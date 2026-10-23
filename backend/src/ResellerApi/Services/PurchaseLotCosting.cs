using ResellerApi.Entities;

namespace ResellerApi.Services;

// All money is BDT. Weights are total physical (usable + damaged) line weights, in grams.
public static class PurchaseLotCosting
{
    public record Line(Guid ItemId, decimal AllocatedCost, decimal LandedUnitCost, decimal LossAmount);

    public static List<Line> Allocate(IReadOnlyCollection<PurchaseItem> products,
        IReadOnlyCollection<PurchaseReceiveItem> received, decimal commonCosts, decimal lotCosts,
        bool byWeight)
    {
        var totalValue = products.Sum(i => i.TotalCost);
        decimal Price(PurchaseReceiveItem r)
        {
            var p = products.Single(i => i.Id == r.PurchaseItemId);
            if (p.QtyBought <= 0) throw new InvalidOperationException("Ordered quantity must be positive.");
            return p.TotalCost / p.QtyBought;
        }
        // Include missing pieces in this lot's purchase-value share, but never capitalize their purchase price.
        var value = received.Sum(r => Price(r) * (r.QtyUsable + r.QtyDamaged + r.QtyMissing));
        var pool = Math.Round(lotCosts + (totalValue == 0 ? 0 : commonCosts * value / totalValue), 2);
        var weights = received.Select(r => byWeight ? r.MeasuredWeightGrams
            : Price(r) * (r.QtyUsable + r.QtyDamaged + r.QtyMissing)).ToArray();
        var denominator = weights.Sum();
        // A completely missing lot has no measurable weight. Its entire pool is a loss.
        if (denominator == 0)
            weights = received.Select(r => r.QtyUsable + r.QtyDamaged + r.QtyMissing).ToArray();
        denominator = weights.Sum();
        var allocations = weights.Select(w => denominator == 0 ? 0 : Math.Round(pool * w / denominator, 2)).ToArray();
        if (allocations.Length > 0 && denominator > 0)
        {
            var largest = Array.IndexOf(weights, weights.Max());
            allocations[largest] += pool - allocations.Sum(); // Preserve every paisa.
        }
        return received.Select((r, index) =>
        {
            var physicalCost = Price(r) * (r.QtyUsable + r.QtyDamaged);
            var loss = Price(r) * r.QtyMissing;
            var landed = r.QtyUsable > 0 ? Math.Round((physicalCost + allocations[index]) / r.QtyUsable, 2) : 0;
            if (r.QtyUsable == 0) loss += physicalCost + allocations[index];
            return new Line(r.PurchaseItemId, allocations[index], landed, Math.Round(loss, 2));
        }).ToList();
    }

    public static List<string> WeightWarnings(decimal declared, decimal measured, decimal billed, decimal tolerancePercent)
    {
        var warnings = new List<string>();
        var pairs = new[] { ("Declared", declared, "Measured", measured), ("Declared", declared, "Billed", billed), ("Measured", measured, "Billed", billed) };
        foreach (var (left, a, right, b) in pairs)
            if (a > 0 && b >= 0 && Math.Abs(a - b) / a * 100 > tolerancePercent)
                warnings.Add($"{left} {a:0.###} g vs {right.ToLowerInvariant()} {b:0.###} g exceeds {tolerancePercent:0.##}% tolerance.");
        return warnings;
    }
}
