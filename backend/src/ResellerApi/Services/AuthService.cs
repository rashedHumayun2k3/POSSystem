using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class AuthService : IAuthService
{
    private const int CodeExpiryMinutes = 10;
    private const int MaxVerifyAttempts = 5;
    private const int VerifiedWindowMinutes = 15;

    private static readonly (string Key, string Value)[] DefaultAppSettings =
    {
        ("low_stock_threshold", "5"),
        ("overhead_mode", "\"AUTO\""),
        ("return_window_days", "7"),
        ("target_margin_pct", "40"),
        ("parked_cart_expiry_minutes", "15"),
        ("refund_approval_threshold", "500"),
        ("staff_free_discount_pct", "5")
    };

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IActivityLogService _activityLog;
    private readonly IEmailSender _emailSender;
    private readonly ISubscriptionService _subscriptions;

    public AuthService(AppDbContext db, IConfiguration config, IActivityLogService activityLog,
        IEmailSender emailSender, ISubscriptionService subscriptions)
    {
        _db = db;
        _config = config;
        _activityLog = activityLog;
        _emailSender = emailSender;
        _subscriptions = subscriptions;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var phone = PhoneNormalizer.Normalize(request.Phone);

        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.Company)
            .Include(u => u.BusinessUsers)
                .ThenInclude(bu => bu.Business)
            .FirstOrDefaultAsync(u => u.Phone == phone && u.IsActive);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid phone or password.");

        if (user.Company.Status != "ACTIVE")
            throw new UnauthorizedAccessException("This account has been deactivated. Contact support.");

        var businesses = user.BusinessUsers.Select(bu => bu.Business).ToList();
        var firstBusinessId = businesses.FirstOrDefault()?.Id ?? Guid.Empty;

        var (accessToken, refreshTokenValue) = await GenerateTokensAsync(user);

        if (firstBusinessId != Guid.Empty)
            await _activityLog.LogAsync(firstBusinessId, user.Id, "LOGIN", "User");

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            MapUserDto(user),
            businesses.Select(MapBusinessDto)
        );
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.BusinessUsers)
                    .ThenInclude(bu => bu.Business)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken && !rt.IsRevoked && rt.ExpiresAt > DateTime.UtcNow);

        if (stored is null)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        stored.IsRevoked = true;
        var user = stored.User;
        var businesses = user.BusinessUsers.Select(bu => bu.Business).ToList();

        var (accessToken, refreshTokenValue) = await GenerateTokensAsync(user);
        await _db.SaveChangesAsync();

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            MapUserDto(user),
            businesses.Select(MapBusinessDto)
        );
    }

    public async Task RevokeAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);
        if (stored is null) return;
        stored.IsRevoked = true;
        await _db.SaveChangesAsync();
    }

    // ── Sign up ───────────────────────────────────────────────────────────

    public async Task RequestSignupCodeAsync(RequestSignupCodeRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("This email is already registered.");

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        _db.EmailVerifications.Add(new EmailVerification
        {
            Email = email,
            CodeHash = HashVerificationCode(code),
            Purpose = EmailVerificationPurpose.Signup,
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeExpiryMinutes)
        });
        await _db.SaveChangesAsync();

        await _emailSender.SendVerificationCodeAsync(email, code);
    }

    public async Task VerifySignupCodeAsync(VerifySignupCodeRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var verification = await _db.EmailVerifications
            .Where(v => v.Email == email && v.Purpose == EmailVerificationPurpose.Signup &&
                        v.ExpiresAt > DateTime.UtcNow && v.VerifiedAt == null)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        if (verification is null)
            throw new InvalidOperationException("No active verification code found. Please request a new code.");

        if (verification.Attempts >= MaxVerifyAttempts)
            throw new InvalidOperationException("Too many incorrect attempts. Please request a new code.");

        if (verification.CodeHash != HashVerificationCode(request.Code.Trim()))
        {
            verification.Attempts++;
            await _db.SaveChangesAsync();
            throw new InvalidOperationException("Incorrect verification code.");
        }

        verification.VerifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // Alternative to the request-code/verify-code pair above — proves email ownership via a
    // Google ID token instead of a mailed code. Produces the exact same EmailVerification row
    // shape (Purpose=Signup, VerifiedAt set), so CompleteSignupAsync needs no changes to accept
    // either path. Both paths stay independently available on the signup page.
    public async Task<string> VerifySignupEmailViaGoogleAsync(GoogleVerifyEmailRequest request)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_config["Google:ClientId"]]
            });
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedAccessException("Invalid Google sign-in token.");
        }

        if (payload.EmailVerified != true)
            throw new UnauthorizedAccessException("Google account email is not verified.");

        var email = payload.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("This email is already registered.");

        // No real code involved — the row still needs *a* CodeHash to satisfy the NOT NULL
        // column; this throwaway value is stored but never checked again since VerifiedAt is
        // set immediately below.
        var throwawayCode = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        _db.EmailVerifications.Add(new EmailVerification
        {
            Email = email,
            CodeHash = HashVerificationCode(throwawayCode),
            Purpose = EmailVerificationPurpose.Signup,
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeExpiryMinutes),
            VerifiedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return email;
    }

    public async Task<AuthResponse> CompleteSignupAsync(SignUpRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var phone = PhoneNormalizer.Normalize(request.Phone);

        var verification = await _db.EmailVerifications
            .Where(v => v.Email == email && v.Purpose == EmailVerificationPurpose.Signup && v.VerifiedAt != null)
            .OrderByDescending(v => v.VerifiedAt)
            .FirstOrDefaultAsync();

        if (verification is null || verification.VerifiedAt < DateTime.UtcNow.AddMinutes(-VerifiedWindowMinutes))
            throw new InvalidOperationException("Email not verified. Please verify your email first.");

        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("This email is already registered.");

        if (await _db.Users.AnyAsync(u => u.Phone == phone))
            throw new InvalidOperationException("This phone number is already registered.");

        Company company;
        Business business;
        User owner;

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            company = new Company { Name = request.BusinessName.Trim() };
            _db.Companies.Add(company);

            business = new Business
            {
                CompanyId = company.Id,
                Name = request.BusinessName.Trim(),
                Currency = "BDT",
                Country = string.IsNullOrWhiteSpace(request.Country) ? null : request.Country.Trim()
            };
            _db.Businesses.Add(business);

            owner = new User
            {
                CompanyId = company.Id,
                Name = request.Name.Trim(),
                Phone = phone,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = Roles.Owner,
                IsActive = true
            };
            _db.Users.Add(owner);

            _db.BusinessUsers.Add(new BusinessUser { BusinessId = business.Id, UserId = owner.Id });

            _db.Branches.Add(new Branch
            {
                BusinessId = business.Id,
                Name = "Main Branch",
                Code = "MAIN",
                IsActive = true,
                IsDefault = true
            });

            // Every business gets a working delivery charge out of the box — otherwise the
            // ClientPage storefront silently charges ৳0 delivery until an owner thinks to visit
            // Settings → Couriers. Rates are editable there like any other courier.
            _db.Couriers.Add(new Courier
            {
                BusinessId = business.Id,
                Name = "Default Courier",
                InsideDhakaCharge = 60,
                OutsideDhakaCharge = 120,
                IsDefault = true,
                IsActive = true
            });

            foreach (var (key, value) in DefaultAppSettings)
            {
                _db.AppSettings.Add(new AppSetting { BusinessId = business.Id, Key = key, ValueJson = value });
            }

            await _db.SaveChangesAsync();
            await _subscriptions.StartTrialAsync(company.Id);
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        var (accessToken, refreshTokenValue) = await GenerateTokensAsync(owner);
        await _activityLog.LogAsync(business.Id, owner.Id, "SIGNUP", "Business", business.Id);

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            MapUserDto(owner),
            new[] { MapBusinessDto(business) }
        );
    }

    // ── Forgot password ──────────────────────────────────────────────────

    // Deliberately explicit on a non-match (unknown email, no-email user, inactive user) — Owner
    // requested a direct "no account for this email" message here rather than the anti-enumeration
    // silent no-op signup's RequestSignupCodeAsync above uses. The "Can't remember your email?"
    // flow (FindMyEmailAsync) is the safer, more controlled path for account discovery; this one
    // trades that safety for a clearer user experience by explicit request.
    public async Task RequestPasswordResetCodeAsync(RequestPasswordResetRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive);
        if (user is null)
            throw new InvalidOperationException(
                "This email address is not set for any business. Please check the email address you used when setting up your business.");

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        _db.EmailVerifications.Add(new EmailVerification
        {
            Email = email,
            CodeHash = HashVerificationCode(code),
            Purpose = EmailVerificationPurpose.PasswordReset,
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeExpiryMinutes)
        });
        await _db.SaveChangesAsync();

        await _emailSender.SendPasswordResetCodeAsync(email, code);
    }

    public async Task VerifyPasswordResetCodeAsync(VerifyPasswordResetRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var verification = await _db.EmailVerifications
            .Where(v => v.Email == email && v.Purpose == EmailVerificationPurpose.PasswordReset &&
                        v.ExpiresAt > DateTime.UtcNow && v.VerifiedAt == null)
            .OrderByDescending(v => v.CreatedAt)
            .FirstOrDefaultAsync();

        if (verification is null)
            throw new InvalidOperationException("No active verification code found. Please request a new code.");

        if (verification.Attempts >= MaxVerifyAttempts)
            throw new InvalidOperationException("Too many incorrect attempts. Please request a new code.");

        if (verification.CodeHash != HashVerificationCode(request.Code.Trim()))
        {
            verification.Attempts++;
            await _db.SaveChangesAsync();
            throw new InvalidOperationException("Incorrect verification code.");
        }

        verification.VerifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task CompletePasswordResetAsync(CompletePasswordResetRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var verification = await _db.EmailVerifications
            .Where(v => v.Email == email && v.Purpose == EmailVerificationPurpose.PasswordReset && v.VerifiedAt != null)
            .OrderByDescending(v => v.VerifiedAt)
            .FirstOrDefaultAsync();

        if (verification is null || verification.VerifiedAt < DateTime.UtcNow.AddMinutes(-VerifiedWindowMinutes))
            throw new InvalidOperationException("Email not verified. Please verify your email first.");

        // Re-fetch by email rather than trusting a client-supplied id — the verified email is the
        // only identity anchor carried across these three calls.
        var user = await _db.Users
            .Include(u => u.BusinessUsers).ThenInclude(bu => bu.Business)
            .FirstOrDefaultAsync(u => u.Email == email && u.IsActive);

        if (user is null)
            throw new InvalidOperationException("Unable to reset password. Please start over.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();

        await RevokeAllTokensForUserAsync(user.Id);

        var firstBusinessId = user.BusinessUsers.Select(bu => bu.Business.Id).FirstOrDefault();
        if (firstBusinessId != Guid.Empty)
            await _activityLog.LogAsync(firstBusinessId, user.Id, "PASSWORD_RESET", "User", user.Id);
    }

    // Separate, more controlled lookup than the anti-enumeration forgot-password flow above: an
    // Owner who forgot their signup email supplies their login phone number + shop name instead.
    // Matching both together is a much higher guessing bar than a single email, so a definite
    // "not found" is safe to return here — but a match still only reveals a masked email, never
    // the full address, and "matched phone, no shop match" collapses into the same Found=false
    // response as "no matching phone at all" to avoid leaking partial-match information.
    public async Task<FindMyEmailResponse> FindMyEmailAsync(FindMyEmailRequest request)
    {
        var phone = PhoneNormalizer.Normalize(request.Phone);
        var shopName = request.ShopName.Trim();

        var user = await _db.Users
            .Include(u => u.Company).ThenInclude(c => c.Businesses)
            .FirstOrDefaultAsync(u => u.Phone == phone && u.Role == Roles.Owner && u.IsActive);

        if (user is null || string.IsNullOrEmpty(user.Email))
            return new FindMyEmailResponse(false, null);

        var shopMatches = user.Company.Businesses.Any(b =>
            b.Name.Trim().Equals(shopName, StringComparison.OrdinalIgnoreCase));

        if (!shopMatches)
            return new FindMyEmailResponse(false, null);

        return new FindMyEmailResponse(true, EmailMasker.Mask(user.Email));
    }

    private async Task RevokeAllTokensForUserAsync(Guid userId)
    {
        var tokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync();
        foreach (var token in tokens)
            token.IsRevoked = true;
        await _db.SaveChangesAsync();
    }

    private static string HashVerificationCode(string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

    private static UserDto MapUserDto(User user) => new(user.Id, user.Name, user.Phone, user.Email, user.Role, user.PhotoUrl);

    private static BusinessDto MapBusinessDto(Business business) => new(
        business.Id, business.Name, business.Currency, business.Country,
        BusinessTypes.ParseJson(business.BusinessTypesJson),
        SalesChannels.ParseJson(business.SalesChannelsJson), business.OnboardingCompletedAt != null);

    private async Task<(string AccessToken, string RefreshToken)> GenerateTokensAsync(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("company_id", user.CompanyId.ToString())
        };

        var jwtToken = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:AccessTokenMinutes"] ?? "60")),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwtToken);

        var refreshTokenValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(int.Parse(_config["Jwt:RefreshTokenDays"] ?? "30"))
        };
        _db.RefreshTokens.Add(refreshTokenEntity);
        await _db.SaveChangesAsync();

        return (accessToken, refreshTokenValue);
    }
}
