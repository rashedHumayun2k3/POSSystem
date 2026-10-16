using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class ProductImportService(AppDbContext db, IBusinessContext business, IProductService products)
{
    public async Task<ProductImportPreview> ValidateBatchAsync(ProductImportRequest request)
    {
        if (request.Rows is null || request.Rows.Count is < 1 or > 50 || request.Rows.Any(r => r is null))
            throw new ArgumentException("Upload between 1 and 50 products.");
        var category = request.CategoryId.HasValue
            ? await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CategoryId)
            : null;
        if (category is null) throw new ArgumentException("Select one available category for all products.");
        var preview = await ValidateAsync(request.Rows.Select(row => row.CategoryId.HasValue ? row : row with { CategoryId = category.Id, Category = category.Name }).ToList());
        foreach (var match in preview.Matches ?? [])
            if (match.ReviewKey is not null && preview.Rows.First(r => r.RowNumber == match.RowNumber).AcknowledgedMatches != match.ReviewKey)
                preview.Errors.Add(new(match.RowNumber, "matches", "Review and acknowledge the similar product names before continuing."));
        return preview;
    }

    public async Task<ProductImportPreview> ValidateAsync(List<ProductImportRow>? rows)
    {
        if (rows is null || rows.Count is < 1 or > ProductImportWorkbook.MaxRows)
            throw new ArgumentException("Upload between 1 and 50 products.");
        if (rows.Any(r => r is null || r.RowNumber < 2) || rows.Select(r => r.RowNumber).Distinct().Count() != rows.Count)
            throw new ArgumentException("Invalid spreadsheet row numbers. Upload the file again.");
        var categories = await db.Categories.AsNoTracking().ToListAsync();
        rows = rows.Select(r => r with { Sku = r.Sku?.Trim() ?? "", Name = r.Name?.Trim() ?? "", Category = r.Category?.Trim() ?? "" }).ToList();
        // Read only matching metadata, once per batch. Explicit tenant scoping is required
        // because reserved SKUs include deleted products. No stock/cost data is exposed.
        var catalog = await db.Products.IgnoreQueryFilters().AsNoTracking()
            .Where(p => p.BusinessId == business.CurrentBusinessId)
            .Select(p => new { p.Id, p.Name, p.Sku, p.ImageUrl, p.CategoryId, p.DeletedAt, p.Status }).ToListAsync();
        var normalizedCatalog = catalog.Select(p => new { Product = p, Name = NormalizeName(p.Name), Words = NameWords(NormalizeName(p.Name)) }).ToList();
        var categoryNames = categories.ToDictionary(c => c.Id, c => c.Name);
        var rowMatches = new List<ProductImportRowMatches>();
        var errors = new List<ProductImportError>();
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var normalizedName = NormalizeName(row.Name);
            var words = NameWords(normalizedName);
            var found = normalizedCatalog.Select(item => {
                var p = item.Product;
                var skuMatch = row.Sku.Length > 0 && string.Equals(p.Sku.Trim(), row.Sku, StringComparison.OrdinalIgnoreCase);
                var exact = p.DeletedAt is null && p.Status == "ACTIVE" && normalizedName.Length > 0 && item.Name == normalizedName;
                var similar = p.DeletedAt is null && p.Status == "ACTIVE" && !exact && SimilarNames(normalizedName, item.Name, words, item.Words);
                return new ProductImportMatch(p.Id, p.Name, p.Sku, p.ImageUrl, categoryNames.GetValueOrDefault(p.CategoryId, ""),
                    p.DeletedAt is not null, p.Status, skuMatch, exact, similar);
            }).Where(p => p.SkuMatch || p.ExactNameMatch || p.SimilarNameMatch)
                .OrderByDescending(p => p.SkuMatch).ThenByDescending(p => p.ExactNameMatch)
                .ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ThenBy(p => p.Id).ToList();
            var similarProducts = found.Where(p => p.SimilarNameMatch).ToList();
            var reviewKey = similarProducts.Count == 0 ? null : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
                JsonSerializer.Serialize(new { Name = normalizedName, Sku = row.Sku.ToUpperInvariant(), Products = similarProducts.Select(p => new { p.Id, p.Name, p.Sku }) }))));
            rowMatches.Add(new(row.RowNumber, found.Take(50).ToList(), found.Count, found.Count(p => p.SkuMatch),
                found.Count(p => p.ExactNameMatch), similarProducts.Count, reviewKey));
            void Error(string field, string message) => errors.Add(new(row.RowNumber, field, message));
            if (row.Sku.Length is < 1 or > 50) Error("sku", "Enter an SKU between 1 and 50 characters.");
            else if (found.Any(p => p.SkuMatch)) Error("sku", "SKU is already used by a product in this business (including deleted products).");
            if (row.Sku.Length > 0 && rows.Count(r => r.Sku.Equals(row.Sku, StringComparison.OrdinalIgnoreCase)) > 1) Error("sku", "SKU appears more than once in this file.");
            if (row.Name.Length is < 1 or > 300) Error("name", "Enter a product name between 1 and 300 characters.");
            else if (found.Any(p => p.ExactNameMatch)) Error("name", "An active product with this name already exists.");
            if (row.Name.Length > 0 && rows.Count(r => NormalizeName(r.Name) == normalizedName) > 1) Error("name", "Product name appears more than once in this file.");
            if (!ProductImportWorkbook.TryNumber(row.Quantity, out var qty) || qty <= 0 || qty >= 1000000000m || decimal.Round(qty, 3) != qty) Error("quantity", "Enter a quantity above zero and below 1 billion, with up to 3 decimal places.");
            if (!ProductImportWorkbook.TryNumber(row.BuyPrice, out var cost) || cost < 0 || cost >= 1000000000000m || decimal.Round(cost, 2) != cost) Error("buyPrice", "Enter a buy price of zero or greater and below 1 trillion, with up to 2 decimal places.");
            if (!ProductImportWorkbook.TryNumber(row.SellPrice, out var price) || price <= 0 || price >= 1000000000000m || decimal.Round(price, 2) != price) Error("sellPrice", "Enter a sell price above zero and below 1 trillion, with up to 2 decimal places.");
            var matches = categories.Where(c => c.Name.Equals(row.Category, StringComparison.OrdinalIgnoreCase)).ToList();
            var category = row.CategoryId.HasValue ? categories.FirstOrDefault(c => c.Id == row.CategoryId) : matches.Count == 1 ? matches[0] : null;
            if (category is null) Error("categoryId", "Select an available category.");
            rows[i] = row with { CategoryId = category?.Id, Category = category?.Name ?? row.Category };
        }
        return new(rows, errors, rowMatches);
    }

    private static string NormalizeName(string value) => Regex.Replace(value.Trim().ToLowerInvariant(), @"\s+", " ");

    private static HashSet<string> NameWords(string value) => Regex.Matches(value, @"[\p{L}\p{M}\p{N}]+")
        .Select(m => m.Value).Where(w => w.Length >= 3 && w is not ("the" or "and" or "for" or "with")).ToHashSet();

    private static bool SimilarNames(string left, string right, HashSet<string> leftWords, HashSet<string> rightWords)
    {
        if (left.Length < 3 || right.Length < 3) return false;
        if (leftWords.Count == 0 || rightWords.Count == 0) return false;
        var shared = leftWords.Intersect(rightWords).Count();
        return shared >= 2 || (shared == 1 && (leftWords.Count == 1 || rightWords.Count == 1))
            || (leftWords.Count >= 2 && right.Contains(left)) || (rightWords.Count >= 2 && left.Contains(right));
    }

    public async Task<ProductImportResult> SaveAsync(ProductImportRequest request, Guid userId)
    {
        if (request.ImportId == Guid.Empty) throw new ArgumentException("The import reference is missing. Upload the file again.");
        if (request.Rows is null || request.Rows.Count is < 1 or > 50) throw new ArgumentException("Save between 1 and 50 products.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { request.Rows, request.BranchId, request.CategoryId }))));
        await using var tx = await db.Database.BeginTransactionAsync();
        // A transaction-owned SQL lock serializes imports for this business across API instances.
        var resource = $"product-import:{business.CurrentBusinessId}";
        await db.Database.ExecuteSqlInterpolatedAsync($@"DECLARE @result int;
            EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
            IF @result < 0 THROW 51000, 'Another import is in progress. Please retry.', 1;");
        var receipt = await db.ActivityLogs.AsNoTracking().FirstOrDefaultAsync(a => a.BusinessId == business.CurrentBusinessId
            && a.UserId == userId && a.EntityType == "ProductImport" && a.EntityId == request.ImportId && a.Action == "CREATE");
        if (receipt is not null)
        {
            if (receipt.BeforeJson != JsonSerializer.Serialize(hash)) throw new ArgumentException("This import was already saved with different values. Start a new upload.");
            return JsonSerializer.Deserialize<ProductImportResult>(receipt.AfterJson!)!;
        }
        var branchId = request.BranchId ?? business.CurrentBranchId;
        if (branchId is null || (business.CurrentBranchId.HasValue && business.CurrentBranchId != branchId)
            || !await db.Branches.AnyAsync(b => b.Id == branchId && b.IsActive))
            throw new ArgumentException("Select an active branch in this business before saving opening stock.");
        var preview = await ValidateBatchAsync(request);
        if (preview.Errors.Count > 0) throw new ProductImportValidationException(preview);
        var categories = await db.Categories.AsNoTracking().ToDictionaryAsync(c => c.Id);
        var ids = new List<Guid>();
        foreach (var row in preview.Rows)
        {
            ProductImportWorkbook.TryNumber(row.Quantity, out var qty);
            ProductImportWorkbook.TryNumber(row.BuyPrice, out var cost);
            ProductImportWorkbook.TryNumber(row.SellPrice, out var price);
            var product = await products.CreateAsync(new CreateProductRequest(
                CategoryId: row.CategoryId!.Value, Name: row.Name, ImageUrl: null, Description: null, DefectNotes: null,
                UnitCode: categories[row.CategoryId.Value].DefaultUnit, SellingPrice: price, MarketPrice: null,
                PackagingCostPerUnit: 0, LowStockThreshold: 0, AttributesJson: null, Note: null,
                VariantCombinations: [new(new Dictionary<string, string>(), qty, cost)], BranchId: branchId,
                WarrantyDurationValue: null, WarrantyDurationUnit: null, WholesaleMinQty: null, WholesaleUnitPrice: null,
                WholesaleNote: null, Sku: row.Sku), userId);
            ids.Add(product.Id);
            if (!row.ShowOnMarketplace)
                await products.SetShowOnMarketplaceAsync(product.Id, false, userId);
        }
        var result = new ProductImportResult(ids);
        // Receipt and products commit together; a timeout/retry can return the original result.
        db.ActivityLogs.Add(new ActivityLog { BusinessId = business.CurrentBusinessId, UserId = userId,
            Action = "CREATE", EntityType = "ProductImport", EntityId = request.ImportId, BeforeJson = JsonSerializer.Serialize(hash),
            AfterJson = JsonSerializer.Serialize(result) });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return result;
    }
}

public class ProductImportValidationException(ProductImportPreview preview) : ArgumentException("Correct the highlighted rows before saving.")
{
    public ProductImportPreview Preview { get; } = preview;
}
