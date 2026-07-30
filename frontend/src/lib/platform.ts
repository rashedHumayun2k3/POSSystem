import { Capacitor } from '@capacitor/core';

// True only inside the actual Capacitor-wrapped Android (or iOS) app — false in every browser
// context, including one that has "installed" the PWA to its home screen. This is the switch
// between the two local-storage backends: native SQLite (full catalog cache + offline queue) vs.
// the existing Dexie/IndexedDB queue-only approach that already works in a plain browser tab.
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
