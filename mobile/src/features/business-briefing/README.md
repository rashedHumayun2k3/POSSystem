# Bangla business briefing

The header uses this feature instead of the previous fixed-answer chat demo. No microphone input. Access is OWNER/MANAGER, matching financial reports.

## Architecture

- `components/BriefingButton.tsx`: panel, transcript, modes, voice preview, rate and controls.
- `hooks/useBriefing.ts`: authenticated requests, greeting/report sequencing, cancellation on navigation, scope change, background and unmount.
- `services/playback.ts`: segmented on-device Expo speech; no server-generated audio or external speech endpoint.
- Backend: `backend/src/ResellerApi/Features/BusinessBriefing`, registered in `Program.cs`.
- `GET /api/v1/business-briefing?mode=quick|standard|detailed` and `GET /api/v1/business-briefing/preferences`.
- Existing Authorization, X-Business-Id and optional X-Branch-Id headers/middleware validate scope. No tenant query parameter. Missing branch means the authorized all-branches view.

## Business preferences

Use existing owner-only `PUT /api/v1/settings` with key `business-briefing` and `value` containing this JSON serialized as a string:

```json
{"timeZone":"Asia/Dhaka","businessDayCutoffHour":0,"address":"","religiousGreeting":false,"defaultMode":"standard","speakingRate":0.9}
```

Timezone must be recognized by the server. Cutoff accepts 0–11. Speaking rate accepts 0.65–1.2. Neutral address/greeting is default; religious greeting is opt-in. No database migration is needed. Voice selection and playback speed adjustments in the panel last for the mounted session. Configure durable default rate through business settings. No voice gender guarantee: device metadata does not consistently expose gender. Installed bn-BD voices are preferred, then named female hints; users can preview/select other Bengali voices.

## Metric definitions and limits

- Revenue matches home-dashboard BusinessDate semantics and shared OrderFinancials rounding: active item quantities × price, minus order discount, plus customer delivery charge; drafts/cancellations excluded. Returns/refunds are NOT deducted. Never presented as net sales, profit or cash collected.
- Morning (05:00–11:59 business local time) selects the previous business date; other hours select the current business date using the configured cutoff. BusinessDate remains authoritative; the feature does not rewrite historical order dates.
- No reliable day/shift closure state exists. `periodEnded` means an elapsed date window, not verified closing. The UI discloses this. Historical figures can change with backdated entries.
- Only elapsed full-date windows get a previous-date comparison; zero baseline and partial-day comparisons are omitted.
- Delivered count is current delivery status of orders from the report date; backlog covers all noncancelled, nondraft unfulfilled/packed/in-transit orders.
- Stock counts active product variants, excluding committed/damaged units. Low stock excludes stockouts; preorders are separate and not inferred from stock.
- Best seller is by ordered quantity, not net revenue. Long/control-character names are omitted from speech.
- Tasks count only overdue active tasks assigned to the caller across this business, not other users' tasks. Expenses are approved month-to-date records in the selected branch scope. Unallocated business expenses are excluded in a branch view, as disclosed.
- BDT only; other currencies return an explanatory error.
- Fresh reads; no shared cache or stored transcript. Queries use existing filters and bounded order pages, and aggregate counts in the database. Multi-query results are not an atomic database snapshot. Load testing and SQL Server query-plan checks are required before large-scale rollout.
- No speculative alerts about payment risk, delivery overdue dates, targets, or shift closure.

## Voice/device limits

Bangla voice quality, offline support and gender vary by device. No paid speech/AI dependency. Android has stop/replay; pause/resume is shown on iOS/web. Browser autoplay policies may require another user tap: use Replay. No silent English-voice fallback. Missing voices retain the full transcript with setup guidance. Physical-device pronunciation, Bluetooth, calls, iOS silent mode, offline voice packs and screen-reader checks are required before release.

## Validation and deployment

Deploy backend before distributing the updated client. Rebuild native binaries to remove the old speech-recognition dependency/plugin. No production deployment has been performed.

Commands from mobile:

```text
npm run typecheck
node --experimental-strip-types src/features/business-briefing/tests/voice-choice.test.mjs
node src/features/business-briefing/tests/playback.test.mjs
```

Backend: `dotnet test backend/src/ResellerApi.Tests/ResellerApi.Tests.csproj --filter FullyQualifiedName~BusinessBriefingTests`.

Existing blockers: full mobile typecheck reports OrderDetailScreen/OrdersScreen errors. The standard backend test build reports InvoiceListTests using nonexistent BusinessId fields. For isolated briefing validation only, a temporary MSBuild targets file excludes that unrelated test file; no test source was changed. See the task completion report for actual results.

QA: verify two tenants and two branches; OWNER/MANAGER versus staff; morning/noon/midnight/cutoff; zero sales and zero baseline; refunds/cancellations; missing voice and denied audio playback; rapid taps; close/stop during request/greeting/report; branch switch during playback; device background/phone calls; all modes and transcript. Inspect endpoint duration/error rates via existing server request logging; do not log response bodies or financial scripts.

## Verification results

- 18 briefing backend tests passed with the temporary unrelated-test exclusion described above. Includes 1,001-order pagination fixture, tenant/branch isolation, endpoint role metadata, time boundaries/DST and narration arithmetic.
- Voice-choice and playback tests passed, including late callbacks and stop/start races.
- Final mobile typecheck reported errors only in the existing OrderDetailScreen.tsx and OrdersScreen.tsx files.
- git diff --check passed. Physical-device and live SQL Server integration/load testing have not been performed.
