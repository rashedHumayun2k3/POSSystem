using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ResellerApi.Data;

namespace ResellerApi.Hubs;

[Authorize]
public class LiveHub : Hub
{
    private readonly AppDbContext _db;
    public LiveHub(AppDbContext db) => _db = db;

    public async Task JoinBusiness(string businessId)
    {
        if (!Guid.TryParse(businessId, out var id) ||
            !Guid.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ||
            !await _db.BusinessUsers.AsNoTracking().AnyAsync(x => x.BusinessId == id && x.UserId == userId))
            throw new HubException("You do not have access to this business.");
        await Groups.AddToGroupAsync(Context.ConnectionId, $"business_{id}");
    }

    public async Task LeaveBusiness(string businessId)
    {
        if (Guid.TryParse(businessId, out var id))
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"business_{id}");
    }
}
