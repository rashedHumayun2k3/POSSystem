using Microsoft.EntityFrameworkCore;
using ResellerApi.Data;
using ResellerApi.Entities;
using ResellerApi.Infrastructure;
namespace ResellerApi.Services;

public record PurchasePaymentRequest(Guid CostKey, decimal ExpectedAmount, string FundingSource, Guid RequestId, Guid? PurchaseItemId = null);
public sealed class PurchasePaymentService(AppDbContext db, IBusinessContext business, ExpenseFundingService funding)
{
    public async Task<List<PurchasePayment>> List(Guid tripId)
    {
        if (!await db.PurchaseTrips.AnyAsync(x => x.Id == tripId)) throw new KeyNotFoundException("Purchase not found.");
        return await db.PurchasePayments.AsNoTracking().Where(x => x.TripId == tripId).ToListAsync();
    }
    public async Task<PurchasePayment> Pay(Guid tripId, PurchasePaymentRequest request, Guid userId)
    {
        if (request.RequestId == Guid.Empty || request.FundingSource is not ("BUSINESS" or "PERSONAL"))
            throw new ArgumentException("Choose a payment source and provide a request ID.");
        await using var tx = await funding.BeginAsync();
        var trip = await db.PurchaseTrips.FirstOrDefaultAsync(x => x.Id == tripId) ?? throw new KeyNotFoundException("Purchase not found.");
        if (request.PurchaseItemId.HasValue && request.PurchaseItemId.Value != request.CostKey)
            throw new ArgumentException("Product payment key must match its purchase item.");
        var previous = await db.PurchasePayments.FirstOrDefaultAsync(x => x.TripId == tripId && x.CostKey == request.CostKey);
        if (previous != null)
        {
            if (previous.PurchaseItemId == request.PurchaseItemId && previous.RequestId == request.RequestId && previous.CreatedBy == userId && previous.Amount == request.ExpectedAmount && previous.FundingSource == request.FundingSource) return previous;
            throw new InvalidOperationException("This cost is already paid. Refresh the purchase.");
        }
        if (trip.Status == "CANCELLED") throw new InvalidOperationException("Cannot pay a cancelled purchase.");
        if (await db.PurchasePayments.AnyAsync(x => x.RequestId == request.RequestId)) throw new InvalidOperationException("Payment request already used.");
        if (request.CostKey == Guid.Empty)
            throw new InvalidOperationException("Record payment for each product individually.");
        PurchaseItem? paidItem = null;
        decimal amount;
        if (request.PurchaseItemId.HasValue)
        {
            if (trip.Status is not ("DRAFT" or "PENDING_APPROVAL"))
                throw new InvalidOperationException("Product payments can only be recorded before approval.");
            if (await db.PurchasePayments.AnyAsync(x => x.TripId == tripId && x.CostKey == Guid.Empty))
                throw new InvalidOperationException("Products were already paid through a historical PO payment.");
            paidItem = await db.PurchaseItems.FirstOrDefaultAsync(x => x.TripId == tripId && x.Id == request.PurchaseItemId.Value)
                ?? throw new KeyNotFoundException("Purchase product not found.");
            amount = paidItem.TotalCost;
        }
        else amount = (await db.PurchaseTripCosts.FirstOrDefaultAsync(x => x.TripId == tripId && x.Id == request.CostKey)
            ?? throw new KeyNotFoundException("Purchase cost not found.")).Amount;
        var paisa = ExpenseFundingService.ToPaisa(amount);
        if (amount <= 0 || request.ExpectedAmount != amount) throw new InvalidOperationException("The cost changed or is zero. Refresh before paying.");
        var now = DateTime.UtcNow;
        await funding.EnsureDateOpenAsync(now.Date);
        Partner? partner = null;
        if (request.FundingSource == "BUSINESS") await funding.CheckBusinessPaymentAsync(amount);
        else partner = await funding.PartnerAsync(userId) ?? throw new InvalidOperationException("Your account must be linked to an active partner to pay with your own money.");
        var payment = new PurchasePayment { BusinessId = business.CurrentBusinessId, BranchId = trip.BranchId, TripId = tripId,
            CostKey = request.CostKey, PurchaseItemId = paidItem?.Id, Amount = amount, FundingSource = request.FundingSource, PartnerId = partner?.Id,
            CreatedBy = userId, RequestId = request.RequestId, PaidAt = now };
        db.PurchasePayments.Add(payment);
        if (partner != null)
        {
            var balance = await db.CapitalLedgerEntries.Where(x => x.PartnerId == partner.Id && x.Bucket == "CAPITAL").SumAsync(x => (long?)x.AmountPaisa) ?? 0;
            db.CapitalLedgerEntries.Add(new CapitalLedgerEntry { BusinessId = business.CurrentBusinessId, PartnerId = partner.Id,
                Bucket = "CAPITAL", EntryType = "CAPITAL_INJECTION", AmountPaisa = paisa, BalanceAfterPaisa = checked(balance + paisa),
                ReferenceType = "PurchasePayment", ReferenceId = payment.Id, CreatedBy = userId,
                Note = "Personal supplier payment for " + trip.TripNo + ". No business cash received." });
        }
        // Existing PaidNow is legacy supplier metadata, not proof of a funding transaction.
        if (paidItem != null) { paidItem.PaidNow = paidItem.TotalCost; paidItem.DueAmount = 0; }
        await db.SaveChangesAsync();
        if (tx != null) await tx.CommitAsync();
        return payment;
    }
}
