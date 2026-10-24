import ProcessGuide, { type ProcessStep } from "../components/ProcessGuide";
import AddCourierPopup from "../components/AddCourierPopup";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, Text as ValueText, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PopupSheet from "../components/PopupSheet";
import { sampleOrders } from "../orders/sampleOrders";

type Item = { isDamagedItem?: boolean; id: string; variantSku: string; productName: string; variantLabel?: string; qty: number; unitPrice?: number; subtotal?: number; unitCostSnapshot?: number; lineProfit?: number; availableStock: number };
type Payment = { id: string; method: string; amount: number; receivedAt: string; recordedByName: string };
type OrderDetail = {
  id: string; orderNo: string; channel: string; customerName: string; customerPhone: string; customerAddress?: string;
  orderStatus: string; paymentStatus: string; fulfillmentStatus: string; isDraft: boolean; createdAt: string; createdByName?: string;
  discountType?: string | null; discountValue?: number | null; subtotal?: number; discountAmount?: number; deliveryChargeCustomer?: number; totalAmount: number; totalPaid?: number; dueAmount: number;
  courierName?: string; trackingNo?: string; deliveryManName?: string; note?: string; confirmedAt?: string; handedOverAt?: string; deliveredAt?: string; returnedAt?: string;
  items: Item[]; payments?: Payment[]; economics?: { revenue: number; cost: number; profit: number };
  courierId?: string; isRevised?: boolean; cancelledReason?: string | null;
};
type Courier = { id: string; name: string; phone?: string; insideDhakaCharge?: number; outsideDhakaCharge?: number; returnCharge?: number; codFeeType?: "PCT" | "FLAT"; codFeeValue?: number; isDefault?: boolean; trackingUrlTemplate?: string; isActive?: boolean };
type DeliveryMan = { id: string; name: string; phone: string; courierId?: string; costPerDelivery?: number; isActive?: boolean };

const cash = (value: number | string | null | undefined = 0) => {
  const amount = Number(value);
  return `৳${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
};
const date = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const label = (value?: string | null) => (value || "Unknown").replaceAll("_", " ");

function Row({ name, value, strong = false, tone }: { name: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return <View style={[s.row, strong && s.strongRow]}><Text style={[s.rowLabel, strong && s.strong]}>{name}</Text><ValueText style={[s.rowValue, strong && s.strong, tone === "good" && s.good, tone === "bad" && s.bad]}>{value}</ValueText></View>;
}
function Card({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "orange" | "green" | "blue" }) {
  return <View style={[s.card, tone === "orange" && s.orangeCard, tone === "green" && s.greenCard, tone === "blue" && s.blueCard]}><Text style={s.cardTitle}>{title}</Text>{children}</View>;
}

export default function OrderDetailScreen() {
  const { t, lang } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "details">("steps");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deliverConfirmOpen, setDeliverConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnConfirm, setReturnConfirm] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnInspections, setReturnInspections] = useState<Record<string, "SELLABLE" | "DAMAGED">>({});
  const [returnResolution, setReturnResolution] = useState("COURIER_RETURN");
  const [returnReason, setReturnReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [returnAmount, setReturnAmount] = useState("");
  const [returnMethod, setReturnMethod] = useState("CASH");
  const openReturn = (resolution: string) => {
    setError(""); setReturnResolution(resolution); setReturnQtys({}); setReturnInspections({});
    setReturnReason(""); setReturnNote(""); setReturnAmount(""); setReturnMethod("CASH"); setReturnConfirm(false); setReturnOpen(true);
  };
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [courierPickerOpen, setCourierPickerOpen] = useState(false);
  const [courierSearch, setCourierSearch] = useState("");
  const courierAnchor = useRef<View>(null);
  const [courierMenu, setCourierMenu] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  useEffect(() => { setCourierPickerOpen(false); }, [viewportWidth, viewportHeight]);
  const openCourierMenu = () => {
    setCourierSearch("");
    courierAnchor.current?.measureInWindow((x, y, width, height) => {
      const below = viewportHeight - y - height - 12;
      const menuHeight = Math.min(280, 56 + Math.max(48, couriers.filter(item => item.isActive).length * 48));
      const above = below < Math.min(menuHeight, 144) && y > below;
      const maxHeight = Math.min(menuHeight, Math.max(48, above ? y - 12 : below));
      setCourierMenu({ left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: above ? y - maxHeight - 4 : y + height + 4, width: Math.min(width, viewportWidth - 16), maxHeight });
      setCourierPickerOpen(true);
    });
  };
  const [addCourierOpen, setAddCourierOpen] = useState(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [handoverCourierId, setHandoverCourierId] = useState("");
  const [deliveryMen, setDeliveryMen] = useState<DeliveryMan[]>([]);
  const [deliveryManId, setDeliveryManId] = useState("");
  const [deliveryManPickerOpen, setDeliveryManPickerOpen] = useState(false);
  const [deliveryManSearch, setDeliveryManSearch] = useState("");
  const deliveryManAnchor = useRef<View>(null);
  const [deliveryManMenu, setDeliveryManMenu] = useState({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const availableDeliveryMen = deliveryMen.filter(item => item.isActive && (!item.courierId || item.courierId === handoverCourierId));
  useEffect(() => { setDeliveryManPickerOpen(false); }, [viewportWidth, viewportHeight, handoverOpen]);
  const filteredCouriers = couriers.filter(item => item.isActive && `${item.name} ${item.phone ?? ""}`.toLowerCase().includes(courierSearch.trim().toLowerCase()));
  const filteredDeliveryMen = availableDeliveryMen.filter(item => `${item.name} ${item.phone ?? ""}`.toLowerCase().includes(deliveryManSearch.trim().toLowerCase()));
  const openDeliveryManMenu = () => {
    setDeliveryManSearch("");
    deliveryManAnchor.current?.measureInWindow((x, y, width, height) => {
      const below = viewportHeight - y - height - 12;
      const menuHeight = Math.min(280, 56 + (availableDeliveryMen.length + 1) * 48);
      const above = below < Math.min(menuHeight, 144) && y > below;
      const maxHeight = Math.min(menuHeight, Math.max(48, above ? y - 12 : below));
      setDeliveryManMenu({ left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: above ? y - maxHeight - 4 : y + height + 4, width: Math.min(width, viewportWidth - 16), maxHeight });
      setDeliveryManPickerOpen(true);
    });
  };
  const [addDeliveryManOpen, setAddDeliveryManOpen] = useState(false);
  const [newDeliveryMan, setNewDeliveryMan] = useState({ name: "", phone: "", cost: "" });
  const [trackingNo, setTrackingNo] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [cancelReason, setCancelReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonOpen, setDeleteReasonOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseQtys, setReviseQtys] = useState<Record<string, number>>({});
  const [reviseReason, setReviseReason] = useState<"OUT_OF_STOCK" | "CUSTOMER_CHANGED_MIND" | "OTHER" | "">("");
  const [reviseNote, setReviseNote] = useState("");
  const [reviseResolution, setReviseResolution] = useState<"REFUND" | "STORE_CREDIT" | "">("");
  const [reviseRefundMethod, setReviseRefundMethod] = useState("CASH");
  const [reviseExcess, setReviseExcess] = useState<number | null>(null);
  const owner = auth.session?.user.role === "OWNER";
  const canMarkDelivered = owner || auth.session?.user.role === "MANAGER";

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true); setError("");
    apiRef.current<OrderDetail>(`/orders/${id}`)
      .then(value => { if (active) setOrder({ ...value, customerName: value.customerName || "Customer", customerPhone: value.customerPhone || "", orderStatus: value.orderStatus || "UNKNOWN", paymentStatus: value.paymentStatus || "UNKNOWN", fulfillmentStatus: value.fulfillmentStatus || "UNKNOWN", channel: value.channel || "UNKNOWN", items: Array.isArray(value.items) ? value.items : [], payments: Array.isArray(value.payments) ? value.payments : [] }); })
      .catch(e => {
        const sample = sampleOrders.find(item => item.id === id);
        if (active && sample) setOrder({ ...sample, createdAt: `${sample.businessDate}T00:00:00`, items: sample.items });
        else if (active) setError((e as Error).message || "Could not load this order.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload, auth.session?.businessId, auth.session?.branchId]);

  const runAction = async (path: string, method: string, body?: unknown, onSuccess?: () => void) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (method === "DELETE") await auth.api(path, { method, body: JSON.stringify(body ?? {}) });
      else await auth.api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      onSuccess?.();
      // The deleted order is no longer readable; its success callback returns to the list.
      if (method !== "DELETE") setReload(value => value + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The action could not be completed.";
      const data = (e as Error & { data?: { code?: string; excessAmount?: number }; body?: { code?: string; excessAmount?: number } });
      const responseData = data.data ?? data.body;
      if (responseData?.code === "ORDER_OVERPAID") setReviseExcess(Number(responseData.excessAmount) || 0);
      setError(message);
    } finally { setBusy(false); }
  };

  const openHandover = async () => {
    setMenuOpen(false); setCourierPickerOpen(false); setTrackingNo(""); setDeliveryCost("0"); setHandoverCourierId(order?.courierId ?? ""); setHandoverOpen(true);
    try {
      const data = await auth.api<Courier[]>("/couriers");
      setCouriers(data);
      const courier = data.find(item => item.id === order?.courierId);
      if (courier?.insideDhakaCharge != null) setDeliveryCost(String(courier.insideDhakaCharge));
      const men = await auth.api<DeliveryMan[]>("/couriers/delivery-men");
      setDeliveryMen(men);
      setDeliveryManId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load couriers."); }
  };

  const createDeliveryMan = async () => {
    if (!newDeliveryMan.name.trim() || !newDeliveryMan.phone.trim()) return;
    if (busy) return;
    setBusy(true); setError("");
    try {
      const created = await auth.api<DeliveryMan>("/couriers/delivery-men", { method: "POST", body: JSON.stringify({
        name: newDeliveryMan.name.trim(), phone: newDeliveryMan.phone.trim(),
        courierId: handoverCourierId || undefined, costPerDelivery: Number.parseFloat(newDeliveryMan.cost) || 0,
      }) });
      setDeliveryMen(previous => [...previous.filter(item=>item.id!==created.id), created]);
      setDeliveryManId(created.id);
      if (created.costPerDelivery != null) setDeliveryCost(String(created.costPerDelivery));
      setNewDeliveryMan({ name: "", phone: "", cost: "" });
      setAddDeliveryManOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add this delivery person."); }
    finally { setBusy(false); }
  };

  const openRevise = () => {
    setMenuOpen(false); setReviseQtys(Object.fromEntries((order?.items ?? []).map(item => [item.id ?? item.variantSku, item.qty])));
    setError(""); setReviseReason(""); setReviseNote(""); setReviseExcess(null); setReviseResolution(""); setReviseOpen(true);
  };

  const cancel = () => {
    setMenuOpen(false);
    setError("");
    setCancelReason("");
    setCancelReasonOpen(true);
  };
  const deleteOrder = () => {
    setMenuOpen(false);
    if (Alert.prompt) Alert.prompt("Delete this order?", "Enter a reason. This permanently removes the order.", reason => {
      if (!reason?.trim()) { setError("A deletion reason is required."); return; }
      void runAction(`/orders/${id}`, "DELETE", { reason: reason.trim() }, () => router.replace("/orders"));
    }, "plain");
    else { setDeleteReason(""); setDeleteReasonOpen(true); }
  };
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false);

  if (loading && !order) return <View style={s.state}><ActivityIndicator size="large" color={colors.primary}/><Text style={s.muted}>Loading order…</Text></View>;
  if (!order) return <View style={s.state}><Ionicons name="alert-circle-outline" size={38} color={colors.danger}/><Text style={s.stateTitle}>Order not found</Text><Text style={s.muted}>{error}</Text><Pressable onPress={() => setReload(v => v + 1)} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>;

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.unitPrice) || 0) * (Number(item.qty) || 0)), 0);
  const returnItems = items.filter(item => !item.isDamagedItem && item.id);
  const selectedReturnItems = returnItems.filter(item => (returnQtys[item.id] ?? 0) > 0);
  const returnPaid = order.totalPaid ?? 0;
  const needsReturnAmount = returnResolution === "REFUND" || returnResolution === "STORE_CREDIT";
  const refundValue = Number(returnAmount || 0);
  const validReturn = selectedReturnItems.length > 0 && selectedReturnItems.every(item => Number.isFinite(returnQtys[item.id]) && returnQtys[item.id] <= item.qty) && (!needsReturnAmount || (returnPaid > 0 && Number.isFinite(refundValue) && refundValue >= 0 && refundValue <= returnPaid));
  const submitReturn = () => {
    if (!validReturn || busy) return;
    void runAction(`/orders/${id}/return`, "POST", {
      items: selectedReturnItems.map(item => ({ orderItemId: item.id, qty: returnQtys[item.id], inspection: returnInspections[item.id] ?? "SELLABLE" })),
      resolutionType: returnResolution, reason: returnReason || undefined, note: returnNote.trim() || undefined,
      refundAmount: needsReturnAmount ? refundValue : undefined, refundMethod: returnResolution === "REFUND" ? returnMethod : undefined,
    }, () => { setReturnOpen(false); setReturnConfirm(false); });
  };
  const terminal = order.orderStatus === "COMPLETED" || order.orderStatus === "CANCELLED";
  const showHandoverAction = !order.isDraft && (order.fulfillmentStatus === "UNFULFILLED" || order.fulfillmentStatus === "PACKED") && order.orderStatus === "OPEN";
  const showConfirmAction = order.isDraft && order.orderStatus !== "CANCELLED";
  const showDeliverAction = order.fulfillmentStatus === "IN_TRANSIT" && order.orderStatus !== "CANCELLED";
  const showReturnAction = order.fulfillmentStatus === "DELIVERED" && order.orderStatus === "OPEN";
  const returned = order.fulfillmentStatus === "RETURNED";
  const cancelled = order.orderStatus === "CANCELLED";
  const orderSteps: ProcessStep[] = [
    {title:lang==="bn"?"অর্ডার তৈরি":"Order placed",description:lang==="bn"?"পণ্য এবং গ্রাহকের তথ্য সংরক্ষণ করা হয়েছে।":"Products and customer details have been recorded.",icon:"cart-outline",done:true,completedAt:date(order.createdAt)},
    {title:lang==="bn"?"অর্ডার নিশ্চিত করুন":"Confirm order",description:lang==="bn"?"নিশ্চিত করার পর পণ্য যোগ বা পরিমাণ বাড়ানো যাবে না। শুধু প্যাক করার আগে পরিমাণ কমানো বা পণ্য সরানো যাবে।":"After confirmation, you cannot add products or increase quantities. You can only reduce quantities or remove products before packing.",icon:"checkmark-circle-outline",done:!!order.confirmedAt || (!order.isDraft&&!cancelled),completedAt:order.confirmedAt?date(order.confirmedAt):undefined,action:showConfirmAction&&!returned?{label:lang==="bn"?"অর্ডার নিশ্চিত করুন":"Confirm Order",onPress:()=>setConfirmOpen(true),disabled:busy}:undefined},
    {title:lang==="bn"?"কুরিয়ারে হস্তান্তর করুন":"Handover to courier",description:lang==="bn"?"কুরিয়ার নির্বাচন করুন এবং ডেলিভারির তথ্য দিয়ে পণ্য হস্তান্তর করুন।":"Select the courier, enter delivery details and hand over the products.",icon:"cube-outline",done:!!order.handedOverAt||["IN_TRANSIT","DELIVERED","RETURNED"].includes(order.fulfillmentStatus),completedAt:order.handedOverAt?date(order.handedOverAt):undefined,action:showHandoverAction&&!returned?{label:lang==="bn"?"কুরিয়ারে হস্তান্তর করুন":"Handover to Courier",onPress:()=>void openHandover(),disabled:busy}:undefined},
    {title:lang==="bn"?"ডেলিভারি সম্পন্ন করুন":"Complete delivery",description:returned?(lang==="bn"?"পণ্য ফেরত এসেছে। এটি সফল ডেলিভারি হিসেবে গণ্য নয়।":"The products were returned. This is not a successful delivery."):(lang==="bn"?"গ্রাহক পণ্য বুঝে পেলে ডেলিভারি সম্পন্ন হিসেবে চিহ্নিত করুন।":"Mark the order delivered after the customer receives the products."),icon:"flag-outline",done:!returned&&!cancelled&&order.fulfillmentStatus==="DELIVERED",completedAt:order.deliveredAt?date(order.deliveredAt):undefined,action:showDeliverAction?{label:lang==="bn"?"ডেলিভারি সম্পন্ন করুন":"Mark Delivered",onPress:()=>{setError("");setDeliverConfirmOpen(true);},disabled:busy||!canMarkDelivered}:undefined},
  ];
  const revisedSubtotal = items.reduce((sum, item) => sum + (reviseQtys[item.id ?? item.variantSku] ?? item.qty) * (item.unitPrice ?? 0), 0);
  const discountCents = revisedSubtotal * (order.discountValue ?? 0);
  const roundedDiscountCents = Math.abs(discountCents - Math.floor(discountCents) - 0.5) < 1e-8
    ? Math.floor(discountCents) + (Math.floor(discountCents) % 2)
    : Math.round(discountCents);
  const revisedDiscount = order.discountType == null || order.discountValue == null ? 0
    : order.discountType === "PERCENT" ? roundedDiscountCents / 100 : order.discountValue;
  const revisedTotal = revisedSubtotal - revisedDiscount + (order.deliveryChargeCustomer ?? 0);
  const hasRemainingItems = items.some(item => (reviseQtys[item.id ?? item.variantSku] ?? item.qty) > 0);
  const hasReducedItems = items.some(item => (reviseQtys[item.id ?? item.variantSku] ?? item.qty) < item.qty);
  const submitRevise = async () => {
    if (!hasRemainingItems) { setError("An order must retain at least one item. Cancel the order instead."); return; }
    const revised = items.filter(item => (reviseQtys[item.id ?? item.variantSku] ?? item.qty) < item.qty)
      .map(item => ({ orderItemId: item.id, newQty: reviseQtys[item.id ?? item.variantSku] ?? 0 }));
    const payload = { items: revised, reason: reviseReason, note: reviseNote.trim() || undefined,
      resolutionType: reviseExcess != null ? reviseResolution || undefined : undefined,
      refundMethod: reviseExcess != null && reviseResolution === "REFUND" ? reviseRefundMethod : undefined };
    await runAction(`/orders/${id}/revise`, "POST", payload, () => { setReviseOpen(false); setReviseExcess(null); });
  };

  return <View style={s.screen}>
    <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.heading}/></Pressable><View style={s.flex}><Text style={s.headerTitle}>Order Details</Text><ValueText style={s.orderNo}>{order.orderNo}</ValueText></View><View style={s.status}><ValueText style={s.statusText}>{order.orderStatus === "CANCELLED" ? "CANCELLED" : label(order.fulfillmentStatus)}</ValueText></View>{!terminal && <Pressable accessibilityLabel="More order actions" onPress={() => setMenuOpen(true)} style={s.more}><Ionicons name="ellipsis-vertical" size={20} color={colors.heading}/></Pressable>}</View>
    <View style={{flexDirection:"row",gap:8,paddingHorizontal:16,paddingVertical:10,backgroundColor:colors.white}}>{(["steps","details"] as const).map(tab=><Pressable key={tab} accessibilityRole="tab" accessibilityState={{selected:activeTab===tab}} onPress={()=>setActiveTab(tab)} style={{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:8,backgroundColor:activeTab===tab?colors.primaryLight:colors.disabled}}><Ionicons name={tab==="steps"?"map-outline":"document-text-outline"} size={17} color={activeTab===tab?colors.primaryDark:colors.secondary}/><Text style={{fontSize:13,fontWeight:"600",color:activeTab===tab?colors.primaryDark:colors.secondary}}>{tab==="steps"?(lang==="bn"?"অর্ডারের ধাপ":"Order Steps"):(lang==="bn"?"বিস্তারিত":"Details")}</Text></Pressable>)}</View>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)} colors={[colors.primary]}/>} contentContainerStyle={s.content}>
      {order.orderStatus === "CANCELLED" ? <View accessibilityRole="alert" style={s.cancelledBanner}><View style={{flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name="close-circle" size={22} color={colors.dangerText}/><Text style={s.cancelledTitle}>Order cancelled</Text></View><Text style={s.muted}>This order has been cancelled and will not be fulfilled.</Text>{!!order.cancelledReason&&<ValueText style={s.muted}>{order.cancelledReason}</ValueText>}</View> : activeTab === "steps" && <><Pressable accessibilityRole="button" accessibilityLabel={lang==="bn"?"অর্ডারের বিস্তারিত দেখুন":"View order details"} onPress={()=>setActiveTab("details")} style={{flexDirection:"row",alignItems:"center",gap:10,padding:12,borderWidth:1,borderColor:colors.border,borderRadius:10,backgroundColor:colors.cardSecondary}}><View style={{flex:1,minWidth:0,gap:4}}><Text style={{fontSize:13,fontWeight:"600",color:colors.heading}}>{order.customerName || "Customer"}</Text><Text style={s.muted}>{items.length} {lang==="bn"?"পণ্য":"products"} · {items.reduce((sum,item)=>sum+item.qty,0)} {lang==="bn"?"পিস":"pieces"} · {lang==="bn"?"মোট":"Total"} {cash(order.totalAmount)}</Text><Text style={s.muted}>{lang==="bn"?"বাকি":"Due"}: {cash(order.dueAmount)}</Text></View><View style={{alignItems:"flex-end",gap:4}}><Ionicons name="chevron-forward" size={18} color={colors.primaryDark}/><Text style={{fontSize:11,color:colors.primaryDark}}>{lang==="bn"?"বিস্তারিত":"Details"}</Text></View></Pressable><ProcessGuide title={lang==="bn"?"অর্ডারের ধাপ":"Order Steps"} steps={orderSteps} notice={returned?(lang==="bn"?"অর্ডার ফেরত এসেছে।":"Order returned."):undefined}/></>}

      {activeTab === "details" && <>
      <Card title="ORDER INFORMATION"><Row name="Order number" value={order.orderNo}/><Row name="Order date" value={date(order.createdAt)}/><Row name="Channel" value={label(order.channel)}/><Row name="Payment" value={label(order.paymentStatus)}/>{order.createdByName && <Row name="Created by" value={order.createdByName}/>}</Card>

      <Card title={`${t("orderDetailLabels.products")} (${items.length})`} tone="blue">{items.map((item, index) => <View key={item.id ?? `${item.variantSku}-${index}`} style={[s.product, index > 0 && s.productDivider]}><View style={s.productIcon}><Ionicons name="cube-outline" size={21} color={colors.primaryDark}/></View><View style={s.flex}><ValueText style={s.productName}>{item.productName || "Product"}</ValueText><ValueText style={s.muted}>{item.variantLabel || item.variantSku || "—"} · {t("orderDetailLabels.quantity")}: {item.qty ?? 0} · {t("orderDetailLabels.stock")}: {item.availableStock ?? 0}</ValueText>{item.unitCostSnapshot != null && <ValueText style={s.cost}>{t("orderDetailLabels.unitCost")}: {cash(item.unitCostSnapshot)}{item.lineProfit != null ? `  ·  ${t("orderDetailLabels.profit")}: ${cash(item.lineProfit)}` : ""}</ValueText>}</View><ValueText style={s.productPrice}>{cash(item.subtotal ?? (item.unitPrice ?? 0) * item.qty)}</ValueText></View>)}</Card>

      <Card title="PAYMENT SUMMARY"><Row name="Subtotal" value={cash(subtotal)}/>{!!order.discountAmount && <Row name="Discount" value={`-${cash(order.discountAmount)}`}/>}{!!order.deliveryChargeCustomer && <Row name="Delivery charge" value={cash(order.deliveryChargeCustomer)}/>}<Row name="Total" value={cash(order.totalAmount)} strong/><Row name="Paid" value={cash(order.totalPaid ?? order.totalAmount - order.dueAmount)} tone="good"/><Row name="Amount due" value={cash(order.dueAmount)} tone={order.dueAmount > 0 ? "bad" : "good"}/></Card>

      <Card title="CUSTOMER"><View style={s.customer}><View style={s.avatar}><ValueText style={s.avatarText}>{(order.customerName || "C").charAt(0).toUpperCase()}</ValueText></View><View style={s.flex}><ValueText style={s.customerName}>{order.customerName || "Customer"}</ValueText><ValueText style={s.customerLine}>{order.customerPhone || "—"}</ValueText>{order.customerAddress && <ValueText style={s.customerLine}>{order.customerAddress}</ValueText>}</View></View></Card>

      {(order.courierName || order.trackingNo || order.deliveryManName) && <Card title="DELIVERY"><Row name="Courier" value={order.courierName ?? "—"}/>{order.trackingNo && <Row name="Tracking number" value={order.trackingNo}/>}{order.deliveryManName && <Row name="Delivery person" value={order.deliveryManName}/>}</Card>}

      {order.economics && <Card title="PRODUCT P&L" tone="green"><Row name="Sale" value={cash(order.economics.revenue)}/><Row name="Product cost" value={cash(order.economics.cost)}/><Row name="Profit" value={`${order.economics.profit >= 0 ? "+" : ""}${cash(order.economics.profit)}`} strong tone={order.economics.profit >= 0 ? "good" : "bad"}/>{order.paymentStatus !== "PAID" && <Text style={s.warning}>Profit is provisional until payment is received.</Text>}</Card>}
      {order.note && <Card title="ORDER NOTE"><ValueText style={s.note}>{order.note}</ValueText></Card>}
      </>}
      {!!error && <Text style={s.inlineError}>{error}</Text>}
    </ScrollView>
    {((showConfirmAction && activeTab === "details") || (showHandoverAction && activeTab === "details") || showDeliverAction || showReturnAction) && <View style={s.actionBar}>
      {showConfirmAction && activeTab === "details" && <Pressable disabled={busy} onPress={() => setConfirmOpen(true)} style={s.primary}><Text style={s.primaryText}>{busy ? "…" : "Confirm Order"}</Text></Pressable>}
      {showHandoverAction && activeTab === "details" && <Pressable disabled={busy} onPress={() => void openHandover()} style={s.primary}><Text style={s.primaryText}>{busy ? "…" : "Handover to Courier"}</Text></Pressable>}
      {showDeliverAction && <View style={{ gap: 8 }}>
        <View style={s.actionRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !canMarkDelivered }} disabled={busy || !canMarkDelivered} onPress={()=>{setError("");setDeliverConfirmOpen(true)}} style={[s.primary,s.actionHalf,(busy || !canMarkDelivered)&&s.unavailableAction]}><Text style={s.primaryText}>{busy ? "Updating…" : "Mark Delivered"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={()=>openReturn("COURIER_RETURN")} style={[s.secondaryAction,s.actionHalf,busy&&s.unavailableAction]}><Text style={s.secondaryText}>Courier Return</Text></Pressable>
        </View>
        {!canMarkDelivered && <Text style={s.muted}>Only an owner or manager can mark an order delivered.</Text>}
      </View>}
      {showReturnAction && <Pressable disabled={busy} onPress={() => openReturn("REFUND")} style={s.secondaryAction}><Text style={s.secondaryText}>Return / Refund</Text></Pressable>}
    </View>}

    <PopupSheet fitContent visible={confirmOpen} onClose={() => { if (!busy) setConfirmOpen(false); }} title="Confirm this order?">
      <View style={s.sheetContent}>
        {!!error && <Text accessibilityRole="alert" style={s.inlineError}>{error}</Text>}
        <View style={{flexDirection:"row",gap:8}}>
        <Pressable accessibilityRole="button" disabled={busy} style={[s.primary,{flex:1,minWidth:0,paddingHorizontal:8}]} onPress={() => void runAction(`/orders/${id}/confirm`, "POST", undefined, () => setConfirmOpen(false))}>
          <Text style={s.primaryText}>{busy ? "Confirming…" : "Confirm Order"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={[s.secondaryAction,{flex:1,minWidth:0,paddingHorizontal:8}]} onPress={() => setConfirmOpen(false)}><Text style={s.secondaryText}>Cancel</Text></Pressable>
        </View>
      </View>
    </PopupSheet>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><Pressable style={s.menuBackdrop} onPress={() => setMenuOpen(false)}><View style={s.menuCard}><Text style={s.menuTitle}>Order actions</Text>{!terminal && order.fulfillmentStatus === "UNFULFILLED" && <Pressable style={s.menuAction} onPress={openRevise}><Ionicons name="create-outline" size={19} color={colors.heading}/><Text style={s.menuText}>Revise Order</Text></Pressable>}{!terminal && <Pressable style={s.menuAction} onPress={cancel}><Ionicons name="close-circle-outline" size={19} color={colors.danger}/><Text style={s.menuDanger}>Cancel Order</Text></Pressable>}{owner && !terminal && <Pressable style={s.menuAction} onPress={deleteOrder}><Ionicons name="trash-outline" size={19} color={colors.danger}/><Text style={s.menuDanger}>Delete Order</Text></Pressable>}</View></Pressable></Modal>

    <PopupSheet visible={returnOpen} onClose={()=>{if(!busy)setReturnOpen(false)}} title="Return / Refund">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>
        {returnConfirm ? <>
          <Text style={s.cardTitle}>Confirm return</Text>
          <Text style={s.rowLabel}>Resolution: {label(returnResolution)}</Text>
          {selectedReturnItems.map(item=><Text key={item.id} style={s.rowLabel}>{item.productName}: {returnQtys[item.id]} · {label(returnInspections[item.id] ?? "SELLABLE")}</Text>)}
          {needsReturnAmount && <Text style={s.rowLabel}>Amount: {cash(refundValue)}</Text>}
          <Text style={s.rowLabel}>Confirm to record this return and adjust stock according to each item's condition.</Text>
        </> : <>
          <Text style={s.fieldLabel}>Why is it coming back?</Text>
          <View style={s.returnChoices}>{[["DEFECTIVE","Defective / broken"],["WRONG_SIZE_COLOR","Wrong size / color"],["CHANGED_MIND","Changed mind"],["DAMAGED_DELIVERY","Damaged in delivery"],["OTHER","Other"]].map(([value,title])=><Pressable key={value} onPress={()=>setReturnReason(value)} style={[s.returnChoice,returnReason===value&&s.returnChoiceOn]}><Text style={s.selectText}>{title}</Text></Pressable>)}</View>
          <Text style={s.fieldLabel}>Resolution</Text>
          <View style={s.returnChoices}>{[["COURIER_RETURN","Courier returned"],["REFUND","Refund to customer"],["STORE_CREDIT","Store credit"],["REPLACE_SAME","Replace same item"],["EXCHANGE_DIFFERENT","Exchange"]].map(([value,title])=>{const disabled=(value==="REFUND"||value==="STORE_CREDIT")&&returnPaid<=0;return <Pressable key={value} disabled={disabled} onPress={()=>setReturnResolution(value)} style={[s.returnChoice,returnResolution===value&&s.returnChoiceOn,disabled&&s.unavailableAction]}><Text style={s.selectText}>{title}{disabled?" (no payment collected)":""}</Text></Pressable>})}</View>
          <Text style={s.fieldLabel}>Items returning</Text>
          {returnItems.map(item=><View key={item.id} style={s.card}>
            <Text style={s.productName}>{item.productName}</Text><Text style={s.muted}>Ordered: {item.qty} · {item.variantLabel || item.variantSku}</Text>
            <View style={s.actionRow}><Pressable accessibilityLabel={`Reduce return quantity for ${item.productName}`} onPress={()=>setReturnQtys(v=>({...v,[item.id]:Math.max(0,(v[item.id]??0)-1)}))} style={s.returnChoice}><Text>−</Text></Pressable><Text style={s.returnQuantity}>{returnQtys[item.id]??0}</Text><Pressable accessibilityLabel={`Increase return quantity for ${item.productName}`} onPress={()=>setReturnQtys(v=>({...v,[item.id]:Math.min(item.qty,(v[item.id]??0)+1)}))} style={s.returnChoice}><Text>+</Text></Pressable></View>
            {(returnQtys[item.id]??0)>0&&<View style={s.actionRow}>{(["SELLABLE","DAMAGED"] as const).map(value=><Pressable key={value} onPress={()=>setReturnInspections(v=>({...v,[item.id]:value}))} style={[s.returnChoice,(returnInspections[item.id]??"SELLABLE")===value&&s.returnChoiceOn]}><Text style={s.selectText}>{value==="SELLABLE"?"Back to stock":"Damaged"}</Text></Pressable>)}</View>}
          </View>)}
          {needsReturnAmount&&<><Text style={s.fieldLabel}>Amount (maximum {cash(returnPaid)})</Text><TextInput accessibilityLabel="Refund or credit amount" value={returnAmount} onChangeText={setReturnAmount} keyboardType="decimal-pad" placeholder="0" style={s.input}/>{returnResolution==="REFUND"&&<View style={s.actionRow}>{["CASH","BKASH","NAGAD"].map(value=><Pressable key={value} onPress={()=>setReturnMethod(value)} style={[s.returnChoice,returnMethod===value&&s.returnChoiceOn]}><Text style={s.selectText}>{value}</Text></Pressable>)}</View>}</>}
          {(returnResolution==="REPLACE_SAME"||returnResolution==="EXCHANGE_DIFFERENT")&&<Text style={s.rowLabel}>After recording the return, create a new order for the replacement or exchanged items.</Text>}
          <TextInput value={returnNote} onChangeText={setReturnNote} placeholder="Reason / customer complaint (optional)" multiline style={s.input}/>
        </>}
        {!!error&&<Text style={s.inlineError}>{error}</Text>}
        {returnConfirm&&<Pressable disabled={busy} onPress={()=>setReturnConfirm(false)} style={s.secondaryAction}><Text style={s.secondaryText}>No, go back</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityState={{disabled:busy||!validReturn}} disabled={busy||!validReturn} onPress={()=>returnConfirm?submitReturn():setReturnConfirm(true)} style={[s.primary,(busy||!validReturn)&&s.unavailableAction]}><Text style={s.primaryText}>{busy?"Saving…":returnConfirm?"Yes, confirm order return":"Review Return"}</Text></Pressable>
      </ScrollView>
    </PopupSheet>

    <PopupSheet visible={deliverConfirmOpen} onClose={()=>{if(!busy)setDeliverConfirmOpen(false)}} title="Mark Delivered">
      <View style={s.sheetContent}>
        <Text style={s.rowLabel}>Confirm that the customer received this order. This will mark the order completed.</Text>
        {!!error && <Text style={s.inlineError}>{error}</Text>}
        <View style={s.actionRow}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setDeliverConfirmOpen(false)} style={[s.secondaryAction,s.actionHalf,busy&&s.unavailableAction]}><Text style={s.secondaryText}>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !canMarkDelivered }} disabled={busy || !canMarkDelivered} onPress={()=>void runAction(`/orders/${id}/delivered`, "POST", undefined, ()=>setDeliverConfirmOpen(false))} style={[s.primary,s.actionHalf,(busy || !canMarkDelivered)&&s.unavailableAction]}><Text style={s.primaryText}>{busy ? "Updating…" : "Mark Delivered"}</Text></Pressable>
        </View>
      </View>
    </PopupSheet>

    <PopupSheet fitContent visible={handoverOpen} onClose={()=>setHandoverOpen(false)} title="Handover to Courier" headerAction={<Pressable onPress={()=>setAddCourierOpen(true)} style={s.addCourier}><Ionicons name="add" size={16} color={colors.primaryDark}/><Text style={s.addCourierText}>Add Courier</Text></Pressable>}><ScrollView style={{flexGrow:0,flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.sheetContent,{paddingBottom:10}]}><Text style={s.fieldLabel}>Courier *</Text><View ref={courierAnchor} collapsable={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Courier service" accessibilityState={{ expanded: courierPickerOpen }} onPress={openCourierMenu} style={s.selectButton}>
          <Text numberOfLines={1} style={[s.selectText,handoverCourierId&&s.selectedCourier]}>{couriers.find(item=>item.id===handoverCourierId)?.name || "Select courier service"}</Text>
          <Ionicons name={courierPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.muted}/>
        </Pressable>
        <Modal visible={courierPickerOpen && handoverOpen} transparent animationType="none" onRequestClose={()=>setCourierPickerOpen(false)}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close courier list" style={StyleSheet.absoluteFill} onPress={()=>setCourierPickerOpen(false)}/>
            <View style={[s.courierFloatingMenu, courierMenu]}>
              <View style={s.dropdownSearchRow}>
                <Ionicons name="search" size={17} color={colors.muted}/>
                <TextInput accessibilityLabel="Search couriers" placeholder="Search by name or phone" value={courierSearch} onChangeText={setCourierSearch} autoCapitalize="none" autoCorrect={false} style={s.dropdownSearchInput}/>
                {!!courierSearch && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setCourierSearch("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted}/></Pressable>}
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={[s.courierDropdown, { maxHeight: Math.max(0, courierMenu.maxHeight - 56) }]}>
          {filteredCouriers.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: handoverCourierId===item.id }} onPress={()=>{setHandoverCourierId(item.id);setDeliveryCost(String(item.insideDhakaCharge??0));setCourierPickerOpen(false)}} style={s.courierDropdownOption}>
            <Text style={[s.courierDropdownText, handoverCourierId===item.id && s.selectedCourier]}>{item.name}</Text>
            {handoverCourierId===item.id&&<Ionicons name="checkmark" size={18} color={colors.primary}/>}
          </Pressable>)}
                {filteredCouriers.length===0 && <Text style={s.dropdownEmpty}>No matching couriers.</Text>}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
      {couriers.filter(item=>item.isActive).length===0&&<Text style={s.noCourier}>No active couriers are available. Add a courier to continue.</Text>}<Text style={s.fieldLabel}>Tracking Number *</Text><TextInput value={trackingNo} onChangeText={setTrackingNo} style={s.input} placeholder="Enter tracking number"/><View style={s.sectionHeader}><Text style={s.fieldLabel}>Delivery Man <Text style={s.optional}>(optional)</Text></Text><Pressable onPress={()=>setAddDeliveryManOpen(true)}><Text style={s.addDeliveryMan}>Add Delivery Man</Text></Pressable></View><View ref={deliveryManAnchor} collapsable={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Delivery man" accessibilityState={{ expanded: deliveryManPickerOpen }} onPress={openDeliveryManMenu} style={s.selectButton}>
          <Text numberOfLines={1} style={[s.selectText, !!deliveryManId && s.selectedCourier]}>{deliveryMen.find(item=>item.id===deliveryManId)?.name || "— none —"}</Text>
          <Ionicons name={deliveryManPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.muted}/>
        </Pressable>
        <Modal visible={deliveryManPickerOpen && handoverOpen} transparent animationType="none" onRequestClose={()=>setDeliveryManPickerOpen(false)}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close delivery man list" style={StyleSheet.absoluteFill} onPress={()=>setDeliveryManPickerOpen(false)}/>
            <View style={[s.courierFloatingMenu, deliveryManMenu]}>
              <View style={s.dropdownSearchRow}>
                <Ionicons name="search" size={17} color={colors.muted}/>
                <TextInput accessibilityLabel="Search delivery men" placeholder="Search by name or phone" value={deliveryManSearch} onChangeText={setDeliveryManSearch} autoCapitalize="none" autoCorrect={false} style={s.dropdownSearchInput}/>
                {!!deliveryManSearch && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={()=>setDeliveryManSearch("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted}/></Pressable>}
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={[s.courierDropdown, { maxHeight: Math.max(0, deliveryManMenu.maxHeight - 56) }]}>
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !deliveryManId }} onPress={()=>{setDeliveryManId("");setDeliveryManPickerOpen(false)}} style={s.courierDropdownOption}>
                  <Text style={[s.courierDropdownText, !deliveryManId && s.selectedCourier]}>— none —</Text>
                  {!deliveryManId && <Ionicons name="checkmark" size={18} color={colors.primary}/>}
                </Pressable>
                {filteredDeliveryMen.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: deliveryManId===item.id }} onPress={()=>{setDeliveryManId(item.id);if(item.costPerDelivery!=null)setDeliveryCost(String(item.costPerDelivery));setDeliveryManPickerOpen(false)}} style={s.courierDropdownOption}>
                  <View style={s.flex}><Text style={[s.courierDropdownText, deliveryManId===item.id && s.selectedCourier]}>{item.name}</Text><Text style={s.muted}>{item.phone}</Text></View>
                  {deliveryManId===item.id && <Ionicons name="checkmark" size={18} color={colors.primary}/>}
                </Pressable>)}
                {filteredDeliveryMen.length===0 && <Text style={s.dropdownEmpty}>No matching delivery men.</Text>}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View><Text style={s.fieldLabel}>Actual Delivery Cost</Text><TextInput value={deliveryCost} onChangeText={setDeliveryCost} keyboardType="decimal-pad" style={s.input}/>{!!error && <Text style={s.inlineError}>{error}</Text>}</ScrollView><View style={s.sheetFooter}><Pressable disabled={busy || !handoverCourierId || !trackingNo.trim()} onPress={() => void runAction(`/orders/${id}/handover`, "POST", { courierId: handoverCourierId, trackingNo: trackingNo.trim(), deliveryManId: deliveryManId || undefined, deliveryCostActual: Number.parseFloat(deliveryCost) || 0 }, () => setHandoverOpen(false))} style={[s.primary,s.fullWidth,(busy || !handoverCourierId || !trackingNo.trim()) && s.disabled]}><Text style={s.primaryText}>{busy ? "Handing over…" : "Handover to Courier"}</Text></Pressable></View></PopupSheet>


    <AddCourierPopup visible={addCourierOpen} onClose={()=>setAddCourierOpen(false)} onCreated={created=>{setCouriers(previous=>[created,...previous.filter(item=>item.id!==created.id)]);setHandoverCourierId(created.id);setDeliveryCost(String(created.insideDhakaCharge??0));setCourierPickerOpen(false);}} />


    <PopupSheet fitContent visible={addDeliveryManOpen} onClose={()=>setAddDeliveryManOpen(false)} title="Add Delivery Man"><ScrollView style={{flexGrow:0,flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}><TextInput value={newDeliveryMan.name} onChangeText={value=>setNewDeliveryMan(form=>({...form,name:value}))} placeholder="Delivery man's name" style={s.input}/><TextInput value={newDeliveryMan.phone} onChangeText={value=>setNewDeliveryMan(form=>({...form,phone:value}))} keyboardType="phone-pad" placeholder="Phone number" style={s.input}/><TextInput value={newDeliveryMan.cost} onChangeText={value=>setNewDeliveryMan(form=>({...form,cost:value}))} keyboardType="decimal-pad" placeholder="Cost per delivery (optional)" style={s.input}/><Pressable disabled={busy||!newDeliveryMan.name.trim()||!newDeliveryMan.phone.trim()} onPress={()=>void createDeliveryMan()} style={[s.primary,s.fullWidth,(busy||!newDeliveryMan.name.trim()||!newDeliveryMan.phone.trim())&&s.disabled]}><Text style={s.primaryText}>{busy?"Saving…":"Save Delivery Man"}</Text></Pressable></ScrollView></PopupSheet>

    <PopupSheet visible={reviseOpen} onClose={() => { if (!busy) setReviseOpen(false); }} title="Revise Order"><ScrollView style={s.reviseScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>{reviseExcess == null ? <>{items.map((item,index) => { const key=item.id ?? item.variantSku; const qty=reviseQtys[key] ?? item.qty; return <View key={key} style={s.reviseItem}><View style={s.flex}><Text style={s.productName}>{item.productName}</Text><Text style={s.muted}>Ordered: {item.qty} · ৳{item.unitPrice}/pc</Text></View><Pressable disabled={busy || qty<=0} onPress={()=>setReviseQtys(value=>({...value,[key]:Math.max(0,qty-1)}))} style={s.qtyButton}><Text>−</Text></Pressable><Text style={s.qtyValue}>{qty}</Text><Pressable disabled={busy || qty>=item.qty} onPress={()=>setReviseQtys(value=>({...value,[key]:Math.min(item.qty,qty+1)}))} style={s.qtyButton}><Text>+</Text></Pressable></View>})}<Text style={s.totalLine}>Revised Total  {cash(revisedTotal)}</Text><Text style={s.fieldLabel}>Why is this being changed? *</Text>{([["OUT_OF_STOCK","Product not available"],["CUSTOMER_CHANGED_MIND","Customer changed mind"],["OTHER","Other"]] as const).map(([value,title])=><Pressable key={value} onPress={()=>setReviseReason(value)} style={[s.choice,reviseReason===value&&s.choiceOn]}><Text style={reviseReason===value?s.choiceTextOn:s.choiceText}>{title}</Text></Pressable>)}{reviseReason==="OTHER"&&<TextInput value={reviseNote} onChangeText={setReviseNote} placeholder="Explain why (required)" multiline style={[s.input,s.multiline]}/>}</>:<><Text style={s.inlineError}>Customer already paid {cash(reviseExcess)} more than the revised total. Choose a resolution.</Text>{(["REFUND","STORE_CREDIT"] as const).map(value=><Pressable key={value} onPress={()=>setReviseResolution(value)} style={[s.choice,reviseResolution===value&&s.choiceOn]}><Text style={reviseResolution===value?s.choiceTextOn:s.choiceText}>{value === "REFUND" ? "Refund" : "Store Credit"}</Text></Pressable>)}{reviseResolution==="REFUND"&&<TextInput value={reviseRefundMethod} onChangeText={setReviseRefundMethod} style={s.input} placeholder="Refund method"/>}</>}{!hasRemainingItems && <Text accessibilityRole="alert" style={s.inlineError}>An order must retain at least one item. Cancel the order instead.</Text>}{!!error && <Text accessibilityRole="alert" style={s.inlineError}>{error}</Text>}</ScrollView><View style={s.reviseFooter}><Pressable disabled={busy || (reviseExcess == null ? !reviseReason || (reviseReason==="OTHER"&&!reviseNote.trim()) || !hasReducedItems || !hasRemainingItems : !reviseResolution || (reviseResolution==="REFUND"&&!reviseRefundMethod.trim()))} onPress={()=>void submitRevise()} style={[s.primary,(busy || (reviseExcess == null ? !reviseReason || (reviseReason==="OTHER"&&!reviseNote.trim()) || !hasReducedItems || !hasRemainingItems : !reviseResolution || (reviseResolution==="REFUND"&&!reviseRefundMethod.trim())))&&s.disabled]}><Text style={s.primaryText}>{busy ? "Saving…" : reviseExcess == null ? "Save Revision" : "Confirm & Save"}</Text></Pressable></View></PopupSheet>

    <Modal visible={cancelReasonOpen} transparent animationType="fade" onRequestClose={()=>{if(!busy)setCancelReasonOpen(false)}}><View style={s.sheetBackdrop}><View style={s.confirmCard}><Text style={s.sheetTitle}>Cancel Order</Text><Text style={s.muted}>Cancel this order and release its reserved stock? The order will remain in your history.</Text><TextInput editable={!busy} value={cancelReason} onChangeText={setCancelReason} placeholder="Reason for cancellation (required)" multiline style={[s.input,s.multiline]}/>{!!error&&<Text accessibilityRole="alert" style={s.inlineError}>{error}</Text>}<View style={s.actionRow}><Pressable accessibilityRole="button" disabled={busy} style={[s.secondaryAction,s.actionHalf]} onPress={()=>setCancelReasonOpen(false)}><Text style={s.secondaryText}>Keep order</Text></Pressable><Pressable accessibilityRole="button" disabled={busy || !cancelReason.trim()} style={[s.dangerAction,s.actionHalf,(busy || !cancelReason.trim())&&s.disabled]} onPress={()=>void runAction(`/orders/${id}/cancel`,"POST",{reason:cancelReason.trim()},()=>{setOrder(current=>current?{...current,orderStatus:"CANCELLED",cancelledReason:cancelReason}:current);setCancelReasonOpen(false)})}><Text style={s.primaryText}>{busy?"Cancelling…":"Cancel Order"}</Text></Pressable></View></View></View></Modal>
    <Modal visible={deleteReasonOpen} transparent animationType="fade" onRequestClose={()=>setDeleteReasonOpen(false)}><View style={s.sheetBackdrop}><View style={[s.confirmCard,{maxHeight:"90%"}]}><Text style={s.sheetTitle}>Delete this order?</Text><ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:10}}>
<View style={s.deleteDetails}>
<View style={s.deleteDetailGroup}><Text style={s.deleteDetailLabel}>Selected order</Text><ValueText style={s.deleteOrderNumber}>{order.orderNo}</ValueText></View>
<View style={s.deleteDetailGroup}><Text style={s.deleteDetailLabel}>Product names</Text>{items.map(item=><ValueText key={item.id ?? item.variantSku} style={s.deleteDetailText}>{item.productName} · {item.qty}</ValueText>)}</View>
<View style={s.deleteDetailGroup}><Text style={s.deleteDetailLabel}>Customer information</Text><ValueText style={[s.deleteDetailText,{fontWeight:"600"}]}>{order.customerName}</ValueText>{!!order.customerPhone&&<ValueText style={s.deleteDetailText}>{order.customerPhone}</ValueText>}{!!order.customerAddress&&<ValueText style={s.deleteDetailText}>{order.customerAddress}</ValueText>}</View>
</View><Text style={s.muted}>The order will be removed from your order list and reserved stock will be released. You cannot undo this from the app.</Text><TextInput value={deleteReason} onChangeText={setDeleteReason} placeholder="Reason for deletion (required)" multiline style={[s.input,s.multiline]}/>{!!error&&<Text accessibilityRole="alert" style={s.inlineError}>{error}</Text>}</ScrollView><View style={s.actionRow}><Pressable style={[s.secondaryAction,s.actionHalf]} onPress={()=>setDeleteReasonOpen(false)}><Text style={s.secondaryText}>No, Keep Order</Text></Pressable><Pressable disabled={busy || !deleteReason.trim()} style={[s.dangerAction,s.actionHalf,(busy || !deleteReason.trim())&&s.disabled]} onPress={()=>void runAction(`/orders/${id}`,"DELETE",{reason:deleteReason.trim()},()=>{setDeleteReasonOpen(false);router.replace("/orders")})}><Text style={s.primaryText}>{busy?"Deleting…":"Yes, Delete Order"}</Text></Pressable></View></View></View></Modal>
  </View>;
}

const s = StyleSheet.create({
  cancelledBanner:{gap:6,padding:14,borderRadius:12,backgroundColor:colors.dangerBackground,borderWidth:1,borderColor:colors.danger},
  cancelledTitle:{fontSize:16,fontWeight:"700",color:colors.dangerText},
  deleteDetails:{gap:10,padding:12,borderRadius:10,backgroundColor:colors.background},
  deleteDetailGroup:{gap:2},
  deleteDetailLabel:{fontSize:11,lineHeight:16,fontWeight:"600",color:colors.secondary},
  deleteOrderNumber:{fontSize:15,lineHeight:20,fontWeight:"700",color:colors.heading},
  deleteDetailText:{fontSize:13,lineHeight:18,color:colors.heading},
  reviseScroll:{flex:1,minHeight:0},
  reviseFooter:{flexShrink:0,paddingHorizontal:16,paddingTop:12,paddingBottom:16,borderTopWidth:1,borderTopColor:colors.divider,backgroundColor:colors.white},
  reviseItem:{flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:12},
  qtyButton:{width:44,minHeight:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:10,backgroundColor:colors.primaryLight},
  qtyValue:{minWidth:24,textAlign:"center",fontSize:16,fontWeight:"600",color:colors.heading},
  totalLine:{fontSize:16,fontWeight:"700",color:colors.heading,paddingVertical:12},
  choice:{minHeight:44,justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12},
  choiceOn:{backgroundColor:colors.primary,borderColor:colors.primary},
  choiceText:{color:colors.heading,fontSize:14},choiceTextOn:{color:colors.white,fontSize:14,fontWeight:"600"},
  returnChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  returnChoice: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  returnChoiceOn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  returnQuantity: { minWidth: 32, textAlign: "center", paddingVertical: 12, color: colors.heading },
  unavailableAction: { opacity: 0.45 },
  courierFloatingMenu: { position: "absolute", backgroundColor: colors.white, borderRadius: 11, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 8 },
  dropdownSearchRow: { height: 56, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropdownSearchInput: { flex: 1, minWidth: 0, height: 42, fontSize: 13, color: colors.heading },
  dropdownEmpty: { padding: 14, fontSize: 13, color: colors.muted },
  courierDropdown: { flexShrink: 1, backgroundColor: colors.white, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, overflow: "hidden" },
  courierDropdownOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  courierDropdownText: { flex: 1, color: colors.heading, fontSize: 14, fontWeight: "600" },
  screen:{flex:1,backgroundColor:colors.background},header:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:10,backgroundColor:colors.white,borderBottomWidth:1,borderBottomColor:colors.divider},back:{padding:7},flex:{flex:1,minWidth:0},headerTitle:{fontSize:17,fontWeight:"600",color:colors.heading},orderNo:{fontSize:11,color:colors.muted,marginTop:2},status:{backgroundColor:colors.primaryLight,borderRadius:999,paddingHorizontal:9,paddingVertical:5},statusText:{fontSize:10,fontWeight:"600",color:colors.primaryDark},more:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:colors.cardSecondary},content:{padding:14,paddingBottom:40,gap:12},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider,borderRadius:14,padding:14,gap:9},orangeCard:{backgroundColor:colors.cardSecondary,borderColor:colors.border},greenCard:{backgroundColor:colors.successBackground,borderColor:"#BBF7D0"},blueCard:{borderColor:"#DBEAFE"},cardTitle:{fontSize:11,fontWeight:"600",letterSpacing:.7,color:colors.secondary},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},strongRow:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:9,marginTop:2},rowLabel:{fontSize:13,color:colors.secondary},rowValue:{fontSize:13,color:colors.heading,textAlign:"right",flexShrink:1},strong:{fontWeight:"700",fontSize:15},good:{color:colors.successText},bad:{color:colors.dangerText},timeline:{gap:0},step:{flexDirection:"row",minHeight:52},rail:{width:28,alignItems:"center"},dot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:colors.muted,backgroundColor:colors.white,alignItems:"center",justifyContent:"center",zIndex:1},dotDone:{backgroundColor:colors.primary,borderColor:colors.primary},line:{position:"absolute",top:19,bottom:-1,width:2,backgroundColor:colors.divider},lineDone:{backgroundColor:colors.primary},stepText:{flex:1,paddingLeft:7,paddingBottom:12},stepName:{fontSize:13,fontWeight:"600",color:colors.heading},pending:{color:colors.muted,fontWeight:"400"},muted:{fontSize:11,color:colors.muted,marginTop:2},product:{flexDirection:"row",alignItems:"flex-start",gap:9,paddingVertical:3},productDivider:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:11,marginTop:3},productIcon:{width:38,height:38,borderRadius:10,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},productName:{fontSize:13,fontWeight:"600",color:colors.heading},productPrice:{fontSize:13,fontWeight:"600",color:colors.heading},cost:{fontSize:11,color:colors.successText,marginTop:3},customer:{flexDirection:"row",alignItems:"center",gap:11},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},avatarText:{fontSize:17,fontWeight:"600",color:colors.primaryDark},customerName:{fontSize:14,fontWeight:"600",color:colors.heading},customerLine:{fontSize:12,color:colors.secondary,marginTop:2},warning:{fontSize:11,color:colors.warningText,marginTop:3},note:{fontSize:13,lineHeight:20,color:colors.secondary},state:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:24,backgroundColor:colors.background},stateTitle:{fontSize:18,fontWeight:"600",color:colors.heading},primary:{backgroundColor:colors.primary,borderRadius:10,paddingHorizontal:18,paddingVertical:12,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.white,fontSize:13,fontWeight:"600",textAlign:"center"},inlineError:{fontSize:12,color:colors.dangerText,textAlign:"center"},actionBar:{paddingHorizontal:14,paddingTop:10,paddingBottom:12,backgroundColor:colors.white,borderTopWidth:1,borderTopColor:colors.divider},actionRow:{flexDirection:"row",gap:9},actionHalf:{flex:1},dangerAction:{minHeight:44,backgroundColor:colors.danger,borderRadius:10,alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:10},disabled:{opacity:0.5},multiline:{minHeight:88,textAlignVertical:"top",paddingVertical:10},secondaryAction:{minHeight:44,borderWidth:1,borderColor:colors.border,borderRadius:10,alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:10},secondaryText:{color:colors.primaryDark,fontSize:12,fontWeight:"600",textAlign:"center"},menuBackdrop:{flex:1,backgroundColor:colors.overlay,alignItems:"flex-end",paddingTop:58,paddingRight:12},menuCard:{width:240,borderRadius:14,backgroundColor:colors.white,padding:10,elevation:9},menuTitle:{fontSize:12,fontWeight:"700",color:colors.muted,paddingHorizontal:10,paddingVertical:7},menuAction:{minHeight:46,flexDirection:"row",alignItems:"center",gap:11,borderRadius:9,paddingHorizontal:10},menuText:{fontSize:13,color:colors.heading},menuDanger:{fontSize:13,color:colors.dangerText},sheetBackdrop:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.overlay,padding:16},sheet:{width:"100%",maxWidth:560,maxHeight:"88%",backgroundColor:colors.white,borderRadius:18,paddingHorizontal:0,paddingTop:0,paddingBottom:12},confirmCard:{width:"100%",maxWidth:440,gap:13,borderRadius:18,backgroundColor:colors.white,padding:18},sheetHeader:{minHeight:52,flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider,paddingHorizontal:14},sheetClose:{width:32,height:32,alignItems:"center",justifyContent:"center",borderRadius:16},sheetHeaderTitle:{flex:1,fontSize:16,fontWeight:"700",color:colors.heading},addCourier:{minHeight:34,flexDirection:"row",alignItems:"center",gap:2,borderRadius:8,backgroundColor:colors.primaryLight,paddingHorizontal:8},addCourierText:{fontSize:11,fontWeight:"700",color:colors.primaryDark},sheetFooter:{paddingHorizontal:14,paddingTop:11,paddingBottom:16,borderTopWidth:1,borderTopColor:colors.divider},fullWidth:{width:"100%"},sheetHandle:{width:40,height:4,alignSelf:"center",borderRadius:3,backgroundColor:colors.divider,marginBottom:7},sheetTitle:{fontSize:17,fontWeight:"700",color:colors.heading,marginBottom:8},sheetContent:{gap:10,paddingHorizontal:16,paddingTop:15,paddingBottom:18},fieldLabel:{fontSize:12,fontWeight:"600",color:colors.secondary,marginTop:4},input:{minHeight:43,borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:11,color:colors.heading,backgroundColor:colors.white,fontSize:13},noCourier:{fontSize:12,color:colors.warningText,backgroundColor:colors.warningBackground,padding:10,borderRadius:9},sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},optional:{color:colors.muted,fontWeight:"400"},addDeliveryMan:{fontSize:11,fontWeight:"600",color:colors.primaryDark,paddingVertical:6},selectButton:{minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:11},selectText:{fontSize:13,color:colors.secondary},selectedCourier:{color:colors.heading,fontWeight:"600"},feeType:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.divider,borderRadius:9,paddingHorizontal:11},feeTypeOn:{backgroundColor:"#4F46E5",borderColor:"#4F46E5"},feeTypeText:{color:colors.secondary,fontSize:14,fontWeight:"600"},feeTypeTextOn:{color:colors.white},defaultCourier:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderWidth:1,borderColor:colors.divider,borderRadius:10},defaultCourierOn:{borderColor:"#6366F1",backgroundColor:"#EEF2FF"},nestedBackdrop:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:colors.overlay,paddingHorizontal:22},nestedSheet:{width:"100%",maxWidth:520,maxHeight:"88%",borderRadius:18,backgroundColor:colors.white,paddingVertical:12,overflow:"hidden"},courierOption:{minHeight:58,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:12,paddingVertical:8},courierName:{fontSize:13,fontWeight:"600",color:colors.heading}
});
