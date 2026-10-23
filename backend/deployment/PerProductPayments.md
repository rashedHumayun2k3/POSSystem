# Per-product PO payments

New product payments use the purchase item ID as CostKey and PurchaseItemId. Common/lot costs continue using their cost ID with PurchaseItemId null. Payments remain immutable full payments, with one payment per product line; partial payments are not introduced.

The existing funding transaction, request idempotency and unique indexes remain in force. A paid item cannot be edited/deleted, while unpaid draft items can be changed and new items can be added. Approval requires all positive-cost products and common costs fully paid; lot costs remain outside product approval.

Products contains the payment action. Costs lists each product and its payment status, the product subtotal, paid amount, outstanding amount, and pending count. Additional cost payments remain separate.

Historical aggregate product payments are retained and displayed as per-line shares when their amount matches the PO subtotal; they are never re-posted. Historical aggregate-paid POs retain their product lock. No local PO deletion is required. New aggregate payments are rejected.

Apply the AddPurchaseItemPayments migration before starting the updated API.
