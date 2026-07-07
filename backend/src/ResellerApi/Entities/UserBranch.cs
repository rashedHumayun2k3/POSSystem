namespace ResellerApi.Entities;

public class UserBranch
{
    public Guid UserId { get; set; }
    public Guid BranchId { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
}
