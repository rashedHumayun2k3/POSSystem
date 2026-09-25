import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import { sampleOrders } from "../orders/sampleOrders";

type Item = { id?: string; variantSku: string; productName: string; variantLabel?: string; qty: number; unitPrice?: number; subtotal?: number; unitCostSnapshot?: number; lineProfit?: number; availableStock: number };
type Payment = { id: string; method: string; amount: number; receivedAt: string; recordedByName: string };
type OrderDetail = {
  id: string; orderNo: string; channel: string; customerName: string; customerPhone: string; customerAddress?: string;
  orderStatus: string; paymentStatus: string; fulfillmentStatus: string; isDraft: boolean; createdAt: string; createdByName?: string;
  subtotal?: number; discountAmount?: number; deliveryChargeCustomer?: number; totalAmount: number; totalPaid?: number; dueAmount: number;
  courierName?: string; trackingNo?: string; deliveryManName?: string; note?: string; confirmedAt?: string; handedOverAt?: string; deliveredAt?: string; returnedAt?: string;
  items: Item[]; payments?: Payment[]; economics?: { revenue: number; cost: number; profit: number };
};

const cash = (value = 0) => `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const date = (value?: string) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const label = (value: string) => value.replaceAll("_", " ");

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

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true); setError("");
    apiRef.current<OrderDetail>(`/orders/${id}`)
      .then(value => { if (active) setOrder(value); })
      .catch(e => {
        const sample = sampleOrders.find(item => item.id === id);
        if (active && sample) setOrder({ ...sample, createdAt: `${sample.businessDate}T00:00:00`, items: sample.items });
        else if (active) setError((e as Error).message || "Could not load this order.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, reload, auth.session?.businessId, auth.session?.branchId]);

  if (loading && !order) return <View style={s.state}><ActivityIndicator size="large" color={colors.primary}/><Text style={s.muted}>Loading order…</Text></View>;
  if (!order) return <View style={s.state}><Ionicons name="alert-circle-outline" size={38} color={colors.danger}/><Text style={s.stateTitle}>Order not found</Text><Text style={s.muted}>{error}</Text><Pressable onPress={() => setReload(v => v + 1)} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>;

  const subtotal = order.subtotal ?? order.items.reduce((sum, item) => sum + (item.subtotal ?? (item.unitPrice ?? 0) * item.qty), 0);
  const lifecycle = [
    { name: "Order placed", at: order.createdAt, done: true },
    { name: "Order confirmed", at: order.confirmedAt, done: !order.isDraft },
    { name: "Handed to courier", at: order.handedOverAt, done: ["IN_TRANSIT", "DELIVERED", "RETURNED"].includes(order.fulfillmentStatus) },
    { name: order.fulfillmentStatus === "RETURNED" ? "Returned" : "Delivered", at: order.returnedAt ?? order.deliveredAt, done: ["DELIVERED", "RETURNED"].includes(order.fulfillmentStatus) },
  ];

  return <View style={s.screen}>
    <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.heading}/></Pressable><View style={s.flex}><Text style={s.headerTitle}>Order Details</Text><Text style={s.orderNo}>{order.orderNo}</Text></View><View style={s.status}><Text style={s.statusText}>{order.orderStatus === "CANCELLED" ? "CANCELLED" : label(order.fulfillmentStatus)}</Text></View></View>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)} colors={[colors.primary]}/>} contentContainerStyle={s.content}>
      <Card title="ORDER PROGRESS" tone="orange"><View style={s.timeline}>{lifecycle.map((step, index) => <View key={step.name} style={s.step}><View style={s.rail}><View style={[s.dot, step.done && s.dotDone]}>{step.done && <Ionicons name="checkmark" size={12} color={colors.white}/>}</View>{index < lifecycle.length - 1 && <View style={[s.line, step.done && s.lineDone]}/>}</View><View style={s.stepText}><Text style={[s.stepName, !step.done && s.pending]}>{step.name}</Text><Text style={s.muted}>{step.done ? date(step.at) : "Pending"}</Text></View></View>)}</View></Card>

      <Card title="ORDER INFORMATION"><Row name="Order number" value={order.orderNo}/><Row name="Order date" value={date(order.createdAt)}/><Row name="Channel" value={label(order.channel)}/><Row name="Payment" value={label(order.paymentStatus)}/>{order.createdByName && <Row name="Created by" value={order.createdByName}/>}</Card>

      <Card title={`PRODUCTS (${order.items.length})`} tone="blue">{order.items.map((item, index) => <View key={item.id ?? `${item.variantSku}-${index}`} style={[s.product, index > 0 && s.productDivider]}><View style={s.productIcon}><Ionicons name="cube-outline" size={21} color={colors.primaryDark}/></View><View style={s.flex}><Text style={s.productName}>{item.productName}</Text><Text style={s.muted}>{item.variantLabel || item.variantSku} · Qty: {item.qty} · Stock: {item.availableStock}</Text>{item.unitCostSnapshot !== undefined && <Text style={s.cost}>Unit cost: {cash(item.unitCostSnapshot)}{item.lineProfit !== undefined ? `  ·  Profit: ${cash(item.lineProfit)}` : ""}</Text>}</View><Text style={s.productPrice}>{cash(item.subtotal ?? (item.unitPrice ?? 0) * item.qty)}</Text></View>)}</Card>

      <Card title="PAYMENT SUMMARY"><Row name="Subtotal" value={cash(subtotal)}/>{!!order.discountAmount && <Row name="Discount" value={`-${cash(order.discountAmount)}`}/>} {!!order.deliveryChargeCustomer && <Row name="Delivery charge" value={cash(order.deliveryChargeCustomer)}/>}<Row name="Total" value={cash(order.totalAmount)} strong/><Row name="Paid" value={cash(order.totalPaid ?? order.totalAmount - order.dueAmount)} tone="good"/><Row name="Amount due" value={cash(order.dueAmount)} tone={order.dueAmount > 0 ? "bad" : "good"}/></Card>

      <Card title="CUSTOMER"><View style={s.customer}><View style={s.avatar}><Text style={s.avatarText}>{order.customerName.charAt(0).toUpperCase()}</Text></View><View style={s.flex}><Text style={s.customerName}>{order.customerName}</Text><Text style={s.customerLine}>{order.customerPhone}</Text>{order.customerAddress && <Text style={s.customerLine}>{order.customerAddress}</Text>}</View></View></Card>

      {(order.courierName || order.trackingNo || order.deliveryManName) && <Card title="DELIVERY"><Row name="Courier" value={order.courierName ?? "—"}/>{order.trackingNo && <Row name="Tracking number" value={order.trackingNo}/>} {order.deliveryManName && <Row name="Delivery person" value={order.deliveryManName}/>}</Card>}

      {order.economics && <Card title="PRODUCT P&L" tone="green"><Row name="Sale" value={cash(order.economics.revenue)}/><Row name="Product cost" value={cash(order.economics.cost)}/><Row name="Profit" value={`${order.economics.profit >= 0 ? "+" : ""}${cash(order.economics.profit)}`} strong tone={order.economics.profit >= 0 ? "good" : "bad"}/>{order.paymentStatus !== "PAID" && <Text style={s.warning}>Profit is provisional until payment is received.</Text>}</Card>}
      {order.note && <Card title="ORDER NOTE"><Text style={s.note}>{order.note}</Text></Card>}
      {!!error && <Text style={s.inlineError}>{error}</Text>}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},header:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,paddingVertical:11,backgroundColor:colors.white,borderBottomWidth:1,borderBottomColor:colors.divider},back:{padding:7},flex:{flex:1,minWidth:0},headerTitle:{fontSize:17,fontWeight:"600",color:colors.heading},orderNo:{fontSize:11,color:colors.muted,marginTop:2},status:{backgroundColor:colors.primaryLight,borderRadius:999,paddingHorizontal:9,paddingVertical:5},statusText:{fontSize:10,fontWeight:"600",color:colors.primaryDark},content:{padding:14,paddingBottom:40,gap:12},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider,borderRadius:14,padding:14,gap:9},orangeCard:{backgroundColor:colors.cardSecondary,borderColor:colors.border},greenCard:{backgroundColor:colors.successBackground,borderColor:"#BBF7D0"},blueCard:{borderColor:"#DBEAFE"},cardTitle:{fontSize:11,fontWeight:"600",letterSpacing:.7,color:colors.secondary},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:12},strongRow:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:9,marginTop:2},rowLabel:{fontSize:13,color:colors.secondary},rowValue:{fontSize:13,color:colors.heading,textAlign:"right",flexShrink:1},strong:{fontWeight:"700",fontSize:15},good:{color:colors.successText},bad:{color:colors.dangerText},timeline:{gap:0},step:{flexDirection:"row",minHeight:52},rail:{width:28,alignItems:"center"},dot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:colors.muted,backgroundColor:colors.white,alignItems:"center",justifyContent:"center",zIndex:1},dotDone:{backgroundColor:colors.primary,borderColor:colors.primary},line:{position:"absolute",top:19,bottom:-1,width:2,backgroundColor:colors.divider},lineDone:{backgroundColor:colors.primary},stepText:{flex:1,paddingLeft:7,paddingBottom:12},stepName:{fontSize:13,fontWeight:"600",color:colors.heading},pending:{color:colors.muted,fontWeight:"400"},muted:{fontSize:11,color:colors.muted,marginTop:2},product:{flexDirection:"row",alignItems:"flex-start",gap:9,paddingVertical:3},productDivider:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:11,marginTop:3},productIcon:{width:38,height:38,borderRadius:10,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},productName:{fontSize:13,fontWeight:"600",color:colors.heading},productPrice:{fontSize:13,fontWeight:"600",color:colors.heading},cost:{fontSize:11,color:colors.successText,marginTop:3},customer:{flexDirection:"row",alignItems:"center",gap:11},avatar:{width:42,height:42,borderRadius:21,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"},avatarText:{fontSize:17,fontWeight:"600",color:colors.primaryDark},customerName:{fontSize:14,fontWeight:"600",color:colors.heading},customerLine:{fontSize:12,color:colors.secondary,marginTop:2},warning:{fontSize:11,color:colors.warningText,marginTop:3},note:{fontSize:13,lineHeight:20,color:colors.secondary},state:{flex:1,alignItems:"center",justifyContent:"center",gap:12,padding:24,backgroundColor:colors.background},stateTitle:{fontSize:18,fontWeight:"600",color:colors.heading},primary:{backgroundColor:colors.primary,borderRadius:10,paddingHorizontal:18,paddingVertical:10},primaryText:{color:colors.white,fontSize:13,fontWeight:"600"},inlineError:{fontSize:12,color:colors.dangerText,textAlign:"center"}
});
