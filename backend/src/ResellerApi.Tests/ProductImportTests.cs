using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Catalog;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public class ProductImportTests
{
    private static ProductImportUpload Workbook(Action<IXLWorksheet> fill)
    {
        using var book = new XLWorkbook(new MemoryStream(ProductImportWorkbook.Template()));
        fill(book.Worksheet("Products"));
        using var stream = new MemoryStream();
        book.SaveAs(stream);
        return new("renamed-template.xlsx", Convert.ToBase64String(stream.ToArray()));
    }

    private static void Fill(IXLWorksheet sheet, int row = 2)
    {
        sheet.Cell(row, 1).Value = "00123";
        sheet.Cell(row, 2).Value = "Cotton Shirt";
        sheet.Cell(row, 3).Value = 1.125;
        sheet.Cell(row, 4).Value = 0;
        sheet.Cell(row, 5).Value = 400.25;
    }

    [Fact]
    public void TemplateRoundTripPreservesLeadingZerosAndNumericValues()
    {
        var rows = ProductImportWorkbook.Read(Workbook(s => Fill(s)));
        var row = Assert.Single(rows);
        Assert.Equal("00123", row.Sku);
        Assert.Equal("1.125", row.Quantity);
        Assert.Equal("0", row.BuyPrice);
        Assert.Equal("400.25", row.SellPrice);
        Assert.Null(row.CategoryId);
    }

    [Fact]
    public void BlankRowsAreIgnoredAndOriginalRowNumbersPreserved()
    {
        var row = Assert.Single(ProductImportWorkbook.Read(Workbook(s => Fill(s, 8))));
        Assert.Equal(8, row.RowNumber);
    }

    [Theory]
    [InlineData(50, true)]
    [InlineData(51, false)]
    public void EnforcesFiftyProductLimit(int count, bool valid)
    {
        var file = Workbook(s => { for (int i = 2; i <= count + 1; i++) Fill(s, i); });
        if (valid) Assert.Equal(count, ProductImportWorkbook.Read(file).Count);
        else Assert.Contains("Maximum 50", Assert.Throws<ArgumentException>(() => ProductImportWorkbook.Read(file)).Message);
    }

    [Fact]
    public void ReorderedHeadersAreAccepted()
    {
        var row = Assert.Single(ProductImportWorkbook.Read(Workbook(s => {
            Fill(s); s.Cell(1, 1).Value = "Product Name"; s.Cell(1, 2).Value = "Product SKU";
            s.Cell(2, 1).Value = "Shirt"; s.Cell(2, 2).Value = "0001";
        })));
        Assert.Equal("0001", row.Sku);
        Assert.Equal("Shirt", row.Name);
    }

    [Fact]
    public void RejectsMissingHeaders() => Assert.Throws<ArgumentException>(() => ProductImportWorkbook.Read(Workbook(s => { Fill(s); s.Cell(1, 2).Clear(); })));

    [Fact]
    public void RejectsEmptyTemplate() => Assert.Throws<ArgumentException>(() => ProductImportWorkbook.Read(Workbook(_ => { })));

    [Fact]
    public void RejectsFormulaCells() => Assert.Contains("formulas", Assert.Throws<ArgumentException>(() => ProductImportWorkbook.Read(Workbook(s => { Fill(s); s.Cell(2, 5).FormulaA1 = "1+1"; }))).Message);

    [Fact]
    public void DoesNotSilentlyRoundPricesFromCellFormatting()
    {
        var row = Assert.Single(ProductImportWorkbook.Read(Workbook(s => { Fill(s); s.Cell(2, 5).Value = 1.2345; })));
        Assert.Equal("1.2345", row.SellPrice);
    }

    [Theory]
    [InlineData("data.csv", "U0tVLE5hbWU=")]
    [InlineData("data.xlsx", "U0tVLE5hbWU=")]
    [InlineData("data.xlsx", "not-base64")]
    public void RejectsWrongFormatAndCorruptFiles(string name, string data) => Assert.Throws<ArgumentException>(() => ProductImportWorkbook.Read(new(name, data)));

    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext context) : AppDbContext(options, context)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<BaseEntity>())
                if (entry.State == EntityState.Added) entry.Entity.RowVer = Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }

    private static ProductImportRow Row(int number = 2, string sku = "NEW-1", string name = "New product") => new(number, sku, name, "Clothing", null, "1", "0", "10");

    [Fact]
    public async Task MatchesAreBusinessScopedDeduplicatedAndIncludeImagesAndDeletedSkus()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var category = new Category { BusinessId = business.CurrentBusinessId, Name = "Clothing" };
        db.Categories.Add(category);
        var exact = new Product { BusinessId = business.CurrentBusinessId, Category = category, Name = "Cotton   Shirt", Sku = "EXACT", ImageUrl = "/shirt.png" };
        var similar = new Product { BusinessId = business.CurrentBusinessId, Category = category, Name = "Cotton Shirt Blue", Sku = "BLUE" };
        var deleted = new Product { BusinessId = business.CurrentBusinessId, Name = "Old Shirt", Sku = "DELETED", DeletedAt = DateTime.UtcNow };
        db.Products.AddRange(exact, similar, deleted, new Product { BusinessId = Guid.NewGuid(), Name = "Cotton Shirt", Sku = "EXACT" });
        await db.SaveChangesAsync();
        var result = await new ProductImportService(db, business, null!).ValidateAsync([Row(sku: " exact ", name: " cotton shirt "), Row(3, "deleted", "Different thing")]);
        var matches = result.Matches![0];
        Assert.Equal(2, matches.Total);
        Assert.Equal(1, matches.ExactNameCount); Assert.Equal(1, matches.SimilarNameCount); Assert.Equal(1, matches.SkuCount);
        var same = Assert.Single(matches.Products.Where(p => p.Id == exact.Id));
        Assert.True(same.SkuMatch && same.ExactNameMatch); Assert.Equal("/shirt.png", same.ImageUrl); Assert.Equal("Clothing", same.Category);
        Assert.True(Assert.Single(result.Matches[1].Products).IsDeleted);
        Assert.Contains(result.Errors, e => e.RowNumber == 2 && e.Field == "name");
    }

    [Fact]
    public async Task SimilarNamesRequireAcknowledgmentAndNewMatchesInvalidateIt()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var category = new Category { BusinessId = business.CurrentBusinessId, Name = "Clothing" };
        db.Categories.Add(category);
        db.Products.Add(new Product { BusinessId = business.CurrentBusinessId, Name = "Cotton Shirt Blue", Sku = "BLUE" });
        await db.SaveChangesAsync();
        var service = new ProductImportService(db, business, null!);
        var request = new ProductImportRequest([Row(name: "Cotton Shirt Red")], null, Guid.NewGuid(), category.Id);
        var initial = await service.ValidateBatchAsync(request);
        Assert.Contains(initial.Errors, e => e.Field == "matches");
        request = request with { Rows = [request.Rows[0] with { AcknowledgedMatches = initial.Matches![0].ReviewKey }] };
        Assert.Empty((await service.ValidateBatchAsync(request)).Errors);
        db.Products.Add(new Product { BusinessId = business.CurrentBusinessId, Name = "Cotton Shirt Green", Sku = "GREEN" });
        await db.SaveChangesAsync();
        var updated = await service.ValidateBatchAsync(request);
        Assert.Contains(updated.Errors, e => e.Field == "matches");
        Assert.NotEqual(initial.Matches![0].ReviewKey, updated.Matches![0].ReviewKey);
    }

    [Fact]
    public async Task MatchingAvoidsShortFragmentsAndCapsDetailsButKeepsTotal()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        for (var i = 0; i < 55; i++) db.Products.Add(new Product { BusinessId = business.CurrentBusinessId, Name = $"Cotton Shirt {i}", Sku = $"SHIRT-{i}" });
        await db.SaveChangesAsync();
        var service = new ProductImportService(db, business, null!);
        var result = await service.ValidateAsync([Row(name: "Cotton Shirt Red"), Row(3, "SECOND", "ot")]);
        Assert.Equal(55, result.Matches![0].Total); Assert.Equal(50, result.Matches[0].Products.Count);
        Assert.Empty(result.Matches[1].Products);
    }

    [Fact]
    public void TemplateHasNoCategoryAndWholeQuantitiesHaveNoTrailingDot()
    {
        using var book = new XLWorkbook(new MemoryStream(ProductImportWorkbook.Template()));
        var sheet = book.Worksheet("Products");
        Assert.Equal(5, sheet.Row(1).CellsUsed().Count());
        Assert.DoesNotContain(sheet.Row(1).CellsUsed(), c => c.GetString() == "Category");
        sheet.Cell("C2").Value = 10;
        Assert.Equal("10", sheet.Cell("C2").GetFormattedString(System.Globalization.CultureInfo.InvariantCulture));
        sheet.Cell("C2").Value = 1.125;
        Assert.Equal("1.125", sheet.Cell("C2").GetFormattedString(System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task BatchRequiresOneCategoryAndAppliesItToEveryRow()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var category = new Category { BusinessId = business.CurrentBusinessId, Name = "Clothing" };
        db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new ProductImportService(db, business, null!);
        var request = new ProductImportRequest([Row(), Row(3, "NEW-2", "Second product") with { CategoryId = Guid.NewGuid(), Category = "Wrong category" }], null, Guid.NewGuid());
        await Assert.ThrowsAsync<ArgumentException>(() => service.ValidateBatchAsync(request));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ValidateBatchAsync(request with { CategoryId = Guid.NewGuid() }));
        var result = await service.ValidateBatchAsync(request with { CategoryId = category.Id });
        Assert.Empty(result.Errors);
        Assert.All(result.Rows, row => { Assert.Equal(category.Id, row.CategoryId); Assert.Equal("Clothing", row.Category); });
    }

    [Fact]
    public async Task ValidationChecksDeletedSkusAndBusinessBoundaries()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var category = new Category { BusinessId = business.CurrentBusinessId, Name = "Clothing" };
        db.Categories.Add(category);
        db.Products.AddRange(
            new Product { BusinessId = business.CurrentBusinessId, Sku = "USED", Name = "Deleted", DeletedAt = DateTime.UtcNow },
            new Product { BusinessId = Guid.NewGuid(), Sku = "OTHER", Name = "New product" });
        await db.SaveChangesAsync();
        var service = new ProductImportService(db, business, null!);
        var blocked = await service.ValidateAsync([Row(sku: " used ")]);
        Assert.Contains(blocked.Errors, e => e.Field == "sku");
        var allowed = await service.ValidateAsync([Row(sku: "OTHER")]);
        Assert.Empty(allowed.Errors);
        Assert.Equal(category.Id, allowed.Rows[0].CategoryId);
    }

    [Fact]
    public async Task ValidationDetectsFileDuplicatesAndInvalidNumbersAndCategory()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var result = await new ProductImportService(db, business, null!).ValidateAsync([
            Row() with { Quantity = "0", BuyPrice = "-1", SellPrice = "1.234" }, Row(3, "new-1", "new PRODUCT")]);
        Assert.Equal(2, result.Errors.Count(e => e.Field == "sku"));
        Assert.Equal(2, result.Errors.Count(e => e.Field == "name"));
        Assert.Contains(result.Errors, e => e.Field == "quantity");
        Assert.Contains(result.Errors, e => e.Field == "buyPrice");
        Assert.Contains(result.Errors, e => e.Field == "sellPrice");
        Assert.Equal(2, result.Errors.Count(e => e.Field == "categoryId"));
    }

    [Fact]
    public async Task ValidationRejectsForeignCategoryAndOverLimitRequests()
    {
        var business = new BusinessContext { CurrentBusinessId = Guid.NewGuid() };
        await using var db = new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, business);
        var category = new Category { BusinessId = Guid.NewGuid(), Name = "Clothing" };
        db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new ProductImportService(db, business, null!);
        var result = await service.ValidateAsync([Row() with { CategoryId = category.Id }]);
        Assert.Contains(result.Errors, e => e.Field == "categoryId");
        await Assert.ThrowsAsync<ArgumentException>(() => service.ValidateAsync(Enumerable.Range(2, 51).Select(i => Row(i)).ToList()));
    }
}
