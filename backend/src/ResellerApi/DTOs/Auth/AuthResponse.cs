namespace ResellerApi.DTOs.Auth;

public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    UserDto User,
    IEnumerable<BusinessDto> Businesses
);

public record UserDto(Guid Id, string Name, string Phone, string? Email, string Role, string? PhotoUrl, bool CanAccessPos);
public record BusinessDto(Guid Id, string Name, string Currency, string? Country, string[] BusinessTypes, string[] SalesChannels, bool OnboardingCompleted);
