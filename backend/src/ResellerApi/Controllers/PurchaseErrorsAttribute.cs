using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ResellerApi.Controllers;

// Keep expected workflow validation readable by mobile clients; unexpected failures still propagate.
public sealed class PurchaseErrorsAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        var status = context.Exception switch
        {
            ArgumentException => 400,
            KeyNotFoundException => 404,
            InvalidOperationException => 409,
            _ => 0
        };
        if (status == 0) return;
        context.Result = new ObjectResult(new { message = context.Exception.Message }) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
