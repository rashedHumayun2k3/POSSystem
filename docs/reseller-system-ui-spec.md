# Reseller Business Management System — UI/UX Specification v1.0
**Companion to:** reseller-system-requirements-v2.md (the functional spec). This document defines screens, layouts, and element placement. Where this doc says WHAT a button does, the requirements doc is authoritative on the underlying rule.
**Target:** Next.js + TypeScript + Tailwind. Mobile-first (375px base), tablet enhancement for POS. Audience: AI coding agent (Claude Code).

---

# 1. DESIGN PRINCIPLES (apply to every screen)

1. **Thumb-first:** primary actions live in the bottom 40% of the screen. Destructive/rare actions live in overflow menus (⋮).
2. **Tap targets ≥ 48px** height. Primary button full-width at screen bottom.
3. **≤ 3 taps to start any frequent task** (new order, scan sale, add expense).
4. **Scan-first, type-last:** every product input field accepts barcode scanner (keyboard-wedge) AND has a 📷 camera-scan icon AND text search fallback — in that priority order.
5. **One screen, one job.** No screen mixes unrelated tasks. Multi-step jobs use a stepper (numbered progress dots at top).
6. **Numbers are big:** money totals 24–28px bold; everything financial right-aligned, thousands separators (18,400).
7. **Status = colored badge, never plain text.** Consistent palette (see §2.3).
8. **Staff-mode is a subset, not a different app:** identical layouts with owner-only elements absent (not greyed — absent).
9. **Never lose work:** all forms auto-save drafts locally; back button asks only when unsaved changes exist.
10. **Empty states teach:** every empty list shows an icon + one sentence + the primary action button ("No orders yet — + New Order").

# 2. DESIGN SYSTEM

## 2.1 Layout primitives
- **AppHeader (every screen):** left = screen title (or back arrow + title); right = 🔔 NotificationBell with unread badge + SyncPill (🟢/🟡 n/🔴, POS-relevant screens) ; owner-only: BusinessSwitcher dropdown left of bell.
- **BottomTabBar (5 tabs, fixed):** 🏠 Home · 🧾 Orders · 🛒 POS · 📦 Products · ☰ More. Active tab tinted. POS tab is the center, visually emphasized (circle).
- **FAB:** floating action button bottom-right above tab bar, only on list screens, always the screen's "+ new" action.
- **BottomSheet:** all pickers/forms shorter than a full screen open as slide-up sheets (not new pages): courier picker, payment method, discount entry, park options.
- **Stepper:** numbered dots + labels at top for multi-step flows (New Purchase Trip, Receiving, Refund).

## 2.2 Components (reused everywhere — build once)
- **SearchBar:** pinned under header on list screens; placeholder states what's searchable ("Search name, phone, order no"); debounced.
- **FilterChips:** horizontal scroll row under SearchBar; single or multi-select; active chip filled. Used for statuses, channels, categories, date presets (Today / 7d / Month / Custom).
- **ListCard:** mobile replaces tables — each row is a card: left = title + 1–2 subtitle lines; right = amount + StatusBadge; tap = detail; **swipe right = primary quick action** (e.g., order → next status), swipe left = secondary (call customer). Long-press = multi-select mode.
- **DataTable (tablet/desktop only):** sortable column headers (tap to sort, arrow indicator), sticky header, same data as ListCards.
- **StatusBadge:** pill, 12px, colored per §2.3.
- **MoneyText:** tabular numerals, owner-only variants render nothing for staff.
- **QtyStepper:** [−] value [+] with direct tap-to-type.
- **Dropdown (ddl):** native select on mobile wrapped in styled trigger; >10 options → searchable BottomSheet list instead.
- **RadioRow / SegmentedControl:** 2–4 mutually exclusive options shown as segmented buttons (e.g., discount PERCENT|FIXED), radios only in settings forms.
- **PhotoAttach:** camera icon button → capture/gallery → thumbnail with ✕; compresses client-side.
- **ScanInput:** text input + 📷 icon; auto-captures scanner keystrokes globally on screens flagged scan-enabled.
- **ApprovalBanner:** amber strip atop records in PENDING_APPROVAL ("Waiting for owner approval") with owner-side Approve/Reject buttons.
- **ConfirmDialog:** destructive actions require typed confirmation only for irreversible ones (complete trip, close shift); others = simple two-button dialog.
- **Toast:** success bottom toasts auto-dismiss 2s; errors persist with retry.

## 2.3 Color semantics (Tailwind tokens)
- Primary actions: indigo-600. Success/money-in/Delivered/Paid: green-600. Danger/loss/Returned/overdue: red-600. Warning/pending/in-transit/baki: amber-500. Neutral/draft/cancelled: gray-400. Info/committed/parked: blue-500.
- Profit numbers: green when ≥0, red when <0 — everywhere, no exceptions.

## 2.4 Typography & spacing
- Inter or system font. Screen title 18/semibold; section header 14/semibold/uppercase-tracking; body 14; captions 12; money-hero 26/bold. Base spacing 4px grid; card padding 16; list gap 8.

# 3. NAVIGATION MAP

```
Login → (app)
Home(Dashboard)
Orders → New Order · Order Detail → Refund flow
POS → Sell · Parked carts · Shift open/close
Products → Product Detail(Display) · New/Edit Product · Damage section
More ☰ → Purchases → Trip Detail → Receiving · Labels
        → Deliveries (courier board) → COD Reconciliation
        → Expenses → Add Expense · Petty Cash
        → Baki → Party Ledger
        → Reports → Report Viewer
        → Customers
        → Settings → (sub-screens incl. Category Builder, Couriers, Staff, **Partners — owner-only, Module 15**)
        → Activity Log (owner)
Notifications (from bell, anywhere)
Partner Portal (separate login, not under (app)) → Partner Dashboard · Partner Ledger · Vote on Distribution [15c+]
```
Staff navigation: identical minus Reports, owner Settings sections, Activity Log, Partners; Purchases visible if permitted (entries go to approval).

# 4. SCREEN SPECIFICATIONS

Format per screen: **Layout (top→bottom)** with element types in [brackets]: [btn]=button, [search], [chips], [ddl], [seg]=segmented, [radio], [table/cards], [fab], [sheet], [input], [scan].

## 4.1 Login
- Centered logo · [input phone] · [input password, eye toggle] · [btn full-width "Login"] · forgot-password link → contact owner note. Errors inline under fields.

## 4.2 Dashboard — Home (owner)
- AppHeader: BusinessSwitcher [ddl] · bell.
- **MoneyStrip:** 4 horizontally scrollable stat cards: Cash today · Customers owe (green) · I owe (red) · At couriers (blue). Tap card → relevant module.
- **TodayRow:** 3 mini-stats: Orders today · Pending deliveries · Stock alerts (red count). Tap → filtered lists.
- **TargetBar:** month target progress (profit) with % label.
- **ActionGrid:** 4 big buttons: + New Order · 🛒 POS · + Purchase · + Expense.
- **AttentionList [cards]:** approvals waiting (owner), stuck orders, expiring stock, baki due today — max 5, "View all".
- Staff variant: TodayRow + ActionGrid + their open shift card + operational alerts only. No MoneyStrip/Target.

## 4.3 Orders — List
- [search "name, phone, order no"] · [chips: All · Draft · Pending · Confirmed · Packed · In transit · Delivered · Returned] + secondary [chips: channel icons] + [chips date presets].
- [cards]: line1 order_no + StatusBadge(fulfillment) + PaymentBadge; line2 customer name · phone; line3 items summary; right: total + (owner) profit small. "Handling: Rahim" chip when claimed. Swipe→ advance status; swipe← call.
- [fab + New Order]. Multi-select (long-press) → bulk action bar: Print challans · Mark handed over (opens scan mode).

## 4.4 New Order (one screen, scan-enabled)
- Step header optional (single screen, sections):
- **Products section:** [ScanInput "Scan or search product"] → result list with photo, name, variant pills (size/color chips appear ONLY if the product's category defines variants — dynamic per requirements R2), available qty, price → tap adds line. Cart lines: name+variant · QtyStepper · price [input editable] · ✕.
- **Customer section:** [input phone] → on match: autofill card (name/address, history line "4 orders · 1 return", rejecter ⚠ banner if flagged); else name/address inputs. [ddl channel] icons.
- **Money section:** subtotal · [btn "Discount"] → [sheet: seg PERCENT|FIXED + input + live SafeDiscount hint "max 51 tk before loss" (owner sees; staff sees only allowed range)] · delivery charge [input, autofilled by area] · advance [input + ddl method].
- Bottom: [btn secondary "Save as draft"] · [btn primary "Confirm order"]. Out-of-stock attempt → inline red "Only 2 available".

## 4.5 Order Detail
- Header: order_no + 3 badges (order/payment/fulfillment).
- **Timeline:** vertical status history with user + time.
- **Next-action button (context-aware, primary, bottom):** Confirm → Pack & Print Challan → Handover (opens [sheet: ddl courier (charges autofill) · input tracking · ddl delivery man optional]) → Delivered/Returned pair.
- Sections: items (with cost/profit lines owner-only) · customer card (call/WhatsApp [btn]s, tracking link) · payments list + [btn "Add payment"] · documents: [btn "Challan PDF"] [btn "Invoice"] [btn "Receipt"] each with Print | WhatsApp share.
- Overflow ⋮: Edit · Cancel (reason required) · Refund/Replace → 4.16.

## 4.6 Products — List
- [search] · [chips categories] · [chips: Low stock · Dead stock · Expiring] · sort [ddl: Name · Stock · Best selling].
- [cards]: photo thumb · name · variant count · "Available 12 (3 committed)" · price; red left-border when low stock. Owner extra small line: avg cost · margin%.
- [fab + New Product]. Header [btn "Print labels"] → multi-select label batch.

## 4.7 Product Detail (Display screen)
- Photo header · name · SKU · barcode image + [btn "Print label"].
- **Variant matrix [table/cards]:** per variant: values (M/Red) · barcode · available/committed/damaged · price → tap row = variant actions.
- **Stock card:** 4 numbers + Incoming; [btn "Adjust stock"] (note required).
- **Owner-only Cost card:** the grouped 3-level breakdown EXACTLY per requirements Module 11: three group rows (chevron expand to line items) → TRUE COST → break-even/suggested/market row → live calculator (price + discount inputs, green/red profit box, safe-discount line).
- Tabs [seg]: Purchases history · Sales history · Movements · Price history (timeline with reasons; [btn "Change price"] owner-only → sheet with reason [input] + optional schedule [date inputs] + markdown guard warning).
- [btn "Report damage"] → 4.15.

## 4.8 New/Edit Product
- [input name] · [ddl category] → **custom fields render dynamically below** per category template (text/number/date inputs, ddl for DROPDOWN, toggle for BOOLEAN); variant-flagged fields render as multi-select chips ("Sizes: S M L XL") → variant combinations auto-listed beneath with per-variant price override [inputs].
- Barcode block [radio]: ◉ Generate new ◯ **Use manufacturer's barcode** → [ScanInput].
- [input selling price] · [input market price (owner)] · packaging cost · low-stock threshold · [PhotoAttach] · defect notes.
- [btn primary "Save"]. Inline-create version of this form opens as [sheet] from purchase/order flows with only required fields.

## 4.9 POS — Sell (the speed screen; tablet = 2-pane: cart left, grid right)
- Top: SyncPill prominent · shift chip ("Shift: Rahim · 9:12") · **ParkedCartChips row**: `[Hasan 850৳ ⏱3m]` amber for awaiting-payment, gray for browsing; tap = resume; ⏱ red when nearing expiry.
- **[ScanInput autofocus always]** — scanner beeps add lines instantly.
- **FavoritesGrid:** 8–12 tiles auto-ranked by 30-day sales (photo + name + price), tap = add.
- **Cart [cards]:** name+variant · QtyStepper · line total · ✕; damaged-sale items show 🏷 badge.
- **TotalBar (sticky bottom):** big total · [btn "Discount"] (guarded sheet) · [btn "⏸ Park"] → [sheet: ◉ Awaiting payment (reserves stock) ◯ Just browsing] · [btn primary "Charge 850৳"].
- **Charge [sheet]:** payment method tiles Cash · bKash · Card · Baki (known customers only) · Split → split rows [ddl method + input amount, must sum]; cash tile shows tendered/change calculator; optional [input customer phone]; [btn "Complete sale"] → success screen: [btn Print receipt] [btn WhatsApp receipt] [btn New sale (autofocus scan)].
- Offline: everything identical; SyncPill 🔴; completed sales toast "Saved offline (3 pending)".

## 4.10 POS — Shift
- Open: [input opening cash] · [btn "Open shift"].
- Close: summary rows (cash sales, refunds−, expected) · [input counted cash] · auto mismatch line (red if ≠) · typed-confirm [btn "Close shift"]. Z-report view → Print/WhatsApp.

## 4.11 Purchases — Trips List & Trip Detail (Draft)
- List: [chips: Draft · Pending approval · Receiving · Completed] · [cards]: trip_no · source icon · items count · running total · status. [fab + New Trip] → [sheet source type 4 tiles] + **[btn "Repeat last purchase"]** (copies prior trip's items as draft).
- Trip Detail (DRAFT): Stepper (1 Items · 2 Costs · 3 Receive).
  - **Items tab:** [ScanInput "Scan repeat product"] → matched product sheet: qty + total cost + shop name + [PhotoAttach memo] + paid/due [seg + inputs + promised date] → add ≈10s. [btn "+ New product"] → inline-create sheet. Item [cards] listed with edit.
  - **Costs tab:** cost-type tiles per source-type smart form (only relevant ones render) → amount + [PhotoAttach].
  - Bottom: [btn "Continue to receive"] (owner) or [btn "Submit for approval"] (staff).

## 4.12 Receiving (stepper continues)
- Per item card: bought qty (readonly) · **[input usable qty]** (≠ triggers damaged-on-arrival auto-row) · per-lot fields render dynamically (expiry [date] etc.).
- **Preview screen:** computed landed cost per unit per item (the math, visible) · total trip value.
- [btn primary "✅ Complete trip"] (typed confirm) → success → **Price & Labels screen:** per item: current price vs new suggested [input] (pricing helpers inline) · label need auto-detected (manufacturer-barcode items show "no label needed") · **[btn "Print all labels"]** (qty per item prefilled, editable) → done.

## 4.13 Expenses & Petty Cash
- Home: month total (owner) · **6 big category tiles** (icon + name) + 7th Owner-drawing tile (owner-only) · recent entries [cards] with status badges · [chips Pending] (owner sees ApprovalBanner items first).
- Add (from tile): sub-type [ddl] · [input amount, numpad] · date (default today) · [PhotoAttach] · TRIP category extra [radio: ◉ General overhead ◯ Attach to trip → ddl trips] · SALARY extra [ddl staff] · "Pay from petty cash" [toggle] (staff default ON) · [btn Save]. ≤5 taps target.
- Petty Cash: per-staff box cards (balance big) · txn list · owner [btn "Fund box"] · mismatch indicator.
- Marketing budget sub-screen: month [ddl] · budget [input] · progress bar spent/budget · per-product budget rows optional.

## 4.14 Baki
- Dashboard: two hero cards — green "Customers owe: 27,500 (8)" · red "I owe: 18,000 (3)" · net line. [chips: Due today · Overdue · All] · aging mini-bars 0-30/30-60/60+.
- Party list [cards]: name · phone (call btn) · balance colored · promised date. Tap → **Ledger:** khata-style two-column running balance table [table/cards] · [btn "Receive payment"/"Pay"] → sheet: amount · method · [PhotoAttach] · remaining auto-shown. Owner [btn "Set credit limit"].

## 4.15 Damage Section
- List [chips: Pending decision · In claim · Resolved] · [cards] with photo thumb + source badge.
- Report: [ScanInput product] · qty · [seg source 4 options] · order link [input] (required for transit/customer sources) · [PhotoAttach mandatory] · note.
- Decision (owner): 4 outcome tiles → each opens its mini-form (claim: supplier+expected; repair: cost; sell-damaged: special price; write-off: confirm). Claim tracker rows with day counter.

## 4.16 Refund / Replace flow (from Order Detail or POS)
- Stepper: 1 Find sale ([ScanInput receipt/challan] or order search) → 2 Select items [checkbox rows + qty] → 3 Reason [ddl mandatory] → 4 Resolution 4 tiles (Refund · Replace same · Exchange → product picker + difference auto · Store credit) → 5 Inspection per returned item [seg: Sellable | Damaged] → confirm. Approval-needed cases show ApprovalBanner and pause at submit.

## 4.17 Deliveries & COD Reconciliation
- Board: sections per courier (collapsible) · order [cards]: order_no · customer+phone · tracking (tap=track) · days-in-transit badge (amber ≥5) · [btn Delivered] [btn Returned]. Top [btn "Scan handover"] → continuous scan mode counter ("14 scanned").
- COD Reconciliation (owner): per courier card "Holding: 12,400 from 9 parcels · oldest 18d ⚠" → detail: delivered-unpaid order rows [checkbox] · [btn "Record payment"] sheet: amount/date/reference → auto-match suggestion pre-ticks rows summing to amount → confirm.

## 4.18 Reports Hub & Viewer (owner-only)
- Hub: grouped tiles (Sales · Profit · Inventory · Demand · Marketing · Courier · Baki · Refunds · Customers) + Daily pack card (today's digest preview) + Targets card.
- Viewer pattern: [chips date presets + custom range] · headline stat row · one chart (bar/line) · breakdown [table/cards sortable] · [btn "Export Excel"] · drill-down on every row.

## 4.19 Customers
- [search phone/name] · [chips: Repeat · Rejecters ⚠ · Has baki · Has credit]. Profile: stats row (orders/returns/baki/credit) · flags banners · order history · ledger shortcut.

## 4.20 Settings
- Grouped list: Business & switcher · Staff (list + role + business assignment + salary owner-only) · **Category Builder** (category list → field rows: name · [ddl type] · options editor · [toggle Variant] · [toggle Per-lot] · drag-sort) · Couriers (cards + charges) · Delivery men · Expense categories · Pricing (target margin% [input], planned rates table with history) · Policies (return days, refund threshold, credit default, park expiry) · **Partners** (Module 15, owner-only → §4.23) · Data (Excel import wizard: upload → column-map [ddl per column] → validation report → import; Export buttons) · Backup status.

## 4.21 Notifications
- [chips by type group] · rows with icon + title + body + time, unread dot; tap deep-links to entity. Owner approval items show inline Approve/Reject.

## 4.22 Activity Log (owner)
- [chips user] [chips entity] [date] · rows: who · did what · when → tap = before/after diff view.

## 4.23 Settings → Partners (owner-only, Module 15)
- **List** (reached from Settings): two sections **Managing Partners** / **Sleeping Partners**, each a [cards] list — name · phone · capital balance (৳, paisa÷100) · deferred-loss badge if >0 · status chip (PENDING APPROVAL — amber / ACTIVE — green / REJECTED — red / EXITED — grey, R15.11). [fab] "+ New Partner".
- **New Partner:** [input name] · [input phone] · [seg MANAGING/SLEEPING] · [input join date] · [input NID number] (required) · [input address] (required) · [input email] · [input bank account number] · [input bank name] · [input agreed profit share %] · [input emergency contact name] · [input emergency contact phone] · [input emergency contact relation] · [input note] · [btn Save]. Type field locks (greyed, "cannot change after first capital entry") once any ledger row exists — shown on edit, not on create. Saved partner starts `PENDING_APPROVAL` (unless bootstrap — see below) and a banner explains: "Waiting for managing partner approval."
- **Partner Detail:** header card (name, type chip, status) → **Approval panel** (only shown while `PENDING_APPROVAL`): progress text "X of Y managing partners approved (need Z)"; per-managing-partner row with Approve/Reject buttons (Owner casts these on each managing partner's behalf — no partner portal yet, R15.11) and a required reason field for Reject; [btn "Cancel request"] (Owner escape hatch, mandatory reason) → **Balance row:** Capital balance · Profit balance (15b+, shows ৳0.00 for now) · Deferred loss (red badge if >0) → [btn "+ Add Capital Injection"] (owner only; disabled/hidden unless status = ACTIVE) → **Ledger timeline [cards]**, newest first: date · entry type chip · signed amount (green +/red −) · balance-after · note; read-only, no edit/delete affordance anywhere (matches R15.3 immutability).
- **Add Capital Injection [sheet]:** [input amount ৳] (entered in taka, converted to paisa server-side) · [input lock-in months] · [input note] · [btn Confirm] → posts, sheet closes, ledger timeline refreshes with the new row at top.
- 15b+ adds: Distributions tab (run/vote/post), Withdrawals tab, Corrections, Exit flow — not built in 15a.

# 5. SPEED PATTERNS (cross-cutting — implement everywhere)
- Autofocus the most likely field on every screen open (POS scan, order phone after products).
- Defaults: today's date, last-used courier, last-used payment method, business default unit.
- Inline-create from any [ddl] ("+ Add new…" as last option) — never force a settings detour mid-task.
- Numeric inputs open numeric keypad (inputmode=decimal).
- Recently-used products float to top of all product searches.
- Every list remembers its filter state per session.

# 6. STATES
- Loading: skeleton cards (no spinners on lists). Errors: persistent toast with Retry. Empty: per Principle 10. Offline (non-POS screens): banner "Offline — viewing cached data" with disabled mutating buttons EXCEPT draft-saving.
