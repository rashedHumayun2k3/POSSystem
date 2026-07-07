# Reseller Business Management System — Technical Requirements Specification v2.0
**Date:** June 2026 | **Status:** Final requirements, ready for implementation
**Audience:** AI coding agent (Claude Code). This document is self-contained: modules, business rules, formulas, database schema, API design, and build order.

---

# PART 1 — SYSTEM OVERVIEW & STACK

## 1.1 Business context
Single-owner reselling business in Bangladesh. Products bought in lots (China trips, Alibaba, Chawkbazar wholesale, agents), sold via TWO channels: (a) online orders (Facebook/WhatsApp/phone) delivered by courier with COD, and (b) physical shop counter with barcode scanner (POS). Owner + multiple staff working concurrently. Currency BDT. Mobile/tablet-first.

**Day-1 configuration:** ONE business with multiple product categories (Toys, Cloth, Shoes...). Categories are NOT separate businesses — one order can mix categories, one customer book, one money pot. Multi-tenant architecture is built into the foundation for (a) future genuinely separate companies and (b) future SaaS offering to other companies (Phase 4).

**Out of scope:** product research, supplier discovery, customer-facing storefront, marketing automation.

## 1.2 Technology stack (decided)
| Layer | Technology |
|---|---|
| Database | SQL Server (start: Express edition). EF Core 8 as ORM. |
| Backend | .NET 8 Web API (REST, /api/v1/...), JWT auth, SignalR for realtime, Hangfire for background jobs. Host on Linux. |
| Frontend | Next.js 14+ (App Router) + TypeScript + Tailwind CSS. PWA (next-pwa). IndexedDB via Dexie.js for offline POS. TanStack Query for data fetching with offline mutation queue. html5-qrcode for camera barcode scanning. |
| Files | Local disk or S3-compatible storage for images (product photos, receipt/memo photos). Client-side image compression before upload. |
| Realtime | SignalR hub (order updates, notifications). Fallback: 10s polling. |

## 1.3 Global technical rules (apply to EVERYTHING)
- **GTR-1 Multi-tenancy:** every business table carries `business_id` (FK). Every query filters by it (EF Core global query filter). Businesses belong to a `company` (tenant). Cross-tenant access is impossible by construction.
- **GTR-2 Money:** DECIMAL(14,2) always. No float/double anywhere. All money math server-side.
- **GTR-3 Quantity:** DECIMAL(12,3) (supports kg/ml/meter), with unit-of-measure per product.
- **GTR-4 Concurrency:** every mutable table gets SQL Server `rowversion` column → optimistic locking. On conflict return HTTP 409 with "Record was changed by {user} — please review". Stock mutations use serializable transactions / `UPDLOCK` row locks (see §4.6).
- **GTR-5 Audit:** every write inserts into `activity_logs` (user, action, entity, before/after JSON, timestamp). Owner-only Activity screen with filters.
- **GTR-6 Soft delete:** `deleted_at` column; hard delete never exposed.
- **GTR-7 Append-only history:** temporal data (prices, planned rates, courier charges, salaries) is never updated in place — new rows with `effective_from` (+optional `effective_to`).
- **GTR-8 Snapshots:** orders freeze `unit_price`, `unit_cost_snapshot`, `overhead_rate_snapshot` at the relevant moment. Historical reports use snapshots only — later changes never alter the past.
- **GTR-9 Idempotency:** all POS/offline-capable POST endpoints accept `Idempotency-Key` (client UUID); duplicates return the original result, never double-insert.
- **GTR-10 Roles:** OWNER sees everything. STAFF never sees: buying prices, landed costs, profit, expense totals, reports, other staff salaries. Enforced server-side (DTO shaping), not just hidden in UI.
- **GTR-11 Realtime:** order list, dashboard, notifications update live via SignalR; minimum acceptable: 10-second polling.
- **GTR-12 Backups:** daily automated SQL backup; monthly "export your data" reminder to owner.

---

# PART 2 — MODULES & REQUIREMENTS

## MODULE 1: Tenancy, Auth, Users, Activity

- **R1.1** Hierarchy: `companies` (tenant) → `businesses` → users assigned per business (many-to-many). Owner account has a business switcher (dropdown) + owner-only combined dashboard across own businesses (total profit, best business).
- **R1.2** Roles: OWNER, STAFF (permission matrix per GTR-10). Login by phone + password (bcrypt). JWT access + refresh tokens.
- **R1.3** Staff approval queues: staff-created purchase trips, expense entries, large/out-of-window refunds, over-limit baki → status PENDING_APPROVAL → owner notification → approve/reject with note.
- **R1.4** "Claimed by" on orders: opening an order to work marks `handling_user_id`; badge shown to others.
- **R1.5** Activity log per GTR-5; closed POS shifts and completed purchase trips are locked (owner correction creates a reversing entry, never edits).

## MODULE 2: Catalog — Dynamic Categories, Products, Variants, Units, Price History

- **R2.1 Category templates:** owner defines categories; each category defines custom fields via a no-code form builder. Field types: TEXT, NUMBER, DATE, DROPDOWN (owner-defined options), BOOLEAN. Each field has two flags: `is_variant` (splits stock) and `is_per_lot` (value entered per purchase batch, e.g. expiry date).
- **R2.2 Pre-seed starter categories:** Toys (age range, material), Cloth (Size✓variant, Color✓variant, fabric, gender), Shoes (Size✓variant, Color✓variant), Generic. Units lookup: pcs, pair, set, dozen, kg, gm, liter, ml, meter, box. Category sets default unit; product can override.
- **R2.3 Products:** common fields: name, SKU (auto P-0001 if blank), image, category, description, defect_notes, selling_price (current), market_price (optional, manual), packaging_cost_per_unit, low_stock_threshold, note, status. Custom attribute values stored as JSON column `attributes` (validated against category template).
- **R2.4 Variants:** combinations of variant-flagged field values. EVERY product has ≥1 variant — products without variant fields get one auto "default" variant. **All stock, barcodes, and order lines reference the variant**, never the product directly. Each variant: own SKU suffix, own barcode + QR (auto-generated), own optional price override.
- **R2.5 Barcode/QR:** generate on product/variant creation; printable label sheets (thermal label printer + A4 sticker layout). Order entry, POS, challan scanning all resolve barcodes to variants.
- **R2.6 Price history (append-only per GTR-7):** `price_history` rows: variant/product, old_price, new_price, effective_from, changed_by, reason (required). Current price denormalized on product/variant for fast reads. Features: (a) **scheduled price changes** (future effective_from + auto-revert row — Hangfire job applies them); (b) **markdown guard** — UI shows new profit instantly and warns/blocks below break-even; price changes are OWNER-only; (c) reports overlay price timeline on sales timeline ("did the markdown increase sales?") and show average-sold-price & margin trend per product.

## MODULE 3: Inventory — Four Numbers, Two Buckets, Movements

- **R3.1 Four inventory numbers per variant** (Shopify standard):
  - `on_hand` = physically present; `committed` = reserved by confirmed orders / payment-parked POS carts; `damaged` = damaged bucket; **`available` = on_hand − committed − damaged** (computed; the ONLY number staff see when selling); `incoming` = qty inside DRAFT purchase trips (informational).
- **R3.2 Stock journal:** `stock_movements` is the single source of truth: type ∈ {PURCHASE_IN, SALE_OUT, RETURN_IN, DAMAGE_IN, DAMAGE_OUT, REPAIR_IN, WRITE_OFF, ADJUSTMENT, COMMIT, RELEASE}, signed qty, reference (order/purchase/refund/damage id), user, note, lot_id where applicable. `variant_inventory` (on_hand, committed, damaged) is maintained transactionally alongside each movement.
- **R3.3 Stock rules:** available can never be oversold ONLINE (atomic check, first-commit-wins; loser gets "Out of stock — just sold by {user}"). OFFLINE POS exception: offline sales are accepted even if they drive on_hand negative on sync → raise OVERSOLD exception notification to owner ("verify physical stock").
- **R3.4 Batch/lot tracking:** each purchase item creates a lot (qty, landed_unit_cost, per-lot field values e.g. expiry). Expiry features: "expiring within 30 days" alert; FEFO hint at sale time ("sell from January batch first"). Lot linkage on SALE_OUT optional (Phase 2 strict FEFO enforcement).
- **R3.5 Stock adjustment:** physical count ≠ system → ADJUSTMENT movement, note mandatory, owner-only or owner-approved.
- **R3.6 Multi-location (Phase 3, schema-ready now):** `locations` table (shop, godown); `variant_inventory` keyed by location; transfer-between-locations movement pair. Day 1: single default location.

## MODULE 4: Damage Section

- **R4.1 Report damage:** product/variant, qty, **source** ∈ {ON_ARRIVAL, IN_STORAGE, COURIER_TRANSIT, CUSTOMER_RETURN}, mandatory photo, note; sources COURIER_TRANSIT/CUSTOMER_RETURN require linked order_id (→ courier & customer analytics). Stock: moves sellable→damaged bucket (DAMAGE_IN).
- **R4.2 Disposition (every damaged item ends in exactly one):**
  1. **SUPPLIER_RETURN** → opens supplier claim (sent date, expected refund/replacement, received amount; reminder if pending >15 days; refund reduces damage loss).
  2. **REPAIR** → repair cost entered; item returns to sellable (REPAIR_IN); repair cost added to that unit's cost.
  3. **SELL_AS_DAMAGED** → stays in damaged bucket but sellable at special reduced price; order line flagged "damaged item".
  4. **WRITE_OFF** → removed; full landed cost recorded as damage loss.
- **R4.3 Customer-end damage** routes through the Refund & Replacement module (Module 9), with returned unit entering R4.1 inspection.
- **R4.4 Reports:** damage rate per product (supplier quality signal), damage by courier, monthly damage loss (tk), claim recovery; repeat-claimer flag on customers.

## MODULE 5: Purchase Module — Trips, Smart Form, Landed Cost, Receiving

- **R5.1 Purchase Trip = container with DRAFT lifecycle:** "+ New Purchase Trip" → choose **source type** ∈ {CHINA_TRIP, ALIBABA, LOCAL_WHOLESALE, AGENT} → trip opens in DRAFT. Items and costs are added throughout the day from mobile. Nothing touches stock/cost until **Complete**.
- **R5.2 Smart form — cost fields shown depend on source type:**
  - CHINA_TRIP: intl shipping, customs/tax, currency loss, local transport, labor (+ link trip expenses option)
  - ALIBABA: shipping (air/sea), customs/tax, payment fee, transport, labor
  - LOCAL_WHOLESALE: transport, labor only
  - AGENT: agent commission, shipping, customs, transport, labor
- **R5.3 Items:** each item = product/variant (existing or created inline), quantity bought, **total cost for the item (not per-unit — matches how owner thinks)**, shop/supplier name per item, memo/receipt photo per item, payment now vs due (→ Baki, R7).
- **R5.4 Shared trip costs** (transport/labor/customs/etc.) entered as separate trip-cost lines, each with optional photo, added step-by-step as paid during the day.
- **R5.5 Receiving checklist at Complete:** (1) count: bought qty vs **usable qty** (damaged-on-arrival auto-recorded; costs spread over usable qty only); (2) per-lot field values (expiry etc.); (3) compute & preview landed costs; (4) confirm → in ONE transaction: PURCHASE_IN movements, lots created, weighted-average cost updated; (5) flow continues to set selling prices (pricing screen) and print barcode labels. Until then trip = RECEIVING status, stock shows as `incoming` only.
- **R5.6 Cost allocation formulas (acceptance-tested):**
```
shared = Σ trip shared costs (+ any linked trip expense)
item_share        = (item_total_cost / Σ all items' total_cost) × shared
landed_unit_cost  = (item_total_cost + item_share) / usable_qty
new_avg_cost      = (old_on_hand×old_avg + usable_qty×landed_unit_cost) / (old_on_hand+usable_qty)
```
Worked test: 1 item, qty 100 (all usable), cost 10,000; transport 100 + labor 200 + other 10 → landed = 103.10. Prior 50 @100.00 → new avg 102.07. Damaged-on-arrival test: usable 95 → landed = 10,310/95 = 108.53.
- **R5.7 Staff trips** complete into PENDING_APPROVAL; owner reviews items + photos remotely, approves → receiving executes.
- **R5.8 Supplier payment on items:** paid_now / due / promised_date → feeds Baki module.

## MODULE 6: Expenses, Petty Cash, Marketing Budget, Planned Rates

- **R6.1 Expense categories (seeded, extensible):** OFFICE (rent, electricity, internet, mobile, food, cleaning) · STAFF (salary auto-generated from users.monthly_salary, bonus, Eid bonus, conveyance) · MARKETING (FB boost, photoshoot, design) · DELIVERY (courier bills, own delivery man, fuel) · TRIP (plane/hotel/food/visa — entry asks: "attach to a purchase trip or general overhead?"; attached → joins that trip's shared costs) · EQUIPMENT_OTHER (printer, scale, repair, license, bank) · **OWNER_DRAWING** (tracked separately, NOT a business cost, never enters product costing or P&L expenses — exists so cash reconciles).
- **R6.2 Entry UX:** "+ Add Cost" → 6 big category tiles → sub-type list → amount → optional receipt photo → save. Date defaults today. ≤5 taps.
- **R6.3 Staff entries → PENDING approval** (notification → owner approve/reject); staff see only their own entries, never totals.
- **R6.4 Petty cash:** one box **per staff**. Owner records fund-ins ("gave Rahim 10,000"); staff bill payments marked "paid from petty cash" auto-decrement box balance; live balance visible to both; refill flow; mismatch = physical count vs system, logged. Staff "Pay a Bill" window = same 5-tap flow.
- **R6.5 Recurring expenses:** monthly salary/rent auto-created by Hangfire job on configured day; paying = setting paid_at.
- **R6.6 Marketing budget planner:** monthly budget per business and optionally per product; daily spends count against it; progress bar ("3,200 of 5,000 · 64% · 10 days left"); pre-overspend warning notification.
- **R6.7 Planned rates (standard costing) — THE pricing/cost separation:**
  - Pricing NEVER uses fluctuating monthly actuals. Owner sets **planned_marketing_per_unit** and **planned_overhead_per_unit** (per product/category/business level, append-only history per GTR-7). App suggests values from trailing 3-month actuals with one-tap accept.
  - Actual truth lives in monthly P&L (Module 11): revenue − COGS(landed) = gross profit; − actual marketing − actual overhead = net profit.
  - **Variance engine (monthly job):** actual_per_unit vs planned per product/business → variance lines in report + notification when |variance| > 20% for 2 consecutive months → "review planned rate / consider price revision". Prices change deliberately (quarterly review reminder), never automatically.
  - Per-unit actuals: marketing_per_unit(M) = marketing spend(M)/units sold(M); overhead likewise. Reference example: Jan 100/10=10.0, Feb 120/10=12.0, Mar 150/20=7.5; 3-mo avg 9.25.

## MODULE 7: Baki (Credit) Module — Payable & Receivable

- **R7.1 Two directions:** SUPPLIER (Ami Debo — payable; from purchase items with due) and CUSTOMER (Ami Pabo — receivable; from orders/POS with due). Unified `ledger_entries` per party: charges, payments (partial allowed, each with date, user, optional photo), running balance.
- **R7.2 Promised dates** on every due; reminder notifications on the day ("collect 2,000 from Hasan; pay 5,000 to Janata Traders").
- **R7.3 Credit limits per customer:** staff exceeding limit or giving baki to a new customer → blocked → owner approval flow.
- **R7.4 Baki dashboard:** receivable total (n customers) / payable total (n suppliers) / net position.
- **R7.5 Reports:** per-party khata ledger (full transaction history), aging buckets 0–30/30–60/60+, overdue list. Phase 3: one-tap SMS/WhatsApp due reminder to customer.

## MODULE 8: Orders (Online) — 3-Track Status, Customers, Challan, COD

- **R8.1 Three independent status tracks per order:**
  - order_status: OPEN → COMPLETED / CANCELLED
  - payment_status: UNPAID → PARTIALLY_PAID → PAID → REFUNDED
  - fulfillment_status: UNFULFILLED → PACKED → IN_TRANSIT → DELIVERED / RETURNED
- **R8.2 Channels:** FACEBOOK, WHATSAPP, INSTAGRAM, PHONE, SHOP (POS), OTHER. One order can mix products of any categories (categories ≠ businesses).
- **R8.3 Draft orders:** "rakhen, kal confirm korbo" → DRAFT, zero stock effect, next-day follow-up reminder; draft conversion rate report.
- **R8.4 Lifecycle & stock/document side-effects:**
  | Step | Stock | Document |
  |---|---|---|
  | Create (pending) | none | — |
  | **Confirm** | committed+, available− | Invoice generated |
  | **Pack** | — | **Challan PDF**: shop name, order no + **barcode**, customer name/phone/address, items, COD amount. Dual output: print AND PDF share via WhatsApp. 2 copies. |
  | **Handover to courier** (requires courier + tracking no) | **on_hand−, committed−** | tracking saved; tappable tracking_url |
  | Delivered | — | money receipt; COD → enters courier reconciliation (R10.3) |
  | Returned | on_hand+ OR → damage bucket | return cost charged to order |
  | Cancel (before handover) | committed released | reason logged |
- **R8.5 Challan barcode scanning:** bulk handover — scan each challan → status flips to IN_TRANSIT, one beep each.
- **R8.6 Customer profiles (auto-built by phone, shared across all categories — ONE customer book):** order count, return count, last order, address autofill, baki balance/limit, store-credit balance, **serial-rejecter warning** ("rejected 3 of last 4 parcels"), repeat-claimer flag. Phase 3: BD courier fraud-check API integration on this screen.
- **R8.7 Order economics (owner-only):** revenue = Σ(price×qty) − discount + delivery_charge_customer; cost = Σ(true_unit_cost_snapshot×qty) + delivery_cost_actual; profit = revenue − cost. Per GTR-8 snapshots frozen at delivery.
- **R8.8 Discounts:** type PERCENT/FIXED; **safe-discount guard** (profit preview, warn below break-even); staff discount permission configurable: free up to X% / owner-approval beyond.
- **R8.9 Stock race:** confirm uses atomic available check (R3.3). Editing conflicts → 409 per GTR-4.
- **R8.10 Phase 3 customer messaging:** auto WhatsApp/SMS on confirm + tracking number.

## MODULE 9: Refund & Replacement (consolidated)

- **R9.1 Entry always from original sale:** scan receipt/challan barcode, order no, or customer phone → select item(s) → mandatory **reason** ∈ {DEFECTIVE, WRONG_SIZE_COLOR, CHANGED_MIND, DAMAGED_DELIVERY, OTHER}.
- **R9.2 Four resolutions:**
  1. **REFUND** (full/partial): cash from drawer (auto-deducts from active shift's expected cash), bKash send-back, or reduce customer baki. Order profit recalculates (can go negative — truth shown).
  2. **REPLACE_SAME**: new unit out (on_hand−), returned unit → inspection.
  3. **EXCHANGE_DIFFERENT**: both stock moves; price difference collected/refunded.
  4. **STORE_CREDIT**: no cash out; credit balance on customer profile, auto-applies at next purchase; store-credit liability report.
- **R9.3 Inspection rule:** returned items NEVER auto-enter sellable stock — staff inspects: intact → sellable; damaged → Damage bucket → Module 4 dispositions.
- **R9.4 Controls:** configurable return window (default 7 days) auto-blocks with owner override; refunds above X tk or out-of-window need owner approval; processor + approver logged; online-order refunds reconcile against COD flow.
- **R9.5 Reports:** refund rate, reasons breakdown ("60% wrong size → fix FB size chart"), refunds by product (quality alarm) and by staff (pattern alarm), store-credit liability.

## MODULE 10: Couriers, Delivery Men, COD Reconciliation

- **R10.1 Couriers (owner-managed list, never hardcoded):** name, charge_inside_dhaka, charge_outside, return_charge, cod_fee_pct, contact, tracking_url_template ("https://.../{tracking_no}"), active. Charges history per GTR-7.
- **R10.2 Delivery men:** name, phone (tap-to-call), optional courier link, cost_per_delivery (own delivery men), active.
- **R10.3 COD reconciliation (BD-critical):** every DELIVERED COD order enters "money at courier" state with expected payout = COD − courier charges. When courier pays (bank/bKash): create courier_payment, tick orders it covers, auto-match suggestion by amount/date. Unmatched after X days → "⚠️ Steadfast owes 12,400 tk from 9 parcels, oldest 18 days". Dashboard money strip: cash + receivable baki + payable baki + **money in transit at couriers**.
- **R10.4 Deliveries screen:** IN_TRANSIT grouped by courier; days-in-transit highlight ≥5 days; [Delivered]/[Returned] actions; ORDER_STUCK notifications.
- **R10.5 Courier reports:** sent/delivered/returned, return %, avg days, total cost, damage-in-transit per courier. Phase 3: Pathao/Steadfast API integration (auto consignment + auto status).

## MODULE 11: Pricing Screen & Cost Display

- **R11.1 Grouped 3-level display (never a flat 10-line dump):** Level 1 always visible: 🏭 Landed cost / 📦 Selling cost per unit (packaging + planned marketing + payment-COD fee est.) / 🏢 Planned overhead share → **TRUE UNIT COST**. Level 2: tap any group → line-by-line drill-down. Level 3 decision helpers: **break-even** (=true cost), **suggested price** (cost × (1+target margin%, default 40, settable)), **market price** (manual field) shown as pricing room: break-even → suggested → market; live price+discount calculator with green/red profit box; **safe discount limit** ("up to 51.30 tk before loss").
- **R11.2 Discount is NOT a cost line** — it lives in the calculator/order, never in cost groups.
- **R11.3 Owner-only everywhere** (GTR-10): staff never receive cost/profit fields in any API response.

## MODULE 12: POS — Shop Counter Selling

- **R12.1 Hardware assumption:** 2D Bluetooth barcode scanner (keyboard mode), thermal label printer (product labels), 58mm thermal receipt printer (optional; WhatsApp digital receipt always available), mobile/tablet, optional cash drawer & weighing scale. **Camera scanning (html5-qrcode) as built-in fallback** — phone alone can sell.
- **R12.2 Unified data model:** POS sale = an order with channel=SHOP, fulfillment instantly DELIVERED, payment immediate (or baki for known customers), stock on_hand− at sale moment, customer optional (walk-in) but phone field links to customer book. All reports merge channels automatically; online-vs-shop comparison report is free.
- **R12.3 POS screen (≤15s/sale):** scan→cart→qty→discount (safe-limit guard)→payment→receipt. Search fallback (2-letter search + favorites grid). Variant barcodes resolve exact variant. **Split payment** (cash+bKash+card combinations). Counter return/exchange via Module 9.
- **R12.4 Multi-cart / parking (the bKash-waiting solution):** cashier holds multiple carts as chips: `[Hasan · 850tk · bKash ⏱3min]`. TWO park types: **PARKED_BROWSING** (no stock effect) and **PARKED_AWAITING_PAYMENT** (items become `committed` — reserved so no one else sells them). Live wait timer per chip; configurable auto-expiry alert (default 15 min) → confirm or cancel (cancel releases stock). Cap ~5 parked carts per cashier. "Payment received" completes cart → receipt. Parked carts sync server-side when online → any logged-in device can resume them.
- **R12.5 Cash register / shifts (Z-report):** staff opens shift with opening cash; cash sales add, **cash refunds subtract** from expected; close shift: expected vs counted → match/mismatch recorded with cashier name; closed shifts locked (corrections = reversing entries). One shift per cashier; responsibility never blurred.
- **R12.6 OFFLINE-FIRST (hard requirement — most engineering-heavy item):**
  - Catalog (names, barcodes, prices, last-known available) cached in IndexedDB; refreshed every sync.
  - Full POS functionality with zero network: scan, cart, discount, cash sale, park, complete.
  - Completed offline sales → persistent **outbox queue** (IndexedDB, survives app crash/restart) → auto-sync with `Idempotency-Key` (GTR-9) → server never duplicates.
  - Active cart auto-saved to device storage **after every scan**; app reopen → "Resume cart? (3 items, 1,250 tk)".
  - Sync status pill always visible: 🟢 synced / 🟡 n pending / 🔴 offline-selling-locally.
  - Offline oversell accepted → negative stock → OVERSOLD owner exception (R3.3).
  - Electricity failure path: device battery + scanner battery + mobile data; receipt printer failure → auto-offer WhatsApp receipt, queue paper receipt.
  - What stays online-only: reports, purchases, settings. POS sell path must not.

## MODULE 13: Reports, Dashboard, Targets, Notifications

- **R13.1 Report framework:** every report: date-range filter, drill-down to underlying records, Excel export. Staff receive ZERO money reports (server-enforced).
- **R13.2 Dashboard (owner):** today's orders, pending deliveries, stock alerts, month profit so far, target progress bars, money strip (cash / receivable / payable / at-courier), notification bell. Staff dashboard: their orders, stock alerts, their shift.
- **R13.3 Daily pack (auto, midnight Hangfire job → immutable daily_snapshots):**
  - **Daily Sales Summary:** total tk + transaction count, shop vs online split, by payment method, discounts given, refunds, damage reported, today's profit (owner), top 5 products. **Daily digest push notification** ("Today: 23 sales · 18,400 tk · profit 4,120 · 1 refund").
  - **Z-report** per cashier shift (R12.5).
- **R13.4 Report library:**
  - Sales: daily/monthly; by category ("which business line wins"); by channel; by product & **by variant** (XL outsells M); by staff.
  - Profit: monthly P&L (revenue → gross → net per R6.7); planned-vs-actual variance; profit per product ranked; total discount given.
  - Inventory: **stock value in tk** ("4,80,000 tk sleeping on shelves"); low stock; **dead stock** (no sale 60/90 days); expiring soon; damage loss & rate.
  - Demand: high/low demand with trends; new-product first-30-days verdict; seasonal patterns (year 2+).
  - Marketing: budget vs actual; **marketing cost per unit sold trend** (the 10→12→7.5 story); sales per ad-taka by category; price-drop vs sales overlay.
  - Courier: per R10.5. Baki: per R7.5. Refunds: per R9.5. Customers: top 20, repeat rate, rejecters. Store-credit liability.
- **R13.5 Targets:** monthly target revenue/profit/units; dashboard progress; month-end achieved-vs-target in digest.
- **R13.6 Notifications (in-app bell; Phase 3 web-push):** LOW_STOCK (≤threshold), HIGH_DEMAND (7-day sales ≥2× weekly avg → "restock!"), LOW_DEMAND (in stock, 0 sales 30d), EXPIRING_SOON (30d), ORDER_STUCK (in transit ≥5d), PENDING_TOO_LONG (≥2d), DRAFT_FOLLOWUP, BAKI_DUE_TODAY, COURIER_PAYMENT_OVERDUE, BUDGET_OVERSPEND_WARNING, VARIANCE_ALERT, OVERSOLD_EXCEPTION, APPROVAL_REQUESTED, PARKED_CART_EXPIRING, MONTHLY_REPORT_READY, DAILY_DIGEST. Staff receive only operational types (no money data).

## MODULE 14: Settings & Data

- **R14.1 Settings:** businesses & switcher; staff & role assignment; couriers & delivery men; categories & field builder; units; expense categories; target margin %; planned rates; return policy days; refund approval threshold; credit limits default; low-stock default; parked-cart expiry minutes; overhead mode (AUTO suggested / MANUAL).
- **R14.2 Excel import (onboarding):** upload .xlsx → column mapping → import products (+opening stock via an opening-balance purchase trip so costing stays consistent) and optionally historical orders; per-row validation report; partial import allowed.
- **R14.3 Excel export:** orders, products+stock, purchases, expenses, baki ledgers, monthly reports. Staff exports exclude cost/profit columns.
- **R14.4 Phase 4 SaaS:** company self-signup, subscription plans, trial, billing — schema-ready via GTR-1; DO NOT build before owner's own business validates the product.
- **R14.4a Override (built 2026-07-02, Owner decision):** a scoped-down self-service signup was built ahead of Phase 4, before the rest of R14.4 (subscription plans, trial, billing) — same pattern as Module 15a being built ahead of Phase 4 Orders. Flow: email + 6-digit code verification (`email_verifications` table, 10-min expiry, 5 wrong-attempt lockout, IP-based rate limiting) → single form (name, phone, password, business name, optional country) → one transaction creates `Company` + `Business` + `Branch` ("Main Branch") + OWNER `User` + default `AppSettings`, mirroring the existing dev-seeder's tenant-creation shape (`Program.cs SeedAsync`) but as a real, concurrency-safe endpoint (`POST /api/v1/auth/signup/complete`). Login stays phone+password only — email exists solely for signup verification/uniqueness, not as a login credential. Immediately after first login, a one-time "what kind of business is this?" step (`POST /api/v1/onboarding/business-type`, idempotent via `Business.OnboardingCompletedAt`) auto-creates a starter set of Categories (+ custom fields) from a fixed preset keyed by business type (Clothing & Fashion, Cosmetics & Beauty, Electronics & Gadgets, Shoes & Footwear, Bags & Accessories, Toys & Baby Items, Home & Kitchen, Books & Stationery, Other/General). Subscription plans, trial periods, and billing remain out of scope until Phase 4 proper.

## MODULE 15: Partnership & Capital Ledger (Owner + Partners)

Independent track — not part of phases 1–10 (Part 6); built in its own sub-phases (15a–15e) because it carries zero-tolerance financial-integrity rules.

- **R15.1 Roles are separate from staff roles:** a partner is NOT a `users`/STAFF/OWNER record — a partner is `MANAGING` or `SLEEPING`, immutable once any ledger entry exists for them (genuine change = mark old partner EXITED + create new partner record, owner action + mandatory audit note). Partners log in through their own portal (`partner_sessions`, separate JWT secret) — sub-phase 15e.
- **R15.2 Money exception:** unlike GTR-2, all `partner*`/`capital_*` monetary columns are `BIGINT` paisa, not DECIMAL — zero-tolerance integer arithmetic for capital math (no float/double, no rounding drift); the display layer divides by 100. This exception is scoped to Module 15 tables only — every other table in the system keeps DECIMAL(14,2) unchanged.
- **R15.3 `capital_ledger` is immutable, INSERT-only:** every financial event (injection, profit credit, loss debit, distribution, withdrawal, correction, exit settlement) is a new row; corrections are new rows, never edits. `balance_after_paisa` is stored per row for fast display, but the true current balance is always recomputed via `SUM()` over the ledger, never stored on `partners` (drift-proof, R15.4). Pre-production hardening: a dedicated SQL login with `DENY UPDATE, DELETE` on this table. Sub-phase 15a enforces insert-only at the application layer only (no Update/Delete code path exists anywhere for this entity).
- **R15.4 Two ledger buckets per partner, tracked separately from day one:** `CAPITAL` and `PROFIT`. A sleeping partner's `CAPITAL` balance can never go below zero — loss debits stop at zero, the remainder is stored as `deferred_loss_paisa` on the partner; managing partners have unlimited liability (their capital can go negative). `PROFIT` balance funds withdrawals; `available_to_withdraw = SUM(profit credits) − SUM(withdrawals)`, always computed live, never stored as a column.
- **R15.5 Capital injections:** each addition is its own `capital_injections` row with its own `lock_in_expires_at` — new money is locked independently of previously-invested capital. Withdrawing `CAPITAL` is blocked until lock-in expires, enforced by a DB CHECK constraint on `withdrawal_requests` (belt) + UI countdown (suspenders) — sub-phase 15d.
- **R15.6 Monthly distribution (sub-phase 15b):** one run per `(month, year)` (DB UNIQUE constraint prevents a double-run). Sleeping-pool % (0–100; warns below 5% or above 40%; 0% is allowed but requires a ≥20-character typed reason, visible to all sleeping partners) splits the pool by investment ratio; the remainder is split among managing partners (default 40/30/20/10) with any 1–2 paisa rounding remainder always assigned to managing Partner 1 (R8 convention). Loss months: the same investment-ratio split is applied to `abs(net_loss)` per sleeping partner, floored at zero; any overflow from partners hitting the floor is absorbed by managing partners. A partner carrying `deferred_loss_paisa` who has a profitable month gets it applied first — `profit_credit = max(0, profit_share − deferred_loss)` — as **two** separate ledger rows (`LOSS_RECOVERY` debit + `PROFIT_CREDIT`), never netted into one.
- **R15.7 Approval workflow (sub-phase 15c):** distribution status `pending → partial_approval → approved → posted`; each of the 4 managing partners votes once (`distribution_votes`, unique per distribution+partner); posting requires 4/4 and is irreversible (corrections only, R15.9). Timeout override: if 3/4 have approved and 7 days have passed since the distribution was initiated, the Owner may force-post with a mandatory reason — logged permanently in `activity_logs`.
- **R15.8 Mid-month joins/exits (sub-phase 15b/15d):** a new sleeping partner's first distribution month is configurable per partner (default: next month only, no pro-rating) — `join_month`/`first_distribution_month` stored separately. Exit requires lock-in expired + 4/4 managing-partner approval; final settlement = `capital_balance + profit_balance − deferred_loss`, posted as an `EXIT_SETTLEMENT` ledger row; partner marked EXITED — history is never deleted.
- **R15.9 Corrections (sub-phase 15d):** a wrong past distribution is never edited — a `distribution_correction` posts new +/− ledger rows for the affected partners, requires Owner approval + mandatory reason; the original distribution stays visible in history, the correction is a separate visible record.
- **R15.10 Visibility:** capital/profit/distribution data is Owner-only on the staff side (GTR-10 applies — STAFF never sees this module, not even in nav). Partners see only their own data via the separate partner portal (15e); a sleeping partner never sees another partner's balance.
- **R15.11 New partner approval (sub-phase 15a):** adding a partner (MANAGING or SLEEPING) requires majority approval from existing ACTIVE managing partners before the partner becomes usable. A new partner starts as `status = PENDING_APPROVAL` — excluded from balance/ledger totals, and `RecordInjection` rejects any partner whose status is not `ACTIVE`. Each ACTIVE managing partner may cast one vote (`partner_approval_votes`, unique per partner+voter) of `APPROVE` or `REJECT`; `REJECT` requires a mandatory note. Threshold = `floor(activeManagingPartnerCount / 2) + 1`, recomputed live against the *current* count of ACTIVE managing partners (excluding the pending partner itself). Reaching the threshold on `APPROVE` flips the partner to `ACTIVE`; enough `REJECT` votes that approval becomes mathematically impossible flips it to `REJECTED` (terminal — create a new partner record to retry; history is kept, never deleted). **Bootstrap exception:** if there are zero ACTIVE managing partners at creation time (the very first partner ever added to a business), the new partner auto-approves to `ACTIVE` immediately, since there is no one to vote. The Owner may also cancel a still-pending request directly (sets `REJECTED`, mandatory reason, logged in `activity_logs`) as a manual escape hatch — unlike R15.7, there is no automatic timeout override here. No partner portal exists yet (15e), so for now the Owner records each managing partner's vote on their behalf through the staff UI, the same way distribution voting (15c) will have to work before 15e exists. **Not retroactive:** partners created before this rule existed keep `status = ACTIVE` unchanged. Partner profile also gains: `nid_number`, `address` (both required going forward), `email`, `bank_account_number`, `bank_name`, `agreed_profit_share_pct`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation` (all optional).

**Build order (Module 15 sub-phases):**
- **15a (current sub-phase):** `partners`, `capital_injections`, `capital_ledger` (CAPITAL bucket only), partner CRUD, computed capital balance — Owner-only API + Settings screens.
- **15b:** monthly distribution engine (split, rounding, loss/deferred-loss, PROFIT bucket activated).
- **15c:** 4/4 managing-partner voting + 7-day timeout override.
- **15d:** withdrawal requests + lock-in CHECK constraint + distribution corrections + exit settlement.
- **15e:** partner portal — second JWT scheme, `partner_sessions`, self-service login/dashboard/voting.

**Module 15a acceptance tests:** a capital injection produces exactly one ledger row with an exact-integer `amount_paisa`/`balance_after_paisa` (no rounding drift across a sequence of injections); the live-summed capital balance matches a manually-computed total; changing a partner's `partner_type` after a ledger entry exists is rejected; a STAFF-role token receives 403 on every `/api/v1/partners*` route; the very first partner ever added to a business auto-approves with zero votes (bootstrap); with 4 ACTIVE managing partners (majority threshold = 3), a new partner reaches `ACTIVE` on the 3rd `APPROVE` vote, and reaches `REJECTED` on the **2nd** `REJECT` vote (2 rejects out of 4 already make the 3/4 majority mathematically unreachable); a duplicate vote from the same managing partner on the same pending partner is rejected; recording a capital injection against a `PENDING_APPROVAL` or `REJECTED` partner is rejected (R15.11).

---

# PART 3 — DATABASE SCHEMA (SQL Server)

All tables: `id UNIQUEIDENTIFIER PK DEFAULT NEWSEQUENTIALID()`, `created_at/updated_at DATETIME2`, `deleted_at NULL`, `row_ver ROWVERSION`; business-scoped tables add `business_id` FK (GTR-1). Money DECIMAL(14,2), qty DECIMAL(12,3) — **exception: Module 15 `partner*`/`capital_*` tables use BIGINT paisa instead of DECIMAL, per R15.2.** FKs implied by `_id` naming.

**Tenancy/Auth:** `companies(name, status)` · `businesses(company_id, name, currency)` · `users(company_id, name, phone UQ, password_hash, role, monthly_salary, is_active)` · `business_users(business_id, user_id)` · `refresh_tokens(user_id, token, expires_at)` · `activity_logs(business_id, user_id, action, entity_type, entity_id, before_json, after_json)`

**Catalog:** `categories(business_id, name, default_unit)` · `category_fields(category_id, name, field_type, options_json, is_required, is_variant, is_per_lot, sort)` · `units(code, name, allows_decimal)` · `products(business_id, category_id, name, sku UQ, image_url, description, defect_notes, unit_code, selling_price, market_price, packaging_cost_per_unit, low_stock_threshold, attributes_json, note, status)` · `product_variants(product_id, variant_values_json, sku UQ, barcode UQ, price_override NULL, is_default)` · `price_history(business_id, variant_id, old_price, new_price, effective_from, effective_to NULL, changed_by, reason)`

**Inventory:** `locations(business_id, name, is_default)` · `variant_inventory(variant_id, location_id, on_hand, committed, damaged)  -- available computed` · `stock_movements(business_id, variant_id, location_id, type, qty, lot_id NULL, reference_type, reference_id, user_id, note)` · `lots(business_id, variant_id, purchase_item_id, qty_in, landed_unit_cost, per_lot_values_json /*expiry etc*/, remaining_qty)` · `damage_records(business_id, variant_id, qty, source, photo_url, note, order_id NULL, lot_id NULL, disposition NULL, repair_cost NULL, write_off_amount NULL, reported_by, decided_by NULL)` · `supplier_claims(damage_record_id, supplier_name, sent_at, expected_amount, received_amount, status)`

**Purchases:** `purchase_trips(business_id, trip_no UQ, source_type, status /*DRAFT,PENDING_APPROVAL,RECEIVING,COMPLETED,CANCELLED*/, note, created_by, approved_by NULL, completed_at NULL)` · `purchase_items(trip_id, variant_id, qty_bought, qty_usable, total_cost, shop_name, memo_photo_url, paid_now, due_amount, promised_date NULL, allocated_shared_cost, landed_unit_cost)` · `purchase_trip_costs(trip_id, cost_type /*TRANSPORT,LABOR,CUSTOMS,SHIPPING_INTL,CURRENCY_LOSS,AGENT_FEE,PAYMENT_FEE,OTHER*/, amount, note, photo_url, paid_by)`

**Parties/Baki:** `customers(business_id, name, phone UQ-per-biz, address, credit_limit, store_credit_balance, is_rejecter_flag, is_claimer_flag, note)` · `suppliers(business_id, name, phone, note)  -- optional registry; purchase items also carry free-text shop_name` · `ledger_entries(business_id, party_type /*CUSTOMER,SUPPLIER*/, party_id NULL, party_name, direction /*RECEIVABLE,PAYABLE*/, entry_type /*CHARGE,PAYMENT*/, amount, reference_type, reference_id, promised_date NULL, photo_url NULL, user_id, note)`

**Orders:** `orders(business_id, order_no UQ, channel, customer_id NULL, customer_name, customer_phone, customer_address, order_status, payment_status, fulfillment_status, is_draft, discount_type, discount_value, delivery_charge_customer, delivery_cost_actual, advance_paid, courier_id NULL, delivery_man_id NULL, tracking_no NULL, handling_user_id NULL, pos_shift_id NULL, client_uid UQ NULL /*idempotency*/, confirmed_at, handed_over_at, delivered_at, returned_at, cancelled_reason, created_by, note)` · `order_items(order_id, variant_id, qty, unit_price, unit_cost_snapshot NULL, overhead_rate_snapshot NULL, marketing_rate_snapshot NULL, is_damaged_item, lot_id NULL)` · `order_status_history(order_id, track /*ORDER,PAYMENT,FULFILLMENT*/, from_status, to_status, user_id, at)` · `order_payments(order_id, method /*CASH,BKASH,NAGAD,CARD,BAKI,STORE_CREDIT,COD*/, amount, received_at, user_id)`

**Refunds:** `refunds(business_id, order_id, resolution /*REFUND,REPLACE_SAME,EXCHANGE_DIFFERENT,STORE_CREDIT*/, reason, amount, method, processed_by, approved_by NULL, note)` · `refund_items(refund_id, order_item_id, qty, inspection /*SELLABLE,DAMAGED*/, replacement_variant_id NULL, price_difference NULL)`

**Couriers/COD:** `couriers(business_id, name, charge_inside, charge_outside, return_charge, cod_fee_pct, contact, tracking_url_template, is_active)` · `delivery_men(business_id, name, phone, courier_id NULL, cost_per_delivery, is_active)` · `courier_payments(business_id, courier_id, paid_at, amount, method, reference, note)` · `courier_payment_orders(courier_payment_id, order_id, amount_settled)`

**Expenses:** `expense_categories(business_id, code, name, is_system)` · `expenses(business_id, category_id, sub_type, amount, expense_date, staff_id NULL, is_recurring, recurring_day NULL, allocate_to_trip_id NULL, petty_cash_box_id NULL, photo_url, status /*PENDING,APPROVED,REJECTED*/, paid_at NULL, created_by, approved_by NULL, note)` · `petty_cash_boxes(business_id, staff_id UQ, balance)` · `petty_cash_txns(box_id, type /*FUND_IN,SPEND,ADJUST*/, amount, expense_id NULL, user_id, note)`

**Costing/Marketing:** `planned_rates(business_id, scope /*BUSINESS,CATEGORY,PRODUCT*/, scope_id NULL, rate_type /*MARKETING,OVERHEAD*/, rate_per_unit, effective_from, effective_to NULL, set_by)` · `marketing_budgets(business_id, month, scope, scope_id NULL, budget_amount)` · `monthly_actual_rates(business_id, month, rate_type, total_amount, units_sold, per_unit)` · `monthly_targets(business_id, month, target_revenue, target_profit, target_units)`

**POS:** `pos_shifts(business_id, cashier_id, location_id, opened_at, opening_cash, closed_at NULL, expected_cash NULL, counted_cash NULL, mismatch NULL, status)` · `pos_carts(business_id, cashier_id, state /*ACTIVE,PARKED_BROWSING,PARKED_AWAITING_PAYMENT,COMPLETED,CANCELLED*/, customer_label, items_json, total, parked_at NULL, expires_at NULL, device_id, client_uid UQ)`

**Misc:** `daily_snapshots(business_id, date, metrics_json) -- immutable` · `notifications(business_id, user_id, type, title, body, entity_ref, is_read)` · `app_settings(business_id, key, value_json)` · `attachments(business_id, entity_type, entity_id, url, kind)`

**Partnership (Module 15, 15a now / 15b+ later):** `partners(business_id, name, phone, partner_type /*MANAGING,SLEEPING — immutable after first ledger entry*/, status /*PENDING_APPROVAL,ACTIVE,REJECTED,EXITED*/, deferred_loss_paisa, join_date, note, nid_number, address, email, bank_account_number, bank_name, agreed_profit_share_pct, emergency_contact_name, emergency_contact_phone, emergency_contact_relation)` · `capital_injections(business_id, partner_id, amount_paisa, injected_at, lock_in_months, lock_in_expires_at, note, created_by)` · `capital_ledger(business_id, partner_id, entry_type /*CAPITAL_INJECTION,PROFIT_CREDIT,LOSS_DEBIT,LOSS_RECOVERY,DISTRIBUTION,WITHDRAWAL,CORRECTION,EXIT_SETTLEMENT*/, bucket /*CAPITAL,PROFIT*/, amount_paisa, balance_after_paisa, reference_type NULL, reference_id NULL, note, created_by) -- INSERT-only, app-enforced` · `partner_approval_votes(business_id, partner_id, voted_by_partner_id UQ(partner_id,voted_by_partner_id), decision /*APPROVE,REJECT*/, note, voted_at)  -- R15.11, new-partner approval, separate from distribution_votes` · *(15b+)* `monthly_distributions(business_id, month, year UQ(month,year), sleeping_pool_pct, status, note, created_by)` · `distribution_votes(distribution_id, managing_partner_id UQ(distribution_id,managing_partner_id), approved_at, note)` · `distribution_lines(distribution_id, partner_id, gross_share_paisa, deferred_loss_applied_paisa, net_credit_paisa)` · `withdrawal_requests(business_id, partner_id, type /*CAPITAL,PROFIT*/, amount_paisa, available_snapshot_paisa, status, requested_at)` · `partner_sessions(partner_id, token, expires_at) -- separate JWT secret from staff sessions`

**Key indexes:** orders(business_id, fulfillment_status), orders(customer_phone), stock_movements(variant_id, created_at), ledger_entries(party_type, party_id), lots(variant_id, remaining_qty) filtered remaining>0, notifications(user_id, is_read), price_history(variant_id, effective_from).

---

# PART 4 — API DESIGN (.NET 8 Web API)

- REST `/api/v1/{module}`; JWT bearer; `X-Business-Id` header validated against user's business_users; EF Core global filters on business_id + deleted_at.
- Controllers: Auth, Users, Categories, Products, Variants, Inventory, Purchases, Expenses, PettyCash, Baki(Ledger), Orders, Refunds, Couriers, CourierPayments, Pos (carts, shifts, sync), Pricing, Reports, Notifications, Settings, ImportExport, **Partners (Module 15; 15a: CRUD + injections + ledger + balance; 15b+: Distributions, Withdrawals, PartnerAuth)**.
- Representative endpoints:
  - `POST /orders` (Idempotency-Key) · `POST /orders/{id}/confirm|pack|handover|delivered|returned|cancel` (each = transactional state change + stock + history row) · `GET /orders?status=&channel=&q=`
  - `POST /purchase-trips` · `POST /purchase-trips/{id}/items|costs` · `POST /purchase-trips/{id}/complete` (single transaction: validation → allocation → lots → movements → avg cost)
  - `POST /pos/sync` (batch offline sales, idempotent per client_uid; returns per-item result incl. OVERSOLD flags) · `GET /pos/catalog?since=` (delta sync) · `POST /pos/shifts/open|close` · `POST /pos/carts/{id}/park|resume|complete|cancel`
  - `POST /refunds` · `POST /damage-records` + `/disposition` · `POST /ledger/payments` · `POST /courier-payments` (+ order matching) · `GET /pricing/{variantId}` (grouped breakdown; staff token → 403/blank cost fields) · `GET /reports/{name}?from=&to=` + `/export`
- **Stock mutation pattern (mandatory):** single DB transaction; `SELECT ... WITH (UPDLOCK, ROWLOCK)` on variant_inventory row; validate available; write stock_movement + inventory update + domain row; commit. Online insufficient stock → 409 OUT_OF_STOCK with seller name.
- SignalR hub `/hubs/live`: order created/changed, notification, dashboard tick. Hangfire jobs: daily snapshot (00:05), monthly rates+variance (1st 00:30), recurring expenses, scheduled price apply/revert, notification rules scan (hourly), parked-cart expiry (1 min), backup.
- Validation: FluentValidation; phone regex BD `(?:\+?88)?01[3-9]\d{8}`; consistent error envelope `{code, message, details}`.

# PART 5 — FRONTEND (Next.js + TypeScript)

- App Router; route groups: `(auth)`, `(app)` with bottom-tab layout: Home / Orders / Products / POS / More(Purchases, Deliveries, Expenses, Baki, Reports, Settings). Business switcher in header. Mobile-first 375px; tablet POS layout enhancement.
- PWA: next-pwa; offline scope = POS routes + catalog. Dexie schema: `catalog`, `outbox`, `carts`, `meta`. Sync engine: online listener + interval; outbox POST with client_uid; status pill component global on POS.
- Barcode: Bluetooth scanner = keyboard input capture (global listener on POS/order screens); camera fallback via html5-qrcode component.
- Documents: challan/invoice/receipt = server-rendered PDF (QuestPDF in .NET) → print dialog or WhatsApp share link; barcode on challan (order_no).
- Role-aware UI: cost/profit components render only for OWNER (and data never arrives for staff anyway). Forms auto-save drafts locally (never lose a half-typed order on connection drop).

# PART 6 — BUILD ORDER & ACCEPTANCE

**Phases:** 
1. Foundation: tenancy, auth, roles, activity log, settings skeleton.
2. Catalog: categories+field builder, products, variants, barcodes, price history.
3. Inventory core: 4 numbers, movements, adjustments, lots/expiry, damage section.
4. Purchases: trips, smart form, allocation (pass §R5.6 tests), receiving, approval.
5. Orders online: 3-track lifecycle, customers, challan PDF, discounts, baki on orders.
6. Couriers + COD reconciliation + deliveries screen.
7. POS: screen, multi-cart parking, shifts/Z-report, **offline-first sync**.
8. Expenses, petty cash, marketing budgets, planned rates + variance job.
9. Refunds & replacement (with shift-cash linkage), pricing screen final.
10. Reports library, daily snapshots/digest, targets, notifications, Excel import/export.

**Acceptance tests (minimum):** landed-cost examples (103.10 / 102.07 / 108.53); two concurrent confirms on last unit → exactly one succeeds; offline: 3 sales queued → airplane mode off → exactly 3 orders, retry produces no duplicates; parked-awaiting-payment reserves stock (second cashier blocked); refund reduces shift expected cash; price change leaves historical order profit untouched; staff token receives no cost/profit fields on any endpoint; COD reconciliation flags unmatched delivered orders after X days; variance alert fires on 2 consecutive months >20%.

**Module 15 (Partnership & Capital Ledger)** runs as an independent track outside phases 1–10 above, sub-phased 15a→15e (see Module 15) — 15a is being built now, in parallel with/ahead of Phase 4, by explicit Owner decision since it doesn't depend on Orders. Its own acceptance tests are listed at the end of the Module 15 section.
