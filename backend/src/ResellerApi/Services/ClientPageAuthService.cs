using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.Data;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ClientPageAuthService : IClientPageAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;

    public ClientPageAuthService(AppDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _config = config;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<ClientPageAuthResponse> GoogleLoginAsync(GoogleLoginRequest request)
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

        var account = await _db.ClientPageCustomerAccounts.FirstOrDefaultAsync(a => a.GoogleId == payload.Subject);
        if (account is null)
        {
            account = new ClientPageCustomerAccount
            {
                GoogleId = payload.Subject,
                Email = payload.Email,
                Name = payload.Name ?? payload.Email,
                PhotoUrl = payload.Picture
            };
            _db.ClientPageCustomerAccounts.Add(account);
        }
        else
        {
            // Keep the profile fresh in case they change their Google name/photo later.
            account.Name = payload.Name ?? account.Name;
            account.PhotoUrl = payload.Picture ?? account.PhotoUrl;
        }
        await _db.SaveChangesAsync();
        return IssueToken(account);
    }

    public async Task<ClientPageAuthResponse> FacebookLoginAsync(FacebookLoginRequest request)
    {
        var appId = _config["Facebook:AppId"];
        var appSecret = _config["Facebook:AppSecret"];
        if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(appSecret))
            throw new UnauthorizedAccessException("Facebook sign-in isn't configured.");

        var http = _httpClientFactory.CreateClient();

        // Verify the token was actually issued for OUR app before trusting it — otherwise a
        // client could hand us a valid access token minted for an unrelated Facebook app/site.
        FacebookDebugTokenResponse? debug;
        try
        {
            debug = await http.GetFromJsonAsync<FacebookDebugTokenResponse>(
                $"https://graph.facebook.com/debug_token?input_token={Uri.EscapeDataString(request.AccessToken)}&access_token={Uri.EscapeDataString(appId)}|{Uri.EscapeDataString(appSecret)}");
        }
        catch (HttpRequestException)
        {
            throw new UnauthorizedAccessException("Could not verify Facebook sign-in token.");
        }
        if (debug?.Data is not { IsValid: true } data || data.AppId != appId)
            throw new UnauthorizedAccessException("Invalid Facebook sign-in token.");

        FacebookProfileResponse? profile;
        try
        {
            profile = await http.GetFromJsonAsync<FacebookProfileResponse>(
                $"https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token={Uri.EscapeDataString(request.AccessToken)}");
        }
        catch (HttpRequestException)
        {
            throw new UnauthorizedAccessException("Could not read Facebook profile.");
        }
        if (profile is null)
            throw new UnauthorizedAccessException("Could not read Facebook profile.");

        var account = await _db.ClientPageCustomerAccounts.FirstOrDefaultAsync(a => a.FacebookId == profile.Id);
        if (account is null)
        {
            account = new ClientPageCustomerAccount
            {
                FacebookId = profile.Id,
                Email = profile.Email,
                Name = profile.Name,
                PhotoUrl = profile.Picture?.Data?.Url
            };
            _db.ClientPageCustomerAccounts.Add(account);
        }
        else
        {
            // Keep the profile fresh in case they change their Facebook name/photo later.
            account.Name = profile.Name ?? account.Name;
            account.PhotoUrl = profile.Picture?.Data?.Url ?? account.PhotoUrl;
        }
        await _db.SaveChangesAsync();
        return IssueToken(account);
    }

    private ClientPageAuthResponse IssueToken(ClientPageCustomerAccount account)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.Name),
            new Claim(ClaimTypes.Role, Roles.ClientPageCustomer),
            new Claim("customer_account_id", account.Id.ToString())
        };

        var jwtToken = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwtToken);
        return new ClientPageAuthResponse(accessToken, account.Name, account.PhotoUrl);
    }
}
