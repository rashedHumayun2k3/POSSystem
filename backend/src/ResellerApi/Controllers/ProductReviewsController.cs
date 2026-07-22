using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Infrastructure;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/clientpage/products/{productId:guid}/reviews")]
public class ProductReviewsController : ControllerBase
{
    private readonly IProductReviewService _svc;

    public ProductReviewsController(IProductReviewService svc)
    {
        _svc = svc;
    }

    private Guid ReviewerAccountId => Guid.Parse(User.FindFirst("customer_account_id")!.Value);

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetReviews(Guid productId)
        => Ok(await _svc.GetReviewsAsync(productId));

    [HttpPost]
    [Authorize(Roles = Roles.ClientPageCustomer)]
    [EnableRateLimiting("clientpage-review")]
    public async Task<IActionResult> SubmitReview(Guid productId, [FromBody] SubmitReviewRequest request)
    {
        try
        {
            await _svc.SubmitReviewAsync(productId, ReviewerAccountId, request);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // Review-photo upload now lives on the standalone ResellerApi.MediaService app
    // (POST /api/v1/media/reviews/{productId}/upload).
}
