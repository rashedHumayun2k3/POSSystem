using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

// One remembered address per phone number, shared across every shop on the marketplace (not
// business-scoped) — deliberately not an "address book" with multiple saved entries or any
// login: checkout stays guest, this is just a convenience cache keyed by phone that gets
// overwritten with whatever address was used most recently. See checkout flow — Owner decision:
// no OTP gate, since shop owners already call every customer to confirm the order by phone.
public class CpShippingAddress : BaseEntity
{
    public string Phone { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string BuildingStreet { get; set; } = null!;
    public string? ColonyLandmark { get; set; }
    public string City { get; set; } = null!;
    public string? Label { get; set; }
}
