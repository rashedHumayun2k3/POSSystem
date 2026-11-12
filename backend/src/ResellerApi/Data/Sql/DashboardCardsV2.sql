-- Dashboard card procedures v2: read existing schema only.
CREATE OR ALTER FUNCTION dbo.DashboardCardRange(@Period varchar(12), @Today date)
RETURNS TABLE AS RETURN (
 SELECT FirstDay, DATEADD(day,1,LastDay) EndDay,
 DATEADD(hour,-6,CAST(FirstDay AS datetime2)) StartUtc,
 DATEADD(hour,-6,CAST(DATEADD(day,1,LastDay) AS datetime2)) EndUtc
 FROM (SELECT CASE @Period WHEN 'TODAY' THEN @Today WHEN 'YESTERDAY' THEN DATEADD(day,-1,@Today)
 WHEN '7D' THEN DATEADD(day,-6,@Today) WHEN 'MONTH' THEN DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1)
 ELSE CONVERT(date,'19000101') END FirstDay,
 CASE WHEN @Period='YESTERDAY' THEN DATEADD(day,-1,@Today) ELSE @Today END LastDay) d
);

GO
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
 JSON_QUERY((SELECT Category Name,SUM(Amount) Value FROM #Expense GROUP BY Category ORDER BY Value DESC,Category FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(3) Title Name,Amount Value,Category+' · '+CONVERT(varchar(10),ExpenseDate,23) Detail
 FROM #Expense ORDER BY ExpenseDate DESC,Title,Amount DESC FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardCollectionSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT p.Method,p.Amount INTO #Payments FROM dbo.order_payments p JOIN dbo.orders o ON o.Id=p.OrderId
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId) AND o.DeletedAt IS NULL
 AND o.IsDraft=0 AND p.DeletedAt IS NULL AND p.ReceivedAt>=@Start AND p.ReceivedAt<@End;
 SELECT k.Name,COALESCE(SUM(p.Amount),0) Value INTO #Rows FROM
 (VALUES('Cash','CASH','REFUND_CASH'),('bKash','BKASH','REFUND_BKASH'),('Nagad','NAGAD','REFUND_NAGAD'),('Card','CARD','REFUND_CARD')) k(Name,Method,Refund)
 LEFT JOIN #Payments p ON p.Method IN(k.Method,k.Refund) GROUP BY k.Name;
 DECLARE @Due decimal(28,5);
 SELECT @Due=COALESCE(SUM(CASE WHEN a.Revenue-p.Paid>0 THEN a.Revenue-p.Paid ELSE 0 END),0)
 FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a
 OUTER APPLY(SELECT COALESCE(SUM(Amount),0) Paid FROM dbo.order_payments WHERE OrderId=a.Id AND DeletedAt IS NULL) p
 WHERE a.OrderStatus<>'CANCELLED' AND a.FulfillmentStatus<>'RETURNED';
 SELECT (SELECT SUM(Value) FROM #Rows) Total,JSON_QUERY((SELECT * FROM #Rows ORDER BY Name FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT 'Due (all time)' Name,@Due Value FOR JSON PATH)) Metrics FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardProfitSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 IF @CanSeeCosts=0 THROW 51001,'Cost permission is required.',1;
 DECLARE @Sales decimal(28,5),@Cost decimal(28,5),@Expense decimal(28,5);
 SELECT @Sales=COALESCE(SUM(Revenue),0),@Cost=COALESCE(SUM(Cogs),0)
 FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) WHERE CreatedAt>=@Start AND CreatedAt<@End AND OrderStatus<>'CANCELLED';
 SELECT @Expense=COALESCE(SUM(Amount),0) FROM dbo.expenses WHERE BusinessId=@BusinessId AND (@BranchId IS NULL OR BranchId=@BranchId)
 AND DeletedAt IS NULL AND Status='APPROVED' AND ExpenseDate>=@First AND ExpenseDate<@EndDay;
 SELECT @Sales-@Cost-@Expense Total,
 JSON_QUERY((SELECT Name,Value FROM (VALUES(1,'Sales',@Sales),(2,'Product and delivery cost',@Cost),
 (3,'Gross profit',@Sales-@Cost),(4,'Approved expenses',@Expense),(5,'Net operating profit',@Sales-@Cost-@Expense)) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Rows
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
 SELECT (SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus NOT IN ('DELIVERED','RETURNED')) Total,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'New',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus='UNFULFILLED')),
 (2,'Packed',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus='OPEN' AND FulfillmentStatus='PACKED')),
 (3,'With courier',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus<>'CANCELLED' AND FulfillmentStatus='IN_TRANSIT')),
 (4,'In transit 5+ days',(SELECT COUNT(*) FROM #Orders WHERE OrderStatus<>'CANCELLED' AND FulfillmentStatus='IN_TRANSIT' AND HandedOverAt<DATEADD(day,-5,@End)))) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'Delivered',(SELECT COUNT(*) FROM #Orders WHERE DeliveredAt>=@Start AND DeliveredAt<@End)),
 (2,'Returned',(SELECT COUNT(*) FROM #Orders WHERE ReturnedAt>=@Start AND ReturnedAt<@End)),
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
 SELECT p.Id,COALESCE(SUM(i.Available),0) Available,p.LowStockThreshold INTO #Products FROM dbo.products p
 LEFT JOIN dbo.product_variants v ON v.ProductId=p.Id AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
 OUTER APPLY(SELECT SUM(OnHand-Committed) Available FROM dbo.branch_variant_inventories WHERE VariantId=v.Id AND (@BranchId IS NULL OR BranchId=@BranchId)) i
 WHERE p.BusinessId=@BusinessId AND p.DeletedAt IS NULL AND p.Status='ACTIVE' GROUP BY p.Id,p.LowStockThreshold;
 SELECT (SELECT COUNT(*) FROM #Products WHERE Available>0) Total,
 JSON_QUERY((SELECT 'Total active products' Name,COUNT(*) Value,'count' Unit FROM #Products FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 (1,'Healthy',(SELECT COUNT(*) FROM #Products WHERE Available>LowStockThreshold)),
 (2,'Low stock',(SELECT COUNT(*) FROM #Products WHERE Available>0 AND Available<=LowStockThreshold)),
 (3,'Out of stock',(SELECT COUNT(*) FROM #Products WHERE Available<=0))) v(Sort,Name,Value) ORDER BY Sort FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardCapitalSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 -- Capital is business-wide; never pretend it belongs to the selected branch.
 SELECT p.Id,p.Name,COALESCE(SUM(CASE WHEN l.Bucket='CAPITAL' THEN CAST(l.AmountPaisa AS decimal(28,2))/100 ELSE 0 END),0) Value
 INTO #Capital FROM dbo.partners p LEFT JOIN dbo.capital_ledger l ON l.PartnerId=p.Id AND l.BusinessId=@BusinessId AND l.DeletedAt IS NULL
 WHERE p.BusinessId=@BusinessId AND p.DeletedAt IS NULL GROUP BY p.Id,p.Name;
 SELECT COALESCE((SELECT SUM(Value) FROM #Capital),0) Total,
 JSON_QUERY((SELECT Name,Value FROM #Capital ORDER BY Value DESC,Name FOR JSON PATH)) Rows
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
 SELECT o.CustomerId,o.CustomerName,o.CustomerPhone,CASE WHEN a.Revenue-p.Paid>0 THEN a.Revenue-p.Paid ELSE 0 END Due
 INTO #Due FROM dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a JOIN dbo.orders o ON o.Id=a.Id
 OUTER APPLY(SELECT COALESCE(SUM(Amount),0) Paid FROM dbo.order_payments WHERE OrderId=a.Id AND DeletedAt IS NULL) p
 WHERE a.OrderStatus<>'CANCELLED' AND a.FulfillmentStatus<>'RETURNED';
 SELECT COALESCE(s.Name,i.ShopName,'Unassigned supplier') Name,i.SupplierId,COALESCE(i.DueAmount,0) Due
 INTO #Payable FROM dbo.purchase_items i JOIN dbo.purchase_trips t ON t.Id=i.TripId
 LEFT JOIN dbo.suppliers s ON s.Id=i.SupplierId AND s.BusinessId=@BusinessId
 WHERE t.BusinessId=@BusinessId AND (@BranchId IS NULL OR t.BranchId=@BranchId) AND t.DeletedAt IS NULL
 AND t.Status NOT IN ('DRAFT','CANCELLED') AND i.DeletedAt IS NULL AND i.DueAmount>0;
 DECLARE @Receive decimal(28,5)=COALESCE((SELECT SUM(Due) FROM #Due),0),@Pay decimal(28,5)=COALESCE((SELECT SUM(Due) FROM #Payable),0);
 SELECT @Receive-CASE WHEN @CanSeeCosts=1 THEN @Pay ELSE 0 END Total,
 JSON_QUERY((SELECT Name,Value FROM (VALUES('To receive',@Receive),('To pay',CASE WHEN @CanSeeCosts=1 THEN @Pay END)) v(Name,Value) WHERE Value IS NOT NULL FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT TOP(3) CustomerName Name,SUM(Due) Value,CustomerPhone Detail FROM #Due WHERE Due>0 GROUP BY CustomerId,CustomerName,CustomerPhone ORDER BY Value DESC,CustomerName FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(3) Name,SUM(Due) Value FROM #Payable WHERE @CanSeeCosts=1 GROUP BY SupplierId,Name ORDER BY Value DESC,Name FOR JSON PATH)) Recent
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
 SELECT p.Id,p.Name,SUM(i.Qty) Quantity,SUM(i.Qty*(i.UnitPrice-COALESCE(i.UnitCostSnapshot,0))) Profit,
 SUM(CASE WHEN i.UnitCostSnapshot IS NULL THEN 1 ELSE 0 END) MissingCost
 INTO #Top FROM dbo.order_items i JOIN dbo.orders o ON o.Id=i.OrderId
 JOIN dbo.product_variants v ON v.Id=i.VariantId AND v.BusinessId=@BusinessId AND v.DeletedAt IS NULL
 JOIN dbo.products p ON p.Id=v.ProductId AND p.BusinessId=@BusinessId AND p.DeletedAt IS NULL
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId) AND o.DeletedAt IS NULL
 AND o.IsDraft=0 AND o.OrderStatus<>'CANCELLED' AND i.DeletedAt IS NULL AND o.CreatedAt>=@Start AND o.CreatedAt<@End GROUP BY p.Id,p.Name;
 SELECT COALESCE((SELECT SUM(Quantity) FROM #Top),0) Total,
 JSON_QUERY((SELECT TOP(5) Name,Quantity Value,'count' Unit FROM #Top ORDER BY Quantity DESC,Name,Id FOR JSON PATH)) Rows,
 JSON_QUERY((SELECT TOP(5) Name,Profit Value FROM #Top WHERE @CanSeeCosts=1 AND MissingCost=0 ORDER BY Profit DESC,Name,Id FOR JSON PATH)) Recent
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardCounterSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT o.Id,o.CreatedBy,o.IsDraft,o.OrderStatus,o.IsRevised,o.CreatedAt,a.Revenue
 INTO #Counter FROM dbo.orders o LEFT JOIN dbo.DashboardOrderAmounts(@BusinessId,@BranchId) a ON a.Id=o.Id
 WHERE o.BusinessId=@BusinessId AND (@BranchId IS NULL OR o.BranchId=@BranchId) AND o.DeletedAt IS NULL
 AND o.Source='POS' AND o.CreatedAt>=@Start AND o.CreatedAt<@End;
 SELECT COALESCE((SELECT SUM(Revenue) FROM #Counter WHERE IsDraft=0 AND OrderStatus<>'CANCELLED'),0) Total,
 JSON_QUERY((SELECT Name,Value,'count' Unit FROM (VALUES
 ('On hold',(SELECT COUNT(*) FROM #Counter WHERE IsDraft=1)),
 ('Cancelled bills',(SELECT COUNT(*) FROM #Counter WHERE IsDraft=0 AND OrderStatus='CANCELLED')),
 ('Revised bills',(SELECT COUNT(*) FROM #Counter WHERE IsDraft=0 AND IsRevised=1))) v(Name,Value) FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT COALESCE(u.Name,'Unknown staff') Name,SUM(c.Revenue) Value FROM #Counter c LEFT JOIN dbo.users u ON u.Id=c.CreatedBy
 WHERE c.IsDraft=0 AND c.OrderStatus<>'CANCELLED' GROUP BY c.CreatedBy,u.Name ORDER BY Value DESC,Name FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END

GO
CREATE OR ALTER PROCEDURE dbo.DashboardTransitSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH','ALL') THROW 51000,'Invalid period.',1;
 SET @Today=COALESCE(@Today,CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())));
 DECLARE @First date,@EndDay date,@Start datetime2,@End datetime2;
 SELECT @First=FirstDay,@EndDay=EndDay,@Start=StartUtc,@End=EndUtc FROM dbo.DashboardCardRange(@Period,@Today);
 SELECT s.Id,s.LotNo,s.ShippedDate,
 SUM(CASE WHEN si.Qty-r.Received>0 THEN si.Qty-r.Received ELSE 0 END) Quantity
 INTO #Transit FROM dbo.purchase_shipments s JOIN dbo.purchase_trips t ON t.Id=s.TripId
 JOIN dbo.purchase_shipment_items si ON si.ShipmentId=s.Id AND si.DeletedAt IS NULL
 OUTER APPLY(SELECT COALESCE(SUM(ri.QtyUsable+ri.QtyDamaged+ri.QtyMissing),0) Received
 FROM dbo.purchase_receive_sessions rs JOIN dbo.purchase_receive_session_items ri ON ri.SessionId=rs.Id AND ri.DeletedAt IS NULL
 WHERE rs.ShipmentId=s.Id AND ri.PurchaseItemId=si.PurchaseItemId AND rs.BusinessId=@BusinessId AND rs.Status='APPROVED' AND rs.DeletedAt IS NULL) r
 WHERE t.BusinessId=@BusinessId AND (@BranchId IS NULL OR t.BranchId=@BranchId) AND t.DeletedAt IS NULL AND t.Status<>'CANCELLED'
 AND s.DeletedAt IS NULL AND s.ShippedDate IS NOT NULL AND s.Status<>'CANCELLED'
 GROUP BY s.Id,s.LotNo,s.ShippedDate;
 SELECT COALESCE((SELECT SUM(Quantity) FROM #Transit WHERE Quantity>0),0) Total,
 JSON_QUERY((SELECT 'Shipments on the way' Name,COUNT(*) Value,'count' Unit FROM #Transit WHERE Quantity>0 FOR JSON PATH)) Metrics,
 JSON_QUERY((SELECT TOP(5) LotNo Name,Quantity Value,'count' Unit,CONVERT(varchar(10),ShippedDate,23) Detail
 FROM #Transit WHERE Quantity>0 ORDER BY ShippedDate,Id FOR JSON PATH)) Rows
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
END
