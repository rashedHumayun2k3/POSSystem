using FluentValidation;
using ResellerApi.Infrastructure;

namespace ResellerApi.DTOs.Auth;

public record SetSalesChannelsRequest(string[] SalesChannels);

public class SetSalesChannelsRequestValidator : AbstractValidator<SetSalesChannelsRequest>
{
    public SetSalesChannelsRequestValidator()
    {
        RuleFor(x => x.SalesChannels)
            .NotEmpty()
            .WithMessage("Select at least one sales channel.");
        RuleForEach(x => x.SalesChannels)
            .Must(sc => SalesChannels.All.Contains(sc))
            .WithMessage($"Invalid sales channel. Allowed: {string.Join(", ", SalesChannels.All)}.");
    }
}
