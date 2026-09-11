using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// Platform-wide reviewer identity (Google or Facebook Sign-In) — deliberately NOT
// BusinessScopedEntity, since one real person can review products from many different shops.
// Not the same thing as Customer, which is per-business CRM data (credit limits, rejecter
// flags) and must never be conflated with a public-facing reviewer profile.
//
// GoogleId/FacebookId are both nullable since an account originates from exactly one provider
// (never both) — application logic (ClientPageAuthService) guarantees at least one is set.
// Email is nullable too: Google always returns it, but a Facebook user can decline to share
// theirs, so it can't be relied on the way it could when Google was the only provider.
public class ClientPageCustomerAccount : BaseEntity
{
    public string? GoogleId { get; set; }
    public string? FacebookId { get; set; }
    public string? Email { get; set; }
    public string Name { get; set; } = null!;
    public string? PhotoUrl { get; set; }

    public ICollection<ProductReview> Reviews { get; set; } = new List<ProductReview>();
}
