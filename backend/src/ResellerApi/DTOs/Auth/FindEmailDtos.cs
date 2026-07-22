using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record FindMyEmailRequest(string Phone, string ShopName);

public class FindMyEmailRequestValidator : AbstractValidator<FindMyEmailRequest>
{
    public FindMyEmailRequestValidator()
    {
        RuleFor(x => x.Phone).NotEmpty();
        RuleFor(x => x.ShopName).NotEmpty();
    }
}

public record FindMyEmailResponse(bool Found, string? MaskedEmail);
