using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record LoginRequest(string Phone, string Password);

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Phone)
            .NotEmpty()
            .Matches(@"(?:\+?88)?01[3-9]\d{8}")
            .WithMessage("Invalid Bangladesh phone number.");
        RuleFor(x => x.Password).NotEmpty();
    }
}
