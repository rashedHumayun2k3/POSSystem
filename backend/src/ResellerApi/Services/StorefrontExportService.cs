using System.IO.Compression;
using System.Text.Json;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class StorefrontExportService : IStorefrontExportService
{
    private const string DefaultContentType = "application/zip";

    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public StorefrontExportService(IWebHostEnvironment env, IConfiguration config)
    {
        _env = env;
        _config = config;
    }

    public async Task<StorefrontExportResult> CreateExportAsync(Business business, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(business.Subdomain))
            throw new InvalidOperationException("Claim a shop subdomain before downloading your website.");

        if (!business.StorefrontEnabled)
            throw new InvalidOperationException("Turn on your storefront before downloading your website.");

        var templatePath = GetTemplatePath();
        if (!Directory.Exists(templatePath))
            throw new DirectoryNotFoundException($"Storefront template was not found at {templatePath}.");

        await using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var file in Directory.EnumerateFiles(templatePath, "*", SearchOption.AllDirectories))
            {
                cancellationToken.ThrowIfCancellationRequested();

                var relativePath = Path.GetRelativePath(templatePath, file).Replace(Path.DirectorySeparatorChar, '/');
                if (relativePath.Equals("store-config.json", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (relativePath.Equals(".htaccess", StringComparison.OrdinalIgnoreCase) ||
                    relativePath.Equals("web.config", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (relativePath.StartsWith("seller/", StringComparison.OrdinalIgnoreCase))
                    continue;

                archive.CreateEntryFromFile(file, relativePath, CompressionLevel.Fastest);
            }

            var configEntry = archive.CreateEntry("store-config.json", CompressionLevel.Fastest);
            await using (var configStream = configEntry.Open())
            {
                await JsonSerializer.SerializeAsync(configStream, BuildStoreConfig(business), cancellationToken: cancellationToken);
            }

            await AddTextEntryAsync(archive, ".htaccess", """
                <IfModule mod_rewrite.c>
                  RewriteEngine On
                  RewriteBase /
                  RewriteRule ^index\.html$ - [L]
                  RewriteCond %{REQUEST_FILENAME} !-f
                  RewriteCond %{REQUEST_FILENAME} !-d
                  RewriteRule . /index.html [L]
                </IfModule>
                """, cancellationToken);

            await AddTextEntryAsync(archive, "web.config", """
                <?xml version="1.0" encoding="utf-8"?>
                <configuration>
                  <system.webServer>
                    <rewrite>
                      <rules>
                        <rule name="Storefront fallback" stopProcessing="true">
                          <match url=".*" />
                          <conditions logicalGrouping="MatchAll">
                            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                          </conditions>
                          <action type="Rewrite" url="/index.html" />
                        </rule>
                      </rules>
                    </rewrite>
                  </system.webServer>
                </configuration>
                """, cancellationToken);
        }

        return new StorefrontExportResult(output.ToArray(), BuildFileName(business), DefaultContentType);
    }

    private string GetTemplatePath()
    {
        var configured = _config["StorefrontExport:TemplatePath"];
        return string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(_env.ContentRootPath, "StorefrontTemplate")
            : Path.GetFullPath(configured, _env.ContentRootPath);
    }

    private object BuildStoreConfig(Business business) => new
    {
        storeKey = business.Subdomain,
        apiBaseUrl = (_config["StorefrontExport:ApiBaseUrl"] ?? _config["PublicApiBaseUrl"] ?? "https://api.lavlokshan.com/api/v1").TrimEnd('/'),
        mediaBaseUrl = (_config["StorefrontExport:MediaBaseUrl"] ?? _config["PublicMediaBaseUrl"] ?? "https://fileserverapi.lavlokshan.com").TrimEnd('/'),
        shopName = business.Name,
        logoUrl = business.LogoUrl,
        bannerUrl = business.BannerUrl,
        websiteSettings = DeserializeWebsiteSettings(business.WebsiteSettingsJson),
        themeId = NormalizeThemeId(business.StorefrontThemeId),
        storefrontVersion = _config["StorefrontExport:Version"] ?? "1.0.0"
    };

    private static object? DeserializeWebsiteSettings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<object>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string NormalizeThemeId(string? themeId) =>
        themeId is "luxury-dark" or "soft-pastel" or "fresh-green" or "modern-blue" or "warm-sunset"
            ? themeId
            : "clean-light";

    private static async Task AddTextEntryAsync(ZipArchive archive, string path, string content, CancellationToken cancellationToken)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Fastest);
        await using var stream = entry.Open();
        await using var writer = new StreamWriter(stream);
        await writer.WriteAsync(content.AsMemory(), cancellationToken);
    }

    private static string BuildFileName(Business business)
    {
        var source = string.IsNullOrWhiteSpace(business.Subdomain) ? business.Name : business.Subdomain;
        var slug = new string(source.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) ? ch : '-').ToArray());

        while (slug.Contains("--", StringComparison.Ordinal))
            slug = slug.Replace("--", "-", StringComparison.Ordinal);

        slug = slug.Trim('-');
        if (string.IsNullOrWhiteSpace(slug)) slug = "storefront";

        return $"{slug}-website.zip";
    }
}
