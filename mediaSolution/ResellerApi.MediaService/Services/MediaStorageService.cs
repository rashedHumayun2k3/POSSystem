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

    public string GetOwnedImagePath(string url, Guid businessId)
    {
        var prefix = $"/uploads/{businessId}/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal))
            throw new ArgumentException("Only images uploaded to this business can be deleted.");
        var fileName = url[prefix.Length..];
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (fileName != Path.GetFileName(fileName) || fileName.Contains('\\') ||
            !Guid.TryParseExact(Path.GetFileNameWithoutExtension(fileName), "D", out _) ||
            (extension != ".jpg" && extension != ".png" && extension != ".webp"))
            throw new ArgumentException("Invalid uploaded image path.");
        var folder = Path.GetFullPath(Path.Combine(_rootPath, businessId.ToString()));
        var path = Path.GetFullPath(Path.Combine(folder, fileName));
        if (!string.Equals(Path.GetDirectoryName(path), folder, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Invalid uploaded image path.");
        return path;
    }

    public void DeleteOwnedImage(string url, Guid businessId)
    {
        File.Delete(GetOwnedImagePath(url, businessId));
    }

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
