# Picker caching

`AppQueryProvider` owns one in-memory TanStack Query client. `ProductPicker`
and `OrderCustomerPicker` share requests by resource, business, effective branch,
and request path (including search and stock filters).

- Results are fresh for five minutes. Reopening a fresh picker makes no request.
- Stale results stay visible during background refresh on open or app focus.
- Refresh buttons bypass freshness. Search requests remain debounced.
- Inactive queries are collected after 30 minutes. App restarts start with an
  empty cache; no customer data is persisted to disk.
- Auth clears queries and cancels requests on logout, account, business, or
  branch changes. Token refresh keeps the cache.
- Successful writes through `AuthContext.api` call `invalidatePickerMutation`.
  Product/category/purchase/order/supplier-return/carton writes invalidate
  product queries; customer/order writes invalidate customer queries. Order
  creation can create a customer, including the sale screen's new customer flow.
  Failed writes, reads, previews, and receipt/label requests do not invalidate.
- Customer duplicate-phone checks still query the server directly.

Other devices' changes become visible at the next stale refresh or manual
refresh. This is not a live inventory subscription; the backend still validates
sales and stock operations.

Good next candidates are supplier, brand, and courier pickers. Add their resource
keys and mutation invalidation rules together. The sale screen's main product
grid and the full Customers page have not been migrated in this change.

Run `node --test scripts/picker-cache.test.mjs` from `mobile` with Node 22.18+
or Node 24, and `npm run typecheck`. The tests exercise request sharing,
reopening, invalidation, business separation, background refresh, and cancellation.
