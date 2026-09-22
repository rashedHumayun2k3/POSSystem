"use client";
import PaymentReferenceInput, { supportsPaymentReference } from "@/components/orders/PaymentReferenceInput";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrder, confirmOrder, handoverOrder, deliverOrder,
  returnOrder, cancelOrder, addOrderPayment,
  updateOrder, deleteOrder, reviseOrder,
  listCouriers, listDeliveryMen, createDeliveryMan,
} from "@/lib/ordersApi";
import AppHeader from "@/components/layout/AppHeader";
import SlidePanel from "@/components/ui/SlidePanel";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import CustomSelect from "@/components/ui/CustomSelect";
import StatusBadge from "@/components/ui/StatusBadge";
import { PhoneIcon, MapPinIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { formatVariantLabel } from "@/lib/format";
import type { OrderDetail, ReturnItemInput, ReturnReasonType, ReviseReasonType, ReviseOrderItemInput } from "@/types/orders";

type Tab = "overview" | "lifecycle" | "history" | "payments";

type LifecycleStepStatus = "done" | "current" | "pending";
interface LifecycleStep {
  key: string;
  label: string;
  date: string | null;
  status: LifecycleStepStatus;
}

function formatStepDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Light-to-dark progression for reached lifecycle steps — literal class names (not built via
// template strings) so Tailwind's content scanner picks them up.
const STEP_BOX_SHADES = ["bg-orange-100", "bg-orange-200", "bg-orange-300", "bg-orange-400"];
const STEP_DOT_SHADES = ["bg-orange-400", "bg-orange-600", "bg-orange-700", "bg-orange-900"];
const STEP_LINE_SHADES = ["bg-orange-400", "bg-orange-600", "bg-orange-700", "bg-orange-900"];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const router = useRouter();
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
  // True once the staff member has typed into the cost field themselves — once set, the
  // courier-charge auto-fill below backs off so it doesn't clobber a manually corrected value.
  // Picking a delivery man still overrides it (that's an explicit "use this person's rate" action).
  const [handoverCostManuallySet, setHandoverCostManuallySet] = useState(false);
  const [showAddDeliveryMan, setShowAddDeliveryMan] = useState(false);
  const [newDmName, setNewDmName] = useState("");
  const [newDmPhone, setNewDmPhone] = useState("");
  const [newDmCost, setNewDmCost] = useState("");

  // Return panel state
  const [showReturn, setShowReturn] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnInspections, setReturnInspections] = useState<Record<string, "SELLABLE" | "DAMAGED">>({});
  const [returnResolution, setReturnResolution] = useState<"COURIER_RETURN" | "REFUND" | "STORE_CREDIT" | "REPLACE_SAME" | "EXCHANGE_DIFFERENT">("COURIER_RETURN");
  const [returnRefundAmount, setReturnRefundAmount] = useState("");
  const [returnRefundMethod, setReturnRefundMethod] = useState("CASH");
  const [returnReason, setReturnReason] = useState<ReturnReasonType | "">("");
  const [returnNote, setReturnNote] = useState("");

  // Confirm order state
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);

  // Deliver state
  const [showDeliverConfirm, setShowDeliverConfirm] = useState(false);

  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ customerName: "", customerPhone: "", customerAddress: "", channel: "", note: "", courierId: "" });

  // Revise state (reduce/remove line items, pre-fulfillment)
  const [showRevise, setShowRevise] = useState(false);
  const [reviseQtys, setReviseQtys] = useState<Record<string, number>>({});
  const [reviseReason, setReviseReason] = useState<ReviseReasonType | "">("");
  const [reviseNote, setReviseNote] = useState("");
  const [reviseExcessAmount, setReviseExcessAmount] = useState<number | null>(null);
  const [reviseResolutionType, setReviseResolutionType] = useState<"REFUND" | "STORE_CREDIT" | "">("");
  const [reviseRefundMethod, setReviseRefundMethod] = useState("CASH");

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Payment panel state
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");

  const showToast = useToastStore((s) => s.show);

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

  // Delivery cost is already known — it's the courier's standard charge, not tied to which
  // delivery man happens to carry it. Backs the field with that charge once it loads, as long as
  // the staff member hasn't already typed a value in themselves.
  useEffect(() => {
    if (!showHandover || handoverCostManuallySet) return;
    const courier = couriers.find((c) => c.id === handoverCourierId);
    if (courier) setHandoverCost(String(courier.insideDhakaCharge));
  }, [showHandover, couriers, handoverCourierId, handoverCostManuallySet]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["order", id] });

  const mutOpts = (onDone?: () => void) => ({
    onSuccess: () => { invalidate(); onDone?.(); },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.items?.length) {
        showToast(`${t("orders.stockUnavailable")}: ${(data.items as string[]).join(", ")}`, "error");
      } else {
        showToast(data?.message ?? t("common.error"), "error");
      }
    },
  });

  const confirmMut = useMutation({ mutationFn: () => confirmOrder(id), ...mutOpts(() => setShowConfirmOrder(false)) });
  const deliverMut = useMutation({ mutationFn: () => deliverOrder(id), ...mutOpts(() => setShowDeliverConfirm(false)) });

  const handoverMut = useMutation({
    mutationFn: () => handoverOrder(id, {
      courierId: handoverCourierId,
      trackingNo: handoverTracking,
      deliveryManId: handoverDeliveryManId || undefined,
      deliveryCostActual: parseFloat(handoverCost) || 0,
    }),
    ...mutOpts(() => setShowHandover(false)),
  });

  const addDeliveryManMut = useMutation({
    mutationFn: () => createDeliveryMan({
      name: newDmName.trim(),
      phone: newDmPhone.trim(),
      courierId: handoverCourierId || undefined,
      costPerDelivery: parseFloat(newDmCost) || 0,
    }),
    onSuccess: (dm) => {
      qc.invalidateQueries({ queryKey: ["delivery-men"] });
      setHandoverDeliveryManId(dm.id);
      setShowAddDeliveryMan(false);
      setNewDmName("");
      setNewDmPhone("");
      setNewDmCost("");
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? t("orders.deliveryManAddFailed"), "error"),
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
    ...mutOpts(() => { setShowReturn(false); setShowReturnConfirm(false); setReturnNote(""); setReturnRefundAmount(""); setReturnReason(""); }),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelOrder(id, cancelReason),
    ...mutOpts(() => { setShowCancel(false); setCancelReason(""); }),
  });

  const paymentMut = useMutation({
    mutationFn: () => addOrderPayment(id, {
      method: payMethod, amount: parseFloat(payAmount),
      paymentReference: supportsPaymentReference(payMethod) ? payReference.trim() || undefined : undefined,
    }),
    ...mutOpts(() => { setShowPayment(false); setPayAmount(""); setPayReference(""); }),
  });

  const editMut = useMutation({
    mutationFn: () => updateOrder(id, {
      customerName: editForm.customerName || undefined,
      customerPhone: editForm.customerPhone || undefined,
      customerAddress: editForm.customerAddress || undefined,
      channel: editForm.channel || undefined,
      note: editForm.note,
      courierId: editForm.courierId || undefined,
    }),
    ...mutOpts(() => setShowEdit(false)),
  });

  const reviseMut = useMutation({
    mutationFn: () => {
      const items: ReviseOrderItemInput[] = (order?.items ?? [])
        .filter((i) => (reviseQtys[i.id] ?? i.qty) < i.qty)
        .map((i) => ({ orderItemId: i.id, newQty: reviseQtys[i.id] ?? 0 }));
      return reviseOrder(id, {
        items,
        reason: reviseReason as ReviseReasonType,
        note: reviseNote.trim() || undefined,
        resolutionType: reviseResolutionType || undefined,
        refundMethod: reviseResolutionType === "REFUND" ? reviseRefundMethod : undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setShowRevise(false);
      setReviseQtys({});
      setReviseReason("");
      setReviseNote("");
      setReviseExcessAmount(null);
      setReviseResolutionType("");
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.code === "ORDER_OVERPAID") {
        setReviseExcessAmount(data.excessAmount);
      } else {
        showToast(data?.message ?? t("common.error"), "error");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteOrder(id, deleteReason),
    onSuccess: () => { window.location.href = "/orders"; },
    onError: (err: any) => {
      showToast(err?.response?.data?.message ?? t("common.error"), "error");
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

  // Lifecycle tab — "how far along" is just an index into the normal happy path
  // (Created → Confirmed → Handed over → Delivered); the furthest reached step is "current",
  // everything before it is "done", everything after is "pending". Cancel/Return are deviations
  // from that path, so they're appended as their own final "current" step instead. Packing has
  // no step of its own — handing over to a courier implies it, so PACKED (legacy orders that
  // already went through the old two-step flow) counts the same as "not yet handed over".
  const lifecycleSteps: LifecycleStep[] = (() => {
    const isCancelled = os === "CANCELLED";
    const isReturned = fs === "RETURNED";
    const stageIndex = isReturned || fs === "DELIVERED" ? 3 : fs === "IN_TRANSIT" ? 2 : 1;
    const confirmedReached = !order.isDraft || !!order.confirmedAt;

    const base = [
      { key: "created", label: t("orders.stepCreated"), pendingLabel: null, date: order.createdAt as string | null, reachedAt: 0 },
      { key: "confirmed", label: t("orders.stepConfirmed"), pendingLabel: t("orders.stepConfirmedPending"), date: order.confirmedAt ?? null, reachedAt: confirmedReached ? 1 : 99 },
      { key: "handedOver", label: t("orders.stepHandedOver"), pendingLabel: t("orders.stepHandedOverPending"), date: order.handedOverAt ?? null, reachedAt: stageIndex >= 2 ? 2 : 99 },
      { key: "delivered", label: t("orders.stepDelivered"), pendingLabel: t("orders.stepDeliveredPending"), date: order.deliveredAt ?? null, reachedAt: stageIndex >= 3 ? 3 : 99 },
    ];

    const reachedValues = base.filter((s) => s.reachedAt !== 99).map((s) => s.reachedAt);
    const maxReached = reachedValues.length > 0 ? Math.max(...reachedValues) : -1;

    const steps: LifecycleStep[] = base.map((s) => {
      const status: LifecycleStepStatus = s.reachedAt === 99 ? "pending" : s.reachedAt === maxReached ? "current" : "done";
      return {
        key: s.key,
        label: status === "pending" && s.pendingLabel ? s.pendingLabel : s.label,
        date: s.date,
        status,
      };
    });

    if (isCancelled || isReturned) {
      steps.forEach((s) => { if (s.status === "current") s.status = "done"; });
      steps.push({
        key: isCancelled ? "cancelled" : "returned",
        label: isCancelled ? t("orders.stepCancelled") : t("orders.stepReturned"),
        date: isCancelled ? null : (order.returnedAt ?? null),
        status: "current",
      });
    }

    return steps;
  })();

  // Live preview while revising — mirrors the backend's ComputeDiscount/ComputeTotal so the
  // number shown here matches what the server will actually save.
  const revisedSubtotal = order.items.reduce((sum, i) => sum + (reviseQtys[i.id] ?? i.qty) * i.unitPrice, 0);
  const revisedDiscount = order.discountType === "PERCENT"
    ? Math.round(revisedSubtotal * (order.discountValue ?? 0)) / 100
    : order.discountType === "FIXED" ? (order.discountValue ?? 0) : 0;
  const revisedTotal = revisedSubtotal - revisedDiscount + order.deliveryChargeCustomer;
  const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "CARD", "BAKI", "COD"];
  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t("orders.overview") },
    { key: "lifecycle", label: t("orders.lifecycle") },
    { key: "history", label: t("orders.history") },
    { key: "payments", label: t("orders.payments") },
  ];

  return (
    <>
      <AppHeader title={order.orderNo} />

      <div className="flex flex-col h-full overflow-hidden">
        {/* Explicit, clearly-labeled way back to the New Orders queue — not just the generic
            back arrow in AppHeader, so staff always have an obvious "take me to the next thing
            to work on" action right at the top, regardless of what they did on this order. */}
        <Link
          href="/orders"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium border-b border-indigo-100 active:bg-indigo-100"
        >
          ← {t("orders.goToNewOrderList")}
        </Link>

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

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-40 space-y-4">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              {/* Compact horizontal preview of the same lifecycle shown in full on the Status
                  tab — evenly split across the screen width so it fits without horizontal
                  scrolling on mobile. */}
              <div className="bg-orange-50 rounded-xl border border-orange-100 px-3 py-4">
                <div className="flex items-center">
                  {lifecycleSteps.map((step, idx) => {
                    const isLast = idx === lifecycleSteps.length - 1;
                    const filled = step.status === "done" || step.status === "current";
                    // Progressively darker shade the further along the path a step is — gives a
                    // sense of "how far in" at a glance, on top of the done/pending distinction.
                    // Pending steps ignore this and stay the flat light-gray/orange-200 they always were.
                    const shadeIdx = Math.min(idx, STEP_DOT_SHADES.length - 1);
                    const isNext = lifecycleSteps[idx - 1]?.status === "current";
                    return (
                      <Fragment key={step.key}>
                        {/* Current step gets the full card (background + label + date). The step
                            right after it gets just its name, muted — enough to answer "what
                            happens next" without matching the current step's weight. Everything
                            else stays a bare dot, connected by a plain line, so the row stays
                            compact instead of N boxed columns fighting for space on a phone. */}
                        {step.status === "current" ? (
                          <div className={`flex flex-col items-center shrink-0 rounded-lg py-1.5 px-2 ${STEP_BOX_SHADES[shadeIdx]}`}>
                            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${STEP_DOT_SHADES[shadeIdx]}`} />
                            <p className="text-[11px] font-medium text-center mt-2 leading-tight text-gray-800 whitespace-nowrap">
                              {step.label}
                            </p>
                            <p className="text-[10px] text-gray-600 text-center mt-1 whitespace-nowrap">
                              {formatStepDate(step.date) ?? "—"}
                            </p>
                          </div>
                        ) : isNext ? (
                          <div className="flex flex-col items-center shrink-0 px-1">
                            <div className="w-3.5 h-3.5 rounded-full shrink-0 bg-white border-2 border-orange-200" />
                            <p className="text-[10px] text-center mt-2 leading-tight text-orange-400 whitespace-nowrap">
                              {step.label}
                            </p>
                          </div>
                        ) : (
                          <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                            filled ? STEP_DOT_SHADES[shadeIdx] : "bg-white border-2 border-orange-200"
                          }`} />
                        )}
                        {!isLast && (
                          <div className={`h-0.5 flex-1 min-w-[8px] ${filled ? STEP_LINE_SHADES[shadeIdx] : "bg-orange-200"}`} />
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Customer invoice preview button above the order details. */}
              {!order.isDraft && os !== "CANCELLED" && (
                <div className="flex items-center gap-4 px-1">
                  <Link
                    href={`/more/reports/invoices/${id}`}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold text-center"
                  >
                    {t("orders.printInvoice")}
                  </Link>
                </div>
              )}

              {order.isRevised && (
                <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-2.5 text-sm text-amber-800 font-medium flex items-center gap-1.5">
                  🔄 {t("orders.orderHasBeenRevised")}
                </div>
              )}

              {/* Everything about this order — order info, items, status, totals, customer,
                  delivery, note, return info, economics — as separate rounded cards with a gap
                  between them, each tinted by what it's about. Edit action up top covers the
                  whole thing (same destination as before: full order builder pre-confirm, small
                  customer-info panel after). */}
              <div className="space-y-3 text-sm">

                {/* Order info */}
                <div className="p-4 space-y-1.5 bg-indigo-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900">
                      {t("notifications.orderNo")}: {order.orderNo}
                    </p>
                    {os !== "CANCELLED" && (
                      <button
                        onClick={() => {
                          // A draft order hasn't been confirmed yet — stock isn't committed and
                          // GTR-8's snapshot-freeze hasn't kicked in, so editing goes to the full
                          // order builder (items, price, qty, everything) instead of just the
                          // customer-info panel.
                          if (order.isDraft) {
                            router.push(`/orders/new?edit=${order.id}`);
                            return;
                          }
                          setEditForm({
                            customerName: order.customerName,
                            customerPhone: order.customerPhone,
                            customerAddress: order.customerAddress ?? "",
                            channel: order.channel,
                            note: order.note ?? "",
                            courierId: order.courierId ?? "",
                          });
                          setShowEdit(true);
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 active:bg-gray-200 shrink-0"
                        title={t("orders.editCustomerInfo")}
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {t("orders.orderDate")}: {new Date(order.createdAt).toLocaleDateString("en-GB")}
                  </p>
                  {/* Type + channel — minor metadata, not worth a full labeled row each like the
                      money/customer fields below, so it's one small muted line instead. */}
                  <p className="text-[11px] text-gray-400">
                    {fs === "UNFULFILLED" ? t("orders.newBadge") : t(`status.${fs}`)} · {t(`orders.channelName${order.channel}`)}
                  </p>
                </div>

                {/* Per-item breakdown */}
                {order.items.map((item) => {
                  const short = item.availableStock < item.qty;
                  return (
                    <div key={item.id} className="p-4 space-y-1.5 bg-white rounded-xl border border-gray-100">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("orders.orderProduct")}</span>
                        <span className="font-medium text-gray-900 text-right">
                          {item.productName}
                          {formatVariantLabel(item.variantLabel) ? ` (${formatVariantLabel(item.variantLabel)})` : ""}
                          {item.isDamagedItem && <span className="text-red-500"> ({t("orders.damaged")})</span>}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("orders.orderQuantity")}</span>
                        <span className="font-medium text-gray-900">{item.qty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("orders.currentStock")}</span>
                        <span className={`font-semibold ${short ? "text-red-600" : "text-gray-700"}`}>
                          {item.availableStock}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t("orders.productPrice")}</span>
                        <span className="font-medium text-gray-900">৳{item.unitPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 mt-1">
                        <span className="text-gray-600 font-medium">{t("orders.subtotal")}</span>
                        <span className="font-bold text-gray-900">৳{item.subtotal.toLocaleString()}</span>
                      </div>
                      {canSeeCosts && item.unitCostSnapshot != null && (
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{t("orders.unitCost")}: ৳{item.unitCostSnapshot}</span>
                          {item.lineProfit != null && (
                            <span className={item.lineProfit >= 0 ? "text-green-700" : "text-red-500"}>
                              {t("orders.lineProfit")}: {item.lineProfit >= 0 ? "+" : ""}৳{item.lineProfit.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {fs !== "UNFULFILLED" && (
                  <div className="p-4 flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-100">
                    <StatusBadge status={order.orderStatus} />
                    {order.channel !== "HAWKER" && order.channel !== "SHOP" && (
                      <>
                        <StatusBadge status={order.fulfillmentStatus} />
                        {order.paymentStatus === "UNPAID" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            {t("orders.paymentNotDoneYet")}
                          </span>
                        ) : (
                          <StatusBadge status={order.paymentStatus} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Totals */}
                <div className="p-4 space-y-2 bg-gray-50 rounded-xl border border-gray-100">
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
                  <div className="flex justify-between font-bold border-t border-gray-100 pt-2 text-gray-900">
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
                      <span>{t("orders.paymentNotDoneYet")}</span>
                      <span>৳{order.dueAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Customer */}
                <div className="p-4 space-y-2 bg-green-50 rounded-xl border border-gray-100">
                  <p className="font-semibold text-gray-900">
                    {order.customerName || t("orders.walkIn")}
                  </p>
                  {order.customerPhone && (
                    <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-gray-700">
                      <PhoneIcon className="w-4 h-4" /> {order.customerPhone}
                    </a>
                  )}
                  {order.customerAddress && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0" /> {order.customerAddress}
                    </div>
                  )}
                </div>

                {/* Delivery info */}
                {(order.courierName || order.trackingNo || order.deliveryManName) && (
                  <div className="p-4 space-y-1 bg-rose-50 rounded-xl border border-gray-100">
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
                  <div className="p-4 text-amber-700 bg-amber-50 rounded-xl border border-gray-100">
                    {order.note}
                  </div>
                )}

                {/* Return info — shown when order has been returned */}
                {fs === "RETURNED" && order.returnResolution && (
                  <div className="p-4 space-y-1 bg-white rounded-xl border border-gray-100">
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

                {/* Economics (owner only) — cost is snapshotted at Confirm (GTR-8), so a draft
                    has no cost data at all yet; showing it pre-confirm would just read as
                    "this product is 100% profit," which isn't true, it's just not calculated.
                    Same reasoning extends to cancelled/returned orders — no sale actually stands,
                    so there's no real profit to report either, not even a provisional one. */}
                {canSeeCosts && order.economics && !order.isDraft && os !== "CANCELLED" && fs !== "RETURNED" && (
                  <div className="p-4 space-y-1 bg-green-50 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-900 mb-2">{t("orders.economics")}</p>
                    <div className="flex justify-between text-gray-600">
                      <span>{t("orders.revenue")}</span>
                      <span>৳{order.economics.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>{t("orders.cost")}</span>
                      <span>৳{order.economics.cost.toLocaleString()}</span>
                    </div>
                    {/* Shown for context only — not part of the profit math below, since
                        delivery is a logistics pass-through, not product margin. */}
                    {order.deliveryChargeCustomer > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>{t("orders.deliveryCharge")}</span>
                        <span>৳{order.deliveryChargeCustomer.toLocaleString()}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-semibold border-t pt-1 ${order.economics.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      <span>{t("orders.profit")}</span>
                      <span>{order.economics.profit >= 0 ? "+" : ""}৳{order.economics.profit.toLocaleString()}</span>
                    </div>
                    {/* This profit is calculated off the full order total, not what's actually
                        been collected — for a seller reading just the number, that reads as
                        already-in-hand money even on an unpaid COD order. Spell out that it's
                        provisional until payment is actually received. */}
                    <p className={`text-xs pt-0.5 ${order.paymentStatus === "PAID" ? "text-green-600" : "text-amber-600"}`}>
                      {order.paymentStatus === "PAID" ? t("orders.profitRealizedNote") : t("orders.profitPendingNote")}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── LIFECYCLE ── */}
          {tab === "lifecycle" && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-5">
              {lifecycleSteps.map((step, idx) => {
                const isLast = idx === lifecycleSteps.length - 1;
                const filled = step.status === "done" || step.status === "current";
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                        filled ? "bg-orange-800 border-orange-800" : "bg-white border-orange-200"
                      }`} />
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[32px] ${filled ? "bg-orange-800" : "bg-orange-100"}`} />
                      )}
                    </div>
                    <div className={isLast ? "pb-0" : "pb-6"}>
                      <p className={`text-sm font-medium ${filled ? "text-gray-900" : "text-gray-400"}`}>
                        {step.label}
                        {step.status === "current" && (
                          <span className="ml-2 text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-full align-middle">
                            {t("orders.currentStatusTag")}
                          </span>
                        )}
                      </p>
                      {step.date && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatStepDate(step.date)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
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
                  {h.track === "ITEMS" && (h.reason || h.note) && (
                    <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 text-xs text-amber-700">
                      {h.reason && <span className="font-medium">{t(`orders.reviseReason${h.reason}`)}</span>}
                      {h.note && <p className="mt-0.5 text-amber-600">{h.note}</p>}
                    </div>
                  )}
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
                      {p.paymentReference && (
                        <p className="text-xs text-gray-500 break-all">{t("orders.paymentReference")}: {p.paymentReference}</p>
                      )}
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
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[768px] bg-white border-t border-gray-100 px-4 pt-2 pb-[calc(3.75rem+env(safe-area-inset-bottom))] space-y-2 z-30">

        {/* Row 1 — primary lifecycle action(s). os !== "CANCELLED" guards the whole row: Cancel
            doesn't touch isDraft/fulfillmentStatus (see CancelAsync), so without this a cancelled
            draft would still fall into the isDraft branch below and show "Confirm Order". */}
        {os !== "CANCELLED" && (order.isDraft ||
          (!order.isDraft && fs === "UNFULFILLED" && os === "OPEN") ||
          fs === "PACKED" ||
          fs === "IN_TRANSIT" ||
          (fs === "DELIVERED" && os === "OPEN")
        ) && (
          <div className="flex gap-2">
            {order.isDraft && (
              <button
                onClick={() => setShowConfirmOrder(true)}
                disabled={confirmMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {confirmMut.isPending ? "…" : t("orders.confirmOrder")}
              </button>
            )}

            {!order.isDraft && (fs === "UNFULFILLED" || fs === "PACKED") && os === "OPEN" && (
              <button
                onClick={() => {
                  setHandoverCourierId(order.courierId ?? "");
                  setHandoverCost("0");
                  setHandoverCostManuallySet(false);
                  setShowHandover(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
              >
                {t("orders.handover")}
              </button>
            )}

            {fs === "IN_TRANSIT" && (
              <>
                <button
                  onClick={() => setShowDeliverConfirm(true)}
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
          {!isTerminal && fs === "UNFULFILLED" && (
            <button
              onClick={() => {
                setReviseQtys(Object.fromEntries(order.items.map((i) => [i.id, i.qty])));
                setReviseReason("");
                setReviseNote("");
                setReviseExcessAmount(null);
                setReviseResolutionType("");
                setShowRevise(true);
              }}
              className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium"
            >
              {t("orders.reviseOrder")}
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium"
            >
              {t("orders.cancel")}
            </button>
          )}
          {isOwner && !isTerminal && (
            <button
              onClick={() => setShowDelete(true)}
              className="flex-1 py-2 rounded-xl border border-red-400 text-red-600 text-sm font-medium"
            >
              {t("orders.deleteOrder")}
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
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.courierName")}</label>
            {order.courierName ? (
              <div className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
                {order.courierName}
              </div>
            ) : (
              <p className="text-xs text-amber-600">{t("orders.setCourierFirst")}</p>
            )}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 block">
                {t("orders.deliveryMan")} <span className="text-gray-300">({t("common.optional")})</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddDeliveryMan((v) => !v)}
                className="text-xs text-indigo-600 font-medium"
              >
                {t("orders.addDeliveryMan")}
              </button>
            </div>
            <CustomSelect
              value={handoverDeliveryManId}
              onChange={setHandoverDeliveryManId}
              placeholder="— none —"
              options={deliveryMen.map((d) => ({ value: d.id, label: d.name }))}
            />

            {showAddDeliveryMan && (
              <div className="mt-2 p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                <input
                  type="text"
                  value={newDmName}
                  onChange={(e) => setNewDmName(e.target.value)}
                  placeholder={t("orders.deliveryManNamePlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="tel"
                  value={newDmPhone}
                  onChange={(e) => setNewDmPhone(e.target.value)}
                  placeholder={t("orders.deliveryManPhonePlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="number"
                  min="0"
                  value={newDmCost}
                  onChange={(e) => setNewDmCost(e.target.value)}
                  placeholder={t("orders.deliveryManCostPlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDeliveryMan(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => addDeliveryManMut.mutate()}
                    disabled={!newDmName.trim() || !newDmPhone.trim() || addDeliveryManMut.isPending}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {addDeliveryManMut.isPending ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.deliveryCost")}</label>
            <input
              type="number"
              value={handoverCost}
              onChange={(e) => { setHandoverCost(e.target.value); setHandoverCostManuallySet(true); }}
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
            onClick={() => setShowReturnConfirm(true)}
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
                          {formatVariantLabel(item.variantLabel) && <p className="text-xs text-gray-400">{formatVariantLabel(item.variantLabel)}</p>}
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
                      min={0}
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

      {/* ── Revise Order panel — reduce qty / remove a line, pre-fulfillment only ── */}
      <SlidePanel
        open={showRevise}
        onClose={() => setShowRevise(false)}
        title={t("orders.reviseOrder")}
        footer={
          reviseExcessAmount != null ? (
            <button
              onClick={() => reviseMut.mutate()}
              disabled={reviseMut.isPending || !reviseResolutionType || (reviseResolutionType === "REFUND" && !reviseRefundMethod)}
              className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {reviseMut.isPending ? "…" : t("orders.confirmRevision")}
            </button>
          ) : (
            <button
              onClick={() => reviseMut.mutate()}
              disabled={
                reviseMut.isPending ||
                !reviseReason ||
                (reviseReason === "OTHER" && !reviseNote.trim()) ||
                !order.items.some((i) => (reviseQtys[i.id] ?? i.qty) < i.qty)
              }
              className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {reviseMut.isPending ? "…" : t("orders.saveRevision")}
            </button>
          )
        }
      >
        {reviseExcessAmount != null ? (
          // ── Overpayment resolution — shown after the server rejects with ORDER_OVERPAID ──
          <div className="p-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              {t("orders.overpaidMessage", { amount: reviseExcessAmount.toFixed(2) })}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t("orders.resolutionType")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReviseResolutionType("REFUND")}
                  className={`p-3 rounded-xl border text-sm font-medium transition ${
                    reviseResolutionType === "REFUND" ? "bg-amber-50 border-amber-400 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  💰 {t("orders.refund")}
                </button>
                <button
                  onClick={() => setReviseResolutionType("STORE_CREDIT")}
                  className={`p-3 rounded-xl border text-sm font-medium transition ${
                    reviseResolutionType === "STORE_CREDIT" ? "bg-amber-50 border-amber-400 text-amber-800" : "bg-gray-50 border-gray-200 text-gray-600"
                  }`}
                >
                  🏷 {t("orders.storeCredit")}
                </button>
              </div>
            </div>
            {reviseResolutionType === "REFUND" && (
              <div className="flex gap-2">
                {(["CASH", "BKASH", "NAGAD"] as const).map((m) => (
                  <button key={m} onClick={() => setReviseRefundMethod(m)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition ${
                      reviseRefundMethod === m ? "bg-indigo-600 text-white" : "bg-white border border-indigo-200 text-indigo-600"
                    }`}>{m}</button>
                ))}
              </div>
            )}
            {reviseResolutionType === "STORE_CREDIT" && !order.customerId && (
              <p className="text-xs text-red-500">{t("orders.noCustomerForCredit")}</p>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* ── Item qty editor — reduce only, can't go above the currently ordered qty ── */}
            <div className="space-y-2">
              {order.items.map((item) => {
                const qty = reviseQtys[item.id] ?? item.qty;
                return (
                  <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                        {formatVariantLabel(item.variantLabel) && <p className="text-xs text-gray-400">{formatVariantLabel(item.variantLabel)}</p>}
                        <p className="text-xs text-gray-400">{t("orders.orderedQty")}: {item.qty} · ৳{item.unitPrice}/pc</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setReviseQtys((p) => ({ ...p, [item.id]: Math.max(0, qty - 1) }))}
                          disabled={qty <= 0}
                          className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-sm font-bold flex items-center justify-center disabled:opacity-40"
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                        <button
                          onClick={() => setReviseQtys((p) => ({ ...p, [item.id]: Math.min(item.qty, qty + 1) }))}
                          disabled={qty >= item.qty}
                          className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center disabled:opacity-40"
                        >+</button>
                      </div>
                    </div>
                    {qty === 0 && (
                      <p className="text-xs text-red-500 font-medium">{t("orders.itemWillBeRemoved")}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live recomputed total — mirrors the backend's math so there's no surprise */}
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex justify-between items-center text-sm">
              <span className="text-teal-700 font-medium">{t("orders.revisedTotal")}</span>
              <span className="font-bold text-teal-900">৳{revisedTotal.toLocaleString()}</span>
            </div>

            {/* Mandatory reason */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t("orders.reviseReasonLabel")} *</p>
              <div className="flex flex-wrap gap-2">
                {(["OUT_OF_STOCK", "CUSTOMER_CHANGED_MIND", "OTHER"] as ReviseReasonType[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReviseReason(r)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                      reviseReason === r ? "bg-amber-500 text-white border-amber-500" : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    {t(`orders.reviseReason${r}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Free-text note — only required when reason is OTHER */}
            {reviseReason === "OTHER" && (
              <textarea
                value={reviseNote}
                onChange={(e) => setReviseNote(e.target.value)}
                rows={2}
                placeholder={t("orders.reviseNotePlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            )}
          </div>
        )}
      </SlidePanel>

      {/* ── Payment panel ── */}
      <SlidePanel
        open={showPayment}
        onClose={() => { setShowPayment(false); setPayReference(""); }}
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
                      {formatVariantLabel(item.variantLabel) ? ` · ${formatVariantLabel(item.variantLabel)}` : ""}
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
                  onClick={() => { setPayMethod(m); if (m !== payMethod) setPayReference(""); }}
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
            <PaymentReferenceInput method={payMethod} value={payReference} onChange={setPayReference} />
            <label className="text-xs text-gray-500 mb-1 block mt-3">{t("orders.advancePaid")}</label>
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

      <ConfirmSheet
        open={showConfirmOrder}
        onClose={() => setShowConfirmOrder(false)}
        title={t("orders.confirmOrderQuestion")}
        closeLabel={t("common.close")}
        confirmLabel={confirmMut.isPending ? t("orders.confirming") : t("orders.confirmOrder")}
        onConfirm={() => confirmMut.mutate()}
        confirmDisabled={confirmMut.isPending}
      />

      <ConfirmSheet
        open={showDeliverConfirm}
        onClose={() => setShowDeliverConfirm(false)}
        title={t("orders.deliverQuestion")}
        note={t("orders.deliverNote")}
        closeLabel={t("common.close")}
        confirmLabel={deliverMut.isPending ? "…" : t("orders.deliver")}
        onConfirm={() => deliverMut.mutate()}
        confirmDisabled={deliverMut.isPending}
        confirmClassName="bg-green-600 text-white"
      />

      <ConfirmSheet
        open={showReturnConfirm}
        onClose={() => setShowReturnConfirm(false)}
        title={t("orders.courierReturnQuestion")}
        note={t("orders.courierReturnNote")}
        closeLabel={t("common.close")}
        confirmLabel={returnMut.isPending ? "…" : "Confirm Return"}
        onConfirm={() => returnMut.mutate()}
        confirmDisabled={returnMut.isPending}
        confirmClassName="bg-amber-500 text-white"
      />

      {/* Cancel is two sheets in sequence — a plain Yes/No first, so an accidental tap doesn't
          fall straight into filling out a cancellation reason. */}
      <ConfirmSheet
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title={t("orders.cancelOrderQuestion")}
        closeLabel={t("common.close")}
        confirmLabel={t("orders.cancel")}
        onConfirm={() => { setShowCancelConfirm(false); setShowCancel(true); }}
        confirmClassName="bg-red-500 text-white"
      />

      <ConfirmSheet
        open={showCancel}
        onClose={() => setShowCancel(false)}
        title={t("orders.cancel")}
        closeLabel={t("common.close")}
        confirmLabel={cancelMut.isPending ? "…" : t("orders.cancel")}
        onConfirm={() => cancelMut.mutate()}
        confirmDisabled={cancelMut.isPending}
        confirmClassName="bg-red-500 text-white"
      >
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
          placeholder={t("orders.cancelReason")}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </ConfirmSheet>

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
            <label className="text-xs text-gray-500 mb-1 block">{t("orders.customerPhone")}</label>
            <input
              type="tel"
              value={editForm.customerPhone}
              onChange={(e) => setEditForm((f) => ({ ...f, customerPhone: e.target.value }))}
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
            <CustomSelect
              value={editForm.courierId}
              onChange={(v) => setEditForm((f) => ({ ...f, courierId: v }))}
              placeholder="— none —"
              options={couriers
                .filter((c) => c.isActive || c.id === editForm.courierId)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
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

      <ConfirmSheet
        open={showDelete}
        onClose={() => { setShowDelete(false); setDeleteReason(""); }}
        title={t("orders.deleteOrderTitle")}
        titleClassName="text-red-600"
        note={t("orders.deleteOrderWarning")}
        closeLabel={t("common.close")}
        confirmLabel={deleteMut.isPending ? t("orders.deleting") : t("orders.confirmDelete")}
        onConfirm={() => deleteMut.mutate()}
        confirmDisabled={deleteMut.isPending || !deleteReason.trim()}
        confirmClassName="bg-red-500 text-white"
      >
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
      </ConfirmSheet>
    </>
  );
}
