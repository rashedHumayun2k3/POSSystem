namespace ResellerApi.MediaService.Services;

public class MediaStorageService
{
    private static readonly Dictionary<string, string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["application/pdf"] = ".pdf",
    };

    private const long MaxBytes = 5 * 1024 * 1024;

    private readonly string _rootPath;

    public MediaStorageService(IConfiguration config, IWebHostEnvironment env)
    {
        var configured = config["Storage:RootPath"];
        _rootPath = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(env.ContentRootPath, "App_Data", "uploads")
            : configured;
        Directory.CreateDirectory(_rootPath);
    }

    public string RootPath => _rootPath;

    public Task<string> SaveImageAsync(IFormFile file, Guid businessId)
    {
        if (file == null || !file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Only JPEG, PNG, or WebP images are allowed.");
        return SaveFileAsync(file, businessId);
    }

    public async Task<string> SaveFileAsync(IFormFile file, Guid businessId)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file was uploaded.");
        if (file.Length > MaxBytes)
            throw new ArgumentException("File must be 5MB or smaller.");
        if (!AllowedContentTypes.TryGetValue(file.ContentType, out var ext))
            throw new ArgumentException("Only JPEG, PNG, WebP, or PDF files are allowed.");

        var folder = Path.Combine(_rootPath, businessId.ToString());
        Directory.CreateDirectory(folder);

        var fileName = $"{Guid.NewGuid()}{ext}";
        var fullPath = Path.Combine(folder, fileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/uploads/{businessId}/{fileName}";
    }
}
