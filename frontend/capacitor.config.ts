import type { CapacitorConfig } from '@capacitor/cli';

// Points the app's WebView at the real hosted deployment rather than bundling a static export —
// this app's dynamic routes (/products/[id], /orders/[id], ...) read live data from a growing
// database, which static export can't pre-render. Real HTTPS here (confirmed: shop.lavlokshan.com
// serves over TLS, http:// redirects to it) also means the service worker registers properly
// inside the WebView — it won't register at all over plain http (browsers/WebViews require a
// secure context for service workers, localhost being the one exception), so this is what makes
// the offline-POS/PWA layer actually work inside the packaged app, not just in a desktop browser.
const config: CapacitorConfig = {
  appId: 'com.lavlokshan.app',
  appName: 'LavLokshan',
  webDir: 'public', // unused while server.url is set, but required by the config type
  server: {
    url: 'https://shop.lavlokshan.com',
  },
};

export default config;
