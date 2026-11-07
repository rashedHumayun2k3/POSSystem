using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
using ResellerApi.Services;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Tests;
public class DueSalesTests
{
    private sealed class Scope : IBusinessContext {
        public Guid CurrentBusinessId {get;}=Guid.NewGuid();
        public Guid? CurrentBranchId {get;}=Guid.NewGuid();
    }
    private sealed class Log : IActivityLogService {
        public Task LogAsync(Guid businessId,Guid userId,string action,string entityType,Guid? entityId=null,object? before=null,object? after=null)=>Task.CompletedTask;
    }
    private sealed class Fixture : IAsyncDisposable {
        public Scope Scope {get;}=new();
        public AppDbContext Db {get;}
        public Guid UserId {get;}=Guid.NewGuid();
        public Customer Customer {get;}
        public Order Order {get;}
        public OrderService Service=>new(Db,new Log(),null!);
        public Fixture(){
            Db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString(),o=>o.EnableNullChecks(false)).Options,Scope);
            Customer=new Customer{BusinessId=Scope.CurrentBusinessId,Name="Buyer",Phone="01712345678"};
            var product=new Product{BusinessId=Scope.CurrentBusinessId,Name="Towel"};
            var variant=new ProductVariant{BusinessId=Scope.CurrentBusinessId,Product=product,ProductId=product.Id,Sku="TOWEL"};
            Db.Users.Add(new User{Id=UserId,Name="Owner"});
            Db.Branches.Add(new Branch{Id=Scope.CurrentBranchId!.Value,BusinessId=Scope.CurrentBusinessId,Name="Main",Code="MAIN",IsActive=true});
            Db.Customers.Add(Customer);Db.Products.Add(product);Db.ProductVariants.Add(variant);
            Order=new Order{BusinessId=Scope.CurrentBusinessId,BranchId=Scope.CurrentBranchId,CustomerId=Customer.Id,CustomerName=Customer.Name,CustomerPhone=Customer.Phone,
                OrderNo="POS-TEST",Source="POS",Channel="SHOP",PaymentTerms="CREDIT",PaymentStatus="UNPAID",OrderStatus="COMPLETED",FulfillmentStatus="DELIVERED",
                BusinessDate=new DateOnly(2026,11,6),ConfirmedAt=DateTime.UtcNow,CreatedBy=UserId,
                Items=[new OrderItem{VariantId=variant.Id,Qty=1,UnitPrice=1000,UnitCostSnapshot=400}]};
            Db.Orders.Add(Order);
        }
        public ValueTask DisposeAsync()=>Db.DisposeAsync();
        public CreateOrderRequest Request(Guid? customerId=null,string name="Buyer",string phone="01712345678",decimal advance=0)=>new("SHOP",phone,name,null,true,
            [new OrderItemInput(Order.Items.First().VariantId,1,1000)],null,null,0,advance,null,null,null,null,
            BusinessDate:new DateOnly(2026,11,6),Source:"POS",PaymentTerms:"CREDIT",CustomerId:customerId);
    }
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task PosSaleRejectsInvalidIndividualPriceEvenWithPositiveTotal(decimal price)
    {
        await using var f = new Fixture();
        await f.Db.SaveChangesAsync();
        var request = f.Request(f.Customer.Id);
        request = request with { Items = [request.Items.First(), new OrderItemInput(f.Order.Items.First().VariantId, 1, price)] };
        var count = await f.Db.Orders.CountAsync();
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => f.Service.CreateAsync(request, f.UserId));
        Assert.Contains("selling price must be greater than zero", error.Message);
        Assert.Equal(count, await f.Db.Orders.CountAsync());
    }

    [Fact]
    public async Task DueMenuUpdatesAfterPartialAndFullCollection()
    {
        await using var f = new Fixture();
        await f.Db.SaveChangesAsync();
        async Task<List<OrderListDto>> Due() => await f.Service.ListAsync(null,null,null,null,null,null,null,null,null,true,dueOnly:true);
        Assert.Equal(1000m, Assert.Single(await Due()).DueAmount);
        f.Db.OrderPayments.Add(new OrderPayment { OrderId=f.Order.Id, Amount=400, Method="CASH", UserId=f.UserId });
        await f.Db.SaveChangesAsync();
        Assert.Equal(600m, Assert.Single(await Due()).DueAmount);
        f.Db.OrderPayments.Add(new OrderPayment { OrderId=f.Order.Id, Amount=600, Method="CASH", UserId=f.UserId });
        await f.Db.SaveChangesAsync();
        Assert.Empty(await Due());
    }

    [Fact]
    public async Task CreditCreationLinksSelectedCustomerWithoutCreatingPayment(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var dto=await f.Service.CreateAsync(f.Request(f.Customer.Id,name:"Spoofed",phone:"00000000000"),f.UserId);
        Assert.Equal("CREDIT",dto.PaymentTerms);Assert.Equal("UNPAID",dto.PaymentStatus);Assert.Equal(f.Customer.Id,dto.CustomerId);
        Assert.Equal("Buyer",dto.CustomerName);Assert.Equal(1000m,dto.DueAmount);Assert.Empty(dto.Payments);
    }
    [Fact]
    public async Task CreditSaleRejectsWalkInAndForeignCustomer(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var count=await f.Db.Orders.CountAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Service.CreateAsync(f.Request(name:"Walk-in",phone:"00000000000"),f.UserId));
        var foreign=new Customer{BusinessId=Guid.NewGuid(),Name="Other",Phone="01912345678"};f.Db.Customers.Add(foreign);await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Service.CreateAsync(f.Request(foreign.Id),f.UserId));
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Service.CreateAsync(f.Request(f.Customer.Id,advance:100),f.UserId));
        Assert.Equal(count,await f.Db.Orders.CountAsync());
    }
    [Fact]
    public async Task SelectedNewCustomerIsCreatedAndLinkedForCredit(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var dto=await f.Service.CreateAsync(f.Request(name:"New buyer",phone:"01812345678"),f.UserId);
        Assert.Equal("New buyer",dto.CustomerName);Assert.NotEqual(f.Customer.Id,dto.CustomerId);Assert.Empty(dto.Payments);
    }
    [Fact]
    public async Task PartialThenFinalCollectionCountsEachPaymentOnceAndRetryIsIdempotent(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var first=new AddOrderPaymentRequest("CASH",500,null,PaymentId:Guid.NewGuid());
        var partial=await f.Service.AddPaymentAsync(f.Order.Id,first,f.UserId);
        Assert.Equal("PARTIALLY_PAID",partial.PaymentStatus);Assert.Equal(500m,partial.TotalPaid);Assert.Equal(500m,partial.DueAmount);
        var retry=await f.Service.AddPaymentAsync(f.Order.Id,first,f.UserId);Assert.Single(retry.Payments);Assert.Equal(500m,retry.DueAmount);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Service.AddPaymentAsync(f.Order.Id,first with{Amount=400},f.UserId));
        var final=await f.Service.AddPaymentAsync(f.Order.Id,new("BKASH",500,null,"TRX123",Guid.NewGuid()),f.UserId);
        Assert.Equal("PAID",final.PaymentStatus);Assert.Equal(1000m,final.TotalPaid);Assert.Equal(0m,final.DueAmount);Assert.Equal(2,final.Payments.Count);
    }
    [Theory]
    [InlineData("BAKI",100)][InlineData("DUE",100)][InlineData("CASH",0)][InlineData("CASH",-1)][InlineData("CASH",1001)][InlineData("CASH",1.001)][InlineData("BKASH",100)]
    public async Task InvalidCollectionsDoNotAddPayments(string method,decimal amount){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(()=>f.Service.AddPaymentAsync(f.Order.Id,new(method,amount,null),f.UserId));
        Assert.Empty(await f.Db.OrderPayments.ToListAsync());
    }
    [Fact]
    public async Task CustomerBalanceUsesActualPaymentsAndPercentageDiscounts(){
        await using var f=new Fixture();f.Order.DiscountType="PERCENT";f.Order.DiscountValue=10;f.Order.AdvancePaid=200;
        f.Order.Payments.Add(new OrderPayment{Amount=200,Method="CASH",UserId=f.UserId});
        f.Order.Payments.Add(new OrderPayment{Amount=100,Method="CASH",UserId=f.UserId});
        f.Order.Payments.Add(new OrderPayment{Amount=999,Method="CASH",UserId=f.UserId,DeletedAt=DateTime.UtcNow});await f.Db.SaveChangesAsync();f.Db.ChangeTracker.Clear();
        var customer=await new CustomerService(f.Db).GetAsync(f.Customer.Id);Assert.Equal(600m,customer.UnpaidBalance);
    }
    [Fact]
    public async Task SalesHistoryOptInIncludesDueSalesWithoutDraftsOrPendingOrders(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var legacy=await f.Service.ListAsync(null,null,"PAID",null,null,null,null,null,null,true);
        Assert.Empty(legacy);
        var sales=await f.Service.ListAsync(null,null,"PAID",null,null,null,null,null,null,true,includeCreditSales:true);
        Assert.Equal(f.Order.Id,Assert.Single(sales).Id);Assert.Equal(1000m,sales[0].DueAmount);
    }
    [Fact]
    public async Task RecordedSalesIncludeConfirmedCreditSaleWithCorrectDue(){
        await using var f=new Fixture();await f.Db.SaveChangesAsync();
        var response=Assert.IsType<OkObjectResult>(await new PosRecordedSalesController(f.Db).Get(f.Order.BusinessDate));
        var report=Assert.IsType<PosRecordedSalesController.RecordedReport>(response.Value);
        var sale=Assert.Single(report.Sales);Assert.Equal(1000m,sale.DueAmount);Assert.Equal("UNPAID",sale.PaymentStatus);Assert.Empty(sale.PaymentMethods);
    }
}
