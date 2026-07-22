using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record RequestPasswordResetRequest(string Email);

public class RequestPasswordResetRequestValidator : AbstractValidator<RequestPasswordResetRequest>
{
    public RequestPasswordResetRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public record VerifyPasswordResetRequest(string Email, string Code);

public class VerifyPasswordResetRequestValidator : AbstractValidator<VerifyPasswordResetRequest>
{
    public VerifyPasswordResetRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Code).NotEmpty().Length(6);
    }
}

public record CompletePasswordResetRequest(string Email, string NewPassword);

public class CompletePasswordResetRequestValidator : AbstractValidator<CompletePasswordResetRequest>
{
    public CompletePasswordResetRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}
