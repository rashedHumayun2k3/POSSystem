namespace ResellerApi.DTOs.Reports;
public record CashActivityReport(string From,string To,string AsOf,string Source,string Direction,int Page,int PageSize,
 decimal Opening,decimal MoneyIn,decimal MoneyOut,decimal Closing,
 decimal SalesIn,decimal InvestmentIn,decimal ExpenseOut,decimal PurchaseOut,decimal RefundOut,
 int AllCount,int InCount,int OutCount,int TotalItems,List<CashActivityDay> Days,List<CashActivityRow> Items);
// Closing = running balance at the end of that Dhaka-local day.
public record CashActivityDay(string Date,decimal MoneyIn,decimal MoneyOut,decimal Closing);
// Kind: PAYMENT | REFUND | EXPENSE | PURCHASE | INVESTMENT
public record CashActivityRow(Guid Id,Guid ReferenceId,string ReferenceType,string Kind,string Source,decimal Amount,string Title,
 string At,string Date,string? FirstProduct,int ProductCount);
