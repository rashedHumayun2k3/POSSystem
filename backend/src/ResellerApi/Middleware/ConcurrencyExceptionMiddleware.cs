using Microsoft.EntityFrameworkCore;

namespace ResellerApi.Middleware;

// Catches EF Core's optimistic-concurrency failure (rowversion mismatch — "expected to affect 1
// row(s), but actually affected 0 row(s)") anywhere in the pipeline and maps it to a 409 with a
// human message, per GTR-5 ("Optimistic concurrency via rowversion on mutable tables; return 409
// with a human message on conflict"). Registered first in the pipeline so it wraps every
// downstream request — this rule applies to every mutable entity, not just one endpoint.
public class ConcurrencyExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public ConcurrencyExceptionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DbUpdateConcurrencyException)
        {
            if (context.Response.HasStarted) throw;

            context.Response.StatusCode = 409;
            await context.Response.WriteAsJsonAsync(new
            {
                code = "CONCURRENCY_CONFLICT",
                message = "This record was changed elsewhere. Please refresh and try again."
            });
        }
    }
}
