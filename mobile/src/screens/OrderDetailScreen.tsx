import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import { sampleOrders } from "../orders/sampleOrders";

type Item = { id: string; variantSku: string; productName: string; variantLabel?: string; qty: number; unitPrice?: number; subtotal?: number; unitCostSnapshot?: number; lineProfit?: number; availableStock: number };
type Payment = { id: string; method: string; amount: number; receivedAt: string; recordedByName: string };
type OrderDetail = {
  id: string; orderNo: string; channel: string; customerName: string; customerPhone: string; customerAddress?: string;
  orderStatus: string; paymentStatus: string; fulfillmentStatus: string; isDraft: boolean; createdAt: string; createdByName?: string;
  subtotal?: number; discountAmount?: number; deliveryChargeCustomer?: number; totalAmount: number; totalPaid?: number; dueAmount: number;
  courierName?: string; trackingNo?: string; deliveryManName?: string; note?: string; confirmedAt?: string; handedOverAt?: string; deliveredAt?: string; returnedAt?: string;
  items: Item[]; payments?: Payment[]; economics?: { revenue: number; cost: number; profit: number };
  courierId?: string; isRevised?: boolean;
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
  return <View style={[s.row, strong && s.strongRow]}><Text style={[s.rowLabel, strong && s.strong]}>{name}</Text><Text style={[s.rowValue, strong && s.strong, tone === "good" && s.good, tone === "bad" && s.bad]}>{value}</Text></View>;
}
function Card({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "orange" | "green" | "blue" }) {
  return <View style={[s.card, tone === "orange" && s.orangeCard, tone === "green" && s.greenCard, tone === "blue" && s.blueCard]}><Text style={s.cardTitle}>{title}</Text>{children}</View>;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [courierPickerOpen, setCourierPickerOpen] = useState(false);
  const [addCourierOpen, setAddCourierOpen] = useState(false);
  const [newCourier, setNewCourier] = useState({ name: "", phone: "", inside: "60", outside: "120", returnCharge: "0", codFeeType: "PCT" as "PCT" | "FLAT", codFeeValue: "0", trackingUrlTemplate: "", isDefault: false });
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [handoverCourierId, setHandoverCourierId] = useState("");
  const [deliveryMen, setDeliveryMen] = useState<DeliveryMan[]>([]);
  const [deliveryManId, setDeliveryManId] = useState("");
  const [deliveryManPickerOpen, setDeliveryManPickerOpen] = useState(false);
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
      onSuccess?.(); setReload(value => value + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : "The action could not be completed.";
      const data = (e as Error & { data?: { code?: string; excessAmount?: number }; body?: { code?: string; excessAmount?: number } });
      const responseData = data.data ?? data.body;
      if (responseData?.code === "ORDER_OVERPAID") setReviseExcess(Number(responseData.excessAmount) || 0);
      setError(message);
    } finally { setBusy(false); }
  };

  const openHandover = async () => {
    setMenuOpen(false); setTrackingNo(""); setDeliveryCost("0"); setHandoverCourierId(order?.courierId ?? ""); setHandoverOpen(true);
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

  const createCourier = async () => {
    if (!newCourier.name.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const created = await auth.api<Courier>("/couriers", { method: "POST", body: JSON.stringify({
        name: newCourier.name.trim(), phone: newCourier.phone.trim() || undefined,
        insideDhakaCharge: Number.parseFloat(newCourier.inside) || 0,
        outsideDhakaCharge: Number.parseFloat(newCourier.outside) || 0,
        returnCharge: Number.parseFloat(newCourier.returnCharge) || 0,
        codFeeType: newCourier.codFeeType, codFeeValue: Number.parseFloat(newCourier.codFeeValue) || 0,
        isDefault: newCourier.isDefault, trackingUrlTemplate: newCourier.trackingUrlTemplate.trim() || undefined,
      }) });
      setCouriers(previous => [created, ...previous.filter(item => item.id !== created.id)]);
      setHandoverCourierId(created.id);
      setDeliveryCost(String(created.insideDhakaCharge ?? 0));
      setNewCourier({ name: "", phone: "", inside: "60", outside: "120", returnCharge: "0", codFeeType: "PCT", codFeeValue: "0", trackingUrlTemplate: "", isDefault: false });
      setAddCourierOpen(false);
      setCourierPickerOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add courier service."); }
    finally { setBusy(false); }
  };

  const openRevise = () => {
    setMenuOpen(false); setReviseQtys(Object.fromEntries((order?.items ?? []).map(item => [item.id ?? item.variantSku, item.qty])));
    setReviseReason(""); setReviseNote(""); setReviseExcess(null); setReviseResolution(""); setReviseOpen(true);
  };

  const cancel = () => {
    setMenuOpen(false);
    Alert.alert("Cancel this order?", "Are you sure you want to cancel this order?", [
      { text: "Keep order", style: "cancel" },
      { text: "Continue", style: "destructive", onPress: () => { setCancelReason(""); setCancelReasonOpen(true); } },
    ]);
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
  const lifecycle = [
    { name: "Order placed", at: order.createdAt, done: true },
    { name: "Order confirmed", at: order.confirmedAt, done: !order.isDraft },
    { name: "Handed to courier", at: order.handedOverAt, done: ["IN_TRANSIT", "DELIVERED", "RETURNED"].includes(order.fulfillmentStatus) },
    { name: order.fulfillmentStatus === "RETURNED" ? "Returned" : "Delivered", at: order.returnedAt ?? order.deliveredAt, done: ["DELIVERED", "RETURNED"].includes(order.fulfillmentStatus) },
  ];
  const terminal = order.orderStatus === "COMPLETED" || order.orderStatus === "CANCELLED";
  const showHandoverAction = !order.isDraft && (order.fulfillmentStatus === "UNFULFILLED" || order.fulfillmentStatus === "PACKED") && order.orderStatus === "OPEN";
  const showConfirmAction = order.isDraft && order.orderStatus !== "CANCELLED";
  const showDeliverAction = order.fulfillmentStatus === "IN_TRANSIT" && order.orderStatus !== "CANCELLED";
  const showReturnAction = order.fulfillmentStatus === "DELIVERED" && order.orderStatus === "OPEN";
  const revisedSubtotal = items.reduce((sum, item) => sum + (reviseQtys[item.id ?? item.variantSku] ?? item.qty) * (item.unitPrice ?? 0), 0);
  const hasReducedItems = items.some(item => (reviseQtys[item.id ?? item.variantSku] ?? item.qty) < item.qty);
  const submitRevise = async () => {
    const revised = items.filter(item => (reviseQtys[item.id ?? item.variantSku] ?? item.qty) < item.qty)
      .map(item => ({ orderItemId: item.id, newQty: reviseQtys[item.id ?? item.variantSku] ?? 0 }));
    const payload = { items: revised, reason: reviseReason, note: reviseNote.trim() || undefined,
      resolutionType: reviseExcess != null ? reviseResolution || undefined : undefined,
      refundMethod: reviseExcess != null && reviseResolution === "REFUND" ? reviseRefundMethod : undefined };
    await runAction(`/orders/${id}/revise`, "POST", payload, () => { setReviseOpen(false); setReviseExcess(null); });
  };

  return <View style={s.screen}>
    <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.heading}/></Pressable><View style={s.flex}><Text style={s.headerTitle}>Order Details</Text><Text style={s.orderNo}>{order.orderNo}</Text></View><View style={s.status}><Text style={s.statusText}>{order.orderStatus === "CANCELLED" ? "CANCELLED" : label(order.fulfillmentStatus)}</Text></View>{!terminal && <Pressable accessibilityLabel="More order actions" onPress={() => setMenuOpen(true)} style={s.more}><Ionicons name="ellipsis-vertical" size={20} color={colors.heading}/></Pressable>}</View>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)} colors={[colors.primary]}/>} contentContainerStyle={s.content}>
      <Card title="ORDER PROGRESS" tone="orange"><View style={s.timeline}>{lifecycle.map((step, index) => <View key={step.name} style={s.step}><View style={s.rail}><View style={[s.dot, step.done && s.dotDone]}>{step.done && <Ionicons name="checkmark" size={12} color={colors.white}/>}</View>{index < lifecycle.length - 1 && <View style={[s.line, step.done && s.lineDone]}/>}</View><View style={s.stepText}><Text style={[s.stepName, !step.done && s.pending]}>{step.name}</Text><Text style={s.muted}>{step.done ? date(step.at) : "Pending"}</Text></View></View>)}</View></Card>

      <Card title="ORDER INFORMATION"><Row name="Order number" value={order.orderNo}/><Row name="Order date" value={date(order.createdAt)}/><Row name="Channel" value={label(order.channel)}/><Row name="Payment" value={label(order.paymentStatus)}/>{order.createdByName && <Row name="Created by" value={order.createdByName}/>}</Card>

      <Card title={`PRODUCTS (${items.length})`} tone="blue">{items.map((item, index) => <View key={item.id ?? `${item.variantSku}-${index}`} style={[s.product, index > 0 && s.productDivider]}><View style={s.productIcon}><Ionicons name="cube-outline" size={21} color={colors.primaryDark}/></View><View style={s.flex}><Text style={s.productName}>{item.productName || "Product"}</Text><Text style={s.muted}>{item.variantLabel || item.variantSku || "—"} · Qty: {item.qty ?? 0} · Stock: {item.availableStock ?? 0}</Text>{item.unitCostSnapshot != null && <Text style={s.cost}>Unit cost: {cash(item.unitCostSnapshot)}{item.lineProfit != null ? `  ·  Profit: ${cash(item.lineProfit)}` : ""}</Text>}</View><Text style={s.productPrice}>{cash(item.subtotal ?? (item.unitPrice ?? 0) * item.qty)}</Text></View>)}</Card>

      <Card title="PAYMENT SUMMARY"><Row name="Subtotal" value={cash(subtotal)}/>{!!order.discountAmount && <Row name="Discount" value={`-${cash(order.discountAmount)}`}/>}{!!order.deliveryChargeCustomer && <Row name="Delivery charge" value={cash(order.deliveryChargeCustomer)}/>}<Row name="Total" value={cash(order.totalAmount)} strong/><Row name="Paid" value={cash(order.totalPaid ?? order.totalAmount - order.dueAmount)} tone="good"/><Row name="Amount due" value={cash(order.dueAmount)} tone={order.dueAmount > 0 ? "bad" : "good"}/></Card>

      <Card title="CUSTOMER"><View style={s.customer}><View style={s.avatar}><Text style={s.avatarText}>{(order.customerName || "C").charAt(0).toUpperCase()}</Text></View><View style={s.flex}><Text style={s.customerName}>{order.customerName || "Customer"}</Text><Text style={s.customerLine}>{order.customerPhone || "—"}</Text>{order.customerAddress && <Text style={s.customerLine}>{order.customerAddress}</Text>}</View></View></Card>

      {(order.courierName || order.trackingNo || order.deliveryManName) && <Card title="DELIVERY"><Row name="Courier" value={order.courierName ?? "—"}/>{order.trackingNo && <Row name="Tracking number" value={order.trackingNo}/>}{order.deliveryManName && <Row name="Delivery person" value={order.deliveryManName}/>}</Card>}

      {order.economics && <Card title="PRODUCT P&L" tone="green"><Row name="Sale" value={cash(order.economics.revenue)}/><Row name="Product cost" value={cash(order.economics.cost)}/><Row name="Profit" value={`${order.economics.profit >= 0 ? "+" : ""}${cash(order.economics.profit)}`} strong tone={order.economics.profit >= 0 ? "good" : "bad"}/>{order.paymentStatus !== "PAID" && <Text style={s.warning}>Profit is provisional until payment is received.</Text>}</Card>}
      {order.note && <Card title="ORDER NOTE"><Text style={s.note}>{order.note}</Text></Card>}
      {!!error && <Text style={s.inlineError}>{error}</Text>}
    </ScrollView>
    {(showConfirmAction || showHandoverAction || showDeliverAction || showReturnAction) && <View style={s.actionBar}>
      {showConfirmAction && <Pressable disabled={busy} onPress={() => Alert.alert("Confirm this order?", "", [{ text: "Cancel", style: "cancel" }, { text: "Confirm Order", onPress: () => void runAction(`/orders/${id}/confirm`, "POST") }])} style={s.primary}><Text style={s.primaryText}>{busy ? "…" : "Confirm Order"}</Text></Pressable>}
      {showHandoverAction && <Pressable disabled={busy} onPress={() => void openHandover()} style={s.primary}><Text style={s.primaryText}>{busy ? "…" : "Handover to Courier"}</Text></Pressable>}
      {showDeliverAction && <View style={s.actionRow}><Pressable disabled={busy} onPress={() => Alert.alert("Mark this order as delivered?", "", [{ text: "Cancel", style: "cancel" }, { text: "Mark Delivered", onPress: () => void runAction(`/orders/${id}/delivered`, "POST") }])} style={[s.primary,s.actionHalf]}><Text style={s.primaryText}>Mark Delivered</Text></Pressable><Pressable onPress={() => Alert.alert("Courier return", "Use the frontend order page to record returned items and stock condition.")} style={[s.secondaryAction,s.actionHalf]}><Text style={s.secondaryText}>Courier Return</Text></Pressable></View>}
      {showReturnAction && <Pressable onPress={() => Alert.alert("Return / Refund", "Use the frontend order page to select returned items and refund details.")} style={s.secondaryAction}><Text style={s.secondaryText}>Return / Refund</Text></Pressable>}
    </View>}

    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}><Pressable style={s.menuBackdrop} onPress={() => setMenuOpen(false)}><View style={s.menuCard}><Text style={s.menuTitle}>Order actions</Text>{!terminal && order.fulfillmentStatus === "UNFULFILLED" && <Pressable style={s.menuAction} onPress={openRevise}><Ionicons name="create-outline" size={19} color={colors.heading}/><Text style={s.menuText}>Revise Order</Text></Pressable>}{!terminal && <Pressable style={s.menuAction} onPress={cancel}><Ionicons name="close-circle-outline" size={19} color={colors.danger}/><Text style={s.menuDanger}>Cancel Order</Text></Pressable>}{owner && !terminal && <Pressable style={s.menuAction} onPress={deleteOrder}><Ionicons name="trash-outline" size={19} color={colors.danger}/><Text style={s.menuDanger}>Delete Order</Text></Pressable>}</View></Pressable></Modal>

    <Modal visible={handoverOpen} transparent animationType="fade" onRequestClose={() => setHandoverOpen(false)}><View style={s.sheetBackdrop}><View style={s.sheet}><View style={s.sheetHeader}><Pressable accessibilityLabel="Close handover" onPress={()=>setHandoverOpen(false)} style={s.sheetClose}><Ionicons name="close" size={21} color={colors.muted}/></Pressable><Text style={s.sheetHeaderTitle}>Handover to Courier</Text><Pressable onPress={()=>setAddCourierOpen(true)} style={s.addCourier}><Ionicons name="add" size={16} color={colors.primaryDark}/><Text style={s.addCourierText}>Add Courier</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}><Text style={s.fieldLabel}>Courier *</Text><Pressable onPress={()=>setCourierPickerOpen(true)} style={s.selectButton}><Text numberOfLines={1} style={[s.selectText,handoverCourierId&&s.selectedCourier]}>{couriers.find(item=>item.id===handoverCourierId)?.name || "Select courier service"}</Text><Ionicons name="chevron-down" size={16} color={colors.muted}/></Pressable><Text style={s.fieldLabel}>Tracking Number *</Text><TextInput value={trackingNo} onChangeText={setTrackingNo} style={s.input} placeholder="Enter tracking number"/><View style={s.sectionHeader}><Text style={s.fieldLabel}>Delivery Man <Text style={s.optional}>(optional)</Text></Text><Pressable onPress={()=>setAddDeliveryManOpen(true)}><Text style={s.addDeliveryMan}>Add Delivery Man</Text></Pressable></View>{deliveryManId ? <Text style={s.readonly}>{deliveryMen.find(item=>item.id===deliveryManId)?.name || "Selected delivery man"}</Text> : <Pressable onPress={()=>setDeliveryManPickerOpen(true)} style={s.selectButton}><Text style={s.selectText}>— none —</Text><Ionicons name="chevron-down" size={16} color={colors.muted}/></Pressable>}<Text style={s.fieldLabel}>Actual Delivery Cost</Text><TextInput value={deliveryCost} onChangeText={setDeliveryCost} keyboardType="decimal-pad" style={s.input}/>{!!error && <Text style={s.inlineError}>{error}</Text>}</ScrollView><View style={s.sheetFooter}><Pressable disabled={busy || !handoverCourierId || !trackingNo.trim()} onPress={() => void runAction(`/orders/${id}/handover`, "POST", { courierId: handoverCourierId, trackingNo: trackingNo.trim(), deliveryManId: deliveryManId || undefined, deliveryCostActual: Number.parseFloat(deliveryCost) || 0 }, () => setHandoverOpen(false))} style={[s.primary,s.fullWidth,(busy || !handoverCourierId || !trackingNo.trim()) && s.disabled]}><Text style={s.primaryText}>{busy ? "Handing over…" : "Handover to Courier"}</Text></Pressable></View></View></View></Modal>

    <Modal visible={courierPickerOpen} transparent animationType="fade" onRequestClose={()=>setCourierPickerOpen(false)}><View style={s.nestedBackdrop}><View style={s.nestedSheet}><View style={s.sheetHandle}/><View style={s.sectionHeader}><Text style={s.sheetTitle}>Select Courier</Text><Pressable onPress={()=>setCourierPickerOpen(false)} style={s.sheetClose}><Ionicons name="close" size={20} color={colors.muted}/></Pressable></View><Text style={s.muted}>Choose an active courier service for this handover.</Text><ScrollView contentContainerStyle={s.sheetContent}>{couriers.filter(item=>item.isActive).map(item=><Pressable key={item.id} onPress={()=>{setHandoverCourierId(item.id);setDeliveryCost(String(item.insideDhakaCharge??0));setCourierPickerOpen(false)}} style={[s.courierOption,handoverCourierId===item.id&&s.choiceOn]}><View style={s.flex}><Text style={s.courierName}>{item.name}</Text><Text style={s.muted}>Inside Dhaka {cash(item.insideDhakaCharge)}</Text></View>{handoverCourierId===item.id&&<Ionicons name="checkmark-circle" size={20} color={colors.primary}/>}</Pressable>)}{couriers.filter(item=>item.isActive).length===0&&<Text style={s.noCourier}>No active couriers are available. Manage courier services in Settings.</Text>}</ScrollView></View></View></Modal>

    <Modal visible={addCourierOpen} transparent animationType="fade" onRequestClose={()=>setAddCourierOpen(false)}><View style={s.nestedBackdrop}><View style={s.nestedSheet}><View style={s.sectionHeader}><Text style={s.sheetTitle}>Add Courier Service</Text><Pressable onPress={()=>setAddCourierOpen(false)} style={s.sheetClose}><Ionicons name="close" size={20} color={colors.muted}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}><TextInput value={newCourier.name} onChangeText={value=>setNewCourier(form=>({...form,name:value}))} placeholder="Courier name *" style={s.input}/><Text style={s.fieldLabel}>Phone (optional)</Text><TextInput value={newCourier.phone} onChangeText={value=>setNewCourier(form=>({...form,phone:value}))} keyboardType="phone-pad" style={s.input}/><View style={s.actionRow}><View style={s.actionHalf}><Text style={s.fieldLabel}>Inside Dhaka (৳)</Text><TextInput value={newCourier.inside} onChangeText={value=>setNewCourier(form=>({...form,inside:value}))} keyboardType="decimal-pad" style={s.input}/></View><View style={s.actionHalf}><Text style={s.fieldLabel}>Outside Dhaka (৳)</Text><TextInput value={newCourier.outside} onChangeText={value=>setNewCourier(form=>({...form,outside:value}))} keyboardType="decimal-pad" style={s.input}/></View></View><Text style={s.fieldLabel}>Return charge (৳)</Text><TextInput value={newCourier.returnCharge} onChangeText={value=>setNewCourier(form=>({...form,returnCharge:value}))} keyboardType="decimal-pad" style={s.input}/><Text style={s.fieldLabel}>COD fee (courier's cut from collected cash)</Text><View style={s.actionRow}><View style={s.actionRow}><Pressable onPress={()=>setNewCourier(form=>({...form,codFeeType:"PCT"}))} style={[s.feeType,newCourier.codFeeType==="PCT"&&s.feeTypeOn]}><Text style={[s.feeTypeText,newCourier.codFeeType==="PCT"&&s.feeTypeTextOn]}>%</Text></Pressable><Pressable onPress={()=>setNewCourier(form=>({...form,codFeeType:"FLAT"}))} style={[s.feeType,newCourier.codFeeType==="FLAT"&&s.feeTypeOn]}><Text style={[s.feeTypeText,newCourier.codFeeType==="FLAT"&&s.feeTypeTextOn]}>৳</Text></Pressable></View><TextInput value={newCourier.codFeeValue} onChangeText={value=>setNewCourier(form=>({...form,codFeeValue:value}))} keyboardType="decimal-pad" placeholder={newCourier.codFeeType==="PCT"?"e.g. 1 for 1%":"e.g. 10"} style={[s.input,s.actionHalf]}/></View><Text style={s.fieldLabel}>Tracking URL — use {'{id}'} for consignment no.</Text><TextInput value={newCourier.trackingUrlTemplate} onChangeText={value=>setNewCourier(form=>({...form,trackingUrlTemplate:value}))} style={s.input}/><Pressable onPress={()=>setNewCourier(form=>({...form,isDefault:!form.isDefault}))} style={[s.defaultCourier,newCourier.isDefault&&s.defaultCourierOn]}><Ionicons name={newCourier.isDefault?"star":"star-outline"} size={17} color={newCourier.isDefault?colors.primaryDark:colors.secondary}/><Text style={[s.selectText,newCourier.isDefault&&s.selectedCourier]}>Set as default courier</Text></Pressable>{!!error&&<Text style={s.inlineError}>{error}</Text>}<Pressable disabled={busy||!newCourier.name.trim()} onPress={()=>void createCourier()} style={[s.primary,s.fullWidth,(busy||!newCourier.name.trim())&&s.disabled]}><Text style={s.primaryText}>{busy?"Saving…":"Save Courier"}</Text></Pressable></ScrollView></View></View></Modal>

    <Modal visible={deliveryManPickerOpen} transparent animationType="fade" onRequestClose={()=>setDeliveryManPickerOpen(false)}><View style={s.nestedBackdrop}><View style={s.nestedSheet}><View style={s.sheetHandle}/><View style={s.sectionHeader}><Text style={s.sheetTitle}>Select Delivery Man</Text><Pressable onPress={()=>setDeliveryManPickerOpen(false)} style={s.sheetClose}><Ionicons name="close" size={20} color={colors.muted}/></Pressable></View><ScrollView contentContainerStyle={s.sheetContent}><Pressable onPress={()=>{setDeliveryManId("");setDeliveryManPickerOpen(false)}} style={s.courierOption}><Text style={s.courierName}>— none —</Text></Pressable>{deliveryMen.filter(item=>item.isActive&&(!item.courierId||item.courierId===handoverCourierId)).map(item=><Pressable key={item.id} onPress={()=>{setDeliveryManId(item.id);if(item.costPerDelivery!=null)setDeliveryCost(String(item.costPerDelivery));setDeliveryManPickerOpen(false)}} style={[s.courierOption,deliveryManId===item.id&&s.choiceOn]}><View style={s.flex}><Text style={s.courierName}>{item.name}</Text><Text style={s.muted}>{item.phone}</Text></View>{deliveryManId===item.id&&<Ionicons name="checkmark-circle" size={20} color={colors.primary}/>}</Pressable>)}</ScrollView></View></View></Modal>

    <Modal visible={addDeliveryManOpen} transparent animationType="fade" onRequestClose={()=>setAddDeliveryManOpen(false)}><View style={s.nestedBackdrop}><View style={s.nestedSheet}><View style={s.sheetHandle}/><View style={s.sectionHeader}><Text style={s.sheetTitle}>Add Delivery Man</Text><Pressable onPress={()=>setAddDeliveryManOpen(false)} style={s.sheetClose}><Ionicons name="close" size={20} color={colors.muted}/></Pressable></View><View style={s.sheetContent}><TextInput value={newDeliveryMan.name} onChangeText={value=>setNewDeliveryMan(form=>({...form,name:value}))} placeholder="Delivery man's name" style={s.input}/><TextInput value={newDeliveryMan.phone} onChangeText={value=>setNewDeliveryMan(form=>({...form,phone:value}))} keyboardType="phone-pad" placeholder="Phone number" style={s.input}/><TextInput value={newDeliveryMan.cost} onChangeText={value=>setNewDeliveryMan(form=>({...form,cost:value}))} keyboardType="decimal-pad" placeholder="Cost per delivery (optional)" style={s.input}/><Pressable disabled={busy||!newDeliveryMan.name.trim()||!newDeliveryMan.phone.trim()} onPress={()=>void createDeliveryMan()} style={[s.primary,s.fullWidth,(busy||!newDeliveryMan.name.trim()||!newDeliveryMan.phone.trim())&&s.disabled]}><Text style={s.primaryText}>{busy?"Saving…":"Save Delivery Man"}</Text></Pressable></View></View></View></Modal>

    <Modal visible={reviseOpen} transparent animationType="fade" onRequestClose={() => setReviseOpen(false)}><View style={s.sheetBackdrop}><View style={s.sheet}><View style={s.sheetHandle}/><Text style={s.sheetTitle}>Revise Order</Text><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>{reviseExcess == null ? <>{items.map((item,index) => { const key=item.id ?? item.variantSku; const qty=reviseQtys[key] ?? item.qty; return <View key={key} style={s.reviseItem}><View style={s.flex}><Text style={s.productName}>{item.productName}</Text><Text style={s.muted}>Ordered: {item.qty} · ৳{item.unitPrice}/pc</Text></View><Pressable disabled={qty<=0} onPress={()=>setReviseQtys(value=>({...value,[key]:Math.max(0,qty-1)}))} style={s.qtyButton}><Text>−</Text></Pressable><Text style={s.qtyValue}>{qty}</Text><Pressable disabled={qty>=item.qty} onPress={()=>setReviseQtys(value=>({...value,[key]:Math.min(item.qty,qty+1)}))} style={s.qtyButton}><Text>+</Text></Pressable></View>})}<Text style={s.totalLine}>Revised Total  {cash(revisedSubtotal)}</Text><Text style={s.fieldLabel}>Why is this being changed? *</Text>{([["OUT_OF_STOCK","Product not available"],["CUSTOMER_CHANGED_MIND","Customer changed mind"],["OTHER","Other"]] as const).map(([value,title])=><Pressable key={value} onPress={()=>setReviseReason(value)} style={[s.choice,reviseReason===value&&s.choiceOn]}><Text style={reviseReason===value?s.choiceTextOn:s.choiceText}>{title}</Text></Pressable>)}{reviseReason==="OTHER"&&<TextInput value={reviseNote} onChangeText={setReviseNote} placeholder="Explain why (required)" multiline style={[s.input,s.multiline]}/>}</>:<><Text style={s.inlineError}>Customer already paid {cash(reviseExcess)} more than the revised total. Choose a resolution.</Text>{(["REFUND","STORE_CREDIT"] as const).map(value=><Pressable key={value} onPress={()=>setReviseResolution(value)} style={[s.choice,reviseResolution===value&&s.choiceOn]}><Text style={reviseResolution===value?s.choiceTextOn:s.choiceText}>{value === "REFUND" ? "Refund" : "Store Credit"}</Text></Pressable>)}{reviseResolution==="REFUND"&&<TextInput value={reviseRefundMethod} onChangeText={setReviseRefundMethod} style={s.input} placeholder="Refund method"/>}</>}</ScrollView><Pressable disabled={busy || (reviseExcess == null ? !reviseReason || (reviseReason==="OTHER"&&!reviseNote.trim()) || !hasReducedItems : !reviseResolution || (reviseResolution==="REFUND"&&!reviseRefundMethod.trim()))} onPress={()=>void submitRevise()} style={[s.primary,(busy || (reviseExcess == null ? !reviseReason || (reviseReason==="OTHER"&&!reviseNote.trim()) || !hasReducedItems : !reviseResolution || (reviseResolution==="REFUND"&&!reviseRefundMethod.trim())))&&s.disabled]}><Text style={s.primaryText}>{busy ? "Saving…" : reviseExcess == null ? "Save Revision" : "Confirm & Save"}</Text></Pressable></View></View></Modal>

    <Modal visible={cancelReasonOpen} transparent animationType="fade" onRequestClose={()=>setCancelReasonOpen(false)}><View style={s.sheetBackdrop}><View style={s.confirmCard}><Text style={s.sheetTitle}>Cancel Order</Text><TextInput value={cancelReason} onChangeText={setCancelReason} placeholder="Reason for cancellation" multiline style={[s.input,s.multiline]}/><View style={s.actionRow}><Pressable style={[s.secondaryAction,s.actionHalf]} onPress={()=>setCancelReasonOpen(false)}><Text style={s.secondaryText}>Keep order</Text></Pressable><Pressable disabled={busy} style={[s.dangerAction,s.actionHalf]} onPress={()=>void runAction(`/orders/${id}/cancel`,"POST",{reason:cancelReason},()=>setCancelReasonOpen(false))}><Text style={s.primaryText}>{busy?"Cancelling…":"Cancel Order"}</Text></Pressable></View></View></View></Modal>
    <Modal visible={deleteReasonOpen} transparent animationType="fade" onRequestClose={()=>setDeleteReasonOpen(false)}><View style={s.sheetBackdrop}><View style={s.confirmCard}><Text style={s.sheetTitle}>Delete this order?</Text><Text style={s.muted}>This permanently removes the order. Stock will be released. This cannot be undone.</Text><TextInput value={deleteReason} onChangeText={setDeleteReason} placeholder="Reason for deletion (required)" multiline style={[s.input,s.multiline]}/><View style={s.actionRow}><Pressable style={[s.secondaryAction,s.actionHalf]} onPress={()=>setDeleteReasonOpen(false)}><Text style={s.secondaryText}>Close</Text></Pressable><Pressable disabled={busy || !deleteReason.trim()} style={[s.dangerAction,s.actionHalf,(busy || !deleteReason.trim())&&s.disabled]} onPress={()=>void runAction(`/orders/${id}`,"DELETE",{reason:deleteReason.trim()},()=>{setDeleteReasonOpen(false);router.replace("/orders")})}><Text style={s.primaryText}>{busy?"Deleting…":"Yes, Delete Order"}</Text></Pressable></View></View></View></Modal>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},header:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,paddingVertical:10,backgroundColor:colors.white,borderBottomWidth:1,borderBottomColor:colors.divider},back:{padding:7},flex:{flex:1,minWidth:0},headerTitle:{fontSize:17,fontWeight:"600",color:colors.heading},orderNo:{fontSize:11,color:colors.muted,marginTop:2},status:{backgroundColor:colors.primaryLight,borderRadius:999,paddingHorizontal:9,paddingVertical:5},statusText:{fontSize:10,fontWeight:"600",color:colors.primaryDark},more:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:colors.cardSecondary},content:{padding:14,paddingBottom:40,gap:12},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider,borderRadius:14,padding:14,gap:9},orangeCard:{backgroundColor:colors.cardSecondary,borderColor:colors.border},greenCard:{backgroundColor:colors.successBackground,borderColor:"#BBF7D0"},blueCard:{borderColor:"#DBEAFE"},cardTitle:{fontSize:11,fontWeight:"600",letterSpacing:.7,color:colors.secondary},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},strongRow:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:9,marginTop:2},rowLabel:{fontSize:13,color:colors.secondary},rowValue:{fontSize:13,color:colors.heading,textAlign:"right",flexShrink:1},strong:{fontWeight:"700",fontSize:15},good:{color:colors.successText},bad:{color:colors.dangerText},timeline:{gap:0},step:{flexDirection:"row",minHeight:52},rail:{width:28,alignItems:"center"},dot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:colors.muted,backgroundColor:colors.white,alignItems:"center",justifyContent:"center",zIndex:1},dotDone:{backgroundColor:colors.primary,borderColor:colors.primary},line:{position:"absolute",top:19,bottom:-1,width:2,backgroundColor:colors.divider},lineDone:{backgroundColor:colors.primary},stepText:{flex:1,paddingLeft:7,paddingBottom:12},stepName:{fontSize:13,fontWeight:"600",color:colors.heading},pending:{color:colors.muted,fontWeight:"400"},muted:{fontSize:11,color:colors.muted,marginTop:2},product:{flexDirection:"row",alignItems:"flex-start",gap:9,paddingVertical:3},productDivider:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:11,marginTop:3},productIcon:{width:38,height:38,borderRadius:10,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},productName:{fontSize:13,fontWeight:"600",color:colors.heading},productPrice:{fontSize:13,fontWeight:"600",color:colors.heading},cost:{fontSize:11,color:colors.successText,marginTop:3},customer:{flexDirection:"row",alignItems:"center",gap:11},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},avatarText:{fontSize:17,fontWeight:"600",color:colors.primaryDark},customerName:{fontSize:14,fontWeight:"600",color:colors.heading},customerLine:{fontSize:12,color:colors.secondary,marginTop:2},warning:{fontSize:11,color:colors.warningText,marginTop:3},note:{fontSize:13,lineHeight:20,color:colors.secondary},state:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:24,backgroundColor:colors.background},stateTitle:{fontSize:18,fontWeight:"600",color:colors.heading},primary:{backgroundColor:colors.primary,borderRadius:10,paddingHorizontal:18,paddingVertical:12,alignItems:"center",justifyContent:"center"},primaryText:{color:colors.white,fontSize:13,fontWeight:"600",textAlign:"center"},inlineError:{fontSize:12,color:colors.dangerText,textAlign:"center"},actionBar:{paddingHorizontal:14,paddingTop:10,paddingBottom:12,backgroundColor:colors.white,borderTopWidth:1,borderTopColor:colors.divider},actionRow:{flexDirection:"row",gap:9},actionHalf:{flex:1},secondaryAction:{minHeight:44,borderWidth:1,borderColor:colors.border,borderRadius:10,alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:10},secondaryText:{color:colors.primaryDark,fontSize:12,fontWeight:"600",textAlign:"center"},menuBackdrop:{flex:1,backgroundColor:colors.overlay,alignItems:"flex-end",paddingTop:58,paddingRight:12},menuCard:{width:240,borderRadius:14,backgroundColor:colors.white,padding:10,elevation:9},menuTitle:{fontSize:12,fontWeight:"700",color:colors.muted,paddingHorizontal:10,paddingVertical:7},menuAction:{minHeight:46,flexDirection:"row",alignItems:"center",gap:11,borderRadius:9,paddingHorizontal:10},menuText:{fontSize:13,color:colors.heading},menuDanger:{fontSize:13,color:colors.dangerText},sheetBackdrop:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.overlay,padding:16},sheet:{width:"100%",maxWidth:560,maxHeight:"88%",backgroundColor:colors.white,borderRadius:18,paddingHorizontal:0,paddingTop:0,paddingBottom:12},confirmCard:{width:"100%",gap:13,borderRadius:18,backgroundColor:colors.white,padding:18},sheetHeader:{minHeight:52,flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider,paddingHorizontal:14},sheetClose:{width:32,height:32,alignItems:"center",justifyContent:"center",borderRadius:16},sheetHeaderTitle:{flex:1,fontSize:16,fontWeight:"700",color:colors.heading},addCourier:{minHeight:34,flexDirection:"row",alignItems:"center",gap:2,borderRadius:8,backgroundColor:colors.primaryLight,paddingHorizontal:8},addCourierText:{fontSize:11,fontWeight:"700",color:colors.primaryDark},sheetFooter:{paddingHorizontal:14,paddingTop:11,borderTopWidth:1,borderTopColor:colors.divider},fullWidth:{width:"100%"},sheetHandle:{width:40,height:4,alignSelf:"center",borderRadius:3,backgroundColor:colors.divider,marginBottom:7},sheetTitle:{fontSize:17,fontWeight:"700",color:colors.heading,marginBottom:8},sheetContent:{gap:10,paddingHorizontal:16,paddingTop:15,paddingBottom:18},fieldLabel:{fontSize:12,fontWeight:"600",color:colors.secondary,marginTop:4},input:{minHeight:43,borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:11,color:colors.heading,backgroundColor:colors.white,fontSize:13},noCourier:{fontSize:12,color:colors.warningText,backgroundColor:colors.warningBackground,padding:10,borderRadius:9},sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},optional:{color:colors.muted,fontWeight:"400"},addDeliveryMan:{fontSize:11,fontWeight:"600",color:colors.primaryDark,paddingVertical:6},selectButton:{minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:11},selectText:{fontSize:13,color:colors.secondary},selectedCourier:{color:colors.heading,fontWeight:"600"},feeType:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.divider,borderRadius:9,paddingHorizontal:11},feeTypeOn:{backgroundColor:"#4F46E5",borderColor:"#4F46E5"},feeTypeText:{color:colors.secondary,fontSize:14,fontWeight:"600"},feeTypeTextOn:{color:colors.white},defaultCourier:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderWidth:1,borderColor:colors.divider,borderRadius:10},defaultCourierOn:{borderColor:"#6366F1",backgroundColor:"#EEF2FF"},nestedBackdrop:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:colors.overlay,paddingHorizontal:22},nestedSheet:{width:"100%",maxWidth:520,maxHeight:"88%",borderRadius:18,backgroundColor:colors.white,paddingVertical:12,overflow:"hidden"},courierOption:{minHeight:58,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:12,paddingVertical:8},courierName:{fontSize:13,fontWeight:"600",color:colors.heading}
});
