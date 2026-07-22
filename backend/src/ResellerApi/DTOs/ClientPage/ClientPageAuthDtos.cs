using System.Text.Json.Serialization;

namespace ResellerApi.DTOs.ClientPage;

public record GoogleLoginRequest(string IdToken);

// Facebook's JS SDK returns an access token, not a self-contained ID token like Google's — the
// backend verifies it by calling Facebook's Graph API (see ClientPageAuthService), not by
// checking a signature locally.
public record FacebookLoginRequest(string AccessToken);

public record ClientPageAuthResponse(string AccessToken, string Name, string? PhotoUrl);

// ── Facebook Graph API response shapes (snake_case JSON — explicit names required, System.Text.
// Json's case-insensitive matching only handles casing, not missing underscores) ──────────────
public record FacebookDebugTokenResponse([property: JsonPropertyName("data")] FacebookDebugTokenData? Data);

public record FacebookDebugTokenData(
    [property: JsonPropertyName("is_valid")] bool IsValid,
    [property: JsonPropertyName("app_id")] string? AppId,
    [property: JsonPropertyName("user_id")] string? UserId
);

public record FacebookProfileResponse(
    string Id,
    string Name,
    string? Email,
    [property: JsonPropertyName("picture")] FacebookPicture? Picture
);

public record FacebookPicture([property: JsonPropertyName("data")] FacebookPictureData? Data);

public record FacebookPictureData([property: JsonPropertyName("url")] string? Url);
