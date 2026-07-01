namespace ResellerApi.Services;

public static class OrderMath
{
    public static decimal ComputeDiscount(string? discountType, decimal? discountValue, decimal subtotal)
    {
        if (discountType == null || discountValue == null) return 0;
        return discountType == "PERCENT"
            ? Math.Round(subtotal * discountValue.Value / 100, 2)
            : discountValue.Value;
    }

    public static string ComputePaymentStatus(decimal totalPaid, decimal orderTotal)
    {
        if (totalPaid >= orderTotal) return "PAID";
        if (totalPaid > 0) return "PARTIALLY_PAID";
        return "UNPAID";
    }

    /// <summary>
    /// Maximum discount % before price drops below unit cost (safe discount guard).
    /// </summary>
    public static decimal MaxSafeDiscountPercent(decimal unitCost, decimal unitPrice)
    {
        if (unitPrice <= 0) return 0;
        return Math.Round((1m - unitCost / unitPrice) * 100m, 2);
    }
}
