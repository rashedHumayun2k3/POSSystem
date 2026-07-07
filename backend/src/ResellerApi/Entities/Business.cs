using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class Business : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = null!;
    public string Currency { get; set; } = "BDT";
    public string? Country { get; set; }
    public string? BusinessTypesJson { get; set; }
    public string? SalesChannelsJson { get; set; }
    public DateTime? OnboardingCompletedAt { get; set; }

    // ── ClientPage storefront ───────────────────────────────────────────────
    public string? Subdomain { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    public bool ShowOnMarketplace { get; set; }
    public bool StorefrontEnabled { get; set; }

    public Company Company { get; set; } = null!;
    public ICollection<BusinessUser> BusinessUsers { get; set; } = new List<BusinessUser>();
    public ICollection<Branch> Branches { get; set; } = new List<Branch>();
}
