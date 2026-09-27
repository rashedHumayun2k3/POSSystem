using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Controllers;
using ResellerApi.Data;
using ResellerApi.DTOs.PreOrders;
using ResellerApi.Entities;
using ResellerApi.Entities.Base;
using ResellerApi.Infrastructure;
namespace ResellerApi.Tests;
public class PreOrderWorkflowTests
{
    private sealed class TestDb(DbContextOptions<AppDbContext> options, IBusinessContext business) : AppDbContext(options,business)
    {
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken=default)
        {
            foreach(var e in ChangeTracker.Entries<BaseEntity>().Where(e=>e.State==EntityState.Added)) e.Entity.RowVer=Guid.NewGuid().ToByteArray();
            return base.SaveChangesAsync(cancellationToken);
        }
    }
    [Fact]
    public async Task WorkflowRequiresReviewAndOutcomeAndPreservesAudit()
    {
        var biz=new BusinessContext {CurrentBusinessId=Guid.NewGuid()};
        using var db=new TestDb(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,biz);
        var order=new PreOrder {BusinessId=biz.CurrentBusinessId,PreOrderNo="TEST",CreatedByUserId=Guid.NewGuid()};
        db.PreOrders.Add(order);await db.SaveChangesAsync();
        var context=new DefaultHttpContext {User=new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim(ClaimTypes.NameIdentifier,order.CreatedByUserId.ToString()),new Claim(ClaimTypes.Name,"Test Admin")},"test"))};
        var controller=new PreOrdersController(db,biz,new CurrentUserService(new HttpContextAccessor{HttpContext=context})){ControllerContext=new ControllerContext{HttpContext=context}};
        Assert.Equal("NEW",order.Status);
        var direct=new PreOrder {BusinessId=biz.CurrentBusinessId,PreOrderNo="DIRECT",CreatedByUserId=order.CreatedByUserId};
        db.PreOrders.Add(direct);await db.SaveChangesAsync();
        Assert.IsType<OkObjectResult>(await controller.UpdateWorkflow(direct.Id,new("RESOLVE","Purchased today",null,null,"PURCHASED")));
        Assert.Equal("RESOLVED",direct.Status);Assert.Equal("Purchased today",direct.StaffNote);
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateWorkflow(order.Id,new("RESOLVE",null,null,null,null)));
        Assert.IsType<OkObjectResult>(await controller.UpdateWorkflow(order.Id,new("START_REVIEW",null,null,null,null)));
        Assert.Equal("IN_PROGRESS",order.Status);
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateWorkflow(order.Id,new("RESOLVE",null,null,null,null)));
        Assert.IsType<OkObjectResult>(await controller.UpdateWorkflow(order.Id,new("UPDATE","Ordered",new DateTime(2026,10,1),"PO-1",null)));
        Assert.Equal("PO-1",order.PurchaseReference);
        Assert.IsType<OkObjectResult>(await controller.UpdateWorkflow(order.Id,new("CONTACTED","Called",null,null,null)));
        Assert.Equal("IN_PROGRESS",order.Status);
        Assert.IsType<OkObjectResult>(await controller.UpdateWorkflow(order.Id,new("RESOLVE","Collected",null,null,"PURCHASED")));
        Assert.Equal("RESOLVED",order.Status);Assert.NotNull(order.CompletedAt);
        Assert.Contains("Test Admin",order.ActivityJson);Assert.Contains("Called",order.ActivityJson);Assert.Contains("PO-1",order.ActivityJson);
        Assert.IsType<BadRequestObjectResult>(await controller.Cancel(order.Id,new("Late cancel")));
        Assert.IsType<BadRequestObjectResult>(await controller.UpdateWorkflow(order.Id,new("UPDATE","Changed",null,null,null)));
        biz.CurrentBusinessId=Guid.NewGuid();
        Assert.IsType<NotFoundObjectResult>(await controller.Get(order.Id));
    }
}
