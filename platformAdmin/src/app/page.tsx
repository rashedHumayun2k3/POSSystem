"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { getCompanies, getStats, setCompanyStatus, extendSubscription, setMarketplaceVisibility } from "@/lib/platformAdminApi";
import { getErrorMessage } from "@/lib/api";
import type { AdminCompany } from "@/lib/types";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function ExtendModal({ company, onClose }: { company: AdminCompany; onClose: () => void }) {
  const qc = useQueryClient();
  const [days, setDays] = useState<number | null>(30);
  const [customDate, setCustomDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      extendSubscription(company.id, {
        addDays: customDate ? undefined : days ?? undefined,
        newPeriodEnd: customDate || undefined,
        amountCollected: amount ? parseFloat(amount) : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onClose();
    },
    onError: (err: unknown) => setError(getErrorMessage(err, "Could not extend subscription.")),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Extend subscription — {company.name}</h2>

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Quick add</p>
          <div className="flex gap-2">
            {[30, 90, 365].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setDays(n);
                  setCustomDate("");
                }}
                className={`flex-1 text-xs font-medium py-2 rounded-lg border ${
                  days === n && !customDate ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                +{n}d
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Or exact new expiry date</label>
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setDays(null);
            }}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Amount collected (optional)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. bank transfer amount"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!days && !customDate)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 text-white disabled:opacity-60"
          >
            {mutation.isPending ? "Saving…" : "Extend"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, hasHydrated, logout } = useAdminAuthStore();
  const [search, setSearch] = useState("");
  const [extendTarget, setExtendTarget] = useState<AdminCompany | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: getStats, enabled: !!token });
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies", search],
    queryFn: () => getCompanies(search || undefined),
    enabled: !!token,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) => setCompanyStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const marketplaceMutation = useMutation({
    mutationFn: ({ id, show }: { id: string; show: boolean }) => setMarketplaceVisibility(id, show),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });

  if (!hasHydrated || !token) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Platform Admin</h1>
          <Link href="/feedback" className="text-sm text-indigo-600 hover:text-indigo-700">
            Feedback →
          </Link>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Companies" value={stats?.totalCompanies ?? "—"} />
        <StatCard label="New This Week" value={stats?.newThisWeek ?? "—"} />
        <StatCard label="New This Month" value={stats?.newThisMonth ?? "—"} />
        <StatCard label="Trialing" value={stats?.trialingCount ?? "—"} />
        <StatCard label="Active Paid" value={stats?.activePaidCount ?? "—"} />
        <StatCard label="Total Revenue" value={stats ? fmtMoney(stats.totalRevenueCollected) : "—"} />
      </div>

      <input
        type="text"
        placeholder="Search companies…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4"
      />

      <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Fees Paid</th>
              <th className="px-4 py-3">Marketplace</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td>
              </tr>
            )}
            {!isLoading && companies.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No companies found.</td>
              </tr>
            )}
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(c.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{c.planCode ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.subscriptionStatus ?? "—"}
                  {c.currentPeriodEnd ? ` · ends ${fmtDate(c.currentPeriodEnd)}` : c.trialEndsAt ? ` · trial ends ${fmtDate(c.trialEndsAt)}` : ""}
                </td>
                <td className="px-4 py-3 text-gray-900 tabular-nums">{fmtMoney(c.totalFeesPaid)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => marketplaceMutation.mutate({ id: c.id, show: !c.showOnMarketplace })}
                    disabled={!c.primaryBusinessId || marketplaceMutation.isPending}
                    className={`text-xs font-medium px-2 py-1 rounded-full disabled:opacity-40 ${
                      c.showOnMarketplace ? "bg-sky-50 text-sky-700" : "bg-gray-100 text-gray-500"
                    }`}
                    title={c.primaryBusinessId ? "Toggle marketplace visibility" : "No business found for this company"}
                  >
                    {c.showOnMarketplace ? "Visible" : "Hidden"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const next = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
                        if (next === "SUSPENDED" && !confirm(`Deactivate "${c.name}"? Their owner will not be able to log in.`)) return;
                        statusMutation.mutate({ id: c.id, status: next });
                      }}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                        c.status === "ACTIVE"
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => setExtendTarget(c)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      Extend
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {extendTarget && <ExtendModal company={extendTarget} onClose={() => setExtendTarget(null)} />}
    </div>
  );
}
