using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class PopularityService : IPopularityService
{
    // Simple, round starting weights — tune once there's real production data to check against,
    // not before. Sales volume counts once, review volume*quality counts double (a handful of
    // sales shouldn't beat a well-reviewed bestseller just because reviews lag behind purchases).
    private const decimal SalesWeight = 1m;
    private const decimal ReviewWeight = 2m;
    private const int SalesWindowDays = 90;

    private readonly AppDbContext _db;

    public PopularityService(AppDbContext db)
    {
        _db = db;
    }

    // Called by Hangfire — runs across every tenant at once (no per-request BusinessContext
    // exists in a background job), so every query below ignores the tenant query filter.
    public async Task RecomputeAsync()
    {
        var since = DateTime.UtcNow.AddDays(-SalesWindowDays);

        // Recent real sales volume per product — excludes cancelled orders, and excludes
        // returned ones even though a returned order can still carry OrderStatus="COMPLETED"
        // (confirmed against seed data), so FulfillmentStatus must be checked separately.
        var salesByProduct = await _db.OrderItems
            .IgnoreQueryFilters()
            .Where(oi => oi.Order.OrderStatus == "COMPLETED" &&
                         oi.Order.FulfillmentStatus != "RETURNED" &&
                         oi.Order.ConfirmedAt != null &&
                         oi.Order.ConfirmedAt >= since)
            .GroupBy(oi => oi.Variant.ProductId)
            .Select(g => new { ProductId = g.Key, UnitsSold = g.Sum(oi => oi.Qty) })
            .ToDictionaryAsync(x => x.ProductId, x => x.UnitsSold);

        // Same aggregate ClientPageCatalogService.GetRatingsAsync computes live per-request —
        // computed once here instead and cached on Product so listing queries can read a plain
        // column. DeletedAt == null excludes hidden reviews, same as the live version.
        var reviewsByProduct = await _db.ProductReviews
            .IgnoreQueryFilters()
            .Where(r => r.DeletedAt == null)
            .GroupBy(r => r.ProductId)
            .Select(g => new { ProductId = g.Key, Average = g.Average(r => r.Rating), Count = g.Count() })
            .ToDictionaryAsync(x => x.ProductId, x => new { x.Average, x.Count });

        var products = await _db.Products
            .IgnoreQueryFilters()
            .Where(p => p.DeletedAt == null)
            .ToListAsync();

        foreach (var product in products)
        {
            var unitsSold = salesByProduct.GetValueOrDefault(product.Id, 0m);
            var hasReviews = reviewsByProduct.TryGetValue(product.Id, out var reviews);

            product.AverageRating = hasReviews ? (decimal)reviews!.Average : null;
            product.ReviewCount = hasReviews ? reviews!.Count : 0;

            var reviewScore = hasReviews ? (decimal)reviews!.Average * reviews.Count : 0m;
            product.PopularityScore = unitsSold * SalesWeight + reviewScore * ReviewWeight;
        }

        await _db.SaveChangesAsync();
    }
}
