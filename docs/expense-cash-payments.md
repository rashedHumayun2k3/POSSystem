# Expense from Cash

The shared `NewExpenseScreen` used by general and product expenses now supports
`FundingSource = CASH` and a `cashPayments` object (`cash`, `bkash`, `nagad`).
The three child checkboxes and amount inputs appear only for this parent option.
At least one amount must be positive; amounts must have at most two decimal
places and add up exactly to the expense amount. Other funding sources must not
submit a split. The server validates these rules independently of the UI.

The split is persisted on the expense, returned in list/detail responses, and
editable through the correction flow. Request IDs retain existing retry
protection. Reports count the expense once under CASH; capital calculations
exclude CASH expenses. Cancellation keeps the original breakdown in history.

Apply the `AddExpenseCashPayments` EF migration before serving the updated API.
It adds three decimal(14,2) columns with zero defaults; existing funding behavior
and historical records remain unchanged. The API already applies pending
migrations on startup. Production deployment/migration has not been performed.

This feature records payment sources. It does not yet implement reconciled cash
or mobile-wallet accounts, opening balances, automatic sales-receipt credits,
transfers, or available-balance enforcement. Do not present totals derived solely
from historical sales as available cash. That ledger requires a separate rollout
with verified opening balances.

Validation: `node mobile/scripts/test-expense-cash.cjs`; backend regression cases
are in `ExpenseFundingTests` and cover persistence, retry protection, capital
isolation, corrections, cancellation, and invalid splits.
