namespace ResellerApi.Services.Interfaces;

public interface IMediaService
{
    Task<string> SaveImageAsync(IFormFile file);
}
