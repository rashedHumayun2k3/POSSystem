namespace ResellerApi.DTOs.Common;

public record PagedResult<T>(List<T> Items, int Total, int Page, int PageSize);
