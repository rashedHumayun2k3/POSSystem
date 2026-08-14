"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  getPlatformAdminToken,
  clearPlatformAdminToken,
  getCourierCatalogAdmin,
  createCourierCatalogAdmin,
  updateCourierCatalogAdmin,
  deleteCourierCatalogAdmin,
  type CourierCatalogItem,
  type CourierCatalogPayload,
} from "@/lib/platformAdminApi";
import SlidePanel from "@/components/ui/SlidePanel";

type FormMode = "add" | "edit" | null;

const EMPTY_FORM = {
  name: "",
  insideDhakaCharge: "",
  outsideDhakaCharge: "",
  returnCharge: "",
  codFeeType: "PCT" as "FLAT" | "PCT",
  codFeeValue: "",
  trackingUrlTemplate: "",
  isActive: true,
};

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message ?? fallback;
}

export default function PlatformAdminCouriersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [editTarget, setEditTarget] = useState<CourierCatalogItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getPlatformAdminToken()) {
      router.replace("/platform-admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["platform-admin", "courier-catalog"],
    queryFn: getCourierCatalogAdmin,
    enabled: ready,
  });

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setError(""); setMode("add"); };
  const openEdit = (c: CourierCatalogItem) => {
    setForm({
      name: c.name,
      insideDhakaCharge: String(c.insideDhakaCharge),
      outsideDhakaCharge: String(c.outsideDhakaCharge),
      returnCharge: String(c.returnCharge),
      codFeeType: c.codFeeType,
      codFeeValue: String(c.codFeeValue),
      trackingUrlTemplate: c.trackingUrlTemplate ?? "",
      isActive: c.isActive,
    });
    setEditTarget(c); setError(""); setMode("edit");
  };
  const close = () => { setMode(null); setEditTarget(null); };

  const buildPayload = (): CourierCatalogPayload => ({
    name: form.name.trim(),
    insideDhakaCharge: parseFloat(form.insideDhakaCharge) || 0,
    outsideDhakaCharge: parseFloat(form.outsideDhakaCharge) || 0,
    returnCharge: parseFloat(form.returnCharge) || 0,
    codFeeType: form.codFeeType,
    codFeeValue: parseFloat(form.codFeeValue) || 0,
    trackingUrlTemplate: form.trackingUrlTemplate.trim() || undefined,
    isActive: form.isActive,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (mode === "add") await createCourierCatalogAdmin(payload);
      else if (editTarget) await updateCourierCatalogAdmin(editTarget.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-admin", "courier-catalog"] }); close(); },
    onError: (err) => setError(getErrorMessage(err, "Failed to save.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCourierCatalogAdmin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-admin", "courier-catalog"] }),
    onError: (err) => alert(getErrorMessage(err, "Failed to delete.")),
  });

  const logout = () => {
    clearPlatformAdminToken();
    router.push("/platform-admin/login");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Courier Catalog</h1>
          <p className="text-xs text-gray-400">Platform-wide list businesses pick couriers from</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1 text-sm font-semibold text-indigo-600">
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
        <button onClick={logout} className="text-xs text-gray-400">Logout</button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-2">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)
        ) : catalog.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No couriers in the catalog yet.</p>
        ) : (
          catalog.map((c) => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                  {c.inUse && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">
                      In use by a business
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <span className="text-xs text-gray-500">Inside ৳{c.insideDhakaCharge}</span>
                  <span className="text-xs text-gray-500">Outside ৳{c.outsideDhakaCharge}</span>
                  <span className="text-xs text-gray-500">Return ৳{c.returnCharge}</span>
                  <span className="text-xs text-gray-500">
                    COD {c.codFeeType === "PCT" ? `${c.codFeeValue}%` : `৳${c.codFeeValue}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  disabled={c.inUse}
                  title={c.inUse ? "In use by a business — cannot be edited" : "Edit"}
                  className="text-xs font-medium px-2 py-1.5 rounded-lg bg-gray-50 text-gray-600 disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${c.name}" from the catalog?`)) deleteMutation.mutate(c.id); }}
                  disabled={c.inUse}
                  title={c.inUse ? "In use by a business — cannot be deleted" : "Delete"}
                  className="text-xs font-medium px-2 py-1.5 rounded-lg bg-red-50 text-red-600 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <SlidePanel
        open={mode !== null}
        onClose={close}
        title={mode === "add" ? "Add Courier" : "Edit Courier"}
        footer={
          <>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.name.trim()}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-40"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="px-4 py-4 space-y-3">
          <input placeholder="Courier name" value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <div className="flex gap-2">
            <input placeholder="Inside Dhaka charge" value={form.insideDhakaCharge}
              type="number" inputMode="decimal" min="0"
              onChange={(e) => setForm((f) => ({ ...f, insideDhakaCharge: e.target.value }))}
              className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input placeholder="Outside Dhaka charge" value={form.outsideDhakaCharge}
              type="number" inputMode="decimal" min="0"
              onChange={(e) => setForm((f) => ({ ...f, outsideDhakaCharge: e.target.value }))}
              className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <input placeholder="Return charge" value={form.returnCharge}
            type="number" inputMode="decimal" min="0"
            onChange={(e) => setForm((f) => ({ ...f, returnCharge: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <div>
            <p className="text-xs text-gray-500 mb-1.5">COD fee</p>
            <div className="flex gap-2">
              <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
                {(["PCT", "FLAT"] as const).map((type) => (
                  <button key={type} type="button"
                    onClick={() => setForm((f) => ({ ...f, codFeeType: type }))}
                    className={`px-3 h-11 text-sm font-medium transition-colors ${form.codFeeType === type ? "bg-indigo-600 text-white" : "bg-white text-gray-500"}`}>
                    {type === "PCT" ? "%" : "৳"}
                  </button>
                ))}
              </div>
              <input
                placeholder={form.codFeeType === "PCT" ? "e.g. 1" : "e.g. 10"}
                value={form.codFeeValue} type="number" inputMode="decimal" min="0"
                onChange={(e) => setForm((f) => ({ ...f, codFeeValue: e.target.value }))}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <input placeholder="Tracking URL template (optional)" value={form.trackingUrlTemplate}
            onChange={(e) => setForm((f) => ({ ...f, trackingUrlTemplate: e.target.value }))}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <button type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`w-full h-11 rounded-xl border text-sm font-medium transition-colors ${form.isActive ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-600"}`}>
            {form.isActive ? "Active — visible to businesses" : "Inactive — hidden from businesses"}
          </button>
        </div>
      </SlidePanel>
    </div>
  );
}
