"use client";

import { useState } from "react";
import TopHeader from "@/components/TopHeader";
import { sellerLogin, getErrorMessage } from "@/lib/sellerAuthApi";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

const inputClass =
  "rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400";

export default function SellerLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedInName, setLoggedInName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    setError(null);
    setBusy(true);
    try {
      const result = await sellerLogin(phone.trim(), password);
      setLoggedInName(result.user.name);
    } catch (err) {
      setError(getErrorMessage(err, "Phone number or password is incorrect."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <TopHeader />
      <div className="lg:max-w-md lg:mx-auto px-4 lg:px-0 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Seller Login</h1>
        <p className="text-sm text-gray-500 mb-6">Log in to manage your shop and products.</p>

        {loggedInName ? (
          <div className="flex flex-col gap-3 items-start">
            <p className="text-sm text-gray-700">
              Welcome back, <span className="font-medium">{loggedInName}</span>.
            </p>
            <a
              href={`${FRONTEND_URL}/login`}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 px-6 hover:bg-indigo-700"
            >
              Go to my dashboard
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" className={inputClass} autoFocus />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={inputClass}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 text-white font-medium py-3 hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Logging in…" : "Log in"}
            </button>
            <p className="text-xs text-gray-400 text-center">
              New seller?{" "}
              <a href={`${FRONTEND_URL}/signup`} className="text-indigo-600">
                Become a Seller
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
