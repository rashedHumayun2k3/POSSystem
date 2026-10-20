# PO cost payments

Deploy the backend and mobile/web client together. Apply `AddPurchasePayments.sql` to the target database before the updated backend serves requests. The script is idempotent and assumes migrations through `20261016095924_AddExpenseTitle` have already been applied. No database was updated during implementation.

Owners and Managers can immediately record full payment for the product subtotal or an individual recorded PO cost. Confirm Payment records money already paid; it does not transfer money to a supplier. Each saved payment turns its cost row green. Business payments reduce available business funds and appear in cash closing. Personal payments require a linked active partner and add a capital-ledger entry without adding business cash. Neither creates another operating expense.

Payment amounts are calculated again on the server. Duplicate payments, insufficient business funds, closed accounting periods and edits/deletion of paid costs are rejected. Purchase approval requires all positive cost rows to be paid. Partial payments and reversals are not included.

Existing PaidNow fields are not backfilled into payment records. Review legacy POs before recording payments to avoid recording historical payments twice. Personal PO contributions appear through the existing capital ledger rather than a new capital-injection approval request.

Validation: Release API build passed; all nine PurchasePaymentTests passed. Combined PO/expense test run: 29 passed, one existing expense-investment approval expectation failed (expected PENDING_APPROVAL, actual APPROVED). The unrelated broken InvoiceListTests file was excluded from this focused run. Device/browser interaction and SQL Server integration testing remain outstanding.
