"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrder, confirmOrder, packOrder, handoverOrder, deliverOrder,
  returnOrder, cancelOrder, addOrderPayment, downloadChallan, downloadReceipt,
  updateOrder, deleteOrder,
  listCouriers, listDeliveryMen,
} from "@/lib/ordersApi";
import AppHeader from "@/components/layout/AppHeader";
import SlidePanel from "@/components/ui/SlidePanel";
import StatusBadge from "@/components/ui/StatusBadge";
import { PhoneIcon, MapPinIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import type { OrderDetail, ReturnItemInput, ReturnReasonType } from "@/types/orders";

type Tab = "overview" | "items" | "history" | "payments";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const qc = useQueryClient();
  const isOwner = useAuthStore((s) => s.isOwner());
  const canSeeCosts = useAuthStore((s) => s.canSeeCosts());

  const [tab, setTab] = useState<Tab>("overview");

  // Handover panel state
  const [showHandover, setShowHandover] = useState(false);
  const [handoverCourierId, setHandoverCourierId] = useState("");
  const [handoverTracking, setHandoverTracking] = useState("");
  const [handoverDeliveryManId, setHandoverDeliveryManId] = useState("");
  const [handoverCost, setHandoverCost] = useState("0");

  // Return panel state
  const [showReturn, setShowReturn] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnInspections, setReturnInspections] = useState<Record<string, "SELLABLE" | "DAMAGED">>({});
  const [returnResolution, setReturnResolution] = useState<"COURIER_RETURN" | "REFUND" | "STORE_CREDIT" | "REPLACE_SAME" | "EXCHANGE_DIFFERENT">("COURIER_RETURN");
  const [returnRefundAmount, setReturnRefundAmount] = useState("");
  const [returnRefundMethod, setReturnRefundMethod] = useState("CASH");
  const [returnReason, setReturnReason] = useState<ReturnReasonType | "">("");
  const [returnNote, setReturnNote] = useState("");

  // Cancel state
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ customerName: "", customerAddress: "", channel: "", note: "", courierId: "" });

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Payment panel state
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payAmount, setPayAmount] = useState("");

  const [challanLoading, setChallanLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["order", id],
    queryFn: () => getOrder(id),
  });

  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: listCouriers,
    enabled: showHandover || showEdit,
  });

  const { data: deliveryMen = [] } = useQuery({
    queryKey: ["delivery-men"],
    queryFn: listDeliveryMen,
    enabled: showHandover,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["order", id] });

  const mutOpts = (onDone?: () => void) => ({
    onSuccess: () => { invalidate(); onDone?.(); },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.unavailableItems?.length) {
        setActionError(`${t("orders.stockUnavailable")}: ${(data.unavailableItems as string[]).join(", ")}`);
      } else {
        setActionError(data?.message ?? t("common.error"));
      }
    },
  });

  const confirmMut = useMutation({ mutationFn: () => confirmOrder(id), ...mutOpts() });
  const packMut = useMutation({ mutationFn: () => packOrder(id), ...mutOpts() });
  const deliverMut = useMutation({ mutationFn: () => deliverOrder(id), ...mutOpts() });

  const handoverMut = useMutation({
    mutationFn: () => handoverOrder(id, {
      courierId: handoverCourierId,
      trackingNo: handoverTracking,
      deliveryManId: handoverDeliveryManId || undefined,
      deliveryCostActual: parseFloat(handoverCost) || 0,
    }),
    ...mutOpts(() => setShowHandover(false)),
  });

  const returnMut = useMutation({
    mutationFn: () => {
      const items: ReturnItemInput[] = (order?.items ?? [])
        .filter((i) => parseFloat(returnQtys[i.id] || "0") > 0)
        .map((i) => ({
          orderItemId: i.id,
          qty: parseFloat(returnQtys[i.id]),
          inspection: returnInspections[i.id] ?? "SELLABLE",
        }));
      return returnOrder(id, {
        items,
        resolutionType: returnResolution,
        reason: returnReason || undefined,
        refundAmount: (returnResolution === "REFUND" || returnResolution === "STORE_CREDIT")
          ? (parseFloat(returnRefundAmount) || 0) : undefined,
        refundMethod: returnResolution === "REFUND" ? returnRefundMethod : undefined,
        note: returnNote.trim() || undefined,
      });
    },
    ...mutOpts(() => { setShowReturn(false); setReturnNote(""); setReturnRefundAmount(""); setReturnReason(""); }),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelOrder(id, cancelReason),
    ...mutOpts(() => { setShowCancel(false); setCancelReason(""); }),
  });

  const paymentMut = useMutation({
    mutationFn: () => addOrderPayment(id, { method: payMethod, amount: parseFloat(payAmount) }),
    ...mutOpts(() => { setShowPayment(false); setPayAmount(""); }),
  });

  const editMut = useMutation({
    mutationFn: () => updateOrder(id, {
      customerName: editForm.customerName || undefined,
      customerAddress: editForm.customerAddress || undefined,
      channel: editForm.channel || undefined,
      note: editForm.note,
      courierId: editForm.courierId || undefined,
    }),
    ...mutOpts(() => setShowEdit(false)),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteOrder(id, deleteReason),
    onSuccess: () => { window.location.href = "/orders"; },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message ?? t("common.error"));
    },
  });

  if (isLoading) {
    return (
      <>
        <AppHeader title="…" backHref="/orders" />
        <div className="px-4 py-6 space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
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

  const fs = order.fulfillmentStatus;
  const os = order.orderStatus;
  const isTerminal = os === "COMPLETED" || os === "CANCELLED";
  const handleChallan = async () => {
    setChallanLoading(true);
    try { await downloadChallan(id); } finally { setChallanLoading(false); }
  };

  const handleReceipt = async () => {
    setReceiptLoading(true);
    try { await downloadReceipt(id); } finally { setReceiptLoading(false); }
  };

  const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "CARD", "BAKI", "COD"];
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t("orders.overview") },
    { key: "items", label: t("orders.items") },
    { key: "history", label: t("orders.history") },
    { key: "payments", label: t("orders.payments") },
  ];

  return (
    <>
      <AppHeader
        title={order.orderNo}
        backHref="/orders"
        right={
          <div className="flex items-center gap-1">
            {os !== "CANCELLED" && (
              <button
                onClick={() => {
                  setEditForm({
                    customerName: order.customerName,
                    customerAddress: order.customerAddress ?? "",
                    channel: order.channel,
                    note: order.note ?? "",
                    courierId: order.courierId ?? "",
                  });
                  setShowEdit(true);
                }}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200"
                title={t("orders.editOrder")}
              >
                <PencilSquareIcon className="w-5 h-5" />
              </button>
            )}
            {isOwner && !isTerminal && (
              <button
                onClick={() => setShowDelete(true)}
                className="p-2 rounded-xl text-red-400 hover:bg-red-50 active:bg-red-100"
                title={t("orders.deleteOrder")}
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-col h-full overflow-hidden">
        {/* Status badges */}
        <div className="px-4 py-2 flex flex-wrap gap-2 bg-white border-b border-gray-100">
          <StatusBadge status={order.orderStatus} />
          {/* Shop and Hawker sales are already-settled walk-in/counter cash sales —
              FulfillmentStatus (always UNFULFILLED) and PaymentStatus (always PAID) never carry
              real information for these two channels, so they're hidden here too, matching the
              Orders list. Delivery channels still show both. */}
          {order.channel !== "HAWKER" && order.channel !== "SHOP" && (
            <StatusBadge status={order.fulfillmentStatus} />
          )}
          {order.channel !== "HAWKER" && order.channel !== "SHOP" && (
            <StatusBadge status={order.paymentStatus} />
          )}
          {order.isDraft && (
            <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
              DRAFT
            </span>
          )}
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {/* Night-entry sales display as Shop (দোকান) — same walk-in-style channel visually */}
            {order.channel === "HAWKER" ? "SHOP" : order.channel}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 bg-white overflow-x-auto no-scrollbar border-b border-gray-100">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === tb.key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Action error */}
        {actionError && (
          <div className="mx-4 mt-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
            {actionError}
            <button onClick={() => setActionError("")} className="ml-2 text-red-400 text-xs">✕</button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-40 space-y-4">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              {/* Customer */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-800">
                  {order.customerName || t("orders.walkIn")}
                </p>
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
              </div>

              {/* Delivery info */}
              {(order.courierName || order.trackingNo || order.deliveryManName) && (
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-1 text-sm">
                  {order.courierName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("orders.courierName")}</span>
                      <span className="font-medium">{order.courierName}</span>
                    </div>
                  )}
                  {order.trackingNo && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("orders.trackingNo")}</span>
                      <span className="font-mono text-indigo-600">{order.trackingNo}</span>
                    </div>
                  )}
                  {order.deliveryManName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("orders.deliveryMan")}</span>
                      <span>{order.deliveryManName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Note */}
              {order.note && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
                  {order.note}
                </div>
              )}

              {/* Return info — shown when order has been returned */}
              {fs === "RETURNED" && order.returnResolution && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1 text-sm">
                  <p className="font-semibold text-red-700 mb-2">Return Info</p>
                  {order.returnReason && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reason</span>
                      <span className="font-medium text-gray-800">
                        {{
                          DEFECTIVE: "Defective / broken",
                          WRONG_SIZE_COLOR: "Wrong size / color",
                          CHANGED_MIND: "Changed mind",
                          DAMAGED_DELIVERY: "Damaged in delivery",
                          OTHER: "Other",
                        }[order.returnReason] ?? order.returnReason}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Resolution</span>
                    <span className="font-medium text-gray-800">
                      {{
                        COURIER_RETURN: "Courier return",
                        REFUND: "Refund",
                        STORE_CREDIT: "Store credit",
                        REPLACE_SAME: "Replacement (same)",
                        EXCHANGE_DIFFERENT: "Exchange (different)",
                      }[order.returnResolution] ?? order.returnResolution}
                    </span>
                  </div>
                  {order.returnedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Returned on</span>
                      <span className="text-gray-700">{new Date(order.returnedAt).toLocaleDateString("en-GB")}</span>
                    </div>
                  )}
                  {order.returnNote && (
                    <p className="text-gray-500 italic mt-1">{order.returnNote}</p>
                  )}
                </div>
              )}

              {/* Totals */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>{t("orders.subtotal")}</span>
                  <span>৳{order.subtotal.toLocaleString()}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>{t("orders.discount")}</span>
                    <span>−৳{order.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {order.deliveryChargeCustomer > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>{t("orders.deliveryCharge")}</span>
                    <span>৳{order.deliveryChargeCustomer.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2 text-gray-900">
                  <span>{t("orders.total")}</span>
                  <span>৳{order.totalAmount.toLocaleString()}</span>
                </div>
                {order.totalPaid > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("orders.paid")}</span>
                    <span>৳{order.totalPaid.toLocaleString()}</span>
                  </div>
                )}
                {order.dueAmount > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>{t("orders.due")}</span>
                    <span>৳{order.dueAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Economics (owner only) */}
              {canSeeCosts && order.economics && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-1 text-sm">
                  <p className="font-semibold text-indigo-700 mb-2">{t("orders.economics")}</p>
                  <div className="flex justify-between text-gray-600">
                    <span>{t("orders.cost")}</span>
                    <span>৳{order.economics.cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{t("orders.revenue")}</span>
                    <span>৳{order.economics.revenue.toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between font-semibold border-t pt-1 ${order.economics.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    <span>{t("orders.profit")}</span>
                    <span>{order.economics.profit >= 0 ? "+" : ""}৳{order.economics.profit.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ITEMS ── */}
          {tab === "items" && (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                      {item.variantLabel && <p className="text-xs text-gray-400">{item.variantLabel}</p>}
                      {item.isDamagedItem && (
                        <span className="text-xs text-red-500">(damaged)</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">৳{item.subtotal.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">×{item.qty} @ ৳{item.unitPrice}</p>
                    </div>
                  </div>
                  {canSeeCosts && item.unitCostSnapshot != null && (
                    <div className="mt-1 flex gap-3 text-xs text-gray-400">
                      <span>{t("orders.unitCost")}: ৳{item.unitCostSnapshot}</span>
                      {item.lineProfit != null && (
                        <span className={item.lineProfit >= 0 ? "text-green-600" : "text-red-500"}>
                          {t("orders.lineProfit")}: {item.lineProfit >= 0 ? "+" : ""}৳{item.lineProfit.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── HISTORY ── */}
          {tab === "history" && (
            <div className="space-y-2">
              {order.statusHistory.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">{t("common.noData")}</p>
              )}
              {order.statusHistory.map((h, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">
                      {h.fromStatus} → {h.toStatus}
                    </span>
                    <span className="text-xs text-gray-400">{h.track}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{h.userName}</span>
                    <span>{new Date(h.at).toLocaleString("en-GB")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab === "payments" && (
            <>
              <div className="space-y-2">
                {order.payments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">{t("common.noData")}</p>
                )}
                {order.payments.map((p) => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{p.method}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.receivedAt).toLocaleDateString("en-GB")} · {p.recordedByName}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">৳{p.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              {!isTerminal && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium"
                >
                  + {t("orders.addPayment")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Sticky action bar ── sits above the bottom nav (h-16) ── */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 pt-2 pb-3 space-y-2 z-30">

        {/* Row 1 — primary lifecycle action(s) */}
        {(order.isDraft ||
          (!order.isDraft && fs === "UNFULFILLED" && os === "OPEN") ||
          fs === "PACKED" ||
          fs === "IN_TRANSIT" ||
          (fs === "DELIVERED" && os === "OPEN")
        ) && (
          <div className="flex gap-2">
            {order.isDraft && (
              <button
                onClick={() => confirmMut.mutate()}
                disabled={confirmMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {confirmMut.isPending ? "…" : t("orders.confirmOrder")}
              </button>
            )}

            {!order.isDraft && fs === "UNFULFILLED" && os === "OPEN" && (
              <button
                onClick={() => packMut.mutate()}
                disabled={packMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {packMut.isPending ? "…" : t("orders.pack")}
              </button>
            )}

            {fs === "PACKED" && (
              <>
                <button
                  onClick={() => setShowHandover(true)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
                >
                  {t("orders.handover")}
                </button>
                <button
                  onClick={handleChallan}
                  disabled={challanLoading}
                  className="flex-1 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium disabled:opacity-50"
                >
                  {challanLoading ? "…" : t("orders.printChallan")}
                </button>
              </>
            )}

            {fs === "IN_TRANSIT" && (
              <>
                <button
                  onClick={() => deliverMut.mutate()}
                  disabled={deliverMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {deliverMut.isPending ? "…" : t("orders.deliver")}
                </button>
                <button
                  onClick={() => { setReturnResolution("COURIER_RETURN"); setReturnQtys({}); setShowReturn(true); }}
                  className="flex-1 py-2.5 rounded-xl border border-amber-500 text-amber-600 text-sm font-medium"
                >
                  📦 Courier Return
                </button>
              </>
            )}

            {fs === "DELIVERED" && os === "OPEN" && (
              <button
                onClick={() => { setReturnResolution("REFUND"); setReturnQtys({}); setShowReturn(true); }}
                className="flex-1 py-2.5 rounded-xl border border-amber-500 text-amber-600 text-sm font-semibold"
              >
                ↩ Return / Refund
              </button>
            )}
          </div>
        )}

        {/* Row 2 — secondary / destructive actions always on their own row */}
        <div className="flex gap-2">
          {(fs === "DELIVERED" || fs === "RETURNED" || isTerminal) && (
            <button
              onClick={handleChallan}
              disabled={challanLoading}
              className="flex-1 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium disabled:opacity-50"
            >
              {challanLoading ? "…" : t("orders.printChallan")}
            </button>
          )}
          {!order.isDraft && os !== "CANCELLED" && (
            <button
              onClick={handleReceipt}
              disabled={receiptLoading}
              className="flex-1 py-2 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium disabled:opacity-50"
            >
              {receiptLoading ? "…" : t("orders.printReceipt")}
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={() => setShowCancel(true)}
              className="flex-1 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium"
            >
              {t("orders.cancel")}
            </button>
          )}
        </div>
      </div>

      {/* ── Handover panel ── */}
      <SlidePanel
        open={showHandover}
        onClose={() => setShowHandover(false)}
        title={t("orders.handover")}
        footer={
          <button
            onClick={() => handoverMut.mutate()}
            disabled={handoverMut.isPending || !handoverCourierId || !handoverTracking}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {handoverMut.isPending ? "…" : t("orders.handover")}
          </button>
        }
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.courierName")} *</label>
            <select
              value={handoverCourierId}
              onChange={(e) => setHandoverCourierId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— select courier —</option>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.trackingNo")} *</label>
            <input
              type="text"
              value={handoverTracking}
              onChange={(e) => setHandoverTracking(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {t("orders.deliveryMan")} <span className="text-gray-300">({t("common.optional")})</span>
            </label>
            <select
              value={handoverDeliveryManId}
              onChange={(e) => setHandoverDeliveryManId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— none —</option>
              {deliveryMen.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.deliveryCost")}</label>
            <input
              type="number"
              value={handoverCost}
              onChange={(e) => setHandoverCost(e.target.value)}
              min={0}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </SlidePanel>

      {/* ── Return / Refund panel ── */}
      <SlidePanel
        open={showReturn}
        onClose={() => setShowReturn(false)}
        title="Return / Refund"
        footer={
          <button
            onClick={() => returnMut.mutate()}
            disabled={returnMut.isPending || !(order?.items ?? []).some((i) => parseFloat(returnQtys[i.id] || "0") > 0)}
            className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
          >
            {returnMut.isPending ? "…" : "Confirm Return"}
          </button>
        }
      >
        {(() => {
          const totalPaid = order?.totalPaid ?? 0;
          const canRefund = totalPaid > 0;
          // Filter out options that don't make sense for this order's payment state
          const resolutionOptions = [
            { key: "COURIER_RETURN" as const,    label: "📦 Courier returned",    desc: "Parcel came back undelivered" },
            { key: "REFUND" as const,             label: "💰 Refund to customer",  desc: `Max ৳${totalPaid.toFixed(0)} (paid)`,  disabled: !canRefund },
            { key: "STORE_CREDIT" as const,       label: "🏷 Store credit",        desc: `Max ৳${totalPaid.toFixed(0)} (paid)`,  disabled: !canRefund },
            { key: "REPLACE_SAME" as const,       label: "🔄 Replace same item",   desc: "Create new order after return" },
            { key: "EXCHANGE_DIFFERENT" as const, label: "🔀 Exchange",            desc: "Swap for different item" },
          ];

          return (
            <div className="p-4 space-y-5">

              {/* ── 0. Return reason (R9.1) ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Why is it coming back?</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "DEFECTIVE",        label: "🔧 Defective / broken" },
                    { key: "WRONG_SIZE_COLOR", label: "📐 Wrong size / color" },
                    { key: "CHANGED_MIND",     label: "💭 Changed mind" },
                    { key: "DAMAGED_DELIVERY", label: "📦 Damaged in delivery" },
                    { key: "OTHER",            label: "❓ Other" },
                  ] as { key: ReturnReasonType; label: string }[]).map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setReturnReason(r.key)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                        returnReason === r.key
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 1. Resolution type ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">What happened?</p>
                <div className="grid grid-cols-2 gap-2">
                  {resolutionOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => !opt.disabled && setReturnResolution(opt.key)}
                      className={`text-left p-3 rounded-xl border text-xs transition ${
                        opt.disabled
                          ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                          : returnResolution === opt.key
                            ? "bg-amber-50 border-amber-400 text-amber-800"
                            : "bg-gray-50 border-gray-200 text-gray-600 active:bg-amber-50"
                      }`}
                    >
                      <p className="font-semibold">{opt.label}</p>
                      <p className={`mt-0.5 text-[10px] ${opt.disabled ? "text-gray-300" : returnResolution === opt.key ? "text-amber-600" : "text-gray-400"}`}>
                        {opt.disabled ? "No payment collected yet" : opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 2. Items being returned ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Items returning</p>
                <div className="space-y-2">
                  {(order?.items ?? []).filter((i) => !i.isDamagedItem).map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                          {item.variantLabel && <p className="text-xs text-gray-400">{item.variantLabel}</p>}
                          <p className="text-xs text-gray-400">Ordered: {item.qty} pcs · ৳{item.subtotal.toFixed(0)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setReturnQtys((p) => ({ ...p, [item.id]: String(Math.max(0, (parseInt(p[item.id] || "0") - 1))) }))}
                            className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-sm font-bold flex items-center justify-center">−</button>
                          <span className="w-6 text-center text-sm font-semibold">{returnQtys[item.id] || "0"}</span>
                          <button onClick={() => setReturnQtys((p) => ({ ...p, [item.id]: String(Math.min(item.qty, (parseInt(p[item.id] || "0") + 1))) }))}
                            className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                      {parseFloat(returnQtys[item.id] || "0") > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Condition when returned</p>
                          <div className="flex gap-2">
                            {(["SELLABLE", "DAMAGED"] as const).map((ins) => (
                              <button key={ins} onClick={() => setReturnInspections((p) => ({ ...p, [item.id]: ins }))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  (returnInspections[item.id] ?? "SELLABLE") === ins
                                    ? ins === "SELLABLE" ? "bg-green-50 border-green-400 text-green-700" : "bg-red-50 border-red-400 text-red-700"
                                    : "bg-white border-gray-200 text-gray-500"
                                }`}>
                                {ins === "SELLABLE" ? "✅ Back to stock" : "⚠️ Damaged"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. Refund / Store credit amount — only when customer actually paid ── */}
              {(returnResolution === "REFUND" || returnResolution === "STORE_CREDIT") && canRefund && (
                <div className="bg-indigo-50 rounded-xl p-3 space-y-3 border border-indigo-100">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                      {returnResolution === "REFUND" ? "Refund amount" : "Store credit amount"}
                    </p>
                    <span className="text-xs text-indigo-500">Max: ৳{totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setReturnRefundAmount(String(totalPaid))}
                      className="text-xs px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 font-medium shrink-0">
                      Full ৳{totalPaid.toFixed(0)}
                    </button>
                    <input
                      type="number" inputMode="decimal"
                      value={returnRefundAmount}
                      onChange={(e) => setReturnRefundAmount(e.target.value)}
                      max={totalPaid}
                      placeholder="0"
                      className="flex-1 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  {returnResolution === "REFUND" && (
                    <div className="flex gap-2">
                      {(["CASH", "BKASH", "NAGAD"] as const).map((m) => (
                        <button key={m} onClick={() => setReturnRefundMethod(m)}
                          className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition ${
                            returnRefundMethod === m ? "bg-indigo-600 text-white" : "bg-white border border-indigo-200 text-indigo-600"
                          }`}>{m}</button>
                      ))}
                    </div>
                  )}
                  {returnResolution === "STORE_CREDIT" && (
                    <p className="text-xs text-indigo-500">Credit will be added to {order?.customerName}&apos;s account and auto-applied on next purchase.</p>
                  )}
                </div>
              )}

              {/* ── 4. Replace / Exchange — explain next step ── */}
              {(returnResolution === "REPLACE_SAME" || returnResolution === "EXCHANGE_DIFFERENT") && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700">
                    {returnResolution === "REPLACE_SAME" ? "🔄 Replacement flow" : "🔀 Exchange flow"}
                  </p>
                  <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                    <li>Confirm this return — stock adjusts automatically</li>
                    <li>
                      {returnResolution === "REPLACE_SAME"
                        ? "Create a new order with the same item for this customer"
                        : "Create a new order with the desired item — adjust price if different"}
                    </li>
                    {returnResolution === "EXCHANGE_DIFFERENT" && (
                      <li>If new item is cheaper, refund the difference via Refund or Store Credit</li>
                    )}
                  </ol>
                  <p className="text-[10px] text-blue-400">The new order links back via the note field automatically.</p>
                </div>
              )}

              {/* ── 5. Note ── */}
              <div>
                <textarea
                  rows={2}
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="Reason / customer complaint (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>

            </div>
          );
        })()}
      </SlidePanel>

      {/* ── Payment panel ── */}
      <SlidePanel
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title={t("orders.addPayment")}
        footer={
          <button
            onClick={() => paymentMut.mutate()}
            disabled={paymentMut.isPending || !parseFloat(payAmount || "0")}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {paymentMut.isPending ? "…" : t("orders.addPayment")}
          </button>
        }
      >
        <div className="p-4 space-y-4">
          {/* Order summary — mini receipt */}
          {order && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 text-xs overflow-hidden">
              {/* Item lines */}
              <div className="px-3 py-2 space-y-1 border-b border-dashed border-gray-200">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-gray-600">
                    <span className="truncate flex-1">
                      {item.productName}
                      {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                      <span className="text-gray-400"> ×{item.qty}</span>
                    </span>
                    <span className="shrink-0 font-medium text-gray-700">৳{item.subtotal.toFixed(0)}</span>
                  </div>
                ))}
              </div>

              {/* Money breakdown */}
              <div className="px-3 py-2 space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>৳{order.subtotal.toFixed(2)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Discount</span>
                    <span>−৳{order.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {order.deliveryChargeCustomer > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Delivery</span>
                    <span>৳{order.deliveryChargeCustomer.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">
                  <span>Grand total</span>
                  <span>৳{order.totalAmount.toFixed(2)}</span>
                </div>
                {order.totalPaid > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span>−৳{order.totalPaid.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Due — highlighted footer row */}
              <div className={`flex justify-between items-center px-3 py-2 font-bold text-sm ${
                order.dueAmount > 0
                  ? "bg-red-50 border-t border-red-100 text-red-600"
                  : "bg-green-50 border-t border-green-100 text-green-600"
              }`}>
                <span>Due from customer</span>
                <span>৳{order.dueAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.paymentMethod")}</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    payMethod === m ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.advancePaid")}</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              min={0}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </SlidePanel>

      {/* ── Cancel confirmation ── */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancel(false)} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-gray-900">{t("orders.cancel")}</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder={t("orders.cancelReason")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancel(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
              >
                {t("common.close")}
              </button>
              <button
                onClick={() => cancelMut.mutate()}
                disabled={cancelMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {cancelMut.isPending ? "…" : t("orders.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit panel ── */}
      <SlidePanel
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title={t("orders.editOrder")}
        footer={
          <button
            onClick={() => editMut.mutate()}
            disabled={editMut.isPending}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {editMut.isPending ? "…" : t("common.save")}
          </button>
        }
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.customerName")}</label>
            <input
              type="text"
              value={editForm.customerName}
              onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.customerAddress")}</label>
            <input
              type="text"
              value={editForm.customerAddress}
              onChange={(e) => setEditForm((f) => ({ ...f, customerAddress: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.channel")}</label>
            <div className="flex flex-wrap gap-2">
              {["FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE", "SHOP", "OTHER"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, channel: ch }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    editForm.channel === ch ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {t("orders.courierName")} <span className="text-gray-300">({t("common.optional")})</span>
            </label>
            <select
              value={editForm.courierId}
              onChange={(e) => setEditForm((f) => ({ ...f, courierId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">— none —</option>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {t("common.note")} <span className="text-gray-300">({t("common.optional")})</span>
            </label>
            <textarea
              value={editForm.note}
              onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      </SlidePanel>

      {/* ── Delete confirmation ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowDelete(false); setDeleteReason(""); }} />
          <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 space-y-4 w-full max-w-[768px] mx-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <p className="text-base font-semibold text-red-600">{t("orders.deleteOrderTitle")}</p>
            <p className="text-sm text-gray-500">{t("orders.deleteOrderWarning")}</p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">{t("orders.deleteOrderReason")} *</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                placeholder={t("orders.deleteOrderReasonPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDelete(false); setDeleteReason(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm"
              >
                {t("common.close")}
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending || !deleteReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {deleteMut.isPending ? t("orders.deleting") : t("orders.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
