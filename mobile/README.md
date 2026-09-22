# LavLokshan mobile

React Native / Expo app with Expo Router. The mobile app is separate from the Next.js `frontend` application.

```powershell
cd E:\LavLokshan\mobile
npm install
npm run web -- --port 8082
```

For Android, start an Android Studio emulator and run `npm run android`.

## Screens

- `/`: existing dashboard preview.
- `/orders`: order list based on the frontend OrderManagement screen. Includes status queues, search, customer/product/channel/date filters, compact and detailed cards, date grouping, stock warnings, pagination, and order preview dialogs.

The app stays centered at a maximum width of 768 logical pixels. Home and Orders use real routes; the remaining navigation items are reserved for future screens.

## Data

Orders currently use clearly labeled fictional data from `src/orders/sampleOrders.ts`. There is no mobile login or live API connection yet. Search and filters operate on the sample dataset. Order previews are read-only; creation, editing, fulfillment, and contacting real customers are not implemented.

The list model and queue rules mirror `frontend/src/components/orders/OrderManagement.tsx`. A live integration should use the existing `/orders/management` API and authenticated business/branch context, rather than reuse the frontend page route or embed credentials in the mobile app.

## Validation

```powershell
npm run typecheck
npx expo export --platform web
npx expo export --platform android
```
