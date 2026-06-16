namespace ResellerApi.Entities;

public class Unit
{
    public string Code { get; set; } = null!; // pcs, kg, liter ...
    public string Name { get; set; } = null!;
    public bool AllowsDecimal { get; set; } = false;
}
