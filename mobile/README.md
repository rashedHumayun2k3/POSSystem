# LavLokshan mobile

React Native / Expo Router app. Android login uses the existing .NET authentication API. Tokens are stored with Expo SecureStore. After login, select a business and assigned branch. Orders load from `/api/v1/orders/management` with bearer authentication, business/branch headers, server search, filters, counts and pagination. Pull down to refresh. Expired access tokens are refreshed automatically; sign out is in the header.

## Run the standalone USB APK

1. Start the server from the repository root:

```powershell
dotnet run --project backend/src/ResellerApi --launch-profile http
```

2. Connect the Android phone, enable USB debugging, authorize the computer, and run:

```powershell
./mobile/scripts/connect-usb.ps1
adb install -r mobile/dist/LavLokshan-usb.apk
```

3. Open LavLokshan and sign in with your existing account. Keep the computer and backend running, and keep the USB cable connected. Re-run the connection script after reconnecting/restarting the phone.

The APK contains its JavaScript bundle and does not need Expo Go or Metro. Its backend URL is `http://127.0.0.1:5018/api/v1`; `adb reverse` forwards that phone port to the computer. The health endpoint is `/api/v1/health`. Database access stays on the .NET server.

## Build

```powershell
./mobile/scripts/build-apk.ps1
```

This generates the Android project and builds an ARM64 APK for the connected Samsung phone. Output: `mobile/dist/LavLokshan-usb.apk`. It is signed with the generated development key for local testing. This USB build permits HTTP for the local server. Store distribution requires production signing and an HTTPS backend configuration.

## Scope

The initial screen opens real orders. Order details are read-only list summaries. The existing new-order form and product picker remain UI prototypes; creating/editing/fulfilling orders is not connected in this build. The original dashboard component is preserved but not used as the launch screen because its numbers are sample data.

## Development and checks

```powershell
cd mobile
npm run typecheck
npx expo start --web --port 8084
```

Browser sessions are memory-only; Android sessions persist in secure storage. For web development the backend CORS policy must allow the chosen local web origin. The layout remains capped at 768 logical pixels.
