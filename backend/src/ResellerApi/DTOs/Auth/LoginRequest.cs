using FluentValidation;

namespace ResellerApi.DTOs.Auth;

public record LoginRequest(string Phone, string Password);

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Phone)
            .NotEmpty()
            .Must(BePhoneOrEmail)
            .WithMessage("Enter a valid Bangladesh phone number or email address.");
        RuleFor(x => x.Password).NotEmpty();
    }

    private static bool BePhoneOrEmail(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Contains('@'))
            return new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(trimmed);

        return System.Text.RegularExpressions.Regex.IsMatch(trimmed, @"(?:\+?88)?01[3-9]\d{8}");
    }
}
