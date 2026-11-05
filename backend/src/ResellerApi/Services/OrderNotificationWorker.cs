using System.Net.Http.Headers;
using System.Text.Json;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;

namespace ResellerApi.Services;

public class OrderNotificationWorker(AppDbContext db, IHttpClientFactory clients, IConfiguration config, ILogger<OrderNotificationWorker> logger)
{
    // Hangfire's SQL distributed lock prevents multiple API instances sending the same batch.
    [DisableConcurrentExecution(300), AutomaticRetry(Attempts = 3)]
    public async Task Run()
    {
        await CreateHistory();
        if (!config.GetValue<bool>("PushNotifications:Enabled")) return;
        var now = DateTime.UtcNow;
        var deliveries = await db.OrderPushDeliveries.Include(d => d.Notification).Include(d => d.Device)
            .Where(d => (d.State == "PENDING" || d.State == "RECEIPT") && d.NextAttemptAt <= now)
            .OrderBy(d => d.NextAttemptAt).Take(100).ToListAsync();
        foreach (var delivery in deliveries)
        {
            try
            {
                if (!await CanDeliver(delivery)) { delivery.State = "CANCELLED"; }
                else if (delivery.Notification.CreatedAt < now.AddHours(-24)) { delivery.State = "EXPIRED"; }
                else if (delivery.State == "RECEIPT") await Receipt(delivery);
                else await Send(delivery);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
            {
                Retry(delivery, "TransportError");
                logger.LogWarning("Order notification delivery {DeliveryId} will retry after a transport error", delivery.Id);
            }
            await db.SaveChangesAsync();
        }
    }

    public async Task CreateHistory()
    {
        var events = await db.OrderNotificationEvents.Where(e => e.ProcessedAt == null)
            .OrderBy(e => e.CreatedAt).Take(100).ToListAsync();
        foreach (var evt in events)
        {
            var order = await db.Orders.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(o => o.Id == evt.OrderId && o.DeletedAt == null);
            if (order != null && order.Source is "CLIENTPAGE" or "EXTERNAL_WEBSITE")
            {
                var recipients = await OrderNotificationService.Recipients(db, order.BusinessId, order.BranchId).Select(m => m.UserId).ToListAsync();
                foreach (var userId in recipients)
                {
                    if (await db.OrderNotifications.AnyAsync(n => n.OrderId == order.Id && n.RecipientId == userId)) continue;
                    var notification = new OrderNotification { OrderId = order.Id, BusinessId = order.BusinessId, BranchId = order.BranchId,
                        RecipientId = userId, OrderNo = order.OrderNo, CreatedAt = evt.CreatedAt };
                    db.OrderNotifications.Add(notification);
                    var devices = await db.PushDevices.Where(d => d.UserId == userId && d.Enabled && d.BusinessId == order.BusinessId &&
                        (d.BranchId == null || d.BranchId == order.BranchId)).ToListAsync();
                    foreach (var device in devices) db.OrderPushDeliveries.Add(new OrderPushDelivery { Notification = notification, Device = device });
                }
            }
            evt.ProcessedAt = DateTime.UtcNow;
            // History, device deliveries and event acknowledgement commit together.
            await db.SaveChangesAsync();
        }
    }

    public async Task<bool> CanDeliver(OrderPushDelivery delivery)
    {
        var d = delivery.Device; var n = delivery.Notification;
        return await db.PushDevices.AsNoTracking().AnyAsync(device => device.Id == d.Id && device.Enabled && device.UserId == n.RecipientId &&
                device.BusinessId == n.BusinessId && (device.BranchId == null || device.BranchId == n.BranchId) &&
                db.RefreshTokens.Any(t => t.Id == device.RefreshTokenId && t.UserId == device.UserId && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow)) &&
            await db.Orders.IgnoreQueryFilters().AnyAsync(o => o.Id == n.OrderId && o.DeletedAt == null && o.OrderStatus != "CANCELLED") &&
            await OrderNotificationService.Recipients(db, n.BusinessId, n.BranchId).AnyAsync(m => m.UserId == n.RecipientId);
    }

    private HttpClient Client()
    {
        var client = clients.CreateClient("ExpoPush");
        if (!string.IsNullOrWhiteSpace(config["PushNotifications:AccessToken"]))
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config["PushNotifications:AccessToken"]);
        return client;
    }

    private async Task Send(OrderPushDelivery delivery)
    {
        delivery.Attempts++;
        var n = delivery.Notification; var bn = delivery.Device.Language == "bn";
        using var client = Client();
        using var response = await client.PostAsJsonAsync("https://exp.host/--/api/v2/push/send", new {
            to = delivery.Device.Token, sound = "default", channelId = "new-orders", priority = "high", ttl = 3600,
            title = bn ? "নতুন অর্ডার এসেছে" : "New online order",
            body = bn ? $"অর্ডার {n.OrderNo} দেখতে ট্যাপ করুন।" : $"Tap to view order {n.OrderNo}.",
            data = new { type = "NEW_ORDER", notificationId = n.Id, orderId = n.OrderId, businessId = n.BusinessId, branchId = n.BranchId, recipientId = n.RecipientId }
        });
        if (!response.IsSuccessStatusCode) { HttpFailure(delivery, (int)response.StatusCode); return; }
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (!json.RootElement.TryGetProperty("data", out var ticket)) { Retry(delivery, "MissingTicket"); return; }
        if (ticket.ValueKind == JsonValueKind.Array && ticket.GetArrayLength() > 0) ticket = ticket[0];
        if (ticket.ValueKind != JsonValueKind.Object || !ticket.TryGetProperty("status", out var status)) { Retry(delivery, "InvalidTicket"); return; }
        if (status.GetString() == "ok" && ticket.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(id.GetString()))
        {
            delivery.TicketId = id.GetString(); delivery.State = "RECEIPT"; delivery.SentAt = DateTime.UtcNow;
            delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(15); delivery.LastError = null;
        }
        else TicketFailure(delivery, ticket);
    }

    private async Task Receipt(OrderPushDelivery delivery)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("https://exp.host/--/api/v2/push/getReceipts", new { ids = new[] { delivery.TicketId } });
        if (!response.IsSuccessStatusCode) { HttpFailure(delivery, (int)response.StatusCode); return; }
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (!json.RootElement.TryGetProperty("data", out var data) || !data.TryGetProperty(delivery.TicketId!, out var receipt))
        {
            if (delivery.SentAt < DateTime.UtcNow.AddHours(-23)) { delivery.State = "UNKNOWN"; delivery.LastError = "ReceiptUnavailable"; }
            else delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(15);
            return;
        }
        if (receipt.ValueKind != JsonValueKind.Object || !receipt.TryGetProperty("status", out var status)) { Retry(delivery, "InvalidReceipt"); return; }
        if (status.GetString() == "ok") { delivery.State = "DELIVERED"; delivery.LastError = null; }
        else TicketFailure(delivery, receipt);
    }

    private void TicketFailure(OrderPushDelivery delivery, JsonElement result)
    {
        var code = result.TryGetProperty("details", out var details) && details.TryGetProperty("error", out var error)
            ? error.GetString() ?? "UnknownError" : "UnknownError";
        delivery.LastError = code;
        if (code == "DeviceNotRegistered") { delivery.Device.Enabled = false; delivery.State = "CANCELLED"; }
        else if (code == "MessageRateExceeded") { delivery.State = "PENDING"; delivery.TicketId = null; Retry(delivery, code); }
        else { delivery.State = "FAILED"; logger.LogWarning("Order push {DeliveryId} failed: {Code}", delivery.Id, code); }
    }

    private static void HttpFailure(OrderPushDelivery delivery, int status)
    {
        if (status == 429 || status >= 500) Retry(delivery, $"HTTP{status}");
        else { delivery.State = "FAILED"; delivery.LastError = $"HTTP{status}"; }
    }

    private static void Retry(OrderPushDelivery delivery, string error)
    {
        delivery.LastError = error;
        if (delivery.Attempts >= 6 && delivery.State != "RECEIPT") delivery.State = "FAILED";
        else delivery.NextAttemptAt = DateTime.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, delivery.Attempts)));
    }
}
