using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Infrastructure;
using ResellerApi.Services;

namespace ResellerApi.Tests;

public sealed class DashboardSqlFactAttribute : FactAttribute
{
    public DashboardSqlFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DASHBOARD_TEST_SQL")))
            Skip = "Set DASHBOARD_TEST_SQL to a LOCAL SQL Server connection; these tests execute real procedures.";
    }
}

public class DashboardCollectionsTests
{
    [DashboardSqlFact]
    public async Task SalesSectionPeriodsChannelsAndPermissions()
    {
        await using var f = new SqlFixture(); await f.Init();
        await f.Seed("""
            DECLARE @Online uniqueidentifier=NEWID(),@Pos uniqueidentifier=NEWID(),@Previous uniqueidentifier=NEWID();
            INSERT orders(Id,BusinessId,BranchId,CreatedAt,Channel,Source) VALUES
            (@Online,@Business,@Branch,DATEADD(hour,-6,CAST(@Today AS datetime2)),'MYWEBSITE','CLIENTPAGE'),
            (@Pos,@Business,@Branch,DATEADD(hour,5,CAST(@Today AS datetime2)),'FACEBOOK','POS'),
            (@Previous,@Business,@Branch,DATEADD(hour,-7,CAST(@Today AS datetime2)),'SHOP','POS');
            INSERT order_items(OrderId,Qty,UnitPrice,UnitCostSnapshot) VALUES
            (@Online,2,100,40),(@Pos,1,100,50),(@Previous,1,150,50);
            """);
        var today = await f.Service.GetDashboardSalesSectionAsync(true,"TODAY");
        Assert.Equal(300m,today.Sales); Assert.Equal(170m,today.Profit); Assert.Equal(2,today.Orders);
        Assert.Equal(3m,today.ItemsSold); Assert.Equal(150m,today.AverageBill); Assert.Equal(56.7m,today.Margin);
        Assert.Equal(100m,today.ChangePercent); Assert.Equal(24,today.Chart.Count);
        Assert.Equal(today.Sales,today.Chart.Sum(x=>x.Value));
        Assert.Equal(200m,today.Channels.Single(x=>x.Channel=="ONLINE").Sales);
        Assert.Equal(100m,today.Channels.Single(x=>x.Channel=="OFFLINE").Sales);
        Assert.Equal(today.Orders,today.Channels.Sum(x=>x.Orders));
        var yesterday = await f.Service.GetDashboardSalesSectionAsync(true,"YESTERDAY");
        Assert.Equal(150m,yesterday.Sales); Assert.Null(yesterday.ChangePercent);
        var week = await f.Service.GetDashboardSalesSectionAsync(true,"7D");
        Assert.Equal(450m,week.Sales); Assert.Equal(7,week.Chart.Count);
        var month = await f.Service.GetDashboardSalesSectionAsync(false,"MONTH");
        Assert.Null(month.Profit); Assert.Null(month.Margin); Assert.InRange(month.Chart.Count,1,31);
        f.Scope.CurrentBranchId=Guid.NewGuid();
        var other = await f.Service.GetDashboardSalesSectionAsync(true,"TODAY");
        Assert.Equal(0m,other.Sales); Assert.Equal(0m,other.AverageBill); Assert.Null(other.Margin);
        f.Scope.CurrentBranchId=null; f.Scope.CurrentBusinessId=Guid.NewGuid();
        Assert.Equal(0m,(await f.Service.GetDashboardSalesSectionAsync(true,"TODAY")).Sales);
        await Assert.ThrowsAsync<ArgumentException>(()=>f.Service.GetDashboardSalesSectionAsync(true,"INVALID"));
    }

    [DashboardSqlFact]
    public async Task DashboardCardsUseExistingDataAndStayScoped()
    {
        await using var f = new SqlFixture(); await f.Init();
        await f.Seed("""
            DECLARE @Order uniqueidentifier=NEWID(),@Category uniqueidentifier=NEWID(),@Partner uniqueidentifier=NEWID(),@Trip uniqueidentifier=NEWID(),@Item uniqueidentifier=NEWID(),@Shipment uniqueidentifier=NEWID(),@Session uniqueidentifier=NEWID(),@User uniqueidentifier=NEWID();
            INSERT users(Id,Name) VALUES(@User,'Cashier');
            INSERT orders(Id,BusinessId,BranchId,CustomerName,CustomerPhone,CreatedBy,Source,DeliveredAt)
            VALUES(@Order,@Business,@Branch,'Customer','123',@User,'POS',SYSUTCDATETIME());
            INSERT order_items(OrderId,Qty,UnitPrice,UnitCostSnapshot) VALUES(@Order,2,100,40);
            INSERT order_payments(OrderId,Method,Amount) VALUES(@Order,'CASH',150),(@Order,'REFUND_CASH',-10);
            INSERT expense_categories(Id,BusinessId,Name) VALUES(@Category,@Business,'Transport');
            INSERT expenses(BusinessId,BranchId,ExpenseDate,Status,Amount,CategoryId,Title) VALUES(@Business,@Branch,@Today,'APPROVED',20,@Category,'Delivery');
            INSERT partners(Id,BusinessId,Name) VALUES(@Partner,@Business,'Partner A');
            INSERT capital_ledger(BusinessId,PartnerId,Bucket,AmountPaisa) VALUES(@Business,@Partner,'CAPITAL',100000),(@Business,@Partner,'CAPITAL',-10000),(@Business,@Partner,'PROFIT',5000);
            INSERT purchase_trips(Id,BusinessId,BranchId,Status) VALUES(@Trip,@Business,@Branch,'IN_PROGRESS');
            INSERT purchase_items(Id,TripId,ShopName,DueAmount) VALUES(@Item,@Trip,'Supplier',80);
            INSERT purchase_shipments(Id,TripId,LotNo,ShippedDate,Status) VALUES(@Shipment,@Trip,'LOT-1',SYSUTCDATETIME(),'IN_TRANSIT');
            INSERT purchase_shipment_items(ShipmentId,PurchaseItemId,Qty) VALUES(@Shipment,@Item,10);
            INSERT purchase_receive_sessions(Id,BusinessId,ShipmentId,Status) VALUES(@Session,@Business,@Shipment,'APPROVED');
            INSERT purchase_receive_session_items(SessionId,PurchaseItemId,QtyUsable,QtyDamaged,QtyMissing) VALUES(@Session,@Item,3,1,1);
            """);
        Assert.Equal(20m,(await f.Service.GetDashboardExpenseSectionAsync(true,"TODAY")).Total);
        var collection=await f.Service.GetDashboardCollectionSectionAsync(true,"TODAY");
        Assert.Equal(140m,collection.Total);Assert.Equal(60m,collection.Metrics.Single().Value);
        Assert.Equal(100m,(await f.Service.GetDashboardProfitSectionAsync(true,"TODAY")).Total);
        await Assert.ThrowsAsync<ArgumentException>(()=>f.Service.GetDashboardProfitSectionAsync(true,"ALL"));
        await Assert.ThrowsAsync<SqlException>(()=>f.Seed("EXEC dbo.DashboardProfitSection @BusinessId=@Business,@BranchId=@Branch,@CanSeeCosts=1,@Period='ALL';"));
        Assert.Equal(1m,(await f.Service.GetDashboardOrdersSectionAsync(true,"TODAY")).Rows.Single(x=>x.Name=="Delivered").Value);
        Assert.Equal(0m,(await f.Service.GetDashboardOrdersSectionAsync(true,"TODAY")).ReturnRate);
        Assert.Equal(1,(await f.Service.GetDashboardOrdersSectionAsync(true,"TODAY")).ResolvedOrders);
        Assert.Equal(1,(await f.Service.GetDashboardDuesSectionAsync(true,"ALL")).Metrics.First(x=>x.Name=="To receive").Count);
        Assert.Equal(0,(await f.Service.GetDashboardDuesSectionAsync(true,"ALL")).Rows.Single().Days);
        Assert.Equal(900m,(await f.Service.GetDashboardCapitalSectionAsync(true,"ALL")).Total);
        Assert.Equal(-20m,(await f.Service.GetDashboardDuesSectionAsync(true,"ALL")).Total);
        var staff=await f.Service.GetDashboardDuesSectionAsync(false,"ALL");
        Assert.Equal(60m,staff.Total);Assert.Empty(staff.Recent);Assert.Single(staff.Metrics);
        Assert.Equal(200m,(await f.Service.GetDashboardCounterSectionAsync(false,"TODAY")).Total);
        Assert.Equal(5m,(await f.Service.GetDashboardTransitSectionAsync(false,"ALL")).Total);
        Assert.Equal(0m,(await f.Service.GetDashboardProductsSectionAsync(false,"ALL")).Total);
        Assert.Empty((await f.Service.GetDashboardTopSectionAsync(false,"7D")).Recent);
        await Assert.ThrowsAsync<SqlException>(()=>f.Service.GetDashboardProfitSectionAsync(false,"TODAY"));
        await f.Seed("""
            DECLARE @Returned uniqueidentifier=NEWID(),@Product uniqueidentifier=NEWID(),@Variant uniqueidentifier=NEWID(),@Cat uniqueidentifier=NEWID();
            INSERT orders(Id,BusinessId,BranchId,DeliveredAt,ReturnedAt,FulfillmentStatus)
            VALUES(@Returned,@Business,@Branch,SYSUTCDATETIME(),SYSUTCDATETIME(),'RETURNED');
            INSERT categories(Id,BusinessId,Name) VALUES(@Cat,@Business,'Clothing');
            INSERT products(Id,BusinessId,CategoryId,Name,LowStockThreshold,Status) VALUES(@Product,@Business,@Cat,'Shirt',5,'ACTIVE');
            INSERT product_variants(Id,BusinessId,ProductId) VALUES(@Variant,@Business,@Product);
            UPDATE order_items SET VariantId=@Variant WHERE OrderId IN (SELECT Id FROM orders WHERE BusinessId=@Business);
            """);
        var outcomes=await f.Service.GetDashboardOrdersSectionAsync(true,"TODAY");
        Assert.Equal(50m,outcomes.ReturnRate);Assert.Equal(2,outcomes.ResolvedOrders);
        Assert.Equal(1m,outcomes.Rows.Single(x=>x.Name=="Delivered").Value);
        var top=await f.Service.GetDashboardTopSectionAsync(true,"7D");
        Assert.Equal(2m,top.Rows.Single().Quantity);Assert.Equal(200m,top.Rows.Single().Value);
        Assert.Equal(120m,top.Recent.Single().Value);
        Assert.Equal("Clothing",(await f.Service.GetDashboardProductsSectionAsync(false,"ALL")).Recent.Single().Name);

        f.Scope.CurrentBranchId=Guid.NewGuid();
        Assert.Equal(0m,(await f.Service.GetDashboardExpenseSectionAsync(true,"TODAY")).Total);
        Assert.Equal(0m,(await f.Service.GetDashboardDuesSectionAsync(true,"ALL")).Total);
        Assert.Equal(0m,(await f.Service.GetDashboardTransitSectionAsync(true,"ALL")).Total);
        Assert.Equal(900m,(await f.Service.GetDashboardCapitalSectionAsync(true,"ALL")).Total); // deliberately business-wide
        f.Scope.CurrentBusinessId=Guid.NewGuid();f.Scope.CurrentBranchId=null;
        Assert.Equal(0m,(await f.Service.GetDashboardCapitalSectionAsync(true,"ALL")).Total);
        Assert.Equal(0m,(await f.Service.GetDashboardCollectionSectionAsync(true,"ALL")).Total);
        Assert.Equal(0m,(await f.Service.GetDashboardCounterSectionAsync(true,"TODAY")).Total);
    }

    [DashboardSqlFact]
    public async Task CurrentMoneyDeductsPaidSplitExpensesAndExcludesFutureAndOtherScopes()
    {
        await using var f = new SqlFixture();await f.Init();
        await f.Seed("""
            DECLARE @Order uniqueidentifier=NEWID();
            INSERT orders(Id,BusinessId,BranchId) VALUES(@Order,@Business,@Branch);
            INSERT order_payments(OrderId,Method,Amount) VALUES(@Order,'CASH',200),(@Order,'REFUND_CASH',-20),(@Order,'BKASH',80),(@Order,'NAGAD',50),(@Order,'CARD',1000),(@Order,'BAKI',900);
            INSERT order_payments(OrderId,Method,Amount,ReceivedAt) VALUES(@Order,'CASH',999,DATEADD(day,1,SYSUTCDATETIME()));
            INSERT expenses(BusinessId,BranchId,Status,FundingSource,PaidAt,CashAmount,BkashAmount,NagadAmount) VALUES
            (@Business,@Branch,'APPROVED','CASH',SYSUTCDATETIME(),30,10,5),
            (@Business,@Branch,'PENDING','CASH',SYSUTCDATETIME(),100,100,100),
            (@Business,@Branch,'APPROVED','PERSONAL',SYSUTCDATETIME(),100,100,100),
            (@Business,@Branch,'APPROVED','CASH',DATEADD(day,1,SYSUTCDATETIME()),100,100,100),
            (@Business,NEWID(),'APPROVED','CASH',SYSUTCDATETIME(),10,0,0),
            (NEWID(),@Branch,'APPROVED','CASH',SYSUTCDATETIME(),100,100,100);
            """);
        var result=await f.Service.GetDashboardMoneySectionAsync();
        Assert.Equal(265m,result.Total);Assert.NotNull(result.AsOf);Assert.Equal(3,result.Rows.Count);
        Assert.Equal(150m,result.Rows.Single(x=>x.Name=="Cash").Value);
        Assert.Equal(70m,result.Rows.Single(x=>x.Name=="bKash").Value);
        Assert.Equal(45m,result.Rows.Single(x=>x.Name=="Nagad").Value);Assert.Empty(result.Metrics);
        f.Scope.CurrentBranchId=null;Assert.Equal(255m,(await f.Service.GetDashboardMoneySectionAsync()).Total);
        f.Scope.CurrentBusinessId=Guid.NewGuid();Assert.Equal(0m,(await f.Service.GetDashboardMoneySectionAsync()).Total);
    }

    // Each test owns a uniquely named local database. No application database is touched.
    private sealed class SqlFixture : IAsyncDisposable
    {
        private readonly string name = "DashboardReportTests_" + Guid.NewGuid().ToString("N");
        private readonly string admin;
        public string Connection { get; }
        public BusinessContext Scope { get; } = new() { CurrentBusinessId = Guid.NewGuid(), CurrentBranchId = Guid.NewGuid() };
        public AppDbContext Db { get; }
        public ReportService Service { get; }
        public SqlFixture()
        {
            var builder = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("DASHBOARD_TEST_SQL"));
            if (builder.DataSource is not ("localhost" or "." or "(local)" or "(localdb)\\MSSQLLocalDB"))
                throw new InvalidOperationException("Dashboard tests require a local SQL Server.");
            builder.InitialCatalog = "master"; admin = builder.ConnectionString;
            builder.InitialCatalog = name; Connection = builder.ConnectionString;
            Db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(Connection).Options, Scope);
            Service = new(Db);
        }
        private static async Task Execute(string connection, string sql)
        {
            await using var c = new SqlConnection(connection); await c.OpenAsync();
            await using var cmd = new SqlCommand(sql,c); await cmd.ExecuteNonQueryAsync();
        }
        public async Task Init()
        {
            await Execute(admin,$"CREATE DATABASE [{name}]");
            await Execute(Connection, """
                CREATE TABLE orders(Id uniqueidentifier PRIMARY KEY, BusinessId uniqueidentifier NOT NULL, BranchId uniqueidentifier NULL,
                  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), ReturnedAt datetime2 NULL, DeletedAt datetime2 NULL,
                  IsDraft bit NOT NULL DEFAULT 0, OrderStatus varchar(20) NOT NULL DEFAULT 'COMPLETED', FulfillmentStatus varchar(20) NOT NULL DEFAULT 'DELIVERED',
                  Channel varchar(30) NOT NULL DEFAULT 'SHOP', Source varchar(30) NULL, CustomerPhone nvarchar(50) NOT NULL DEFAULT '', DiscountType varchar(20) NULL, DiscountValue decimal(14,2) NULL,
                  DeliveryChargeCustomer decimal(14,2) NOT NULL DEFAULT 0, DeliveryCostActual decimal(14,2) NOT NULL DEFAULT 0);
                CREATE TABLE order_items(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),OrderId uniqueidentifier,VariantId uniqueidentifier,
                  Qty decimal(12,3),UnitPrice decimal(14,2),UnitCostSnapshot decimal(14,2),DeletedAt datetime2 NULL);
                CREATE TABLE order_payments(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),OrderId uniqueidentifier,Method varchar(30),Amount decimal(14,2),
                  ReceivedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),DeletedAt datetime2 NULL);
                CREATE TABLE expenses(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),BusinessId uniqueidentifier,BranchId uniqueidentifier NULL,
                  ExpenseDate datetime2,Status varchar(20),Amount decimal(14,2),DeletedAt datetime2 NULL);
                CREATE TABLE categories(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,Name nvarchar(100),DeletedAt datetime2 NULL);
                CREATE TABLE products(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,CategoryId uniqueidentifier,Name nvarchar(100),
                  LowStockThreshold int,Status varchar(20),DeletedAt datetime2 NULL);
                CREATE TABLE product_variants(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,ProductId uniqueidentifier,DeletedAt datetime2 NULL);
                CREATE TABLE branch_variant_inventories(BranchId uniqueidentifier,VariantId uniqueidentifier,OnHand decimal(12,3),Committed decimal(12,3),Damaged decimal(12,3));
                """);
            await Execute(Connection, """
                ALTER TABLE orders ADD CustomerId uniqueidentifier NULL,CustomerName nvarchar(100) NOT NULL DEFAULT '',
                  HandedOverAt datetime2 NULL,DeliveredAt datetime2 NULL,CreatedBy uniqueidentifier NULL,IsRevised bit NOT NULL DEFAULT 0;
                ALTER TABLE expenses ADD FundingSource varchar(20) NULL,PaidAt datetime2 NULL,CashAmount decimal(14,2) NOT NULL DEFAULT 0,BkashAmount decimal(14,2) NOT NULL DEFAULT 0,NagadAmount decimal(14,2) NOT NULL DEFAULT 0,Title nvarchar(100) NULL,SubType nvarchar(100) NULL,CategoryId uniqueidentifier NULL;
                CREATE TABLE expense_categories(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,Name nvarchar(100));
                CREATE TABLE order_status_history(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),OrderId uniqueidentifier,Track varchar(20),ToStatus varchar(20),At datetime2,DeletedAt datetime2 NULL);
                CREATE TABLE partners(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,Name nvarchar(100),DeletedAt datetime2 NULL);
                CREATE TABLE capital_ledger(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),BusinessId uniqueidentifier,PartnerId uniqueidentifier,Bucket varchar(20),AmountPaisa bigint,DeletedAt datetime2 NULL);
                CREATE TABLE suppliers(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,Name nvarchar(100));
                CREATE TABLE users(Id uniqueidentifier PRIMARY KEY,Name nvarchar(100));
                CREATE TABLE purchase_trips(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,BranchId uniqueidentifier NULL,Status varchar(30),DeletedAt datetime2 NULL);
                CREATE TABLE purchase_items(Id uniqueidentifier PRIMARY KEY,TripId uniqueidentifier,SupplierId uniqueidentifier NULL,ShopName nvarchar(100) NULL,DueAmount decimal(14,2),DeletedAt datetime2 NULL);
                CREATE TABLE purchase_shipments(Id uniqueidentifier PRIMARY KEY,TripId uniqueidentifier,LotNo varchar(30),ShippedDate datetime2 NULL,Status varchar(30),DeletedAt datetime2 NULL);
                CREATE TABLE purchase_shipment_items(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),ShipmentId uniqueidentifier,PurchaseItemId uniqueidentifier,Qty decimal(12,3),DeletedAt datetime2 NULL);
                CREATE TABLE purchase_receive_sessions(Id uniqueidentifier PRIMARY KEY,BusinessId uniqueidentifier,ShipmentId uniqueidentifier,Status varchar(30),DeletedAt datetime2 NULL);
                CREATE TABLE purchase_receive_session_items(Id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),SessionId uniqueidentifier,PurchaseItemId uniqueidentifier,QtyUsable decimal(12,3),QtyDamaged decimal(12,3),QtyMissing decimal(12,3),DeletedAt datetime2 NULL);
                """);
            foreach (var sql in DashboardReportSql.Batches()) await Execute(Connection, sql);
            foreach (var sql in DashboardReportSql.Batches("DashboardSalesSection.sql")) await Execute(Connection, sql);
            foreach (var sql in DashboardReportSql.Batches("DashboardCardsV2.sql")) await Execute(Connection, sql);
            foreach (var sql in DashboardReportSql.Batches("DashboardCurrentMoney.sql")) await Execute(Connection, sql);
            foreach (var sql in DashboardReportSql.Batches("DashboardProfitPeriods.sql")) await Execute(Connection, sql);
            foreach (var sql in DashboardReportSql.Batches("DashboardCompactDetails.sql")) await Execute(Connection, sql);
        }
        public async Task Seed(string sql)
        {
            await using var c = new SqlConnection(Connection); await c.OpenAsync();
            await using var cmd = new SqlCommand("DECLARE @Today date=CONVERT(date,DATEADD(hour,6,SYSUTCDATETIME())); " + sql,c);
            cmd.Parameters.AddWithValue("@Business", Scope.CurrentBusinessId);
            cmd.Parameters.AddWithValue("@Branch", Scope.CurrentBranchId!.Value);
            await cmd.ExecuteNonQueryAsync();
        }
        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync(); SqlConnection.ClearAllPools();
            if (!name.StartsWith("DashboardReportTests_",StringComparison.Ordinal)) throw new InvalidOperationException();
            await Execute(admin,$"IF DB_ID('{name}') IS NOT NULL BEGIN ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{name}]; END");
        }
    }

    [DashboardSqlFact]
    public async Task EmptySummariesAndPermissionMaskingUseRealProcedures()
    {
        await using var f = new SqlFixture(); await f.Init();
        var empty = await f.Service.GetDashboardAsync(false);
        Assert.Equal(0,empty.TodaySales); Assert.Equal(30,empty.SalesTrend.Count); Assert.Equal(24,empty.HourlySales.Count);
        Assert.Empty(empty.TopProducts); Assert.Empty(empty.PaymentMethods); Assert.Empty(empty.SalesByCategory);
        Assert.Equal(0,empty.SalesCollections!.Due);
        var overview = await f.Service.GetDashboardSalesOverviewAsync(false);
        Assert.Null(overview.TodayProfit); Assert.Equal(0m,overview.ChangePercent); Assert.Equal(7,overview.Days.Count);
        var expense = await f.Service.GetDashboardExpenseSummaryAsync(); Assert.Equal(0,expense.MonthCost);
        f.Scope.CurrentBusinessId = Guid.Empty;
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.GetDashboardExpenseSummaryAsync());
    }

    [DashboardSqlFact]
    public async Task ExpensesRespectDateStatusTenantAndBranch()
    {
        await using var f = new SqlFixture(); await f.Init();
        await f.Seed("""
            INSERT expenses(BusinessId,BranchId,ExpenseDate,Status,Amount) VALUES
            (@Business,@Branch,@Today,'APPROVED',150),
            (@Business,@Branch,DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1),'APPROVED',30),
            (@Business,@Branch,DATEADD(day,1,@Today),'APPROVED',999),
            (@Business,@Branch,DATEADD(day,-1,DATEFROMPARTS(YEAR(@Today),MONTH(@Today),1)),'APPROVED',999),
            (@Business,@Branch,@Today,'PENDING',999),(@Business,@Branch,@Today,'REJECTED',999),(@Business,@Branch,@Today,'CANCELLED',999),
            (NEWID(),@Branch,@Today,'APPROVED',999),(@Business,NEWID(),@Today,'APPROVED',50),(@Business,NULL,@Today,'APPROVED',20);
            INSERT expenses(BusinessId,BranchId,ExpenseDate,Status,Amount,DeletedAt) VALUES(@Business,@Branch,@Today,'APPROVED',999,SYSUTCDATETIME());
            """);
        var result = await f.Service.GetDashboardExpenseSummaryAsync();
        Assert.Equal(180,result.MonthCost);
        Assert.Equal(DhakaTime.UtcToLocal(DateTime.UtcNow).Day==1?180:150,result.TodayCost);
        f.Scope.CurrentBranchId=null;
        Assert.Equal(250,(await f.Service.GetDashboardExpenseSummaryAsync()).MonthCost);
    }

    [DashboardSqlFact]
    public async Task SalesRefundsDueStockAndChartsAreScopedAndPreserveRounding()
    {
        await using var f = new SqlFixture(); await f.Init();
        await f.Seed("""
            DECLARE @Order uniqueidentifier=NEWID(),@Returned uniqueidentifier=NEWID(),@Other uniqueidentifier=NEWID(),
                @Cat uniqueidentifier=NEWID(),@Product uniqueidentifier=NEWID(),@Variant uniqueidentifier=NEWID();
            INSERT categories VALUES(@Cat,@Business,'Shoes',NULL);
            INSERT products VALUES(@Product,@Business,@Cat,'Test shoe',5,'ACTIVE',NULL);
            INSERT product_variants VALUES(@Variant,@Business,@Product,NULL);
            INSERT branch_variant_inventories VALUES(@Branch,@Variant,5,1,1),(NEWID(),@Variant,10,0,0);
            INSERT orders(Id,BusinessId,BranchId,DiscountType,DiscountValue,DeliveryChargeCustomer,CustomerPhone)
                VALUES(@Order,@Business,@Branch,'PERCENT',10,5,'123');
            INSERT order_items(OrderId,VariantId,Qty,UnitPrice,UnitCostSnapshot) VALUES(@Order,@Variant,1,100,20);
            INSERT order_items(OrderId,VariantId,Qty,UnitPrice,DeletedAt) VALUES(@Order,@Variant,1,999,SYSUTCDATETIME());
            INSERT order_payments(OrderId,Method,Amount) VALUES(@Order,'CASH',60);
            INSERT order_payments(OrderId,Method,Amount,DeletedAt) VALUES(@Order,'CASH',999,SYSUTCDATETIME());
            INSERT orders(Id,BusinessId,BranchId,CreatedAt,FulfillmentStatus,ReturnedAt)
                VALUES(@Returned,@Business,@Branch,DATEADD(year,-1,SYSUTCDATETIME()),'RETURNED',SYSUTCDATETIME());
            INSERT order_payments(OrderId,Method,Amount) VALUES(@Returned,'BKASH',100),(@Returned,'REFUND_BKASH',-80),(@Returned,'REFUND_CASH',-20),(@Returned,'COD',1000);
            INSERT orders(Id,BusinessId,BranchId) VALUES(@Other,NEWID(),@Branch);
            INSERT order_items(OrderId,VariantId,Qty,UnitPrice) VALUES(@Other,@Variant,1,9999);
            INSERT order_payments(OrderId,Method,Amount) VALUES(@Other,'CASH',9999);
            -- The exact UTC instant before Dhaka midnight belongs to yesterday.
            DECLARE @Yesterday uniqueidentifier=NEWID();
            INSERT orders(Id,BusinessId,BranchId,CreatedAt) VALUES(@Yesterday,@Business,@Branch,DATEADD(second,-1,DATEADD(hour,-6,CAST(@Today AS datetime2))));
            INSERT order_items(OrderId,VariantId,Qty,UnitPrice,UnitCostSnapshot) VALUES(@Yesterday,@Variant,1,50,0);
            DECLARE @RoundingBusiness uniqueidentifier=NEWID(), @RoundingOrder uniqueidentifier=NEWID();
            INSERT orders(Id,BusinessId,BranchId,DiscountType,DiscountValue) VALUES(@RoundingOrder,@RoundingBusiness,@Branch,'PERCENT',10);
            INSERT order_items(OrderId,VariantId,Qty,UnitPrice) VALUES(@RoundingOrder,@Variant,1,100.05);
            IF (SELECT Revenue FROM dbo.DashboardOrderAmounts(@RoundingBusiness,@Branch) WHERE Id=@RoundingOrder)<>90.05
                THROW 51000,'Percentage discount rounding does not match existing sales totals.',1;
            -- Deleted and draft orders cannot contribute to any section.
            INSERT orders(Id,BusinessId,BranchId,IsDraft) VALUES(NEWID(),@Business,@Branch,1);
            IF dbo.DashboardRoundEven(1.005,2)<>1.00 OR dbo.DashboardRoundEven(1.015,2)<>1.02
                THROW 51000,'Midpoint rounding differs from existing C# calculations.',1;
            """);
        var overview=await f.Service.GetDashboardSalesOverviewAsync(true);
        Assert.Equal(95,overview.TodaySales); Assert.Equal(75m,overview.TodayProfit); Assert.Equal(1,overview.TodayOrders);
        Assert.Equal(50,overview.YesterdaySales); Assert.Equal(90m,overview.ChangePercent); Assert.Equal(145,overview.SevenDaySales);
        Assert.Equal(7,overview.Days.Count); Assert.Equal(95,overview.Days[^1].Value);
        Assert.Null((await f.Service.GetDashboardSalesOverviewAsync(false)).TodayProfit);
        var collections=await f.Service.GetDashboardCollectionsSummaryAsync();
        Assert.Equal(40,collections.Cash); Assert.Equal(20,collections.Bkash); Assert.Equal(85,collections.Due);
        var counts=await f.Service.GetDashboardOrderSummaryAsync(); Assert.Equal(1,counts.Orders); Assert.Equal(1,counts.Returns);
        Assert.Equal(1,(await f.Service.GetDashboardStockAsync())[0].Value);
        Assert.Equal(150,Assert.Single(await f.Service.GetDashboardTopProductsAsync()).Value);
        Assert.Equal(150,Assert.Single(await f.Service.GetDashboardCategoriesAsync()).Value);
        var trend=await f.Service.GetDashboardTrendAsync(); Assert.Equal(30,trend.Count); Assert.Equal(1060,trend.Sum(p=>p.Value));
        Assert.Equal(40,(await f.Service.GetDashboardPaymentMethodsAsync()).Where(p=>p.Name is "CASH" or "REFUND_CASH").Sum(p=>p.Value));
        f.Scope.CurrentBranchId=null; Assert.Equal(0,(await f.Service.GetDashboardStockAsync())[0].Value);
    }
}
