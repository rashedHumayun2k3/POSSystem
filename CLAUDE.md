# Reseller Business Management System — Project Instructions

## What this project is
A mobile-first business management system for a Bangladesh reselling business (lot purchasing, Facebook/courier COD orders, physical shop POS with barcode scanner, multi-staff, future SaaS).

## The two source-of-truth documents — READ BOTH before any task
1. `docs/reseller-system-requirements-v2.md` — ALL functional requirements: modules, business rules, formulas, database schema, API design, build order, acceptance tests.
2. `docs/reseller-system-ui-spec.md` — ALL screens, layouts, components, element placement, navigation.

**Authority rule:** if the documents ever seem to conflict, the requirements doc wins on logic/data/behavior; the UI doc wins on appearance/layout.

## Stack (decided — do not substitute)
- Backend: .NET 8 Web API in `/backend`, EF Core **Code-First** against SQL Server (Express for dev), JWT auth, SignalR, Hangfire, QuestPDF for documents.
- Frontend: Next.js 14+ (App Router) + TypeScript + Tailwind in `/frontend`, PWA (next-pwa), Dexie.js (IndexedDB) for offline POS, TanStack Query, html5-qrcode.

## Standing engineering rules (non-negotiable)
1. **Code-First only.** Schema changes = EF migrations. NEVER drop/recreate the database; never suggest it once data exists.
2. **All business logic, validation, and state changes live in C# services with unit tests.** Raw SQL is allowed ONLY for read-only reporting, implemented as SQL views created via EF migrations. No business rules in stored procedures.
3. Every business-scoped table has `business_id` with an EF global query filter (multi-tenant rule GTR-1). Money = DECIMAL(14,2); quantity = DECIMAL(12,3). Never float/double for money.
4. Stock mutations follow the mandatory pattern in requirements Part 4: single transaction + UPDLOCK row lock + stock_movement + inventory update.
5. Optimistic concurrency via rowversion on mutable tables; return 409 with a human message on conflict.
6. STAFF role must never receive cost/profit/expense fields in any API response — enforce server-side (DTO shaping), not just in UI.
7. Soft delete only (`deleted_at`). Append-only history for prices, planned rates, courier charges (GTR-7). Order snapshots are frozen and never recalculated (GTR-8).
8. POS/offline endpoints accept Idempotency-Key (client UUID) and must never create duplicates on retry.

## Working method
- Follow the **build order in Part 6** of the requirements doc, ONE phase at a time. Do not start a new phase until the current one passes its acceptance tests (listed at the end of the requirements doc) and is committed.
- After completing a phase: state which acceptance tests apply and how to run/verify them manually.
- Write unit tests for all costing math (landed cost allocation, weighted average, safe discount, refund effects on shift cash).
- Keep commits small and working; suggest a commit message after each completed unit of work.
- When something in the docs is ambiguous, ASK before inventing behavior.

## Current status
Phase 1 (tenancy/auth/activity log) ✅
Phase 2 (catalog: categories, products, variants, barcodes, price history) ✅
Phase 3 (inventory: purchase trips, lots, stock movements, variant_inventories, landed cost) ✅
  → Extras built on Phase 3: supplier picker, product picker (category chips + A-Z), late costs (post-completion), partial delivery (PARTIALLY_RECEIVED status), staff can receive trips.
Currently: Phase 3 complete. Next = Phase 4 Orders.

## Planned features (not yet built — implement in order when reached)

### Supplier Return / Debit Note
**When:** After Phase 4 (Orders) is done, or when the user reports enough damaged goods piling up.

**Business scenarios it covers:**
- Buyer receives 100 units, 10 are broken → returns 10 to supplier
- Supplier sends wrong product → full return
- Supplier gives partial credit instead of replacement

**Design decisions already made:**
- Damage is recorded at trip completion via `DAMAGE_IN` stock movement (already working)
- Damaged units sit in `variant_inventories.Damaged` — tracked but NOT in sellable stock
- The return module picks up from there

**Data model to build:**
```
supplier_returns (BusinessScopedEntity)
  - SupplierReturnNo  TEXT
  - SupplierId        FK → suppliers
  - TripId            FK → purchase_trips (optional, the original trip)
  - Status            DRAFT | SUBMITTED | RESOLVED
  - Note              TEXT?
  - CreatedBy         FK → users

supplier_return_items (BaseEntity)
  - ReturnId          FK → supplier_returns
  - VariantId         FK → product_variants
  - QtyReturned       DECIMAL(12,3)
  - UnitCost          DECIMAL(14,2)    ← the landed cost of the damaged batch
  - ResolutionType    REFUND | REPLACEMENT | CREDIT_NOTE | WRITE_OFF
  - ResolutionAmount  DECIMAL(14,2)?   ← money received back (for REFUND/CREDIT_NOTE)
  - ReplacementTripId FK → purchase_trips?  ← if supplier sends replacement goods
  - Note              TEXT?
```

**What happens on "Resolve":**
- `REFUND`: reduce `variant_inventories.Damaged` by QtyReturned; record `DAMAGE_OUT` stock movement; record income entry
- `REPLACEMENT`: reduce `Damaged`; record `DAMAGE_OUT`; a new purchase trip is linked for the replacement
- `CREDIT_NOTE`: reduce `Damaged`; record `DAMAGE_OUT`; create a supplier credit that can offset future purchases
- `WRITE_OFF`: reduce `Damaged`; record `DAMAGE_WRITEOFF`; treat as a loss expense

**UI:** Same slide-panel pattern for supplier picker; item list with variant picker; resolution form per item.
