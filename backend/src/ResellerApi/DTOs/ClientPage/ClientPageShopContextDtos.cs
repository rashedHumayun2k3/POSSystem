namespace ResellerApi.DTOs.ClientPage;

public record ClientPageShopContextDto(
    string Mode, // "shop" | "marketplace"
    Guid? BusinessId,
    string? ShopName,
    string? LogoUrl,
    string? BannerUrl,
    string? WebsiteUrl,
    StorefrontWebsiteSettingsDto? WebsiteSettings
);

public record StorefrontWebsiteSettingsDto(
    string? FaviconUrl,
    List<string>? SliderImageUrls,
    string? AboutText,
    string? ContactPhone,
    string? WhatsappNumber,
    string? ContactEmail,
    string? Address,
    string? DeliveryPolicy,
    string? ReturnPolicy,
    string? PrivacyPolicy,
    string? TermsPolicy
);
