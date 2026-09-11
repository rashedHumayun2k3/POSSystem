namespace ResellerApi.Entities.Base;

public interface IBranchScoped
{
    Guid? BranchId { get; set; }
}
