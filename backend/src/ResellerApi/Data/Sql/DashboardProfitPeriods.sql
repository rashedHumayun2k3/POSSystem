CREATE OR ALTER PROCEDURE dbo.DashboardProfitSection
 @BusinessId uniqueidentifier, @BranchId uniqueidentifier=NULL, @CanSeeCosts bit=0,
 @Period varchar(12)='MONTH', @Today date=NULL
AS BEGIN
 SET NOCOUNT ON;
 IF @BusinessId IS NULL THROW 51000,'Business scope is required.',1;
 IF @Period IS NULL OR @Period NOT IN ('TODAY','YESTERDAY','7D','MONTH') THROW 51000,'Invalid period.',1;
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
