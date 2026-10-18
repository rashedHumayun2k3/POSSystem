# Codex Implementation Brief — Production-Grade Bangla POS Voice Assistant

> **Instruction to Codex:** You are working in an existing, production-oriented multi-tenant POS application with a .NET backend and React Native client. Implement a reliable, polished, **zero-paid-AI-API** Bangla business voice briefing feature. **First inspect the repository** and adapt to its real architecture. Do not invent entities, database fields, business rules, or UI conventions. This document specifies requirements, behavior, and acceptance criteria—not implementation code.

## 1. Product objective

When a business owner taps a voice-assistant icon, the app should greet them naturally in Bangla, prepare a concise and actionable briefing from authorized POS data, and speak it aloud. It should feel like a competent, respectful personal business assistant—not a robotic list of numbers. Support thousands of businesses, with strict tenant isolation, accurate financial figures, robust error handling, and accessibility.

**Hard constraint:** No paid AI, cloud LLM, or paid text-to-speech API. Prefer on-device text-to-speech (TTS) using existing OS capabilities and a deterministic, server-generated Bangla narrative. Do not promise universally human-like Bangla speech: available voice quality depends on device, operating system, installed language data, and TTS engine. Build capability detection, quality testing, graceful fallbacks, and transparent user messaging. Do not silently download a paid voice service or send financial data to a third-party TTS provider.

## 2. Repository discovery and delivery discipline

Before editing code:

1. Map the actual .NET solution structure, API conventions, authorization, tenant context, time zone handling, service boundaries, data models, sales/order/payment/returns/stock/expense/task modules, tests, and React Native navigation/state/audio dependencies.
2. Identify which facts can be reliably computed and which are not available. Distinguish sales revenue from order totals, payments collected, net sales, profit, and expenses. Never equate them without domain confirmation.
3. Check existing localization, feature flags, logging, observability, caching, mobile lifecycle, and API contracts. Reuse existing patterns and libraries when appropriate.
4. Present a concise implementation plan, impacted files, data dependencies, assumptions, and any blocking questions **before** broad modifications. Do not rewrite unrelated modules.
5. Implement incrementally with tests and document what was actually verified. Do not claim device speech quality without testing on physical Android/iOS devices.

## 3. End-to-end interaction

1. User taps the assistant icon (one tap; prevent accidental duplicate sessions).
2. Immediately provide visible and accessible feedback. Determine local greeting based on the business's configured IANA time zone and local time, not the server's UTC clock. If an appropriate Bangla TTS voice is available, begin a short welcome while the API request starts concurrently.
3. Example welcome: **“আসসালামু আলাইকুম স্যার, শুভ সকাল। আপনার ব্যবসার গুরুত্বপূর্ণ আপডেটগুলো তৈরি করছি, একটু সময় দিন।”** The salutation must be configurable; do not assume all owners want a religious greeting or “স্যার/বস.” Default to a neutral professional greeting unless configured otherwise.
4. Fetch a tenant-authorized briefing payload from .NET. The server performs all aggregation, comparisons, prioritization, and final narrative composition.
5. If the briefing arrives while the greeting is playing, queue it; never overlap utterances. If the request is fast, skip unnecessary “ready” chatter. If it takes noticeably longer, say a single concise progress phrase, not repeated promises.
6. Optionally transition with **“আপনার রিপোর্ট তৈরি। এখন গুরুত্বপূর্ণ বিষয়গুলো জানাচ্ছি।”** only when it improves pacing.
7. Speak the briefing in short, meaningful segments with pause/resume/stop, visible text transcript, and clear progress. Handle app backgrounding, phone calls/audio focus, route changes, interruptions, and unmount safely.
8. Finish with 1–3 actionable next steps grounded in actual POS facts. Avoid repetitive closings or forced positivity.
9. On failure, explain the problem in Bangla, show the text summary when possible, and offer retry. Never fabricate a report.

## 4. Time-aware reporting (business local time)

The reporting window and the spoken greeting are separate decisions. Make boundaries configurable per business; initial suggested defaults:

| Local time | Greeting | Report intent |
|---|---|---|
| 05:00–11:59 | শুভ সকাল | Yesterday's **completed business day**, plus today's urgent outstanding items |
| 12:00–17:59 | শুভ দুপুর / শুভ বিকেল, as appropriate | Today's **so-far** performance vs yesterday at the **same elapsed time**, plus current priorities |
| 18:00–21:59 | শুভ সন্ধ্যা | Today's **so-far** performance, or completed-day report only if the business day is closed |
| 22:00–04:59 | শুভ রাত্রি | Most recent business day; if still open, explicitly say **“এখন পর্যন্ত”**; if after midnight, resolve the configured business-day boundary correctly |

Do not treat midnight as closing time by default. Some businesses operate overnight. Respect business-day cutoff, shop hours, shifts, holidays, and manually closed shifts if these concepts exist. Determine reporting date and weekday accurately in `bn-BD` locale, using Bangla-friendly wording. Never assume Friday is a particular date without computing it.

**Comparison correctness:** Compare completed days against completed days, or partial days against the same elapsed interval where historical timestamped data supports it. If an apples-to-apples comparison is unavailable, omit the percentage and state only reliable values. Avoid double-counting orders, deliveries, and payments across reporting periods.

## 5. What the briefing should contain

Prioritize the information an owner can act on; do not read every notification.

- **Sales:** correctly defined net/gross sales, currency in BDT, meaningful change vs comparable period, optionally target attainment when targets exist.
- **Orders and fulfillment:** created orders, delivered orders, currently pending delivery, overdue fulfillment, cancellations/returns if meaningful. Clearly label whether pending items are from today's orders or all outstanding orders.
- **Best-selling product:** by a clearly defined metric (quantity or net revenue); include only when enough data exists. Avoid exposing long SKU strings in speech.
- **Inventory:** number of products below their configured reorder threshold; highlight critical, fast-moving items. Distinguish preorders from low stock and avoid implying they are the same category.
- **Tasks:** overdue or high-priority unfinished tasks assigned to the owner/team where authorized.
- **Expenses:** month-to-date total and unusual changes only when supported; never describe expenses as profit or loss. State whether refunds, tax, shipping, discounts, and cost of goods are included where relevant.
- **Other signals only if supported:** unpaid invoices, receivables, unusual returns, cash mismatch, upcoming supplier receipts, high-risk order backlog, near-expiry stock, and store-specific KPIs.

Missing/zero data must be handled distinctly. Zero sales is not “data unavailable.” For businesses without a task or expense module, omit those categories rather than guessing.

## 6. Priority and brevity engine

Use deterministic, explainable scoring/rules rather than an LLM. Recommended ordering:

1. Critical operational risks (overdue deliveries, stockouts of best sellers, high-priority overdue tasks, verified payment/cash exceptions).
2. Sales and order headline, with one meaningful comparison.
3. Fulfillment and stock exceptions.
4. Tasks, expenses, and secondary insights only when relevant.
5. At most 1–3 grounded actions.

Create **Quick** (~20–40 seconds), **Standard** (~60–90 seconds), and **Detailed** (~2–3 minutes) modes. These are target ranges, not guarantees; duration varies by device voice/rate. Standard should be the default. Enforce content/segment limits; deduplicate overlapping alerts. A business with 200 low-stock SKUs should hear the count and the most urgent few, not 200 names. A quiet business should get a short briefing, not padded narration.

## 7. Natural Bangla narration without an AI model

Build a reusable Bangla narrative composer in .NET with tested, human-written template families and rule-based selection. Requirements:

- Conversational, professional **Bangladeshi Bangla**; avoid formal bureaucratic language and excessive English mixing.
- Vary openings, transitions, positive/negative trend phrasing, and closings **without altering factual meaning**. Use deterministic variation by business/date/session or stable seeded selection so retries are consistent and auditable.
- Speak complete ideas, not raw key/value pairs. Combine related facts, e.g., sales trend then order fulfillment; add natural pauses between sections.
- Convert amounts, counts, percentages, dates, and product names into TTS-friendly speech. Prefer **“দশ হাজার টাকা”** over digit-by-digit reading; handle large amounts, decimal taka/paisa, negatives/refunds, and Bangladeshi lakh/crore conventions. Verify pronunciation on supported devices.
- Use safe, grammatically natural comparisons: **“গতকালের তুলনায় বিক্রি প্রায় এগারো শতাংশ বেড়েছে।”** Compute percentages server-side with defined rounding; avoid division by zero.
- For a negative result, be measured and useful, not alarmist or shaming. Avoid unsupported causes, predictions, or exaggerated praise.
- Avoid invented details. If a product name or customer label is unpronounceable, apply a tested fallback, not a made-up name.
- Support owner preferences for address (“স্যার”, “ম্যাডাম”, “বস”, name, or neutral), optional religious greeting, speaking rate, verbosity, and language.
- Include a readable transcript that matches the spoken content; do not send secrets or unnecessary customer PII to speech.

### Sample morning narration (illustrative data only)

“শুভ সকাল, স্যার। গতকালের ব্যবসার সংক্ষিপ্ত আপডেট দিচ্ছি। গতকাল মোট বিক্রি হয়েছে দশ হাজার টাকা, আগের দিনের তুলনায় প্রায় এগারো শতাংশ বেশি। সবচেয়ে বেশি বিক্রি হয়েছে প্রোডাক্ট ওয়ান। গতকাল দশটি অর্ডার এসেছে; তার মধ্যে আটটি ডেলিভারি সম্পন্ন হয়েছে, আর ওই অর্ডারগুলোর দুটি এখনো বাকি। বর্তমানে দশটি পণ্যের স্টক নির্ধারিত সীমার নিচে। তিনটি কাজও অসম্পূর্ণ রয়েছে। এই মাসে এখন পর্যন্ত খরচ হয়েছে বিশ হাজার টাকা। আজ প্রথমে বাকি ডেলিভারিগুলো এবং জরুরি স্টকগুলো দেখে নিন।”

### Sample evening narration (illustrative data only)

“শুভ সন্ধ্যা, স্যার। আজ এখন পর্যন্ত আপনার বিক্রি হয়েছে দশ হাজার টাকা। গতকালের একই সময়ের নির্ভরযোগ্য তথ্য থাকলে সেটার সঙ্গে তুলনা জানাব; না থাকলে শুধু আজকের বিক্রির হিসাব বলব। আজ দশটি অর্ডার এসেছে, আটটি ডেলিভারি হয়েছে, আর আজকের অর্ডারগুলোর দুটি এখনো বাকি। দশটি পণ্যের স্টক কম আছে। আগামীকাল শুরু করার আগে জরুরি স্টক এবং বাকি ডেলিভারিগুলো দেখে নেওয়া ভালো হবে।”

These examples are not hard-coded reports. Every number, comparison, and recommendation must derive from validated data.

## 8. Backend architecture (.NET)

Implement using the repository's existing architectural conventions:

- Authenticated, tenant-scoped briefing endpoint/service. Derive tenant/store access from trusted identity/authorization, not a client-supplied tenant ID alone. Enforce store-level permissions and row-level isolation.
- Dedicated aggregation layer that uses efficient, bounded, indexed queries and avoids N+1 reads; aggregate in the database where feasible. Consider per-store snapshot/caching for scale and use cache keys scoped by tenant, store, reporting window, role, language, and relevant data version.
- A normalized report DTO with report period, `asOf` timestamp, completeness/closing status, KPI definitions, comparison periods, alerts, recommended actions, and generated speech segments/transcript. Version the contract.
- Narrative composer consumes **validated, computed facts**, not raw database records. Keep templates localizable and independently testable.
- Clear data freshness rules and invalidation after sales, delivery, inventory, task, and expense updates. Do not cache an obsolete urgent warning indefinitely.
- Idempotent requests, cancellation support, timeouts, safe retries, structured logging, traces, and latency metrics. No raw financial figures, customer PII, or full speech scripts in default production logs.
- Gracefully degrade if optional modules are absent or unavailable. Do not block the whole briefing on a nonessential metric.
- If multiple branches/stores exist, clearly state whether the report is for one store or an authorized consolidated view; never mix them accidentally.

## 9. React Native TTS and audio orchestration

Use a maintained, compatible native TTS integration selected after checking current React Native version and platform support. Requirements:

- Discover installed voices and whether a suitable Bangla/Bangladesh locale voice is actually available. Test `bn-BD` first and evaluate other Bangla voices only when pronunciation is acceptable.
- On-device TTS generally has no per-call API fee, but **Bangla voice availability, offline capability, and naturalness are not guaranteed**. Verify offline behavior. Do not imply the React Native library itself supplies a high-quality voice.
- If no acceptable Bangla voice exists, show a clear setup/help path or transcript-only fallback. Do not silently use an English voice to read Bangla or call an external paid TTS API.
- Queue greeting, optional progress phrase, and briefing segments without overlap. Model playback states: `idle`, `greeting`, `loading`, `ready`, `speaking`, `paused`, `completed`, `cancelled`, `error`.
- Controls: play/replay, pause/resume where supported, stop, mode selection, and text transcript. Disable conflicting actions; cancel in-flight requests and queued speech on stop/navigation as appropriate.
- Handle TTS initialization errors, missing language packs, audio focus/interruption, Bluetooth/headphones, app background/foreground, Android/iOS differences, and platform-specific limitations. Don't assume pause/resume works identically on both systems.
- Accessibility labels, readable contrast, screen-reader support, reduced motion, and visual progress without relying on audio alone.
- Keep greetings responsive: start API fetching concurrently with the opening speech. Avoid speaking “please wait” if the report is already ready. Never repeat a loading phrase in a loop.

## 10. Zero-cost policy and scale

No generative model is required for the MVP. Do not add OpenAI, Gemini, Azure Speech, Google Cloud TTS, ElevenLabs, or another paid API. No vendor account, payment card, or external inference endpoint should be required to run this feature.

**Clarification:** “No paid AI/TTS API” does **not** mean zero infrastructure cost: existing .NET servers, databases, network traffic, maintenance, and optional voice-pack downloads still have resource costs. Optimize backend query latency and caching for thousands of tenant businesses. Avoid self-hosting a large model or server-side neural TTS unless explicitly approved after hardware, operations, licensing, and voice-quality evaluation.

## 11. Security, privacy, and trust

- Enforce authentication, RBAC, and strict tenant/store isolation for every aggregation and cache entry.
- Do not reveal financial details on a locked device or through unexpected autoplay; voice playback must be user-initiated.
- Respect account preferences and permissions; do not narrate sensitive customer names, phone numbers, addresses, or payment credentials.
- Audit access to financial briefing endpoints according to existing policy, without recording unnecessary private transcript data.
- Use secure transport and existing application secrets/configuration practices.
- Label stale or incomplete reports and distinguish actual values from recommendations.

## 12. Testing and production acceptance

Cover automated tests for:

- Morning, afternoon, evening, night, midnight crossover, DST/time-zone boundaries, and overnight business-day cutoff.
- Correct Bangla weekday/date and greeting; customizable owner address.
- Zero sales, no orders, negative net sales, refunds, cancelled orders, missing metrics, divide-by-zero comparisons, partial-day vs completed-day comparisons.
- Pending deliveries from today vs prior dates, preorder vs low-stock separation, expense vs profit distinction.
- 1, 10, 100, and 10,000+ relevant records; long product names; alert prioritization, deduplication, and duration modes.
- Cross-tenant/store isolation, role permissions, cache invalidation, simultaneous requests, cancellation, and partial dependency failure.
- Device integration tests: Android and iOS if supported; physical-device Bangla pronunciation, voice availability, offline operation, audio interruptions, backgrounding, and screen readers.

**Acceptance criteria:**

1. One tap starts an appropriate greeting quickly and requests the correct authorized report concurrently.
2. Every spoken numeric fact matches the backend's validated report and clearly identifies its reporting period.
3. Morning reports focus on the previous completed business day; daytime reports use today-so-far; night reports never call an open day final.
4. Briefings are concise, natural, actionable, and do not read dozens of raw notifications.
5. No paid AI/TTS API is required; unavailable Bangla TTS is handled honestly with a transcript fallback.
6. No cross-tenant data leakage; performance and failure behavior are observable and production-ready.
7. Existing POS flows remain unaffected; automated tests and device QA evidence are documented.

## 13. Requested Codex deliverables

1. Repository architecture assessment and concise implementation plan.
2. Production-ready .NET aggregation, reporting, prioritization, and Bangla narrative functionality following current conventions.
3. React Native assistant entry point, playback state management, native TTS integration, settings, transcript, and failure states.
4. Tests for business rules, authorization, time boundaries, and speech orchestration.
5. Documentation: feature configuration, supported voice locales, known platform limitations, deployment/migration needs, monitoring, and QA checklist.
6. Final change summary listing files changed, commands/tests executed, actual results, and unresolved limitations.

**Execution instruction:** First inspect the actual codebase, identify gaps, and present the plan. Then implement in coherent, reviewable increments. Ask only for genuinely blocking business decisions. Prioritize correctness, privacy, reliability, and natural Bangla delivery over adding superficial AI branding.
