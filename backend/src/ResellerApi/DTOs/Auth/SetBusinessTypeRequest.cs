using FluentValidation;
using ResellerApi.Infrastructure;

namespace ResellerApi.DTOs.Auth;

public record SetBusinessTypesRequest(string[] BusinessTypes);

public class SetBusinessTypesRequestValidator : AbstractValidator<SetBusinessTypesRequest>
{
    public SetBusinessTypesRequestValidator()
    {
        RuleFor(x => x.BusinessTypes)
            .NotEmpty()
            .WithMessage("Select at least one business type.");
        RuleForEach(x => x.BusinessTypes)
            .Must(bt => BusinessTypes.All.Contains(bt))
            .WithMessage($"Invalid business type. Allowed: {string.Join(", ", BusinessTypes.All)}.");
    }
}
