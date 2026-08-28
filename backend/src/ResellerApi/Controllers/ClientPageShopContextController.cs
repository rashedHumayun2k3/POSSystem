using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
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
            _shopContext.BannerUrl,
            _shopContext.WebsiteUrl,
            DeserializeWebsiteSettings(_shopContext.WebsiteSettingsJson)
        ));
    }

    private static StorefrontWebsiteSettingsDto? DeserializeWebsiteSettings(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<StorefrontWebsiteSettingsDto>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
