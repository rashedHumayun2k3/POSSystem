'use client';

import { useIsOnline, usePendingSalesCount } from '@/lib/posSync';

// Per the UI spec: "SyncPill prominent" at the top of the Sell screen — 🔴 offline, pending count
// once sales are queued. Deliberately visible even when online with 0 pending (a cashier needs to
// see "we're fine" just as much as "we're not"), not just a colored dot.
export default function SyncPill() {
  const online = useIsOnline();
  const pending = usePendingSalesCount();

  if (online && pending === 0) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 text-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Online
      </span>
    );
  }

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 text-amber-200 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Offline{pending > 0 ? ` · ${pending} pending` : ''}
      </span>
    );
  }

  // Online but still draining a queue from a recent offline stretch.
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-amber-200 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Syncing {pending} pending
    </span>
  );
}
