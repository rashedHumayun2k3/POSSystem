# Product and customer cache synchronization

The mobile product picker, POS catalog, and customer picker share TanStack Query
caches keyed by business, branch and request path (including search/filter terms).
Fresh results are reused for five minutes; inactive results are retained for thirty
minutes. Successful writes invalidate affected resources across that business's
branches. Logout and business/branch changes clear the local cache.

## Automatic updates

- Successful product/category, purchase, supplier-return and carton writes emit
  `PickerDataChanged` for products; customer writes emit it for customers; order
  writes emit it for both. The middleware sends after endpoint completion, after
  service transactions have committed. Preview/receipt/barcode-print requests do
  not trigger events. Notification failure is logged and cannot fail a saved sale.
- The authenticated SignalR connection joins only a business the user belongs to.
  Events contain resource names, not product/customer data. Reads retain their
  normal business, branch and role checks.
- The mobile app also listens to existing storefront `OrderCreated` events.
- Open queries refresh on invalidation. Closed queries are marked stale and fetch
  when reopened. App resume and hub reconnect invalidate both resource types.
- Visible queries perform a 60-second fallback refresh for missed messages,
  scheduled price changes and disconnected hubs. Closed pickers, unfocused screens
  and background apps do not poll. Initial connection failures retry automatically.
- Product/customer pickers no longer require manual refresh. Failed background
  requests retain cached results and display a refresh error.

The five-minute freshness value is not a periodic timer. The explicit fallback
interval is separate. Offline displays can be stale; reconnect/resume recovers them.
POS continues to submit sales to the backend, whose existing confirmation path
checks stock inside a SQL transaction with inventory update locks. Cached quantities
never authorize a sale. Existing editable POS prices and offline-oversell policy
are not changed by caching.

## Deployment and limits

Deploy the backend and rebuild the mobile app together. This feature needs no
database migration. Ensure the production hub URL points to `/hubs/live` on the
correct backend and the proxy supports SignalR/WebSockets.

The existing SignalR server uses in-process groups. Immediate delivery works for
connections on the API instance handling the write. Multiple API instances require
a shared SignalR backplane/service for immediate delivery across instances; without
one, the 60-second fallback still recovers visible lists. Jobs and direct database
writes likewise rely on the fallback. Events are hints, not a durable event stream.

## Verification

Automated coverage includes cache reuse, concurrent query deduplication, closed
picker invalidation, cross-business isolation, open-list refresh after a simulated
remote sale, resume invalidation, logout cancellation, hub membership checks,
mutation route mapping, and notification failure after a committed response.

Before production rollout, verify against the deployed SQL Server and two devices:

1. Warm both catalogs; create/edit/delete a product on one device and check the other.
2. Sell on one device; check quantities and customer information on the other.
3. Disconnect one device, make changes, reconnect and verify recovery without taps.
4. Background/resume the app and switch businesses/branches; verify isolation.
5. Have both devices attempt to sell the last unit; only one online confirmation
   should commit. This needs real SQL Server locking, not the in-memory test provider.
6. Disable hub delivery and confirm fallback recovery while the list is visible.

These live-device and SQL concurrency checks are deployment acceptance checks;
unit tests and an Android JavaScript export do not establish that they have passed.
