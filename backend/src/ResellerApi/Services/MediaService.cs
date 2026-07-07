using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class MediaService : IMediaService
{
    private static readonly Dictionary<string, string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    private const long MaxBytes = 5 * 1024 * 1024;

    private readonly IWebHostEnvironment _env;
    private readonly IBusinessContext _business;

    public MediaService(IWebHostEnvironment env, IBusinessContext business)
    {
        _env = env;
        _business = business;
    }

    public async Task<string> SaveImageAsync(IFormFile file)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file was uploaded.");
        if (file.Length > MaxBytes)
            throw new ArgumentException("Image must be 5MB or smaller.");
        if (!AllowedContentTypes.TryGetValue(file.ContentType, out var ext))
            throw new ArgumentException("Only JPEG, PNG, or WebP images are allowed.");

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var folder = Path.Combine(webRoot, "uploads", _business.CurrentBusinessId.ToString());
        Directory.CreateDirectory(folder);

        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(folder, fileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/uploads/{_business.CurrentBusinessId}/{fileName}";
    }
}
