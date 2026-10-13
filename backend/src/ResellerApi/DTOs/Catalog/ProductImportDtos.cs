namespace ResellerApi.DTOs.Catalog;

public record ProductImportUpload(string FileName, string Base64);
public record ProductImportRow(int RowNumber, string Sku, string Name, string Category,
    Guid? CategoryId, string Quantity, string BuyPrice, string SellPrice, string? AcknowledgedMatches = null);
public record ProductImportRequest(List<ProductImportRow> Rows, Guid? BranchId, Guid ImportId, Guid? CategoryId = null);
public record ProductImportError(int RowNumber, string Field, string Message);
public record ProductImportMatch(Guid Id, string Name, string Sku, string? ImageUrl, string Category,
    bool IsDeleted, string Status, bool SkuMatch, bool ExactNameMatch, bool SimilarNameMatch);
public record ProductImportRowMatches(int RowNumber, List<ProductImportMatch> Products, int Total,
    int SkuCount, int ExactNameCount, int SimilarNameCount, string? ReviewKey);
public record ProductImportPreview(List<ProductImportRow> Rows, List<ProductImportError> Errors,
    List<ProductImportRowMatches>? Matches = null);
public record ProductImportResult(List<Guid> ProductIds);
