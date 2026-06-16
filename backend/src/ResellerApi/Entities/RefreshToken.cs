using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string Token { get; set; } = null!;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; } = false;

    public User User { get; set; } = null!;
}
