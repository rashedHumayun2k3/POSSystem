namespace ResellerApi.DTOs.ClientPage;

public record ClientPageShopContextDto(
    string Mode, // "shop" | "marketplace"
    Guid? BusinessId,
    string? ShopName,
    string? LogoUrl,
    string? BannerUrl,
    string? WebsiteUrl
);
