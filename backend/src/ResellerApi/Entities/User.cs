using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class User : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = null!;
    public string Phone { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string Role { get; set; } = null!; // OWNER, STAFF
    public decimal MonthlySalary { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    public Company Company { get; set; } = null!;
    public ICollection<BusinessUser> BusinessUsers { get; set; } = new List<BusinessUser>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
