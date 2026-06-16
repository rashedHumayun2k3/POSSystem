"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { PhoneIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <>
        <AppHeader title={t("orders.title")} backHref="/orders" />
        <div className="px-4 py-6 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <AppHeader title={t("orders.notFound")} backHref="/orders" />
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
          {t("orders.notFoundDesc")}
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title={order.orderNo ?? t("orders.title")} backHref="/orders" />
      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={order.orderStatus} />
          <StatusBadge status={order.fulfillmentStatus} />
          <StatusBadge status={order.paymentStatus} />
        </div>

        {/* Customer card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-800">{order.customerName || t("orders.walkIn")}</p>
          {order.customerPhone && (
            <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-sm text-indigo-600">
              <PhoneIcon className="w-4 h-4" /> {order.customerPhone}
            </a>
          )}
          {order.customerAddress && (
            <div className="flex items-start gap-2 text-sm text-gray-500">
              <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0" /> {order.customerAddress}
            </div>
          )}
          <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {order.channel}
          </span>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {order.items?.map((item: { id: string; productName: string; variantLabel?: string; qty: number; unitPrice: number }) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                {item.variantLabel && <p className="text-xs text-gray-400">{item.variantLabel}</p>}
                <p className="text-xs text-gray-400">× {item.qty}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">৳{(item.qty * item.unitPrice).toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>{t("orders.subtotal")}</span><span>৳{order.subtotal?.toFixed(2)}</span>
          </div>
          {order.discountType !== "NONE" && (
            <div className="flex justify-between text-sm text-red-500">
              <span>{t("orders.discount")}</span><span>−৳{order.discountAmount?.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-500">
            <span>{t("orders.delivery")}</span><span>৳{order.deliveryChargeCustomer?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t pt-2">
            <span>{t("orders.total")}</span><span className="text-indigo-700">৳{order.total?.toFixed(2)}</span>
          </div>
        </div>

        {/* Note */}
        {order.note && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-sm text-amber-700">
            {order.note}
          </div>
        )}
      </div>
    </>
  );
}
