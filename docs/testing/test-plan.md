# LavLokshan — Full Application Test Plan

**Target:** Web build of the mobile app (`http://localhost:8081`), backed by the local API (`localhost:5018`).
**Method:** Playwright with a visible browser window (you can watch), plus direct API checks for the math.
**Scope:** every menu, every tab and every field. Each module gets positive (P) and negative (N) tests.
**Outputs:**
1. `docs/testing/bug-list.md`: ID, module, severity, steps, expected vs actual, screenshot.
2. `docs/testing/ux-suggestions.md`: user-friendliness only, **no new features**.

**Severity:**
- Critical: wrong money or stock, data loss, crash, or a security leak.
- High: a flow is blocked.
- Medium: a wrong display or validation gap.
- Low: cosmetic, text or translation.

**Run in both languages:** English and বাংলা. Every screen is checked for untranslated text.
**Roles:** OWNER (full run) and STAFF (permission and data-leak run).

---

## Test data flow (order of execution)
The modules run in dependency order, so each step creates the data the next one needs:

1. Log in as OWNER.
2. Partner capital injection (Cash In). This puts cash in the business.
3. Settings: categories, expense categories, couriers, branches, staff.
4. Products: new, setup wizard, bulk, quick add, barcodes.
5. Purchase trip (PO) → receive → stock in.
6. POS sale (full paid, full due, part paid).
7. Online order → courier → COD.
8. Due collection.
9. Expenses and cash out.
10. Reports and cash book: verify the numbers from steps 2–9.
11. STAFF login: permission run.

---

## Module list (A–Z)

| # | Module | Route |
|---|--------|-------|
| 1 | Auth (login / logout / session) | `/`, `/profile` |
| 2 | Backdated POS | `/more/backdated-pos` |
| 3 | Barcodes | `/more/barcodes` |
| 4 | Branches | `/more/settings/branches` |
| 5 | Bulk Products / Quick Add | `/more/bulk-products` |
| 6 | Cash Book report | `/more/reports/cash-book` |
| 7 | Cash In / Out | `/cash-in-out` |
| 8 | Catalog Templates | `/more/catalog-templates` |
| 9 | Categories | `/more/categories` |
| 10 | Config (business settings) | `/more/settings/config` |
| 11 | Couriers | `/more/settings/couriers` |
| 12 | Customers | `/more/customers` |
| 13 | Dashboard (home) | `/`, `/more/reports/dashboard` |
| 14 | Daily Closing report | `/more/reports/daily-closing` |
| 15 | Deliveries | `/more/deliveries` |
| 16 | Discounts | `/more/discounts` |
| 17 | Due (Shop Sale Due / Online Order Due) | `/more/due` |
| 18 | Expense Categories | `/more/settings/expense-categories` |
| 19 | Expenses | `/more/expenses` |
| 20 | FAQ | `/more/faq` |
| 21 | Feedback | `/more/feedback` |
| 22 | Fund Closing | `/more/settings/fund-closing` |
| 23 | Invoices | `/more/reports/invoices` |
| 24 | Language switch (EN/BN) | global |
| 25 | More menu (drawer) | global |
| 26 | Notifications | `/notifications` |
| 27 | Orders (online) | `/orders` |
| 28 | Partners and capital | `/more/settings/partners` |
| 29 | POS Sale | `/sale` |
| 30 | Pre-orders | `/more/pre-orders` |
| 31 | Products (list, detail, new, setup) | `/products` |
| 32 | Profile | `/profile` |
| 33 | Purchases (PO / trips) | `/more/purchases` |
| 34 | Reports (sales, orders, inventory, financial, expenses, stock valuation, product sales, product profit) | `/more/reports/*` |
| 35 | Sales Record | `/sales-record` |
| 36 | Shop Type | `/more/settings/shop-type` |
| 37 | Staff | `/more/settings/staff` |
| 38 | Storefront settings | `/more/settings/storefront` |
| 39 | Storeroom (currently hidden in menu) | `/more/storeroom` |
| 40 | Subscription | `/more/settings/subscription` |
| 41 | Tasks and permissions | `/more/tasks` |

---

## Test cases

### 1. Auth
- **AUTH-P1:** Log in with a valid phone and password. Lands on the dashboard; name and role are shown.
- **AUTH-P2:** Reload the page. The session persists.
- **AUTH-P3:** Logout from Profile and from the More → Logout menu item. OWNER/STAFF see the daily report prompt; all three options work.
- **AUTH-N1:** Wrong password. A clear error appears; the password field is not cleared unexpectedly.
- **AUTH-N2:** Empty fields. Login is blocked and the error appears under the field.
- **AUTH-N3:** Open a protected URL after logout. Redirects to login.

### 2. Partners and capital (cash source)
- **PART-P1:** Add a partner (name, phone, share %).
- **PART-P2:** Add a capital injection: CASH, then BANK (bank name and reference), then CHEQUE (number and photo), then MOBILE_BANKING. Each appears in the list with the correct amount.
- **PART-P3:** Submit for approval, then approve. The cash book increases by exactly that amount.
- **PART-N1:** Amount 0, negative, or text. Blocked.
- **PART-N2:** BANK with no bank name, or CHEQUE with no number. Blocked with a message.
- **PART-N3:** Share % total above 100. Blocked or warned.
- **PART-N4:** Future date, lock-in 0 or negative.

### 3. Cash In / Out
- **CIO-P1:** Cash In for another partner. "Entry by" shows the logged-in user.
- **CIO-P2:** Cash In with More options (lock-in, photo, note). The photo preview appears and can be removed.
- **CIO-P3:** Cash Out. The partner is fixed to the logged-in user and cannot be changed.
- **CIO-P4:** Transactions panel filters (Today, 7 Days, This Month, Custom) and tabs (All, In, Out). Counts match the rows; installment rows are highlighted.
- **CIO-N1:** Cash Out more than the cash balance. Blocked or warned.
- **CIO-N2:** Cash Out for another partner's ID through the API. Returns 403 or an error (security).
- **CIO-N3:** Empty amount, double tap on Save (no duplicate entry).

### 4. Settings (Categories, Expense Categories, Couriers, Branches, Shop Type, Config, Storefront, Subscription, Fund Closing)
- **SET-P1:** Create, edit and delete each master record. The change shows up in the pickers that use it.
- **SET-P2:** Config changes (for example the low-stock threshold or receipt settings) take effect in POS and reports.
- **SET-N1:** Duplicate name, empty name, very long name (200+ characters), emoji and Bangla text.
- **SET-N2:** Delete a category or courier that is in use. Blocked or handled safely.
- **SET-N3:** Two tabs edit the same record. The second save shows a 409 message ("changed by someone else").

### 5. Staff and Tasks
- **STF-P1:** Add a STAFF user, set permissions, and log in as that user.
- **TSK-P1:** Create a task, assign it, change its status, and comment.
- **TSK-P2:** Task permissions screen. Changes apply to the staff user.
- **STF-N1:** Duplicate phone number, weak password.
- **STF-N2:** Disable a staff user. That user can no longer log in.

### 6. Products
- **PRD-P1:** New product with variants (size and colour), price and barcode.
- **PRD-P2:** Setup wizard end to end.
- **PRD-P3:** Bulk Products / Quick Add with several rows.
- **PRD-P4:** Product detail tabs:
  - Stock adjustment adds and removes stock; the history appears.
  - Set a discount offer and remove it; the Discount History updates.
  - The Marketplace tab is hidden when "Show on website" is off.
- **PRD-P5:** Search, category chips, A–Z, and filters on the list.
- **PRD-P6:** Catalog template import.
- **PRD-N1:** Sale price below cost. Warned.
- **PRD-N2:** Duplicate barcode or SKU. Blocked.
- **PRD-N3:** Negative price, zero price, or empty name.
- **PRD-N4:** Stock adjustment below 0. Blocked.
- **PRD-N5:** Discount larger than the price, or an end date before the start date.

### 7. Barcodes
- **BAR-P1:** Generate and print labels for selected variants; the quantity matches.
- **BAR-N1:** Print with nothing selected, or with quantity 0.

### 8. Purchases (PO / trips)
- **PUR-P1:** New trip:
  - Pick a supplier and products, with quantity and cost.
  - Add trip costs (transport and others).
  - Landed cost is allocated correctly; I verify it by hand.
- **PUR-P2:** Receive the full quantity. Stock increases and the weighted average cost updates.
- **PUR-P3:** Partial delivery. The trip becomes PARTIALLY_RECEIVED; receive the rest later.
- **PUR-P4:** Damage at receipt. Damaged units are not sellable.
- **PUR-P5:** Late cost after completion. The cost is re-allocated.
- **PUR-N1:** Quantity 0, negative cost, or no items.
- **PUR-N2:** Receive more than ordered.
- **PUR-N3:** Edit a completed trip. Blocked.

### 9. POS Sale
- **POS-P1:** Scan or search, add items, change quantity, and pay by Cash, then Card, bKash and Nagad. Stock decreases; the receipt prints and WhatsApp text is correct.
- **POS-P2:** Is Due → Full Due. The full amount appears in Shop Sale Due.
- **POS-P3:** Is Due → Part Paid. Example: ৳1,500 bill, ৳500 cash and ৳500 bKash, leaving ৳500 due. The receipt and the due list are correct.
- **POS-P4:** Discount on an item and on the whole bill, within the safe discount limit.
- **POS-P5:** Customer picker: an existing customer, and adding a new one.
- **POS-P6:** Backdated POS sale. The sale is saved with the chosen date.
- **POS-N1:** Quantity above stock. Blocked.
- **POS-N2:** Part Paid with paid ≥ total, bKash without a TxID, or no method selected.
- **POS-N3:** Discount above the limit, or a negative price.
- **POS-N4:** Double tap on Confirm or a network retry. Only one sale is created (idempotency).
- **POS-N5:** Due sale with no customer. Blocked.

### 10. Orders (online) and Deliveries
- **ORD-P1:** New order with a customer, address, items, courier and delivery charge, plus an advance.
- **ORD-P2:** Status flow: confirm → pack → ship → deliver. Stock and COD amounts are correct at each step.
- **ORD-P3:** Cancel and return. Stock comes back.
- **ORD-P4:** Deliveries screen: filters, and Collect from Courier.
- **ORD-P5:** Pre-order is created and later converted.
- **ORD-N1:** Advance above the total, an invalid phone, or a missing address.
- **ORD-N2:** Changing a delivered order's items is blocked; the order snapshot is not recalculated.

### 11. Due
- **DUE-P1:** Shop Sale Due: Collect from Customer, as a partial and then a full payment. The balance updates.
- **DUE-P2:** Online Order Due: Collect from Courier. Works on web; on mobile I'll give you a phone checklist.
- **DUE-N1:** Collect more than the amount due, 0, or bKash without a TxID.

### 12. Customers
- **CUS-P1:** Add, edit and search a customer. The detail page shows orders and due.
- **CUS-N1:** Duplicate phone, or an invalid phone format.

### 13. Expenses
- **EXP-P1:** New expense, paid by cash and by split payment. The cash book decreases.
- **EXP-P2:** Edit and delete an expense; the detail page, filters and category are shown correctly.
- **EXP-N1:** Amount 0, a future date, a split total that doesn't match, or a cash expense above the balance.

### 14. Reports and Cash Book
- **RPT-P1:** Cash Book:
  - Opening + In − Out = Closing, and matches every transaction from steps 2–13.
  - The panel filters work.
- **RPT-P2:**
  - Sales, Orders, Product Sales and Product Profit match the sales created.
  - Profit = sale − landed cost.
- **RPT-P3:** Inventory and Stock Valuation match the stock after the PO and the sales.
- **RPT-P4:** Expenses, Financial and Daily Closing totals are correct; Daily Closing sends.
- **RPT-P5:** Invoices: list and detail, and the PDF opens.
- **RPT-N1:** A custom date range with from > to, or an empty period (shows a friendly empty state).

### 15. Dashboard, Notifications, Sales Record
- **DSH-P1:** The KPI cards match the reports for Today and This Month.
- **NOT-P1:** Notifications appear for events and the read state works.
- **SRC-P1:** Sales Record lists the sales and opens their details.

### 16. More menu, Profile, FAQ, Feedback, Language
- **GEN-P1:** Every More menu item opens the right screen; groups and the Logout item work.
- **GEN-P2:** Profile photo upload; daily report send.
- **GEN-P3:** Submit feedback; FAQ expands.
- **GEN-P4:** Switch to বাংলা. Every screen is checked for leftover English text.
- **GEN-N1:** Upload a non-image file, or a very large image.

### 17. STAFF role (security run)
- **SEC-1:** STAFF never sees cost, profit or expense data on any screen **or in any API response**.
- **SEC-2:** STAFF cannot open owner-only URLs directly (reports, partners, cash book, discount history).
- **SEC-3:** STAFF can do POS sales and receive trips, per permissions.

### 18. Cross-cutting (applies to every screen)
- **X-1:** Phone width (390px) layout: nothing is cut off, overlapping, or scrolling sideways.
- **X-2:** Loading, empty and error states are shown, not a blank screen.
- **X-3:** Required fields are marked, and errors appear next to the field.
- **X-4:** Money uses the ৳ format; there are no floating-point oddities (for example 99.99999).
- **X-5:** Back navigation, and unsaved-changes handling.
- **X-6:** Double-submit protection on every Save button.

---

## Out of scope / you verify on a phone
- Native-only behaviour: crashes, the camera barcode scanner, printing to a Bluetooth printer.
- Real courier and bKash APIs, and SMS/WhatsApp delivery.
- Offline POS sync. I can simulate offline in the browser for a basic check only.
