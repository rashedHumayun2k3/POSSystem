namespace ResellerApi.Infrastructure;

/// <summary>
/// Thrown when adding a staff user or branch would exceed the company's current plan limit.
/// Maps to HTTP 402 so the frontend can show an upgrade prompt rather than a generic error toast.
/// </summary>
public class SubscriptionLimitException : Exception
{
    public SubscriptionLimitException(string message) : base(message) { }
}
