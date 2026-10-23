# Purchase shipment lots

This change covers the API and the Expo mobile application. Deploy the migration, API and updated mobile client together. The separate Next.js `frontend` PO screens have not been redesigned for these new statuses/endpoints and must not be used to manage the new lot workflow until upgraded.

## Findings from the existing implementation

- `ProductVariant` maps to `product_variants`. Only `purchase_items` previously held unit weight.
- `purchase_shipments` previously required a carrier and a single associated cost, and had a filtered unique index on `TripId`. These legacy fields are retained; carrier/cost foreign keys are now optional.
- Existing receiving sessions do not identify shipments. They cannot be reliably backfilled into shipment lots. Existing inventory `lots` are a separate concept and are preserved.
- The old service supported draft receiving, and charged the entire product-line value again on each partial receipt.
- Catalog template onboarding also used draft receiving for opening inventory. It now uses an explicit internal opening-stock transition; the HTTP receiving endpoint rejects drafts.

## Lifecycle and permissions

PO: `DRAFT` → `PRODUCT_APPROVED` → `IN_PROGRESS` → `COMPLETED`.

Product approval checks the product subtotal and non-post-completion costs whose `ShipmentId` is null. Positive rows require a full recorded payment. Common costs lock at product approval. The first sent lot moves the PO to In Progress.

Shipment lot: `READY` → `SENT` → `RECEIVED`. Owners create/edit ready lots and mark them sent. Sent quantities are immutable. A PO product can be split between lots, but reserved quantities cannot exceed the order.

Owners and warehouse users submit receipts. Owner receipts auto-approve in the same transaction; warehouse receipts wait for owner/manager approval. A receipt accounts for every lot line as usable + damaged + missing. There is one active receipt per lot; rejected attempts remain in history and allow resubmission. Approval revalidates quantities and requires a `COURIER` row. A zero courier row represents free delivery. Lot payments may be made later; their payment status does not block product approval or receipt approval.

Payments retain the original schema, request idempotency, full-row amounts, and business/personal funding rules. `Guid.Empty` is the product subtotal key. Lot cost IDs are ordinary payment cost keys.

Receipt approval and lot reservation use the existing serializable business funding lock. Inventory updates retain SQL Server update locks and are committed with receipt, lot, loss, stock-movement and average-cost changes.

Automatic completion requires exact accounted quantity on every line and no other pending receipt. Manual close requires pending receipts to be approved/rejected and a reason for unaccounted quantities. It does not invent missing quantities or retroactively change inventory.

## Cost and weight rules

All new amounts are BDT; new lots do not use currency exchange or carrier rates.

1. Unit purchase cost = PO line total / ordered quantity.
2. Lot share of common costs = common costs × purchase value assigned to the lot / total PO product value. Missing pieces still belong to the lot's assigned value.
3. Pool = that common share + non-post-completion China-local and courier rows for the lot.
4. Pool is allocated by each line's total physical measured weight. Rounding residuals within a lot are assigned to the largest weight to preserve every paisa.
5. Landed unit cost = (unit purchase cost × (usable + damaged) + allocated cost) / usable quantity.
6. Missing purchase value is recorded in `LossAmount`, not added to usable inventory cost. When a line has no usable units, its remaining physical purchase value and allocated costs are also recorded as unrecoverable loss. A completely missing lot allocates its pool by assigned quantities because it has no measurable weight.
7. Measured line weight / physical quantity updates the variant's saved unit weight and the current PO line. New PO lines default to the variant's last measured weight.
8. Historical receipts without a shipment use proportional purchase-value cost allocation, with only the quantity in that receipt charged. Existing inventory valuations are not rewritten.

Weight warnings compare declared, measured and billed weights. Set `Purchases:WeightTolerancePercent` in configuration, or environment variable `Purchases__WeightTolerancePercent`; the default is 5. Warnings do not prevent approval.

## Migration and compatibility

EF migration: `20261022162615_AddPurchaseShipmentLots`.

- Adds `purchase_shipment_items`, lot status/number/weight fields, nullable cost/receipt `ShipmentId`, receipt allocated cost/loss/weight, `QtyShipped`, and variant weight.
- Replaces the single active shipment index with unique `(TripId, LotNo)`.
- Adds a filtered unique index allowing one non-rejected, non-deleted receipt per shipment.
- Preserves existing shipment metadata as `IsLegacy` records and old cost/payment IDs unchanged.
- Existing `PENDING_APPROVAL` POs become Draft; `RECEIVING` becomes In Progress. Historical drafts that already have approved receipts become In Progress. Completed and cancelled history stays intact.
- Existing POs get `UsesShipmentLots = false`; new application-created POs use true. Historical unassigned receipts can still complete after approval. Their unallocated remainder can also be put into new lots.
- Backfills shipped quantity from already-accounted quantities and missing purchase losses for approved historical receipt rows. Historical allocated shipping amounts remain untouched/unknown rather than reconstructed.
- Historical receiving sessions keep null `ShipmentId`; no unsupported lot assignments are guessed.
- Rollback is refused once new lots exist, because dropping their fields would destroy shipment/loss history. Restore a pre-migration backup if rollback is required after use.

`AddPurchaseShipmentLots.sql` is the generated forward script from `AddPurchasePayments`; it has not been applied to the application database. Both the backfill and filtered-index creation use deferred SQL compilation to support executing the generated script as well as EF migration commands.

## API and mobile

New routes under `/api/v1/purchase-trips/{id}`:

- `POST /lots`: create ready lot; `PUT /lots/{lotId}`: edit ready lot.
- `POST /lots/{lotId}/send`: mark sent.
- `POST /lots/import/preview`: validate `.xlsx` JSON upload `{ fileName, base64 }` without writing.
- Existing `/costs` accepts nullable `shipmentId`; use `CHINA_LOCAL` or `COURIER` for lot costs.
- Existing `/sessions` accepts `shipmentId`, `billedWeightGrams`, and each item's total `measuredWeightGrams`.
- PO detail includes `lots`, `qtyShipped`, shipment links, measured weights, allocated costs, losses, and weight warnings.
- Historical singular shipment GET is retained. Singular shipment mutations now return an instruction to use Lots.
- The old submit route is a compatibility no-op on Draft. Product approval happens directly from Costs.

Mobile tabs are Products / Lots / Costs / Cost Summary. Lots and Cost Summary appear after product approval. Payments remain in Costs, while lot details show payment status. Excel preview accepts Product or Product Name, Variant or SKU, and Qty or Quantity headers. A unique variant SKU resolves ambiguous names. Duplicate matching rows are combined by the mobile confirmation step; quantities are validated again when saving. Maximum 500 rows / 5 MB; formulas and macros are rejected.

## Verification

Final local results: 31 purchase/payment tests passed; the changed PO TypeScript dependency graph passed; Expo web export passed; EF reported no model changes missing from the migration. Backend compilation passed with existing warnings. Verification used the `PoLotsVerify` build configuration to avoid replacing an API executable already in use.

The regression suite is `PurchaseShipmentLotTests.cs`, alongside existing purchase cost/payment tests. It covers 4+6 splits, historical 50+50 costing, stock updates, approval gates, courier requirement, missing losses, owner/warehouse approval, rejected receipt replacement, duplicate receipt prevention, manual close, fresh-request persistence, saved weight reuse, cost locking, tenant isolation, rounding, Excel preview, and tolerance.

`PurchaseShipmentMigrationSmoke.sql` is a SQLCMD fixture for a disposable database named `PoLotMigrationCheck_*`. It recreates only affected old-schema tables, executes a generated migration script, and checks legacy backfills and filtered uniqueness. It must never run against application data.

Full repository checks have unrelated baseline blockers: `InvoiceListTests.cs` refers to missing `BusinessId` fields on `OrderItem`/`OrderPayment`; mobile order screens have existing TypeScript errors. PO tests were run with that invoice test source temporarily excluded, and the changed PO screens were typechecked separately. The Expo web export succeeds.

The final SQL smoke rerun remains pending: earlier runs exposed SQL single-batch compilation issues, now corrected; automatic approval review then hit its usage limit and blocked resetting/rerunning the disposable database. The temporary database `PoLotMigrationCheck_20261022_1626` may remain locally and contains only the test fixture. No application database was changed.
