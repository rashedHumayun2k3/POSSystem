"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomer, updateCustomer, listOrders } from "@/lib/ordersApi";
import { useLanguage } from "@/i18n/LanguageContext";
import { toastError } from "@/lib/toastError";
import { useToastStore } from "@/store/toastStore";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [creditLimit, setCreditLimit] = useState("");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer-orders", customer?.phone],
    queryFn: () => listOrders({ q: customer!.phone }),
    enabled: !!customer,
  });

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setAddress(customer.address ?? "");
      setCreditLimit(String(customer.creditLimit));
    }
  }, [customer]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCustomer(id, {
        name: name.trim(),
        address: address.trim() || null,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["customer", id], updated);
      setEditing(false);
      useToastStore.getState().show(t("customers.saved"));
    },
    onError: (err: unknown) => toastError(err, t("customers.saveFailed")),
  });

  function handleSave() {
    if (!name.trim()) {
      useToastStore.getState().show(t("customers.nameRequired"), "error");
      return;
    }
    saveMutation.mutate();
  }

  if (isLoading || !customer) {
    return <div className="px-4 pt-8 text-gray-400 text-sm">{t("common.loading")}</div>;
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">{customer.name}</h1>
        <button onClick={() => setEditing((v) => !v)} className="text-sm font-semibold text-indigo-600">
          {editing ? t("common.cancel") : t("common.edit")}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <p className="text-sm text-gray-500">{customer.phone}</p>

        {customer.isSerialRejecter && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-red-700">
              ⚠ {t("customers.serialRejecterWarning", {
                returns: customer.recentReturnCount,
                orders: customer.recentOrderCount,
              })}
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-400">{t("customers.orders")}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{customer.orderCount}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-400">{t("customers.returns")}</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{customer.returnCount}</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-400">{t("customers.baki")}</p>
            <p className={`text-lg font-bold mt-0.5 ${customer.unpaidBalance > 0 ? "text-red-600" : "text-gray-900"}`}>
              ৳{customer.unpaidBalance.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-xs text-gray-400">{t("customers.credit")}</p>
            <p className={`text-lg font-bold mt-0.5 ${customer.storeCreditBalance > 0 ? "text-green-600" : "text-gray-900"}`}>
              ৳{customer.storeCreditBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {editing ? (
          <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t("customers.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
              placeholder={t("customers.addressPlaceholder")}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div>
              <label className="text-xs text-indigo-700 block mb-1">{t("customers.creditLimitLabel")}</label>
              <input
                type="number"
                min="0"
                className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        ) : (
          customer.address && (
            <p className="text-xs text-gray-400">📍 {customer.address}</p>
          )
        )}

        {/* Order history */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("customers.orderHistory")}</p>
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t("customers.noOrders")}</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 active:scale-[0.99] transition"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.orderNo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">৳{o.totalAmount.toLocaleString()}</p>
                    <div className="mt-0.5">
                      <StatusBadge status={o.fulfillmentStatus} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
