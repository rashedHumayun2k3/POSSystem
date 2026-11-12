-- Dashboard reports. Execute with SQL Server/sqlcmd (GO separates object batches).
-- @BusinessId is mandatory; NULL @BranchId means all branches of that business.
-- @Today is optional for deterministic tests; production defaults to Bangladesh today.
CREATE OR ALTER FUNCTION dbo.DashboardRoundEven(@Value decimal(28,10), @Digits int)
RETURNS decimal(28,10)
AS
BEGIN
    DECLARE @Scale decimal(18,0) = POWER(CAST(10 AS decimal(18,0)), @Digits);
    DECLARE @Scaled decimal(32,10) = @Value * @Scale;
    -- FLOOR widens to decimal(38,0); narrow before subtraction to retain the fraction.
    DECLARE @Whole decimal(22,0) = FLOOR(@Scaled);
    RETURN CASE WHEN ABS(@Scaled - @Whole) = 0.5
        THEN (@Whole + CASE WHEN ABS(@Whole) % 2 = 1 THEN 1 ELSE 0 END) / @Scale
        ELSE ROUND(@Value, @Digits) END;
END
GO
CREATE OR ALTER FUNCTION dbo.DashboardOrderAmounts(@BusinessId uniqueidentifier, @BranchId uniqueidentifier)
RETURNS TABLE AS RETURN
(
    SELECT o.Id, o.CreatedAt, o.ReturnedAt, o.OrderStatus, o.FulfillmentStatus, o.CustomerPhone,
        a.Units,
        CAST(a.Subtotal - CASE WHEN o.DiscountType IS NULL OR o.DiscountValue IS NULL THEN 0
             WHEN o.DiscountType = 'PERCENT' THEN dbo.DashboardRoundEven(a.Subtotal * o.DiscountValue / 100, 2)
             ELSE o.DiscountValue END + o.DeliveryChargeCustomer AS decimal(28,5)) AS Revenue,
        CAST(a.Cost + o.DeliveryCostActual AS decimal(28,5)) AS Cogs
    FROM dbo.orders o
    OUTER APPLY (SELECT COALESCE(SUM(i.Qty * i.UnitPrice),0) Subtotal,
        COALESCE(SUM(i.Qty * COALESCE(i.UnitCostSnapshot,0)),0) Cost, COALESCE(SUM(i.Qty),0) Units
        FROM dbo.order_items i WHERE i.OrderId=o.Id AND i.DeletedAt IS NULL) a
    WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
      AND o.DeletedAt IS NULL AND o.IsDraft=0
)
GO
CREATE OR ALTER PROCEDURE dbo.DashboardSalesOverview
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));

DECLARE @Start datetime2 = DATEADD(hour,-6,CAST(DATEADD(day,-6,@Today) AS datetime2));
DECLARE @End datetime2 = DATEADD(hour,-6,CAST(DATEADD(day,1,@Today) AS datetime2));
SELECT CONVERT(date,DATEADD(hour,6,CreatedAt)) Day, Revenue, Cogs, CustomerPhone, Units INTO #Sales
FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId)
WHERE CreatedAt>=@Start AND CreatedAt<@End AND OrderStatus<>'CANCELLED';
DECLARE @Sales decimal(28,5)=COALESCE((SELECT SUM(Revenue) FROM #Sales WHERE Day=@Today),0);
DECLARE @Yesterday decimal(28,5)=COALESCE((SELECT SUM(Revenue) FROM #Sales WHERE Day=DATEADD(day,-1,@Today)),0);
SELECT @Sales TodaySales,
    CASE WHEN @CanSeeCosts=1 THEN COALESCE((SELECT SUM(Revenue-Cogs) FROM #Sales WHERE Day=@Today),0) END TodayProfit,
    (SELECT COUNT(*) FROM #Sales WHERE Day=@Today) TodayOrders, @Yesterday YesterdaySales,
    CASE WHEN @Yesterday>0 THEN dbo.DashboardRoundEven((@Sales-@Yesterday)/@Yesterday*100,1)
         WHEN @Sales=0 THEN CAST(0 AS decimal(28,10)) END ChangePercent,
    COALESCE((SELECT SUM(Revenue) FROM #Sales),0) SevenDaySales,
    (SELECT COUNT(DISTINCT NULLIF(CustomerPhone,'')) FROM #Sales WHERE Day=@Today) TodayCustomers,
    COALESCE((SELECT SUM(Units) FROM #Sales WHERE Day=@Today),0) TodayProductsSold;
SELECT CONVERT(varchar(10),d.Day,23) Label, COALESCE(SUM(s.Revenue),0) Value
FROM (VALUES(0),(1),(2),(3),(4),(5),(6)) n(i)
CROSS APPLY (SELECT DATEADD(day,n.i-6,@Today) Day) d
LEFT JOIN #Sales s ON s.Day=d.Day GROUP BY d.Day ORDER BY d.Day;

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardOrders
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));

DECLARE @Start datetime2=DATEADD(hour,-6,CAST(@Today AS datetime2));
DECLARE @End datetime2=DATEADD(day,1,@Start);
SELECT COALESCE(SUM(CASE WHEN CreatedAt>=@Start AND CreatedAt<@End AND OrderStatus<>'CANCELLED' THEN 1 ELSE 0 END),0) Orders,
    COALESCE(SUM(CASE WHEN ReturnedAt>=@Start AND ReturnedAt<@End THEN 1 ELSE 0 END),0) Returns
FROM dbo.orders WHERE BusinessId=@BusinessId AND (@BranchId IS NULL OR BranchId=@BranchId)
AND DeletedAt IS NULL AND IsDraft=0
AND ((CreatedAt>=@Start AND CreatedAt<@End) OR (ReturnedAt>=@Start AND ReturnedAt<@End));

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardExpenses
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));

SELECT COALESCE(SUM(CASE WHEN ExpenseDate>=@Today THEN Amount ELSE 0 END),0) TodayCost,
    COALESCE(SUM(Amount),0) MonthCost
FROM dbo.expenses WHERE BusinessId=@BusinessId AND (@BranchId IS NULL OR BranchId=@BranchId)
AND DeletedAt IS NULL AND Status='APPROVED'
AND ExpenseDate>=DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1) AND ExpenseDate<DATEADD(day,1,@Today);

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardStock
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));

SELECT COALESCE(SUM(CASE WHEN a.Available>0 AND a.Available<=p.LowStockThreshold THEN 1 ELSE 0 END),0) LowStock,
    COALESCE(SUM(CASE WHEN a.Available<=0 THEN 1 ELSE 0 END),0) OutOfStock
FROM dbo.product_variants v JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId
OUTER APPLY (SELECT COALESCE(SUM(i.OnHand-i.Committed),0) Available
    FROM dbo.branch_variant_inventories i WHERE i.VariantId=v.Id AND (@BranchId IS NULL OR i.BranchId=@BranchId)) a
WHERE v.BusinessId=@BusinessId AND v.DeletedAt IS NULL AND p.DeletedAt IS NULL AND p.Status='ACTIVE';

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardCollections
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));

-- Include actual payments/refunds on returned and cancelled orders.
SELECT p.Method,p.Amount INTO #Payments FROM dbo.order_payments p
JOIN dbo.orders o ON o.Id=p.OrderId
WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL;
DECLARE @Due decimal(28,5);
SELECT @Due=COALESCE(SUM(CASE WHEN o.Revenue-a.Paid>0 THEN o.Revenue-a.Paid ELSE 0 END),0)
FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) o
OUTER APPLY(SELECT COALESCE(SUM(p.Amount),0) Paid FROM dbo.order_payments p WHERE p.OrderId=o.Id AND p.DeletedAt IS NULL) a
WHERE o.OrderStatus<>'CANCELLED' AND o.FulfillmentStatus<>'RETURNED';
SELECT COALESCE(SUM(CASE WHEN Method IN ('CASH','REFUND_CASH') THEN Amount ELSE 0 END),0) Cash,
    COALESCE(SUM(CASE WHEN Method IN ('BKASH','REFUND_BKASH') THEN Amount ELSE 0 END),0) Bkash,
    COALESCE(SUM(CASE WHEN Method IN ('NAGAD','REFUND_NAGAD') THEN Amount ELSE 0 END),0) Nagad,
    COALESCE(SUM(CASE WHEN Method IN ('CARD','REFUND_CARD') THEN Amount ELSE 0 END),0) Card,@Due Due FROM #Payments;

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardTrend
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
DECLARE @Start datetime2=DATEADD(hour,-6,CAST(DATEADD(day,-29,@Today) AS datetime2));
DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Today) AS datetime2));
SELECT CONVERT(date,DATEADD(hour,6,p.ReceivedAt)) Day, SUM(p.Amount) Amount INTO #Days
FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL
AND p.ReceivedAt>=@Start AND p.ReceivedAt<@End GROUP BY CONVERT(date,DATEADD(hour,6,p.ReceivedAt));
WITH n AS (SELECT 0 i UNION ALL SELECT i+1 FROM n WHERE i<29)
SELECT FORMAT(DATEADD(day,n.i-29,@Today),'MMM dd','en-US') Label, COALESCE(d.Amount,0) Value
FROM n LEFT JOIN #Days d ON d.Day=DATEADD(day,n.i-29,@Today) ORDER BY n.i;

END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardPaymentMethods
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
DECLARE @Start datetime2=DATEADD(hour,-6,CAST(DATEADD(day,-29,@Today) AS datetime2));
DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Today) AS datetime2));
SELECT p.Method Name, SUM(p.Amount) Value FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL
AND p.ReceivedAt>=@Start AND p.ReceivedAt<@End GROUP BY p.Method ORDER BY p.Method;
END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardTopProducts
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
DECLARE @Start datetime2=DATEADD(hour,-6,CAST(DATEADD(day,-29,@Today) AS datetime2));
DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Today) AS datetime2));
SELECT TOP (10) p.Name, SUM(i.Qty*i.UnitPrice) Value FROM dbo.order_items i JOIN dbo.orders o ON o.Id=i.OrderId
JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId AND p.DeletedAt IS NULL

WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND o.OrderStatus<>'CANCELLED' AND i.DeletedAt IS NULL
AND o.CreatedAt>=@Start AND o.CreatedAt<@End GROUP BY p.Name ORDER BY Value DESC,p.Name;
END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardCategories
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
DECLARE @Start datetime2=DATEADD(hour,-6,CAST(DATEADD(day,-29,@Today) AS datetime2));
DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Today) AS datetime2));
SELECT c.Name, SUM(i.Qty*i.UnitPrice) Value FROM dbo.order_items i JOIN dbo.orders o ON o.Id=i.OrderId
JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId AND p.DeletedAt IS NULL
JOIN dbo.categories c ON c.Id=p.CategoryId AND c.BusinessId=@BusinessId AND c.DeletedAt IS NULL
WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND o.OrderStatus<>'CANCELLED' AND i.DeletedAt IS NULL
AND o.CreatedAt>=@Start AND o.CreatedAt<@End GROUP BY c.Name ORDER BY Value DESC,c.Name;
END
GO
CREATE OR ALTER PROCEDURE dbo.DashboardHourly
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
DECLARE @Start datetime2=DATEADD(hour,-6,CAST(@Today AS datetime2));
DECLARE @End datetime2=DATEADD(day,1,@Start);
SELECT DATEPART(hour,DATEADD(hour,6,p.ReceivedAt)) Hour, SUM(p.Amount) Amount INTO #Hours
FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId)
AND o.DeletedAt IS NULL AND o.IsDraft=0 AND p.DeletedAt IS NULL
AND p.ReceivedAt>=@Start AND p.ReceivedAt<@End GROUP BY DATEPART(hour,DATEADD(hour,6,p.ReceivedAt));
WITH n AS (SELECT 0 i UNION ALL SELECT i+1 FROM n WHERE i<23)
SELECT RIGHT('0'+CAST(n.i AS varchar(2)),2)+':00' Label,COALESCE(h.Amount,0) Value
FROM n LEFT JOIN #Hours h ON h.Hour=n.i ORDER BY n.i;

END
GO
