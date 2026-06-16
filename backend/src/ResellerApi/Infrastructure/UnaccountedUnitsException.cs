namespace ResellerApi.Infrastructure;

/// <summary>
/// Thrown when a force-complete is attempted but ForceComplete flag is false.
/// Maps to HTTP 422 so the frontend can show a warning form rather than a generic error toast.
/// </summary>
public class UnaccountedUnitsException : Exception
{
    public List<UnaccountedItem> Items { get; }

    public UnaccountedUnitsException(List<UnaccountedItem> items)
        : base("Some items have unaccounted units. Set ForceComplete=true with a reason to proceed.")
    {
        Items = items;
    }
}

public record UnaccountedItem(string VariantSku, string ProductName, decimal QtyBought, decimal QtyEntered, decimal QtyUnaccounted);
