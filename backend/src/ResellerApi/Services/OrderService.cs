using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.DTOs.Orders;
using ResellerApi.Entities;
using ResellerApi.Services.Interfaces;

namespace ResellerApi.Services;

public class StockUnavailableException : Exception
{
    public List<string> UnavailableItems { get; }
    public StockUnavailableException(List<string> items)
        : base("Insufficient stock for one or more items.")
    {
        UnavailableItems = items;
    }
}

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly IActivityLogService _log;

    public OrderService(AppDbContext db, IActivityLogService log)
    {
        _db = db;
        _log = log;
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> CreateAsync(CreateOrderRequest request, Guid userId)
    {
        // Idempotency check
        if (!string.IsNullOrWhiteSpace(request.ClientUid))
        {
            var existing = await _db.Orders
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.ClientUid == request.ClientUid);
            if (existing != null)
                return await GetAsync(existing.Id, true);
        }

        // Auto-create customer
        var customer = await FindOrCreateCustomerAsync(request.CustomerPhone, request.CustomerName, request.CustomerAddress);

        // Generate order number
        var orderNo = await GenerateOrderNoAsync();

        var order = new Order
        {
            BusinessId = _db.CurrentBusinessId,
            BranchId = _db.CurrentBranchId
                ?? throw new InvalidOperationException("A branch must be selected to create an order."),
            OrderNo = orderNo,
            Channel = request.Channel,
            BusinessDate = request.BusinessDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            CustomerId = customer.Id,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            CustomerAddress = request.CustomerAddress,
            IsDraft = request.IsDraft,
            DiscountType = request.DiscountType,
            DiscountValue = request.DiscountValue,
            DeliveryChargeCustomer = request.DeliveryChargeCustomer,
            AdvancePaid = request.AdvancePaid,
            Note = request.Note,
            ClientUid = request.ClientUid,
            CourierId = request.CourierId,
            CreatedBy = userId,
            OrderStatus = "OPEN",
            PaymentStatus = request.AdvancePaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
            FulfillmentStatus = "UNFULFILLED"
        };

        foreach (var item in request.Items)
        {
            order.Items.Add(new OrderItem
            {
                VariantId = item.VariantId,
                Qty = item.Qty,
                UnitPrice = item.UnitPrice
            });
        }

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        // Add initial advance payment if > 0
        if (request.AdvancePaid > 0)
        {
            _db.OrderPayments.Add(new OrderPayment
            {
                OrderId = order.Id,
                Method = request.AdvancePaymentMethod ?? "CASH",
                Amount = request.AdvancePaid,
                ReceivedAt = DateTime.UtcNow,
                UserId = userId
            });
            await _db.SaveChangesAsync();
        }

        // Auto-confirm if not a draft
        if (!request.IsDraft)
        {
            try
            {
                order = await ConfirmInternalAsync(order, userId);
            }
            catch (StockUnavailableException)
            {
                // The order row above was already persisted — ConfirmInternalAsync needs a
                // real Id for its StockMovement/OrderStatusHistory references, so it can't run
                // before the initial save. If confirmation then fails, this order was never a
                // real, actionable one (no stock ever committed) — soft-delete it (GTR-6) rather
                // than leave a phantom OPEN/UNFULFILLED order visible to staff with nothing
                // behind it.
                order.DeletedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                throw;
            }
        }

        await _log.LogAsync(_db.CurrentBusinessId, userId, "CREATE", "Order", order.Id);
        return await GetAsync(order.Id, true);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public async Task<List<OrderListDto>> ListAsync(string? orderStatus, string? fulfillmentStatus, string? channel, string? q, DateTime? from, DateTime? to, bool canSeeCosts)
    {
        var query = _db.Orders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(o => o.Payments)
            .Include(o => o.HandlingUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(orderStatus))
            query = query.Where(o => o.OrderStatus == orderStatus);
        if (!string.IsNullOrWhiteSpace(fulfillmentStatus))
            query = query.Where(o => o.FulfillmentStatus == fulfillmentStatus);
        if (!string.IsNullOrWhiteSpace(channel))
            query = query.Where(o => o.Channel == channel);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var lower = q.ToLower();
            query = query.Where(o =>
                o.OrderNo.ToLower().Contains(lower) ||
                o.CustomerName.ToLower().Contains(lower) ||
                o.CustomerPhone.Contains(q) ||
                o.Items.Any(i => i.DeletedAt == null &&
                    (i.Variant.Sku.ToLower().Contains(lower) || i.Variant.Product.Sku.ToLower().Contains(lower))));
        }
        if (from.HasValue)
            query = query.Where(o => o.CreatedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(o => o.CreatedAt <= to.Value);

        var orders = await query
            .OrderByDescending(o => o.BusinessDate).ThenByDescending(o => o.CreatedAt)
            .Take(200)
            .ToListAsync();

        return orders.Select(o => ToListDto(o, canSeeCosts)).ToList();
    }

    // ── List by product ───────────────────────────────────────────────────────

    public async Task<List<OrderListDto>> ListByProductAsync(Guid productId, bool canSeeCosts)
    {
        var orders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(o => o.Payments)
            .Include(o => o.HandlingUser)
            .Where(o => o.Items.Any(i => i.Variant != null && i.Variant.ProductId == productId))
            .OrderByDescending(o => o.BusinessDate).ThenByDescending(o => o.CreatedAt)
            .Take(200)
            .ToListAsync();

        return orders.Select(o => ToListDto(o, canSeeCosts)).ToList();
    }

    // ── Get ───────────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> GetAsync(Guid id, bool isOwner)
    {
        var order = await LoadFullOrderAsync(id)
            ?? throw new KeyNotFoundException("Order not found.");
        return ToDetailDto(order, isOwner);
    }

    // ── Update (draft only) ───────────────────────────────────────────────────

    public async Task<OrderDetailDto> UpdateAsync(Guid id, UpdateOrderRequest request, Guid userId)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.OrderStatus == "CANCELLED")
            throw new InvalidOperationException("Cannot edit a cancelled order.");

        // Basic fields — always editable (draft or live, any fulfillment stage except terminal)
        if (request.CustomerName != null) order.CustomerName = request.CustomerName;
        if (request.CustomerAddress != null) order.CustomerAddress = request.CustomerAddress;
        if (request.Channel != null) order.Channel = request.Channel;
        if (request.Note != null) order.Note = request.Note;
        if (request.CourierId.HasValue) order.CourierId = request.CourierId;

        // Pricing fields — only for draft orders (frozen at confirm per GTR-8)
        if (order.IsDraft)
        {
            if (request.DiscountType != null) order.DiscountType = request.DiscountType;
            if (request.DiscountValue.HasValue) order.DiscountValue = request.DiscountValue;
            if (request.DeliveryChargeCustomer.HasValue) order.DeliveryChargeCustomer = request.DeliveryChargeCustomer.Value;
        }

        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Delete (soft, OWNER-only) ──────────────────────────────────────────────

    public async Task DeleteAsync(Guid id, string reason, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.OrderStatus == "CANCELLED")
            throw new InvalidOperationException("Order is already cancelled. Cannot delete.");
        if (order.FulfillmentStatus == "IN_TRANSIT" || order.FulfillmentStatus == "DELIVERED")
            throw new InvalidOperationException("Cannot delete an order that is in transit or delivered. Cancel it first.");
        if (order.FulfillmentStatus == "RETURNED")
            throw new InvalidOperationException("Cannot delete a returned order.");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Release committed stock if the order was confirmed (stock was reserved)
            if (!order.IsDraft && order.ConfirmedAt.HasValue)
            {
                foreach (var item in order.Items.Where(i => i.DeletedAt == null))
                {
                    var inv = await _db.BranchVariantInventories
                        .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                        .FirstOrDefaultAsync();
                    if (inv != null)
                    {
                        inv.Committed = Math.Max(0, inv.Committed - item.Qty);
                        _db.StockMovements.Add(new StockMovement
                        {
                            BusinessId = _db.CurrentBusinessId,
                            BranchId = order.BranchId,
                            VariantId = item.VariantId,
                            MovementType = "RELEASE",
                            Qty = item.Qty,
                            ReferenceType = "Order",
                            ReferenceId = order.Id,
                            UserId = userId,
                            Note = $"Order deleted: {reason}"
                        });
                    }
                }
            }

            order.CancelledReason = reason;
            order.DeletedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_db.CurrentBusinessId, userId, "DELETE", "Order", order.Id);
    }

    // ── Confirm ───────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> ConfirmAsync(Guid id, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.FulfillmentStatus != "UNFULFILLED")
            throw new InvalidOperationException($"Order cannot be confirmed in status {order.FulfillmentStatus}.");

        order = await ConfirmInternalAsync(order, userId);
        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Pack ──────────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> PackAsync(Guid id, Guid userId)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.FulfillmentStatus != "UNFULFILLED" || order.IsDraft)
            throw new InvalidOperationException("Order must be confirmed (not draft) and UNFULFILLED to pack.");

        var prev = order.FulfillmentStatus;
        order.FulfillmentStatus = "PACKED";
        _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "FULFILLMENT", FromStatus = prev, ToStatus = "PACKED", UserId = userId });
        await _db.SaveChangesAsync();

        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Handover ──────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> HandoverAsync(Guid id, HandoverOrderRequest request, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.FulfillmentStatus != "PACKED")
            throw new InvalidOperationException("Order must be PACKED before handover.");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            foreach (var item in order.Items.Where(i => i.DeletedAt == null))
            {
                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                    .FirstOrDefaultAsync()
                    ?? throw new InvalidOperationException($"Inventory record not found for variant {item.VariantId}.");

                inv.OnHand -= item.Qty;
                inv.Committed -= item.Qty;

                _db.StockMovements.Add(new StockMovement
                {
                    BusinessId = _db.CurrentBusinessId,
                    BranchId = order.BranchId,
                    VariantId = item.VariantId,
                    MovementType = "SALE_OUT",
                    Qty = -item.Qty,
                    ReferenceType = "Order",
                    ReferenceId = order.Id,
                    UserId = userId
                });
            }

            var prev = order.FulfillmentStatus;
            order.FulfillmentStatus = "IN_TRANSIT";
            order.HandedOverAt = DateTime.UtcNow;
            order.CourierId = request.CourierId;
            order.DeliveryManId = request.DeliveryManId;
            order.TrackingNo = request.TrackingNo;
            order.DeliveryCostActual = request.DeliveryCostActual;

            _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "FULFILLMENT", FromStatus = prev, ToStatus = "IN_TRANSIT", UserId = userId });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Deliver ───────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> DeliverAsync(Guid id, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.FulfillmentStatus != "IN_TRANSIT")
            throw new InvalidOperationException("Order must be IN_TRANSIT to mark delivered.");

        var prev = order.FulfillmentStatus;
        order.FulfillmentStatus = "DELIVERED";
        order.DeliveredAt = DateTime.UtcNow;
        order.OrderStatus = "COMPLETED";

        // Set COD remittance status: if courier holds unpaid cash, track it
        var total = ComputeTotal(order);
        var paid = order.Payments.Sum(p => p.Amount);
        order.CodRemittanceStatus = (total - paid > 0 && order.CourierId.HasValue)
            ? "PENDING"
            : "NOT_APPLICABLE";

        _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "FULFILLMENT", FromStatus = prev, ToStatus = "DELIVERED", UserId = userId });
        _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "ORDER", FromStatus = "OPEN", ToStatus = "COMPLETED", UserId = userId });

        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Return ────────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> ReturnAsync(Guid id, ReturnOrderRequest request, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.FulfillmentStatus != "IN_TRANSIT" && order.FulfillmentStatus != "DELIVERED")
            throw new InvalidOperationException("Order must be IN_TRANSIT or DELIVERED to return.");

        // Return window enforcement (R9.4): configurable days, default 7
        if (order.DeliveredAt.HasValue)
        {
            var windowDays = 7; // TODO: read from AppSettings when settings module is wired
            var cutoff = order.DeliveredAt.Value.AddDays(windowDays);
            if (DateTime.UtcNow > cutoff)
                throw new InvalidOperationException(
                    $"Return window of {windowDays} days has expired (delivered {order.DeliveredAt.Value:yyyy-MM-dd}).");
        }

        var validResolutions = new[] { "COURIER_RETURN", "REFUND", "STORE_CREDIT", "REPLACE_SAME", "EXCHANGE_DIFFERENT" };
        if (!validResolutions.Contains(request.ResolutionType))
            throw new InvalidOperationException($"Invalid resolution type '{request.ResolutionType}'.");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // ── Stock movements per item ──────────────────────────────────────
            foreach (var ri in request.Items)
            {
                var item = order.Items.FirstOrDefault(i => i.Id == ri.OrderItemId)
                    ?? throw new KeyNotFoundException($"Order item {ri.OrderItemId} not found.");

                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                    .FirstOrDefaultAsync()
                    ?? throw new InvalidOperationException($"Inventory record not found for variant {item.VariantId}.");

                var notePrefix = request.ResolutionType switch
                {
                    "COURIER_RETURN" => "Courier return",
                    "REFUND" => "Refund return",
                    "STORE_CREDIT" => "Store credit return",
                    "REPLACE_SAME" => "Replacement return",
                    "EXCHANGE_DIFFERENT" => "Exchange return",
                    _ => "Customer return"
                };

                if (ri.Inspection == "SELLABLE")
                {
                    inv.OnHand += ri.Qty;
                    _db.StockMovements.Add(new StockMovement
                    {
                        BusinessId = _db.CurrentBusinessId,
                        BranchId = order.BranchId,
                        VariantId = item.VariantId,
                        MovementType = "RETURN_IN",
                        Qty = ri.Qty,
                        ReferenceType = "Order",
                        ReferenceId = order.Id,
                        UserId = userId,
                        Note = $"{notePrefix} — sellable"
                    });
                }
                else
                {
                    inv.Damaged += ri.Qty;
                    _db.StockMovements.Add(new StockMovement
                    {
                        BusinessId = _db.CurrentBusinessId,
                        BranchId = order.BranchId,
                        VariantId = item.VariantId,
                        MovementType = "DAMAGE_IN",
                        Qty = ri.Qty,
                        ReferenceType = "Order",
                        ReferenceId = order.Id,
                        UserId = userId,
                        Note = $"{notePrefix} — damaged"
                    });
                }
            }

            // ── Financial resolution ──────────────────────────────────────────
            if (request.ResolutionType == "REFUND" && request.RefundAmount is > 0)
            {
                // Negative payment = money going back to customer
                _db.OrderPayments.Add(new OrderPayment
                {
                    OrderId = order.Id,
                    Method = $"REFUND_{request.RefundMethod ?? "CASH"}",
                    Amount = -request.RefundAmount.Value,
                    ReceivedAt = DateTime.UtcNow,
                    UserId = userId
                });
                // Mark order as refunded if full amount returned
                var totalPaid = order.Payments.Sum(p => p.Amount) - request.RefundAmount.Value;
                order.PaymentStatus = totalPaid <= 0 ? "REFUNDED" : "PARTIALLY_PAID";
            }
            else if (request.ResolutionType == "STORE_CREDIT" && request.RefundAmount is > 0 && order.Customer != null)
            {
                order.Customer.StoreCreditBalance += request.RefundAmount.Value;
                // Store credit is not cash out — record as a zero-cash resolved payment note
                _db.OrderPayments.Add(new OrderPayment
                {
                    OrderId = order.Id,
                    Method = "STORE_CREDIT",
                    Amount = -request.RefundAmount.Value,
                    ReceivedAt = DateTime.UtcNow,
                    UserId = userId
                });
                order.PaymentStatus = "REFUNDED";
            }

            // ── Order resolution fields ───────────────────────────────────────
            order.ReturnResolution = request.ResolutionType;
            order.ReturnReason     = request.Reason;
            order.ReturnNote       = request.Note;

            var prev = order.FulfillmentStatus;
            order.FulfillmentStatus = "RETURNED";
            order.ReturnedAt = DateTime.UtcNow;

            _db.OrderStatusHistories.Add(new OrderStatusHistory
            {
                OrderId = order.Id,
                Track = "FULFILLMENT",
                FromStatus = prev,
                ToStatus = "RETURNED",
                UserId = userId
            });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.OrderStatus == "CANCELLED")
            throw new InvalidOperationException("Order is already cancelled.");
        if (order.FulfillmentStatus == "IN_TRANSIT" || order.FulfillmentStatus == "DELIVERED")
            throw new InvalidOperationException("Cannot cancel an order that is in transit or delivered.");

        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Release committed stock only if order was confirmed
            if (!order.IsDraft && order.ConfirmedAt.HasValue)
            {
                foreach (var item in order.Items.Where(i => i.DeletedAt == null))
                {
                    var inv = await _db.BranchVariantInventories
                        .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                        .FirstOrDefaultAsync();

                    if (inv != null)
                    {
                        inv.Committed = Math.Max(0, inv.Committed - item.Qty);
                        _db.StockMovements.Add(new StockMovement
                        {
                            BusinessId = _db.CurrentBusinessId,
                            BranchId = order.BranchId,
                            VariantId = item.VariantId,
                            MovementType = "RELEASE",
                            Qty = item.Qty,
                            ReferenceType = "Order",
                            ReferenceId = order.Id,
                            UserId = userId
                        });
                    }
                }
            }

            var prevOrder = order.OrderStatus;
            order.OrderStatus = "CANCELLED";
            order.CancelledReason = request.Reason;

            _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "ORDER", FromStatus = prevOrder, ToStatus = "CANCELLED", UserId = userId });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _log.LogAsync(_db.CurrentBusinessId, userId, "UPDATE", "Order", order.Id);
        return await GetAsync(id, true);
    }

    // ── Payment ───────────────────────────────────────────────────────────────

    public async Task<OrderDetailDto> AddPaymentAsync(Guid id, AddOrderPaymentRequest request, Guid userId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");

        _db.OrderPayments.Add(new OrderPayment
        {
            OrderId = order.Id,
            Method = request.Method,
            Amount = request.Amount,
            ReceivedAt = request.ReceivedAt ?? DateTime.UtcNow,
            UserId = userId
        });

        // Recompute payment status
        var totalPaid = order.Payments.Sum(p => p.Amount) + request.Amount;
        var total = ComputeTotal(order);

        var prevPayment = order.PaymentStatus;
        order.PaymentStatus = totalPaid >= total ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

        if (prevPayment != order.PaymentStatus)
            _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "PAYMENT", FromStatus = prevPayment, ToStatus = order.PaymentStatus, UserId = userId });

        await _db.SaveChangesAsync();
        await _log.LogAsync(_db.CurrentBusinessId, userId, "CREATE", "OrderPayment", order.Id);
        return await GetAsync(id, true);
    }

    // ── Claim ─────────────────────────────────────────────────────────────────

    public async Task ClaimAsync(Guid id, Guid userId)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id)
            ?? throw new KeyNotFoundException("Order not found.");
        order.HandlingUserId = userId;
        await _db.SaveChangesAsync();
    }

    // ── Challan PDF ───────────────────────────────────────────────────────────

    public async Task<byte[]> GetChallanPdfAsync(Guid id)
    {
        var order = await LoadFullOrderAsync(id)
            ?? throw new KeyNotFoundException("Order not found.");

        var business = await _db.Businesses.AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == _db.CurrentBusinessId);

        return ChallanPdfGenerator.Generate(order, business?.Name ?? "");
    }

    // ── Receipt PDF ───────────────────────────────────────────────────────────

    public async Task<byte[]> GetReceiptPdfAsync(Guid id)
    {
        var order = await LoadFullOrderAsync(id)
            ?? throw new KeyNotFoundException("Order not found.");

        var business = await _db.Businesses.AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == _db.CurrentBusinessId);

        Branch? branch = null;
        if (order.BranchId.HasValue)
            branch = await _db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == order.BranchId.Value);

        return ReceiptPdfGenerator.Generate(order, business?.Name ?? "", branch?.Address, branch?.Phone);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private async Task<Order> ConfirmInternalAsync(Order order, Guid userId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var unavailable = new List<string>();

            foreach (var item in order.Items.Where(i => i.DeletedAt == null))
            {
                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                    .FirstOrDefaultAsync();

                var available = inv?.Available ?? 0;
                if (available < item.Qty)
                {
                    var variant = await _db.ProductVariants.AsNoTracking()
                        .Include(v => v.Product)
                        .FirstOrDefaultAsync(v => v.Id == item.VariantId);
                    unavailable.Add($"{variant?.Product?.Name ?? "Unknown"} ({variant?.Sku ?? item.VariantId.ToString()}): need {item.Qty}, available {available}");
                }
            }

            if (unavailable.Any())
                throw new StockUnavailableException(unavailable);

            foreach (var item in order.Items.Where(i => i.DeletedAt == null))
            {
                var inv = await _db.BranchVariantInventories
                    .FromSqlRaw("SELECT * FROM branch_variant_inventories WITH (UPDLOCK) WHERE [BranchId] = {0} AND [VariantId] = {1}", order.BranchId, item.VariantId)
                    .FirstOrDefaultAsync()!;

                inv!.Committed += item.Qty;

                // Snapshot costs at confirm time (GTR-8)
                var variant = await _db.ProductVariants.AsNoTracking()
                    .FirstOrDefaultAsync(v => v.Id == item.VariantId);
                item.UnitCostSnapshot = variant?.AvgLandedCost;

                _db.StockMovements.Add(new StockMovement
                {
                    BusinessId = _db.CurrentBusinessId,
                    BranchId = order.BranchId,
                    VariantId = item.VariantId,
                    MovementType = "COMMIT",
                    Qty = item.Qty,
                    ReferenceType = "Order",
                    ReferenceId = order.Id,
                    UserId = userId
                });
            }

            var prev = order.IsDraft ? "DRAFT" : order.FulfillmentStatus;
            order.IsDraft = false;
            order.ConfirmedAt = DateTime.UtcNow;

            _db.OrderStatusHistories.Add(new OrderStatusHistory { OrderId = order.Id, Track = "ORDER", FromStatus = prev, ToStatus = "OPEN", UserId = userId });

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return order;
    }

    private async Task<Customer> FindOrCreateCustomerAsync(string phone, string name, string? address)
    {
        var existing = await _db.Customers.FirstOrDefaultAsync(c => c.Phone == phone);
        if (existing != null) return existing;

        var customer = new Customer
        {
            BusinessId = _db.CurrentBusinessId,
            Name = name,
            Phone = phone,
            Address = address
        };
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        return customer;
    }

    private async Task<string> GenerateOrderNoAsync()
    {
        // IgnoreQueryFilters is essential here, not just belt-and-suspenders: Order is
        // IBranchScoped, so a plain _db.Orders.CountAsync() is silently filtered down to only
        // the CURRENT branch whenever a branch is selected (not "All Branches"). OrderNo
        // uniqueness is BUSINESS-wide (IX_orders_BusinessId_OrderNo), so counting one branch's
        // orders undercounts and reuses numbers already taken by another branch. Re-adding the
        // BusinessId filter manually keeps the business scope while dropping the branch/soft-
        // delete ones. Same class of bug as ProductService.GenerateSkuAsync.
        var count = await _db.Orders.IgnoreQueryFilters()
            .CountAsync(o => o.BusinessId == _db.CurrentBusinessId) + 1;
        return $"O-{count:D4}";
    }

    private async Task<Order?> LoadFullOrderAsync(Guid id)
    {
        return await _db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product)
            .Include(o => o.Payments).ThenInclude(p => p.User)
            .Include(o => o.StatusHistory).ThenInclude(h => h.User)
            .Include(o => o.Customer)
            .Include(o => o.Courier)
            .Include(o => o.DeliveryMan)
            .Include(o => o.HandlingUser)
            .Include(o => o.CreatedByUser)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    // ── DTO mapping ───────────────────────────────────────────────────────────

    private static decimal ComputeSubtotal(Order o) =>
        o.Items.Where(i => i.DeletedAt == null).Sum(i => i.Qty * i.UnitPrice);

    private static decimal ComputeDiscount(Order o)
    {
        if (o.DiscountType == null || o.DiscountValue == null) return 0;
        var sub = ComputeSubtotal(o);
        return o.DiscountType == "PERCENT"
            ? Math.Round(sub * o.DiscountValue.Value / 100, 2)
            : o.DiscountValue.Value;
    }

    private static decimal ComputeTotal(Order o) =>
        ComputeSubtotal(o) - ComputeDiscount(o) + o.DeliveryChargeCustomer;

    private static OrderListDto ToListDto(Order o, bool canSeeCosts)
    {
        var total = ComputeTotal(o);
        var paid = o.Payments.Sum(p => p.Amount);
        var items = o.Items.Where(i => i.DeletedAt == null)
            .Select(i => new OrderListItemSummaryDto(i.Variant?.Product?.Name ?? "Unknown", i.Variant?.Sku ?? "", i.Qty))
            .ToList();

        // Same formula as OrderDetailDto.Economics (ToDetailDto) — cost = cost-snapshot per line
        // + actual delivery cost, so the day-total profit here always matches what the order
        // detail page would show for the same orders.
        decimal? profit = null;
        if (canSeeCosts)
        {
            var cost = o.Items.Where(i => i.DeletedAt == null && i.UnitCostSnapshot.HasValue)
                .Sum(i => i.UnitCostSnapshot!.Value * i.Qty) + o.DeliveryCostActual;
            profit = total - cost;
        }

        return new OrderListDto(
            o.Id, o.OrderNo, o.Channel,
            o.CustomerName, o.CustomerPhone,
            o.OrderStatus, o.PaymentStatus, o.FulfillmentStatus,
            o.IsDraft, total, Math.Max(0, total - paid),
            o.TrackingNo, o.HandlingUser?.Name, o.CreatedAt, o.BusinessDate,
            items, profit
        );
    }

    private static OrderDetailDto ToDetailDto(Order o, bool isOwner)
    {
        var subtotal = ComputeSubtotal(o);
        var discount = ComputeDiscount(o);
        var total = subtotal - discount + o.DeliveryChargeCustomer;
        var paid = o.Payments.Sum(p => p.Amount);

        var items = o.Items.Where(i => i.DeletedAt == null).Select(i =>
        {
            var lineSubtotal = i.Qty * i.UnitPrice;
            decimal? lineProfit = isOwner && i.UnitCostSnapshot.HasValue
                ? lineSubtotal - (i.UnitCostSnapshot.Value * i.Qty)
                : null;
            return new OrderItemDto(
                i.Id, i.VariantId,
                i.Variant?.Sku ?? "",
                i.Variant?.Product?.Name ?? "",
                i.Variant?.VariantValuesJson,
                i.Qty, i.UnitPrice, lineSubtotal,
                isOwner ? i.UnitCostSnapshot : null,
                lineProfit,
                i.IsDamagedItem
            );
        }).ToList();

        OrderEconomicsDto? economics = null;
        if (isOwner)
        {
            var cost = o.Items.Where(i => i.DeletedAt == null && i.UnitCostSnapshot.HasValue)
                .Sum(i => i.UnitCostSnapshot!.Value * i.Qty) + o.DeliveryCostActual;
            economics = new OrderEconomicsDto(total, cost, total - cost, discount);
        }

        return new OrderDetailDto(
            o.Id, o.OrderNo, o.Channel,
            o.CustomerId, o.CustomerName, o.CustomerPhone, o.CustomerAddress,
            o.OrderStatus, o.PaymentStatus, o.FulfillmentStatus, o.IsDraft,
            o.DiscountType, o.DiscountValue,
            o.DeliveryChargeCustomer, o.DeliveryCostActual,
            subtotal, discount, total, paid, Math.Max(0, total - paid),
            o.CourierId, o.Courier?.Name, o.TrackingNo,
            o.DeliveryManId, o.DeliveryMan?.Name,
            o.HandlingUserId, o.HandlingUser?.Name,
            o.Note,
            o.ConfirmedAt, o.HandedOverAt, o.DeliveredAt, o.ReturnedAt, o.CancelledReason, o.ReturnResolution, o.ReturnReason, o.ReturnNote,
            o.CreatedAt, o.CreatedByUser?.Name ?? "",
            items,
            o.Payments.Select(p => new OrderPaymentDto(p.Id, p.Method, p.Amount, p.ReceivedAt, p.User?.Name ?? "")).ToList(),
            o.StatusHistory.OrderBy(h => h.At).Select(h => new OrderStatusHistoryDto(h.Track, h.FromStatus, h.ToStatus, h.User?.Name ?? "", h.At)).ToList(),
            economics
        );
    }
}
