CREATE OR ALTER PROCEDURE dbo.DashboardExpenseSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT e.Amount,e.ExpenseDate,COALESCE(e.Title,e.SubType,'Expense') Title,COALESCE(c.Name,'Other') Category
 INTO #Expense FROM dbo.expenses e LEFT JOIN dbo.expense_categories c ON c.Id=e.CategoryId AND c.BusinessId=@BusinessId
 WHERE e.BusinessId=@BusinessId AND (@BranchId IS NULL OR e.BranchId=@BranchId) AND e.DeletedAt IS NULL
 AND e.Status='APPROVED' AND e.ExpenseDate>=@First AND e.ExpenseDate<@EndDay;
 SELECT COALESCE((SELECT SUM(Amount) FROM #Expense),0) Total,
 JSON_QUERY((SELECT TOP(10) Category Name,SUM(Amount) Value FROM #Expense GROUP BY Category ORDER BY Value DESC,Category FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(3) Title Name,Amount Value,Category+' · '+CONVERT(varchar(10),ExpenseDate,23) Detail
 FROM #Expense ORDER BY ExpenseDate DESC,Title,Amount DESC FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardOrdersSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT o.* INTO #Orders FROM dbo.orders o WHERE BusinessId=@BusinessId
 AND (@BranchId IS NULL OR BranchId=@BranchId) AND DeletedAt IS NULL AND IsDraft=0;
 DECLARE @Returned int=(SELECT COUNT(*) FROM #Orders WHERE ReturnedAt>=@Start AND ReturnedAt<@End);
 DECLARE @Delivered int=(SELECT COUNT(*) FROM #Orders WHERE DeliveredAt>=@Start AND DeliveredAt<@End
 AND (ReturnedAt IS NULL OR ReturnedAt<@Start OR ReturnedAt>=@End));
 SELECT (SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus NOT IN ('DELIVERED','RETURNED')) Total,
 CASE WHEN @Delivered+@Returned>0 THEN ROUND(CAST(@Returned AS decimal(18,4))*100/(@Delivered+@Returned),1) END ReturnRate,
 @Delivered+@Returned ResolvedOrders,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'New',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus='UNFULFILLED')),
 (2,'Packed',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus='PACKED')),
 (3,'With courier',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus<>'CANCELLED' AND FulfillmentStatus='IN_TRANSIT')),
 (4,'In transit 5+ days',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus<>'CANCELLED' AND FulfillmentStatus='IN_TRANSIT' AND HandedOverAt<DATEADD(day,-5,@End)))) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'Delivered',@Delivered),
 (2,'Returned',@Returned),
 (3,'Cancelled',(SELECT COUNT(*) FROM #Orders o WHERE EXISTS(SELECT 1 FROM dbo.order_status_history h WHERE h.OrderId=o.Id AND h.DeletedAt IS NULL AND h.Track='ORDER' AND h.ToStatus='CANCELLED' AND h.At>=@Start AND h.At<@End)))) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardProductsSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT p.Id,p.CategoryId,COALESCE(SUM(i.Available),0) Available,p.LowStockThreshold INTO #Products FROM dbo.products p
 LEFT JOIN dbo.product_variants v ON v.ProductId=p.Id AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
 OUTER APPLY(SELECT SUM(OnHand-Committed) Available FROM dbo.branch_variant_inventories WHERE VariantId=v.Id AND (@BranchId IS NULL OR BranchId=@BranchId)) i
 WHERE p.BusinessId=@BusinessId AND p.DeletedAt IS NULL AND p.Status='ACTIVE' GROUP BY p.Id,p.CategoryId,p.LowStockThreshold;
 SELECT (SELECT COUNT(*) FROM #Products WHERE Available>0) Total,
 JSON_QUERY((SELECT 'Total active products' Name,COUNT(*) Value,'count' Unit FROM #Products FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'Healthy',(SELECT COUNT(*) FROM #Products WHERE Available>LowStockThreshold)),
 (2,'Low stock',(SELECT COUNT(*) FROM #Products WHERE Available>0 AND Available<=LowStockThreshold)),
 (3,'Out of stock',(SELECT COUNT(*) FROM #Products WHERE Available<=0))) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(10) COALESCE(c.Name,'Uncategorized') Name,COUNT(*) Value,'count' Unit
 FROM #Products p LEFT JOIN dbo.categories c ON c.Id=p.CategoryId AND c.BusinessId=@BusinessId AND c.DeletedAt IS NULL
 GROUP BY c.Id,c.Name ORDER BY Value DESC,Name FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardDuesSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT o.CustomerId,o.CustomerName,o.CustomerPhone,o.CreatedAt,CASE WHEN a.Revenue-p.Paid>0 THEN a.Revenue-p.Paid ELSE 0 END Due
 INTO #Due FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a JOIN dbo.orders o ON o.Id=a.Id
 OUTER APPLY(SELECT COALESCE(SUM(Amount),0) Paid FROM dbo.order_payments WHERE OrderId=a.Id AND DeletedAt IS NULL) p
 WHERE a.OrderStatus<>'CANCELLED' AND a.FulfillmentStatus<>'RETURNED';
 SELECT COALESCE(s.Name,i.ShopName,'Unassigned supplier') Name,i.SupplierId,COALESCE(i.DueAmount,0) Due
 INTO #Payable FROM dbo.purchase_items i JOIN dbo.purchase_trips t ON t.Id=i.TripId
 LEFT JOIN dbo.suppliers s ON s.Id=i.SupplierId AND s.BusinessId=@BusinessId
 WHERE t.BusinessId=@BusinessId AND (@BranchId IS NULL OR t.BranchId=@BranchId) AND t.DeletedAt IS NULL
 AND t.Status NOT IN ('DRAFT','CANCELLED') AND i.DeletedAt IS NULL AND i.DueAmount>0;
 SELECT CustomerId,CustomerName,CustomerPhone,SUM(Due) Due,
 DATEDIFF(day,CONVERT(date,DATEADD(hour,6,MIN(CreatedAt))),@Today) Days
 INTO #Customers FROM #Due WHERE Due>0 GROUP BY CustomerId,CustomerName,CustomerPhone;
 SELECT SupplierId,Name,SUM(Due) Due INTO #Suppliers FROM #Payable GROUP BY SupplierId,Name;
 DECLARE @Receive decimal(28,5)=COALESCE((SELECT SUM(Due) FROM #Due),0),@Pay decimal(28,5)=COALESCE((SELECT SUM(Due) FROM #Payable),0);
 SELECT @Receive-CASE WHEN @CanSeeCosts=1 THEN @Pay ELSE 0 END Total,
 JSON_QUERY((SELECT Name,Value,Count FROM (VALUES('To receive',@Receive,(SELECT COUNT(*) FROM #Customers)),('To pay',CASE WHEN @CanSeeCosts=1 THEN @Pay END,(SELECT COUNT(*) FROM #Suppliers))) v(Name,Value,Count) WHERE Value IS NOT NULL FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT TOP(3) CustomerName Name,Due Value,Days FROM #Customers ORDER BY Value DESC,CustomerName FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(3) Name,Due Value FROM #Suppliers WHERE @CanSeeCosts=1 ORDER BY Value DESC,Name FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardTopSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT p.Id,p.Name,SUM(i.Qty) Quantity,SUM(i.Qty*i.UnitPrice) Sales,SUM(i.Qty*(i.UnitPrice-COALESCE(i.UnitCostSnapshot,0))) Profit,
 SUM(CASE WHEN i.UnitCostSnapshot IS NULL THEN 1 ELSE 0 END) MissingCost
 INTO #Top FROM dbo.order_items i JOIN dbo.orders o ON o.Id=i.OrderId
 JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
 JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId AND p.DeletedAt IS NULL
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId) AND o.DeletedAt IS NULL
 AND o.IsDraft=0 AND o.OrderStatus<>'CANCELLED' AND i.DeletedAt IS NULL AND o.CreatedAt>=@Start AND o.CreatedAt<@End GROUP BY p.Id,p.Name;
 SELECT COALESCE((SELECT SUM(Quantity) FROM #Top),0) Total,
 JSON_QUERY((SELECT TOP(5) Name,Sales Value,Quantity FROM #Top ORDER BY Quantity DESC,Name,Id FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(5) Name,Profit Value,Quantity FROM #Top WHERE @CanSeeCosts=1 AND MissingCost=0 ORDER BY Profit DESC,Name,Id FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardSalesSection
    @BusinessId uniqueidentifier, @BranchId uniqueidentifier = NULL,
    @CanSeeCosts bit = 0, @Period varchar(12) = 'TODAY', @Today date = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @BusinessId IS NULL THROW 51000, 'Business scope is required.', 1;
    IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH') THROW 51000, 'Invalid sales period.', 1;
    SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
    DECLARE @Last date=CASE WHEN @Period='YESTERDAY' THEN DATEADD(day,-1,@Today) ELSE @Today END;
    DECLARE @First date=CASE WHEN @Period='7D' THEN DATEADD(day,-6,@Today)
        WHEN @Period='MONTH' THEN DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1) ELSE @Last END;
    DECLARE @Hourly bit=CASE WHEN @Period IN ('TODAY','YESTERDAY') THEN 1 ELSE 0 END;
    DECLARE @Length int=DATEDIFF(day,@First,@Last)+1;
    DECLARE @PreviousFirst date=DATEADD(day,-@Length,@First);
    DECLARE @Start datetime2=DATEADD(hour,-6,CAST(@PreviousFirst AS datetime2));
    DECLARE @End datetime2=DATEADD(hour,-6,CAST(DATEADD(day,1,@Last) AS datetime2));
    SELECT CONVERT(date,DATEADD(hour,6,a.CreatedAt)) Day, DATEPART(hour,DATEADD(hour,6,a.CreatedAt)) Hour,
        a.Revenue,a.Cogs,a.Units,
        CASE WHEN o.Source='POS' THEN 'OFFLINE'
          WHEN o.Source IN ('CLIENTPAGE','EXTERNAL_WEBSITE') OR o.Channel IN ('FACEBOOK','WHATSAPP','INSTAGRAM','MYWEBSITE') THEN 'ONLINE'
          ELSE 'OFFLINE' END Channel
    INTO #Sales FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a
    JOIN dbo.orders o ON o.Id=a.Id
    WHERE a.CreatedAt>=@Start AND a.CreatedAt<@End AND a.OrderStatus<>'CANCELLED';
    DECLARE @Sales decimal(28,5),@Profit decimal(28,5),@Orders int,@Units decimal(28,5),@Previous decimal(28,5);
    SELECT @Sales=COALESCE(SUM(Revenue),0),@Profit=COALESCE(SUM(Revenue-Cogs),0),@Orders=COUNT(*),@Units=COALESCE(SUM(Units),0)
    FROM #Sales WHERE Day>=@First;
    SELECT @Previous=COALESCE(SUM(Revenue),0) FROM #Sales WHERE Day<@First;
    SELECT @Previous PreviousSales,@Sales Sales, CASE WHEN @CanSeeCosts=1 THEN @Profit END Profit, @Orders Orders,@Units ItemsSold,
        CASE WHEN @Orders>0 THEN ROUND(@Sales/@Orders,2) ELSE 0 END AverageBill,
        CASE WHEN @CanSeeCosts=1 AND @Sales<>0 THEN ROUND(@Profit/@Sales*100,1) END Margin,
        CASE WHEN @Previous>0 THEN ROUND((@Sales-@Previous)/@Previous*100,1) WHEN @Sales=0 THEN 0 END ChangePercent;
    ;WITH Numbers AS (SELECT 0 n UNION ALL SELECT n+1 FROM Numbers WHERE n<30)
    SELECT CASE WHEN @Hourly=1 THEN RIGHT('0'+CAST(n AS varchar(2)),2)+':00'
        ELSE CONVERT(varchar(10),DATEADD(day,n,@First),23) END Label,COALESCE(SUM(s.Revenue),0) Value
    FROM Numbers LEFT JOIN #Sales s ON s.Day>=@First AND
        ((@Hourly=1 AND s.Hour=n) OR (@Hourly=0 AND s.Day=DATEADD(day,n,@First)))
    WHERE n<CASE WHEN @Hourly=1 THEN 24 ELSE @Length END GROUP BY n ORDER BY n;
    SELECT c.Channel,COUNT(s.Channel) Orders,COALESCE(SUM(s.Revenue),0) Sales,
        CASE WHEN @Sales<>0 THEN ROUND(COALESCE(SUM(s.Revenue),0)/@Sales*100,1) ELSE 0 END Share
    FROM (VALUES('ONLINE'),('OFFLINE')) c(Channel)
    LEFT JOIN #Sales s ON s.Channel=c.Channel AND s.Day>=@First GROUP BY c.Channel ORDER BY c.Channel DESC;
END
