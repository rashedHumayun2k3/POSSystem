/*
Retire the old, product-specific offer slots for every business.

Preview first (@Apply = 0). When @Apply = 1, this retires unlinked offer slots and restores
the selling price from MarketPrice or the variant's latest Original Price slot where available.
If neither exists, it leaves the current price unchanged. Reusable discount applications are preserved.
*/
SET XACT_ABORT ON;

DECLARE @Apply bit = 0;
DECLARE @Now datetime2 = SYSUTCDATETIME();

BEGIN TRANSACTION;

SELECT
    ps.Id AS SlotId,
    ps.BusinessId,
    ps.VariantId,
    p.Name AS ProductName,
    v.Sku AS VariantSku,
    ps.Label,
    ps.Price,
    ps.IsActive,
    CASE
        WHEN v.PriceOverride IS NOT NULL THEN COALESCE(originalPrice.Price, NULLIF(p.MarketPrice, 0), v.PriceOverride)
        WHEN v.IsDefault = 1 THEN COALESCE(NULLIF(p.MarketPrice, 0), originalPrice.Price, p.SellingPrice)
        ELSE NULL
    END AS ResetPrice,
    v.IsDefault,
    v.PriceOverride AS CurrentPriceOverride
INTO #LegacyOffers
FROM dbo.price_slots AS ps WITH (UPDLOCK, HOLDLOCK)
JOIN dbo.product_variants AS v ON v.Id = ps.VariantId AND v.BusinessId = ps.BusinessId
JOIN dbo.products AS p ON p.Id = v.ProductId AND p.BusinessId = ps.BusinessId
OUTER APPLY
(
    SELECT TOP (1) original.Price
    FROM dbo.price_slots AS original
    WHERE original.BusinessId = ps.BusinessId
      AND original.VariantId = ps.VariantId
      AND original.Label = N'Original Price'
      AND original.DeletedAt IS NULL
    ORDER BY original.CreatedAt DESC, original.Id DESC
) AS originalPrice
WHERE ps.DeletedAt IS NULL
  AND ps.Label <> N'Original Price'
  AND ps.ReusableDiscountId IS NULL;

IF @Apply = 0
BEGIN
    SELECT * FROM #LegacyOffers ORDER BY ProductName, VariantSku, Label;
    SELECT N'Preview only: no changes were made. Set @Apply = 1 to retire these legacy slots.' AS Result;
    ROLLBACK TRANSACTION;
    RETURN;
END;

UPDATE history
SET history.DeactivatedAt = @Now
FROM dbo.price_activation_logs AS history
JOIN #LegacyOffers AS legacy ON legacy.SlotId = history.SlotId
WHERE history.DeactivatedAt IS NULL;

UPDATE v
SET v.PriceOverride = legacy.ResetPrice
FROM dbo.product_variants AS v
JOIN #LegacyOffers AS legacy ON legacy.VariantId = v.Id
WHERE legacy.CurrentPriceOverride IS NOT NULL
  AND legacy.ResetPrice IS NOT NULL;

UPDATE p
SET p.SellingPrice = legacy.ResetPrice
FROM dbo.products AS p
JOIN dbo.product_variants AS v ON v.ProductId = p.Id AND v.BusinessId = p.BusinessId
JOIN #LegacyOffers AS legacy ON legacy.VariantId = v.Id
WHERE v.IsDefault = 1
  AND v.PriceOverride IS NULL
  AND legacy.ResetPrice IS NOT NULL;

UPDATE slot
SET slot.IsActive = 0,
    slot.DeletedAt = @Now,
    slot.UpdatedAt = @Now
FROM dbo.price_slots AS slot
JOIN #LegacyOffers AS legacy ON legacy.SlotId = slot.Id
WHERE slot.DeletedAt IS NULL
  AND slot.ReusableDiscountId IS NULL;

SELECT COUNT_BIG(*) AS RetiredLegacyOffers FROM #LegacyOffers;

COMMIT TRANSACTION;
