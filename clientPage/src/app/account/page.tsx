"use client";

import TopHeader from "@/components/TopHeader";

const AccountIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.4-3.4 4.3-5.2 7.5-5.2s6.1 1.8 7.5 5.2" strokeLinecap="round" />
  </svg>
);

export default function AccountPage() {
  return (
    <main>
      <TopHeader />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <AccountIcon />
        <p className="text-sm font-medium text-gray-700">No account needed</p>
        <p className="text-xs text-gray-400 max-w-[240px]">
          Checkout as a guest — no sign-in required. Order tracking by phone number is coming soon.
        </p>
      </div>
    </main>
  );
}
