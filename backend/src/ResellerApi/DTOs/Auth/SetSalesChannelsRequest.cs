using FluentValidation;
using ResellerApi.Infrastructure;

namespace ResellerApi.DTOs.Auth;

public record SetSalesChannelsRequest(string[] SalesChannels, string? ShopType = null);

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
        RuleFor(x => x.SalesChannels)
            .Must(SalesChannels.IsValidCombination)
            .WithMessage("A business can't be both a Big Supershop and a Hawker/Small Shop at the same time.");
        RuleFor(x => x.ShopType)
            .Must(shopType => shopType == null || ShopTypes.All.Contains(shopType))
            .WithMessage($"Invalid shop type. Allowed: {string.Join(", ", ShopTypes.All)}.");
        RuleFor(x => x)
            .Must(x => x.ShopType == null || ShopTypes.MatchesChannels(x.ShopType, x.SalesChannels))
            .WithMessage("The selected shop type does not match its sales channels.");
    }
}
