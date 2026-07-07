# ClientPage — Public Storefront Requirements
**Status:** Phase A–D complete (browsing, cart, guest checkout with per-shop order splitting, live POS order notifications). This is the source-of-truth doc for the ClientPage module — expand it here as requirements grow.

**Relationship to the other docs:** `reseller-system-requirements-v2.md` explicitly lists "customer-facing storefront" as out of scope (§1.1). This is a documented Owner override, same pattern as Subscriptions, Catalog Templates, and self-service signup — all shipped ahead of/outside the original doc by Owner decision. Where this doc doesn't cover something, the core requirements doc's Global Technical Rules (GTR-1..12) still apply — this module doesn't get a pass on multi-tenancy, money precision, soft-delete, etc.

---

## 1. What this is

A public, unauthenticated e-commerce site where outside customers browse products and place guest cash-on-delivery orders. No customer login, no online payment. It runs in a **hybrid model**, resolved per-request:

- **Main domain** (e.g. `yourplatform.com`) → **marketplace mode** → shows products aggregated from every shop that has opted in (`ShowOnMarketplace`), each product card shows which shop it's from.
- **A specific shop** → **shop mode** → looks like that one shop's own independent site, only its products. Two ways to reach it, both resolved by the same mechanism (`src/proxy.ts` sets a `cp_shop` cookie + `x-clientpage-shop` request header regardless of source):
  - **Path-based** (`yourplatform.com/shop/rahimstore`) — the always-works sharing URL, no infrastructure required. Implemented as a proxy-level rewrite: the address bar keeps showing `/shop/rahimstore/...`, but the request is served by the normal unprefixed route underneath (so `/shop/rahimstore/product/xyz` rewrites to `/product/xyz` with shop context already set) — deep links work, not just the homepage.
  - **Real subdomain** (`rahimstore.yourplatform.com`) — resolved from the `Host` header once a shop has DNS set up. Requires wildcard DNS + wildcard SSL (§7, deployment prerequisite, not built yet) — the code path exists and is a drop-in upgrade once that infra exists, no app changes needed.

Same frontend codebase and components render both modes — only the resolved scope (and branding) differs. The customer never needs to know or care which mode they're in.

## 2. The core architectural fact this design rests on

`Business` (`backend/src/ResellerApi/Entities/Business.cs`) **is already the "shop" tenant boundary.** Every business-scoped table already carries `BusinessId` with an EF Core global query filter enforcing isolation (GTR-1). There is no separate `Shops` table — a "shop" in ClientPage terms is just a `Business` row with storefront fields turned on.

This means shop-mode requests can reuse the **exact same tenant-scoping mechanism** the staff/POS app already uses:

- `Middleware/BusinessContextMiddleware.cs` (staff path) resolves `X-Business-Id` header + JWT claims → sets `BusinessContext.CurrentBusinessId` (a scoped POCO, `Infrastructure/BusinessContext.cs`) → every `BusinessScopedEntity` query is automatically filtered by it.
- `Middleware/ClientPageShopContextMiddleware.cs` (this module) resolves which shop the request is for → sets **the same** `BusinessContext.CurrentBusinessId`.

**How shop resolution actually works, and why:** the ClientPage frontend and this API are separate origins (distinct CORS-listed ports/domains) — the backend can never reliably see the *browser's* real `Host` the way a same-origin reverse proxy setup would let it. So resolution is a `?shop=<subdomain>` query param, **always honored** (not a dev-only fallback) plus an optional `Host`-header-based lookup for deployments that do put the frontend and API behind the same domain. The frontend is the one responsible for figuring out "what shop is this" (from *its own* incoming Host header, via Next.js middleware) and passing that slug through explicitly on every backend call — the query param is an internal channel between the frontend and its own API, not something an end user is expected to hand-type.

This is safe to always honor because it doesn't cross a real privilege boundary: it only ever unlocks a shop's already-public catalog and guest checkout — exactly what visiting that shop's real subdomain directly already exposes. There is no private/staff data behind it, so there's nothing to "spoof" the way `X-Business-Id` spoofing would matter on the staff side (where `BusinessContextMiddleware` verifies real `BusinessUser` membership before trusting the header). The one accepted tradeoff: reaching a shop this way bypasses `ShowOnMarketplace` — that flag only controls whether a shop appears in *aggregated marketplace search results*, not whether its storefront is directly reachable by someone who already has its subdomain/slug (which was never meant to be secret — it's the shop's own memorable identifier, same as a real subdomain would be).

Because `BusinessContextMiddleware` and `SubscriptionGateMiddleware` both already short-circuit for unauthenticated requests (`!context.User.Identity.IsAuthenticated`), and ClientPage requests are always anonymous, there is zero interference between the staff auth path and this one — they are mutually exclusive per request, and share only the plumbing (a scoped-per-request DI instance), not any global state.

**Practical payoff:** in shop mode, `ClientPageCatalogService` doesn't reimplement search/browse/detail — it calls straight through to the existing `IProductService.SearchAsync`/`BrowseAsync`/`GetAsync(id, isOwner:false)`/`ActiveCategoriesAsync()`, which are already correctly scoped, already tested, and already strip cost fields (`ProductDetailStaffDto`/`VariantStaffDto`, no role check needed since ClientPage always takes that branch).

**Marketplace mode is the one genuinely new read path** — it can't be expressed as "the same filter, more permissive." It uses `IgnoreQueryFilters()` plus an explicit join: `WHERE Business.ShowOnMarketplace = true AND Business.DeletedAt IS NULL`, kept as its own clearly-named service method so it's easy to spot in review as the one place in the codebase allowed to read across tenants.

## 3. Data model

New columns on `Business`:
| Column | Type | Notes |
|---|---|---|
| `Subdomain` | `string?`, max 63 | Unique filtered index (`WHERE Subdomain IS NOT NULL`). DNS label limit. |
| `LogoUrl` | `string?` | |
| `BannerUrl` | `string?` | |
| `ShowOnMarketplace` | `bool`, default `false` | Opt-in to appear in aggregated main-domain search |
| `StorefrontEnabled` | `bool`, default `false` | Has its own subdomain site at all — independent of the flag above, so a shop can run a private white-label subdomain without ever appearing next to competitors |

New tables (prefixed `cp_` to keep this module visually distinguishable from the core POS schema):

```
cp_checkout_groups        (BaseEntity, NOT business-scoped — spans multiple businesses by design)
  - CustomerName    string
  - CustomerPhone   string

cp_checkout_group_orders   (BaseEntity)
  - CheckoutGroupId  FK → cp_checkout_groups
  - OrderId          FK → orders
  - BusinessId       Guid (denormalized, for display only)
```

`CpCheckoutGroup`/`CpCheckoutGroupOrder` are plain `BaseEntity` (get rowversion automatically via the existing convention loop in `AppDbContext.OnModelCreating`) — they are **not** `BusinessScopedEntity`, since a checkout group can legitimately reference orders from several different businesses at once (a mixed-shop marketplace cart). This is the only entity family in the system that deliberately crosses the tenant boundary, and it carries no money/cost/business-logic fields itself — it's purely a receipt-grouping record for the customer-facing confirmation page.

## 4. Order-splitting model (deferred — designed now, built in the next pass)

A mixed-shop cart must **not** become one `Order` spanning multiple businesses — that would break GTR-1 and the entire fulfillment pipeline (pack/handover/deliver, stock UPDLOCK commit, POS visibility all assume exactly one business owns an order). Instead:

1. Cart items are grouped by the owning `Business.Id` at checkout time.
2. One independent `Order` is created **per business group**, through the existing `IOrderService.CreateAsync` → `ConfirmInternalAsync` pipeline, completely unmodified — same stock lock, same `StockUnavailableException` handling, same guest `Customer` find-or-create (which stays per-business: the same phone number becomes a distinct `Customer` row in each shop's own book — there is no cross-shop customer identity, consistent with guest-checkout-only).
3. A `CpCheckoutGroup` + one `CpCheckoutGroupOrder` row per created `Order` ties them together for the receipt/confirmation page ("your order includes items from 2 shops").
4. Delivery charge is **per shop**, computed by each `Order` exactly as today — there is no shared order total to split, so this falls out for free.
5. On a shop subdomain, this whole grouping layer is skipped — single business cart, one `Order`, identical to a plain single-storefront design.

## 5. Feature list

### Pages (both modes, same components)
| Page | Notes |
|---|---|
| Homepage | Banner (shop's own in shop mode, platform's in marketplace mode), category chips, product grid |
| Category browse | Product grid, filter (in-stock only), sort |
| Search results | Same grid; marketplace mode searches across all opted-in shops |
| Product detail | Images, selling price only (never cost), variant picker, in-stock/out-of-stock badge (no exact count exposed), shop name + link (marketplace mode) |
| Cart | Client-side only (no server cart, no login). Marketplace-mode cart visually groups items by shop |
| Checkout | Guest form (name/phone/address), COD only, splits into N `Order`s + one `CheckoutGroup` |
| Order confirmation | One card per shop-order |
| Order lookup | Phone + order number (no login exists, so this is the only way a guest checks status later) |
| Shop "About" | Address/contact, from existing `Branch`/`Business` fields (shop mode only) |

### Backend
- Public catalog reads: shop-scoped (reuses existing `IProductService`) and marketplace-wide (new `IgnoreQueryFilters` path)
- Shop-context resolution: `?shop=` query param (always honored — see §2), `/shop/{slug}` path prefix, plus `Host`-header lookup for same-origin/subdomain deployments
- Public guest-checkout endpoint (`POST /api/v1/clientpage/checkout`, `Services/ClientPageCheckoutService.cs`) — groups cart items by `BusinessId`, creates one independent `Order` per shop via the existing `IOrderService.CreateAsync` pipeline unmodified, ties them together with `CpCheckoutGroup`/`CpCheckoutGroupOrder`. **Partial-success**: one shop's oversold items failing doesn't block another shop's order in the same checkout. Guest orders are attributed to a lazily-created, unguessable, `IsActive=false` "Storefront" system user per business (`Role = "STOREFRONT_SYSTEM"`, not in `Roles.All` — can never log in or pass an `[Authorize(Roles=...)]` check) since every `Order` requires a real `CreatedByUserId`.
- Rate-limiting on the checkout endpoint — reuses the existing fixed-window `RateLimiter` pattern (`Program.cs`, policy `"clientpage-checkout"`, mirrors `"signup"`).
- **Live order notifications**: first real use of `Hubs/LiveHub.cs` — the hub existed (JWT auth, per-business `JoinBusiness`/`LeaveBusiness` groups) but nothing ever broadcast to it, and the POS frontend had no SignalR client at all. `ClientPageCheckoutService` now calls `IHubContext<LiveHub>.Clients.Group($"business_{businessId}").SendAsync("OrderCreated", ...)` after each successful order; the POS app (`src/hooks/useLiveNotifications.ts`) connects once authenticated, shows a toast + bell badge (live-only, no persisted history — that's a bigger deferred feature). Required exempting `/hubs` from `BusinessContextMiddleware`'s `X-Business-Id` header requirement, since SignalR's own negotiate/connect calls never carry it (the hub scopes itself via the `JoinBusiness` RPC instead).
- Public order-lookup endpoint by phone + order number (deferred to next pass)
- Self-service Business Settings additions in the existing `/frontend` app: claim `Subdomain`, upload `LogoUrl`/`BannerUrl`, toggle `ShowOnMarketplace`/`StorefrontEnabled` (deferred to next pass)
- Full persisted notification system (notification table, read/unread state, working `/notifications` page) — deferred; today's live-only toast+badge was a deliberate scope call

### Explicitly out of scope for now
Customer accounts/login (guest checkout + phone/order-number lookup only), online payment (COD only), custom domains (this architecture supports it later — just another lookup column, not built now), a platform-admin approval queue (self-service toggles instead — no cross-business admin role exists today), per-product marketplace-visibility override (visibility is shop-level only, via `ShowOnMarketplace`), reviews/ratings/wishlists/recommendations.

## 6. Naming & folder conventions

- Backend controllers: `Controllers/ClientPage*Controller.cs`, route base `api/v1/clientpage`, all `[AllowAnonymous]`.
- Backend DB objects introduced by this module: `Cp*` entity classes, `cp_*` table names.
- Frontend: a separate Next.js 14+ App Router + TypeScript + Tailwind project at `/clientPage`, independent `package.json`/deploy from `/frontend` (the internal staff/POS app). No shared UI code between the two.

## 7. Deployment prerequisites (not built by this module, must exist for production)

- Wildcard DNS + wildcard SSL certificate (`*.yourplatform.com`) for subdomain hosting to work at all in production — the frontend's own Next.js middleware needs a real `Host` header to resolve which shop a visitor is on. Not needed for local development — `?shop=` on the frontend's URL simulates it, and works identically in prod as an internal frontend→backend channel regardless.
- Production CORS: the current `AllowedOrigins` allow-list (`appsettings.json`) is a fixed list of known origins, fine for one dev origin. Once shops have arbitrary subdomains (and later, custom domains), this needs a dynamic-origin CORS policy or a same-origin reverse-proxy setup. Not solved in this pass — flagged so it isn't forgotten.

## 8. Verification (Phase A–C)

1. `dotnet build` clean, `dotnet test` — all pre-existing tests still pass (nothing existing is modified, only additive).
2. Apply migration; confirm `cp_checkout_groups`/`cp_checkout_group_orders` exist; confirm `Business` has the new nullable/defaulted columns on existing rows.
3. Set `ShowOnMarketplace=1` + a `Subdomain` on the dev seed business via SQL. `GET /api/v1/clientpage/shop-context?shop=<subdomain>` → `mode: "shop"` with correct branding. Same call with no `?shop=` → `mode: "marketplace"`.
4. Run the `clientPage` dev server; browse homepage/category/search/product-detail in both a `?shop=` URL and the bare marketplace URL; confirm correct product scoping and that no cost/profit field ever appears in any network response.
5. Confirm the existing `/frontend` POS app and all existing endpoints are completely unaffected.
