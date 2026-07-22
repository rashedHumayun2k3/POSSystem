"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useBranchSelection } from "@/hooks/useBranchSelection";
import { useConnectivityStore } from "@/store/connectivityStore";
import { BellIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { useLanguage, type Lang } from "@/i18n/LanguageContext";
import Avatar from "@/components/ui/Avatar";
import { listOrders } from "@/lib/ordersApi";

interface Props {
  title: string;
  backHref?: string;
  // Rendered before the standard language/notifications/avatar icons — NOT a replacement for
  // them, so every page keeps those regardless of what page-specific actions it adds (e.g. the
  // order detail page's Delete button).
  extraActions?: React.ReactNode;
}

export default function AppHeader({ title, backHref, extraActions }: Props) {
  const { user, businesses, currentBusinessId, switchBusiness, isOwner, canSeeCosts, branches, currentBranchId, switchBranch, clearBranch } = useAuthStore();
  const { lang, setLang } = useLanguage();
  const resolveBranch = useBranchSelection();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  // Same query (and cache key) as the Notifications list page — the bell badge reflects real
  // pending-order data instead of a live-push counter, so it's correct even if the SignalR
  // connection never connects/negotiates (it degrades to this page's own 15s poll instead of
  // going blank). useLiveNotifications invalidates this key on a live "OrderCreated" push for
  // an instant bump while the socket is up.
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["notifications-online-orders", currentBranchId],
    queryFn: () => listOrders({ channel: "WEBSITE", fulfillmentStatus: "UNFULFILLED" }),
    staleTime: 15_000,
  });
  const unreadCount = pendingOrders.length;

  const toggleLang = () => setLang(lang === "bn" ? "en" : ("bn" as Lang));

  const handleBusinessSwitch = async (id: string) => {
    switchBusiness(id);
    await resolveBranch();
  };

  const handleBranchChange = (value: string) => {
    if (value === "") clearBranch();
    else switchBranch(value);
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b px-4 h-14 flex items-center gap-3 transition-colors ${
        isOnline ? "bg-white border-gray-200" : "bg-red-50 border-red-200"
      }`}
    >
      {backHref ? (
        <Link href={backHref} className="text-indigo-600 mr-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      ) : null}

      {/* Business switcher — owner only */}
      {isOwner() && businesses.length > 1 ? (
        <select
          value={currentBusinessId ?? ""}
          onChange={(e) => handleBusinessSwitch(e.target.value)}
          className="text-sm font-semibold text-gray-900 border-none outline-none bg-transparent"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      ) : (
        <Link href="/dashboard" className="flex items-center flex-1">
          <Image src="/logo.png" alt="LavLokshan" width={152} height={152} className="rounded-md object-contain" />
        </Link>
      )}

      {/* Branch switcher — everyone, on every page (including ones with a back button);
          OWNER/MANAGER get an "All Branches" option, others only see it once they have more
          than one assigned branch. */}
      {(canSeeCosts() ? branches.length > 0 : branches.length > 1) ? (
        <select
          value={currentBranchId ?? ""}
          onChange={(e) => handleBranchChange(e.target.value)}
          className="text-xs font-medium text-indigo-600 border-none outline-none bg-indigo-50 rounded-lg px-2 py-1 max-w-[110px]"
        >
          {canSeeCosts() && <option value="">All Branches</option>}
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {extraActions}
        <button
          onClick={toggleLang}
          className="text-xs font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 leading-none"
          title="Switch language"
        >
          {lang === "bn" ? "EN" : "বাং"}
        </button>
        <Link href="/notifications" className="relative text-gray-500">
          <BellIcon className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <Link href="/profile">
          <Avatar name={user?.name ?? "?"} photoUrl={user?.photoUrl} size={28} />
        </Link>
      </div>
    </header>
  );
}
