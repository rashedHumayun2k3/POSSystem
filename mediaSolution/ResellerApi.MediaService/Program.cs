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
        policy.WithOrigins(allowedOrigins)
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

app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.MapGet("/api/v1/health", async (MediaDbContext db) =>
    await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));

app.Run();
