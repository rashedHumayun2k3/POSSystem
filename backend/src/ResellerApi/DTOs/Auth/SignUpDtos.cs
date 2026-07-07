using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record RequestSignupCodeRequest(string Email);

public class RequestSignupCodeRequestValidator : AbstractValidator<RequestSignupCodeRequest>
{
    public RequestSignupCodeRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public record VerifySignupCodeRequest(string Email, string Code);

public class VerifySignupCodeRequestValidator : AbstractValidator<VerifySignupCodeRequest>
{
    public VerifySignupCodeRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Code).NotEmpty().Length(6);
    }
}

public record SignUpRequest(
    string Email,
    string Name,
    string Phone,
    string Password,
    string BusinessName,
    string? Country
);

public class SignUpRequestValidator : AbstractValidator<SignUpRequest>
{
    public SignUpRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone)
            .NotEmpty()
            .Matches(@"(?:\+?88)?01[3-9]\d{8}")
            .WithMessage("Invalid Bangladesh phone number.");
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.BusinessName).NotEmpty().MaximumLength(200);
    }
}
