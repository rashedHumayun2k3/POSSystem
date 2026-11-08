using ResellerApi.DTOs.Expenses;

namespace ResellerApi.Services;

public static class ExpenseCashPaymentValidation
{
    public static void Validate(string? source, decimal amount, ExpenseCashPayments? payments)
    {
        if (source != "CASH")
        {
            if (payments != null) throw new ArgumentException("Cash payments require Expense from Cash.");
            return;
        }
        if (payments == null) throw new ArgumentException("Select Cash in Hand, bKash, or Nagad and enter the amounts.");
        var total = ExpenseFundingService.ToPaisa(payments.Cash)
            + ExpenseFundingService.ToPaisa(payments.Bkash)
            + ExpenseFundingService.ToPaisa(payments.Nagad);
        if (total <= 0 || total != ExpenseFundingService.ToPaisa(amount))
            throw new ArgumentException("Cash, bKash, and Nagad payments must add up to the expense amount.");
    }
}
