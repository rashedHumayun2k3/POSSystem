using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class EmailVerification : BaseEntity
{
    public string Email { get; set; } = null!;
    public string CodeHash { get; set; } = null!;
    public string Purpose { get; set; } = EmailVerificationPurpose.Signup;
    public DateTime ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public DateTime? VerifiedAt { get; set; }
}
