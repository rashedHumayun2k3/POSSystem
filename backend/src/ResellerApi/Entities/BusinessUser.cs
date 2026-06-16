namespace ResellerApi.Entities;

public class BusinessUser
{
    public Guid BusinessId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Business Business { get; set; } = null!;
    public User User { get; set; } = null!;
}
