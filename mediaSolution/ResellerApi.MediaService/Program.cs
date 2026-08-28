using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using ResellerApi.MediaService.Data;
using ResellerApi.MediaService.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ── EF Core (read-only — business_users/products only, no migrations here) ─
builder.Services.AddDbContext<MediaDbContext>(options =>
    options.UseSqlServer(config.GetConnectionString("Default")));

// ── Auth — validates JWTs issued by the main ResellerApi (same signing key/issuer/audience) ─
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = config["Jwt:Issuer"],
            ValidAudience = config["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!)),
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<MediaStorageService>();

// ── CORS ──────────────────────────────────────────────────────────────────
var allowedOrigins = config.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
    options.AddPolicy("FrontendPolicy", policy =>
        policy.SetIsOriginAllowedToAllowWildcardSubdomains()
              .SetIsOriginAllowed(origin =>
              {
                  if (string.IsNullOrWhiteSpace(origin)) return false;
                  return allowedOrigins.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase));
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ── Rate limiting (customer review-photo uploads) ───────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("clientpage-review", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { code = "RATE_LIMITED", message = "Too many requests. Please try again later." }, token);
    };
});

var app = builder.Build();

// Storage root lives outside wwwroot (see MediaStorageService) so a publish that only
// replaces the app's own output never touches uploaded files.
string storageRootPath;
using (var scope = app.Services.CreateScope())
{
    storageRootPath = scope.ServiceProvider.GetRequiredService<MediaStorageService>().RootPath;
}
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(storageRootPath),
    RequestPath = "/uploads"
});

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.FirstOrDefault();
    if (string.IsNullOrWhiteSpace(origin))
    {
        await next(context);
        return;
    }

    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<MediaDbContext>();
    if (!await IsRegisteredStorefrontOriginAsync(db, origin, context.RequestAborted))
    {
        await next(context);
        return;
    }

    context.Response.OnStarting(() =>
    {
        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.AccessControlAllowHeaders = "Authorization,Content-Type";
        context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
        context.Response.Headers.AccessControlAllowCredentials = "true";
        context.Response.Headers.Vary = "Origin";
        return Task.CompletedTask;
    });

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next(context);
});

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.MapGet("/api/v1/health", async (MediaDbContext db) =>
    await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));

app.Run();

static async Task<bool> IsRegisteredStorefrontOriginAsync(MediaDbContext db, string origin, CancellationToken cancellationToken)
{
    var urls = await db.Businesses
        .AsNoTracking()
        .Where(b => b.DeletedAt == null && b.StorefrontEnabled && b.ExternalWebsiteUrl != null)
        .Select(b => b.ExternalWebsiteUrl!)
        .ToListAsync(cancellationToken);

    return urls.SelectMany(ToOrigins).Contains(origin, StringComparer.OrdinalIgnoreCase);
}

static IEnumerable<string> ToOrigins(string websiteUrl)
{
    if (!Uri.TryCreate(websiteUrl, UriKind.Absolute, out var uri)) yield break;

    yield return $"{uri.Scheme}://{uri.Host}";

    if (uri.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase))
    {
        yield return $"{uri.Scheme}://{uri.Host[4..]}";
    }
    else
    {
        yield return $"{uri.Scheme}://www.{uri.Host}";
    }
}
