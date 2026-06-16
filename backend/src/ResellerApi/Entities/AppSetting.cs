using ResellerApi.Entities.Base;

namespace ResellerApi.Entities;

public class AppSetting : BusinessScopedEntity
{
    public string Key { get; set; } = null!;
    public string ValueJson { get; set; } = null!;
}
