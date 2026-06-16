using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ResellerApi.Hubs;

[Authorize]
public class LiveHub : Hub
{
    public async Task JoinBusiness(string businessId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"business_{businessId}");
    }

    public async Task LeaveBusiness(string businessId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"business_{businessId}");
    }
}
