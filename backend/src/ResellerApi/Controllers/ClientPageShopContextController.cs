using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResellerApi.DTOs.ClientPage;
using ResellerApi.Infrastructure;

namespace ResellerApi.Controllers;

[ApiController]
[Route("api/v1/clientpage")]
[AllowAnonymous]
public class ClientPageShopContextController : ControllerBase
{
    private readonly ClientPageShopContext _shopContext;

    public ClientPageShopContextController(ClientPageShopContext shopContext)
    {
        _shopContext = shopContext;
    }

    [HttpGet("shop-context")]
    public ActionResult<ClientPageShopContextDto> GetShopContext()
    {
        return Ok(new ClientPageShopContextDto(
            _shopContext.IsShopMode ? "shop" : "marketplace",
            _shopContext.BusinessId,
            _shopContext.ShopName,
            _shopContext.LogoUrl,
            _shopContext.BannerUrl
        ));
    }
}
