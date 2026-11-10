# Dashboard stored procedures

Dashboard report arithmetic, filtering, aggregation, date buckets, comparisons,
and zero-filling now run in SQL Server. `DashboardReportService` only binds the
authenticated business/branch and cost permission, executes procedures, and maps
result sets. No in-memory/LINQ reporting fallback is used.

| Dashboard section | Stored procedure |
| --- | --- |
| Today's sales, profit, orders, yesterday comparison, seven-day trend | `dbo.DashboardSalesOverview` |
| Orders / returns | `dbo.DashboardOrders` |
| Today and month-to-date expenses | `dbo.DashboardExpenses` |
| Low stock / out of stock | `dbo.DashboardStock` |
| Cash, bKash, Nagad, Card, Due | `dbo.DashboardCollections` |
| Thirty-day trend | `dbo.DashboardTrend` |
| Top products | `dbo.DashboardTopProducts` |
| Payment method breakdown | `dbo.DashboardPaymentMethods` |
| Category sales | `dbo.DashboardCategories` |
| Hourly data for legacy clients | `dbo.DashboardHourly` |

Independent endpoints and UI loading/retry behavior are unchanged. Legacy
single-value endpoints project the appropriate procedure result; the older
combined dashboard endpoint composes procedure results sequentially on its
scoped connection.

Every procedure requires `@BusinessId`. `@BranchId = NULL` means all branches of
that business; a selected branch excludes business-wide/null-branch expenses,
matching the existing EF filters. SQL explicitly enforces these filters because
EF global filters do not apply to stored procedures. Profit requires the
server-controlled `@CanSeeCosts` flag and is also masked in the API mapper.

Dates default to Bangladesh today in SQL (UTC + 06:00). An optional `@Today`
parameter supports deterministic SQL testing; it is not exposed to dashboard
clients. Sales summaries retain the existing CreatedAt-based sale definition;
collection charts use ReceivedAt, and expenses use their business calendar date.
Collections include recorded refunds on returned/cancelled orders. Due excludes
draft, cancelled, and returned orders. Collections are before expenses and
withdrawals; this migration does not introduce an account-balance ledger.

`DashboardOrderAmounts` centralizes existing order arithmetic, including shipping
and discounts. `DashboardRoundEven` preserves .NET midpoint-to-even rounding for
percentage discounts and comparisons, unlike SQL's default midpoint rounding.

## Deployment

EF migration `20261109120000_AddDashboardStoredProcedures` installs the embedded
`backend/src/ResellerApi/Data/Sql/DashboardReports.sql` batches. The API's existing
startup migration flow applies it on restart; apply before serving the updated
API when deploying separately. The SQL file can also be reviewed/executed using
SQL Server tooling. Down removes these procedures and helper functions without
altering application data. Version this SQL resource when adding future migrations
so this migration remains reproducible.

No production migration is executed by development tests.

## Verification

`DashboardCollectionsTests` now executes actual procedures, including all result
set mappings. Set `DASHBOARD_TEST_SQL` to a local SQL Server connection with
permission to create/drop test databases. Each test creates a uniquely named
`DashboardReportTests_<guid>` database, installs a minimal test schema and the
embedded procedures, and drops only that database afterward. Non-local servers
are refused. Without the variable, SQL tests are explicitly skipped rather than
pretending an in-memory provider validates T-SQL.

Example PowerShell:

```powershell
$env:DASHBOARD_TEST_SQL = 'Server=localhost;Integrated Security=true;TrustServerCertificate=true;Encrypt=false'
dotnet test backend/src/ResellerApi.Tests --filter FullyQualifiedName~DashboardCollectionsTests
```

Frontend independent-loading regression: `node mobile/scripts/test-dashboard-loading.cjs`.

## Full-width Sales card

Migration `20261109130000_AddDashboardSalesSection` installs the separately versioned
`DashboardSalesSection.sql`. GET `/reports/dashboard/sales-section?period=TODAY`
accepts TODAY, YESTERDAY, 7D, MONTH. A single procedure returns summary, zero-filled
chart, and channel breakdown. Other dashboard cards still load independently.
Comparisons use the immediately preceding equal number of calendar days (month-to-date
compares against the same number of days immediately before this month). Dates use
Bangladesh time. Single-day tabs show hours; 7D and MONTH show days.
POS source takes precedence over channel; CLIENTPAGE/EXTERNAL_WEBSITE and
FACEBOOK/WHATSAPP/INSTAGRAM/MYWEBSITE are online; remaining sales are offline.
Average bill is sales/order count; margin is profit/sales (undefined at zero sales).
Profit and margin remain masked by server permission. Existing revenue and return
semantics are unchanged. The View all sales link opens the orders list.
Apply both pending dashboard migrations before serving the updated frontend.

## Expandable dashboard cards (HTML design adaptation)

`20261109140000_AddDashboardCards` installs `DashboardCardsV2.sql`. It creates only
stored procedures and a date-range function: no application tables or columns.
Every visible section has its own controller action, service method and procedure.

| Card | Endpoint suffix | Procedure |
| --- | --- | --- |
| Sales | sales-section | DashboardSalesSection |
| Expense | expense-section | DashboardExpenseSection |
| Collections | collection-section | DashboardCollectionSection |
| Profit | profit-section | DashboardProfitSection |
| Orders | orders-section | DashboardOrdersSection |
| Products | products-section | DashboardProductsSection |
| Capital | capital-section | DashboardCapitalSection |
| Dues | dues-section | DashboardDuesSection |
| Top products | top-section | DashboardTopSection |
| Counter | counter-section | DashboardCounterSection |
| Transit | transit-section | DashboardTransitSection |

All endpoints are under `/api/v1/reports/dashboard/`. Each card loads independently
and rejects late responses after changing period/scope. Cards start collapsed;
Sales remains full width, other cards use two columns at >=768px and one below.
Filter chips wrap. Empty sales charts are omitted. Labels support English/Bangla.

Data adaptations (no sample values are used):
- Profit uses existing sales revenue (discounts already deducted), snapshot product
  and delivery costs, less approved expense. No duplicate discounts/refund subtraction.
  Existing report return/cost-snapshot semantics remain unchanged.
- Collections use payment receipt dates, include signed refunds and show all-time
  outstanding dues separately. They are receipts, not physical cash balances.
- Orders use recorded DeliveredAt/ReturnedAt and cancellation history dates. Active
  counts are current across all dates. No estimated return-rate denominator.
- Products are active product counts, aggregating available variant inventory and
  using each product's configured low-stock threshold, not sample thresholds.
- Capital is the signed CAPITAL ledger balance across the business, broken down by
  partner. Owner/partner only, enforced on the controller. No inferred asset value
  or lifetime profit. Other cards remain branch-scoped.
- Payables use purchase-line DueAmount for non-draft/non-cancelled trips. They are
  hidden from users without cost access. Supplier overdue dates are not fabricated.
- Top products rank quantity or item profit before order discounts/delivery. Profit
  ranking excludes missing cost snapshots and is omitted without cost permission.
- Counter shows POS sales by creating staff, held/cancelled/revised bills. No drawer
  shortage, suspicious activity or discount-under-price claims without evidence.
- Transit counts shipped quantities less approved receipt quantities including
  damaged/missing units. It does not claim they are paid or estimate missing freight.

SQL tests install the procedures into disposable local databases; frontend checks:
`node mobile/scripts/test-dashboard-loading.cjs` and
`node mobile/scripts/test-dashboard-sales-card.cjs`.

## Current Money

The dashboard now uses `/dashboard/money-section` and `DashboardMoneySection`
instead of the collection card. It has no date filter. A server timestamp bounds
all movements and is returned as AsOf. Includes CASH/BKASH/NAGAD receipts and
signed refunds, less APPROVED CASH-funded expense splits with PaidAt <= AsOf.
Card receipts, dues, personal expenses, capital-fund expenses and ambiguous
petty-cash/capital movements are excluded. Business/branch scoping is preserved.
The existing schema does not identify opening balances, transfers or withdrawals
for this drawer/wallet, so the UI explicitly labels these as recorded balances,
not confirmed physical cash. No table/column additions. Migration:
20261109150000_AddDashboardCurrentMoney. Opening the card or pressing Refresh
fetches the latest balance; page refresh also reloads it.

## Profit date restrictions

Migration `20261109160000_RestrictDashboardProfitPeriods` updates only the profit
procedure. Profit summary permits TODAY, YESTERDAY, 7D and MONTH; ALL is rejected
by the controller, service and procedure and removed from its filter options.

## Compact breakdowns

Migration 20261109170000_DashboardCompactDetails adds no tables/columns. It updates
Expense (top 10 categories), Orders (return rate and resolved-order denominator),
Products (top 10 categories by active-product count), Dues (party counts and age of
oldest unpaid order), Top (quantity plus sales/profit), and Sales (unrounded
comparison-period sales for accurate negative-change coloring).
Return rate is returned / (delivered + returned) in the selected outcome period;
returns take precedence when an order has both dates in the period. Cancelled
orders are excluded from this denominator. It is labelled resolved shipments, not
all shipments sent. Supplier due dates are not inferred from PromisedDate.
Card settlement is untracked and displayed as unavailable, excluded from current
cash totals/charts. Breakdown charts are segmented bars (not invented time series).
