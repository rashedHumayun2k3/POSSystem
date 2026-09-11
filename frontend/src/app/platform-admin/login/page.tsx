"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { platformAdminLogin } from "@/lib/platformAdminApi";

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await platformAdminLogin(username.trim(), password);
      router.push("/platform-admin/couriers");
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Platform Admin</h1>
          <p className="text-xs text-gray-400 mt-0.5">Developer access only</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
