# New-order notifications

## What is implemented

- New `CLIENTPAGE` and `EXTERNAL_WEBSITE` orders write an outbox event in the
  same database save as the order. Existing orders are not backfilled. Retrying
  an idempotent checkout does not create another event. Manual/POS sales do not alert.
- Hangfire's `order-notifications` job runs every minute, creates per-user unread
  history and queues device deliveries. Expect up to about one minute before
  sending, plus provider/network delay. Hangfire must be running on the API host.
- Owners/managers/partners can receive alerts across their business. Staff and
  warehouse users must be assigned to the order's branch. Each device subscribes
  to its last successfully registered business/branch; all-branches mode covers
  the whole business for management roles. Permissions are checked again before
  delivery and on opening history.
- Push tokens are tied to the login's refresh token. Token rotation preserves the
  subscription; server-side logout/expiry revokes it. Offline logout cannot revoke
  a server subscription until the logout request reaches the server; already
  delivered OS notifications cannot be recalled. The app suppresses foreground
  alerts for a different account/scope and clears displayed alerts on logout.
- English/Bangla push text follows the device's last registered app language.
- Transient errors retry up to six send attempts. Expo receipts are checked after
  15 minutes; invalid devices are disabled. `DELIVERED` means the downstream
  provider accepted the push, not proof that the person saw it. A crash between
  sending and saving the ticket can cause a duplicate push (at-least-once delivery).
- The bell combines order/task unread counts; the notification screen has separate
  Orders and Tasks tabs. Tasks retain their existing permission model.
- Tapping an order alert validates the payload, selects an authorized business and
  branch, marks the notification read and opens the server-returned order ID.

## Backend rollout

1. Apply `AddOrderNotifications.sql` to the intended database **before deploying
   this backend**. It is an idempotent script for migration
   `20261030053909_AddOrderNotifications`; earlier migrations must already be applied.
   Alternatively use the normal EF migration deployment process. No database was
   modified while implementing this feature.
2. Deploy the backend and ensure Hangfire is running. History is generated even
   while push delivery is disabled.
3. Configure the API host environment:

   ```text
   PushNotifications__Enabled=true
   PushNotifications__AccessToken=<Expo access token, if enhanced push security is enabled>
   ```

   Push delivery defaults to disabled. Enable Expo enhanced push security for the
   production project and configure its access token in server secrets, not source
   control or an `EXPO_PUBLIC_` variable. Allow HTTPS egress to `exp.host`.
4. Check Hangfire job failures and `order_push_deliveries.State/LastError` for
   operational failures. Correct FCM credentials before retrying `FAILED` deliveries.
   Pending deliveries expire after 24 hours; history remains available.

## Android / Expo setup (requires project credentials)

1. Create/link the Expo/EAS project and obtain its UUID. Configure Firebase Android
   app package **com.lavlokshan.mobile** and download `google-services.json` to
   `mobile/google-services.json` (ignored by Git).
2. Upload the Firebase **FCM v1 service-account credential** to the matching Expo
   project using EAS credentials or the Expo dashboard. This private service-account
   JSON is different from the client `google-services.json`; never bundle it in the
   APK. Local Gradle builds can use Expo Push Service, but still need this setup.
3. Set `EAS_PROJECT_ID` during both prebuild and bundling. `mobile/app.config.js`
   reads it and the optional `GOOGLE_SERVICES_JSON` file path. Without a project ID,
   the app reports that push is unconfigured and still provides notification history.
4. Build with production endpoints, including **prebuild** for the new native plugin:

   ```powershell
   Set-Location E:\LavLokshan\mobile
   $env:EAS_PROJECT_ID = '<your Expo project UUID>'
   $env:GOOGLE_SERVICES_JSON = 'E:\LavLokshan\mobile\google-services.json'
   $env:NODE_ENV = 'production'
   $env:EXPO_NO_DOTENV = '1'
   $env:EXPO_PUBLIC_API_URL = 'https://api.lavlokshan.com/api/v1'
   $env:EXPO_PUBLIC_HUB_URL = 'https://api.lavlokshan.com/hubs/live'
   $env:EXPO_PUBLIC_MEDIA_URL = 'https://fileserverapi.lavlokshan.com'
   npx expo prebuild --platform android --no-install
   if ($LASTEXITCODE -ne 0) { throw 'Prebuild failed.' }
   Set-Location android
   .\gradlew.bat :app:assembleRelease --rerun-tasks --no-build-cache --no-daemon --console=plain
   if ($LASTEXITCODE -ne 0) { throw 'APK build failed.' }
   ```

   Configure `JAVA_HOME`/Android SDK as for previous builds. APK output remains
   `mobile/android/app/build/outputs/apk/release/app-release.apk`. The existing
   `build-apk.ps1` pins localhost and should not be used for production endpoints.
   Existing Android release signing settings are unchanged.
5. Install on a physical Android device, sign in, select a business/branch, and allow
   notifications. On the bell screen verify registration succeeded. Test a new
   website order while foregrounded, backgrounded, and after normally closing the
   app; then tap it and verify the correct order and unread count. Android force-stop
   may prevent delivery until the app is opened again.

## Validation

- Backend notification tests: `OrderNotificationTests.cs` covers fanout, access,
  token ownership, localization, retries, receipts, logout/revocation, and manual orders.
- Mobile payload tests: `node --test mobile/scripts/order-notification.test.mjs`.
- Physical-device delivery requires the Firebase/Expo credentials above and a
  deployed database/backend; local tests use a fake HTTP transport and send no pushes.

Official setup: https://docs.expo.dev/push-notifications/push-notifications-setup/

FCM credentials: https://docs.expo.dev/push-notifications/fcm-credentials/

Delivery/receipts: https://docs.expo.dev/push-notifications/sending-notifications/
