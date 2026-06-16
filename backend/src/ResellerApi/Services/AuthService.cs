using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.Data;
using ResellerApi.DTOs.Auth;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IActivityLogService _activityLog;

    public AuthService(AppDbContext db, IConfiguration config, IActivityLogService activityLog)
    {
        _db = db;
        _config = config;
        _activityLog = activityLog;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var phone = NormalizePhone(request.Phone);

        var user = await _db.Users
            .AsNoTracking()
            .Include(u => u.BusinessUsers)
                .ThenInclude(bu => bu.Business)
            .FirstOrDefaultAsync(u => u.Phone == phone && u.IsActive);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid phone or password.");

        var businesses = user.BusinessUsers.Select(bu => bu.Business).ToList();
        var firstBusinessId = businesses.FirstOrDefault()?.Id ?? Guid.Empty;

        var (accessToken, refreshTokenValue) = await GenerateTokensAsync(user);

        if (firstBusinessId != Guid.Empty)
            await _activityLog.LogAsync(firstBusinessId, user.Id, "LOGIN", "User");

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            new UserDto(user.Id, user.Name, user.Phone, user.Role),
            businesses.Select(b => new BusinessDto(b.Id, b.Name, b.Currency))
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
            new UserDto(user.Id, user.Name, user.Phone, user.Role),
            businesses.Select(b => new BusinessDto(b.Id, b.Name, b.Currency))
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

    private static string NormalizePhone(string phone)
    {
        phone = phone.Trim();
        if (phone.StartsWith("+88")) phone = phone[3..];
        if (phone.StartsWith("88") && phone.Length > 11) phone = phone[2..];
        return phone;
    }
}
