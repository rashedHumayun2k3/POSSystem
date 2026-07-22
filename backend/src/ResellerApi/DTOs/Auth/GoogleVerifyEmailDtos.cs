using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record GoogleVerifyEmailRequest(string IdToken);

public class GoogleVerifyEmailRequestValidator : AbstractValidator<GoogleVerifyEmailRequest>
{
    public GoogleVerifyEmailRequestValidator()
    {
        RuleFor(x => x.IdToken).NotEmpty();
    }
}
