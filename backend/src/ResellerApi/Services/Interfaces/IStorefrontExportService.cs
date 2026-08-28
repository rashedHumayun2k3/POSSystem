using ResellerApi.Entities;

namespace ResellerApi.Services.Interfaces;

public interface IStorefrontExportService
{
    Task<StorefrontExportResult> CreateExportAsync(Business business, CancellationToken cancellationToken = default);
}

public record StorefrontExportResult(byte[] Content, string FileName, string ContentType);

