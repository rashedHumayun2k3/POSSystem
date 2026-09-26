import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../auth/AuthContext";

type Point = { label: string; value: number };
type Summary = {
  todaySales: number; yesterdaySales: number; salesChangePercent: number | null;
  todayProfit: number | null; todayMarginPercent: number | null; todayOrders: number;
  pendingOrders: number; pendingDeliveries: number; todayReturns: number;
  lowStockCount: number; outOfStockCount: number; customerReceivable: number;
  customersWithDue: number; moneyAtCourier: number; todayCash: number;
  supplierPayable: number | null; suppliersWithDue: number | null;
  sevenDaySales: Point[]; topProductsToday: { name: string; quantity: number; revenue: number }[];
};
type Icon = keyof typeof Ionicons.glyphMap;
const cash = (value: number | null | undefined) => `৳${Number(value ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function HomeScreen() {
  const auth = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    auth.api<Summary>("/reports/home-summary").then(value => { if (active) setData(value); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.session?.businessId, auth.session?.branchId, reload]);
  const refresh = useCallback(() => setReload(v => v + 1), []);
  const business = auth.session?.businesses.find(item => item.id === auth.session?.businessId);
  const canSeeCosts = ["OWNER", "MANAGER"].includes(auth.session?.user.role ?? "OWNER");
  const date = new Intl.DateTimeFormat("en-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
  const stockAlerts = (data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0);
  const attention = useMemo(() => data ? [
    data.pendingOrders > 0 && { icon: "clipboard-outline" as Icon, title: `${data.pendingOrders} order${data.pendingOrders === 1 ? "" : "s"} needs processing`, detail: "Pack them or hand them over for delivery.", action: () => router.push({ pathname: "/orders", params: { tab: "WAITING_COURIER" } }) },
    stockAlerts > 0 && { icon: "archive-outline" as Icon, title: `${stockAlerts} products need stock attention`, detail: `${data.lowStockCount} low stock, ${data.outOfStockCount} out of stock.`, action: undefined },
    data.pendingDeliveries > 0 && { icon: "car-outline" as Icon, title: `${data.pendingDeliveries} pending deliveries`, detail: "Review orders waiting for delivery.", action: () => router.push({ pathname: "/orders", params: { tab: "PENDING" } }) },
    data.todayReturns > 0 && { icon: "return-down-back-outline" as Icon, title: `${data.todayReturns} returns today`, detail: "Review returned orders.", action: () => router.push({ pathname: "/orders", params: { tab: "RETURNED" } }) },
  ].filter(Boolean) as { icon: Icon; title: string; detail: string; action?: () => void }[] : [], [data, stockAlerts]);

  if (loading && !data) return <View style={s.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={s.muted}>Loading dashboard…</Text></View>;
  if (error || !data) return <View style={s.state}><Ionicons name="warning-outline" size={36} color={colors.danger} /><Text style={s.heading}>Could not load dashboard</Text><Text style={s.muted}>{error}</Text><Pressable style={s.retry} onPress={refresh}><Text style={s.retryText}>Try again</Text></Pressable></View>;

  const salesDetail = data.salesChangePercent === null ? `Yesterday: ${cash(data.yesterdaySales)}` : data.salesChangePercent === 0 ? "Same as yesterday" : `${Math.abs(data.salesChangePercent)}% ${data.salesChangePercent > 0 ? "more" : "less"} than yesterday`;
  const actions: { label: string; icon: Icon; color: string; press?: () => void }[] = [
    { label: "New Order", icon: "clipboard-outline", color: colors.primary, press: () => router.push("/orders/new") },
    { label: "New Sale", icon: "cart-outline", color: colors.primary, press: () => router.push("/sale") },
    { label: "Sales Record", icon: "cash-outline", color: colors.primary, press: () => router.push("/more/reports/sales") },
    { label: "New Purchase", icon: "car-outline", color: colors.primary, press: () => router.push("/more/purchases/new") },
    { label: "Add Expense", icon: "logo-usd", color: colors.primary, press: () => router.push("/more/expenses/new") },
    { label: "Customers", icon: "people-outline", color: colors.primary, press: () => router.push("/more/customers") },
  ];
  return <ScrollView style={s.root} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
    <View style={s.welcome}><Text style={s.welcomeText}>Welcome back, {auth.session?.user.name}</Text><View style={s.businessRow}><Text numberOfLines={1} style={s.business}>{business?.name ?? "LavLokshan"}</Text><Text style={s.date}>{date}</Text></View></View>
    <View style={s.body}>
      <SectionTitle title="Business today" link="Closing summary" />
      <View style={s.infoGrid}>
        <Info value={data.todayOrders} label="Orders today" color={colors.infoText} action={() => router.push("/orders")} />
        <Info value={data.pendingOrders} label="Orders awaiting action" color={colors.primaryDark} action={() => router.push({ pathname: "/orders", params: { tab: "WAITING_COURIER" } })} />
        <Info value={stockAlerts} label="Stock alerts" color="#be123c" />
        <Info value={data.pendingDeliveries} label="Pending deliveries" color={colors.infoText} action={() => router.push({ pathname: "/orders", params: { tab: "PENDING" } })} />
      </View>
      <View style={s.metricGrid}><Metric label="Today's sales" value={cash(data.todaySales)} detail={salesDetail} icon="trending-up-outline" tone="green" />{canSeeCosts && data.todayProfit !== null && <Metric label="Today's profit" value={cash(data.todayProfit)} detail={`Margin: ${data.todayMarginPercent ?? 0}%`} icon="logo-usd" tone="amber" />}</View>

      <SectionTitle title="Quick Actions" />
      <View style={s.actions}>{actions.map(item => <Pressable key={item.label} onPress={item.press} style={({ pressed }) => [s.action, { backgroundColor: item.color }, pressed && s.pressed]}><View style={s.actionIcon}><Ionicons name={item.icon} size={21} color={colors.white} /></View><Text style={s.actionText}>{item.label}</Text></Pressable>)}</View>

      <Pressable onPress={() => setHot(v => !v)} style={s.hot}><Ionicons name="notifications" size={20} color={colors.primaryDark} /><Text style={s.hotText}>Hot notifications</Text><Ionicons name={hot ? "chevron-up" : "chevron-down"} size={17} color={colors.primaryDark} /></Pressable>
      {hot && <View style={s.hotBody}>
        <SectionTitle title="Attention required" />
        {attention.length ? attention.map(item => <Pressable key={item.title} onPress={item.action} style={s.attention}><View style={s.attentionIcon}><Ionicons name={item.icon} size={21} color={colors.primaryDark} /></View><View style={s.grow}><Text style={s.attentionTitle}>{item.title}</Text><Text style={s.attentionDetail}>{item.detail}</Text></View><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Pressable>) : <View style={s.clear}><Ionicons name="checkmark-circle-outline" size={28} color={colors.success} /><View><Text style={s.attentionTitle}>All clear</Text><Text style={s.attentionDetail}>Nothing needs your attention right now.</Text></View></View>}

        <SectionTitle title="Products Need Restock" link="View report" />
        {stockAlerts === 0 ? <View style={s.clear}><Ionicons name="checkmark-circle-outline" size={28} color={colors.success} /><Text style={s.clearText}>No low stock products right now</Text></View> : <View style={s.stockWarn}><Ionicons name="archive-outline" size={25} color={colors.white} /><View style={s.grow}><Text style={s.stockTitle}>{stockAlerts} products need restocking</Text><Text style={s.stockDetail}>{data.lowStockCount} low stock · {data.outOfStockCount} out of stock</Text></View></View>}

        {canSeeCosts && <><SectionTitle title="Receivables and payables" /><MoneyRow label="Customer receivable" detail={`${data.customersWithDue} customer${data.customersWithDue === 1 ? "" : "s"}`} value={cash(data.customerReceivable)} color={colors.infoText} /><MoneyRow label="Supplier payable" detail={`${data.suppliersWithDue ?? 0} suppliers`} value={cash(data.supplierPayable)} color={colors.dangerText} /><MoneyRow label="Courier receivable" detail="Waiting for courier remittance" value={cash(data.moneyAtCourier)} color={colors.primaryDark} /><MoneyRow label="Cash received today" detail="Cash payments only" value={cash(data.todayCash)} color={colors.successText} /></>}

        <SectionTitle title="Sales performance" subtitle="Last 7 days" link="View report" />
        <View style={s.chart}><Bars points={data.sevenDaySales} /><View style={s.top}><Text style={s.topTitle}>Top selling today</Text>{data.topProductsToday.length ? data.topProductsToday.slice(0, 5).map(item => <View key={item.name} style={s.topRow}><Text numberOfLines={1} style={s.grow}>{item.name}</Text><Text style={s.topValue}>{item.quantity} · {cash(item.revenue)}</Text></View>) : <Text style={s.attentionDetail}>No products have been sold today yet.</Text>}</View></View>
      </View>}
    </View>
  </ScrollView>;
}

function SectionTitle({ title, subtitle, link }: { title: string; subtitle?: string; link?: string }) { return <View style={s.section}><View><Text style={s.heading}>{title}</Text>{subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}</View>{link && <View style={s.linkRow}><Text style={s.link}>{link}</Text><Ionicons name="arrow-forward" size={14} color={colors.primary} /></View>}</View>; }
function Info({ value, label, color, action }: { value: number; label: string; color: string; action?: () => void }) { return <Pressable onPress={action} style={s.info}><Text style={[s.infoValue, { color }]}>{value}</Text><Text style={s.infoLabel}>{label}</Text></Pressable>; }
function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: Icon; tone: "green" | "amber" }) { const green = tone === "green"; return <View style={[s.metric, green ? s.metricGreen : s.metricAmber]}><View style={s.metricHead}><Text style={s.metricLabel}>{label}</Text><Ionicons name={icon} size={20} color={green ? colors.successText : colors.warningText} /></View><Text style={s.metricValue}>{value}</Text><Text style={s.metricDetail}>{detail}</Text></View>; }
function MoneyRow({ label, detail, value, color }: { label: string; detail: string; value: string; color: string }) { return <View style={s.moneyRow}><View style={s.grow}><Text style={s.moneyLabel}>{label}</Text><Text style={s.attentionDetail}>{detail}</Text></View><Text style={[s.moneyValue, { color }]}>{value}</Text></View>; }
function Bars({ points }: { points: Point[] }) { const max = Math.max(1, ...points.map(p => p.value)); return <View style={s.bars}>{points.map(point => <View key={point.label} style={s.barCol}><View style={[s.bar, { height: Math.max(2, (point.value / max) * 100) }]} /><Text style={s.barLabel}>{new Date(`${point.label}T00:00:00`).toLocaleDateString("en-BD", { weekday: "short" })}</Text></View>)}</View>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: 26 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, welcome: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 16, paddingVertical: 20 }, welcomeText: { color: colors.secondary, fontSize: 14 }, businessRow: { marginTop: 5, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }, business: { flex: 1, color: colors.heading, fontSize: 20, fontWeight: "700" }, date: { minWidth: 128, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.successBackground, color: colors.successText, textAlign: "center", fontSize: 12, fontWeight: "500" }, body: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 }, section: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heading: { color: colors.heading, fontSize: 14, fontWeight: "700" }, sectionSub: { color: colors.secondary, fontSize: 12, marginTop: 3 }, linkRow: { flexDirection: "row", alignItems: "center", gap: 4 }, link: { color: colors.primary, fontSize: 12, fontWeight: "500" }, infoGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 2 }, info: { width: "50%", flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 5 }, infoValue: { fontSize: 14, fontWeight: "700" }, infoLabel: { flexShrink: 1, color: colors.secondary, fontSize: 12 }, metricGrid: { flexDirection: "row", gap: 12 }, metric: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 16 }, metricGreen: { borderColor: colors.successBackground, backgroundColor: colors.successBackground }, metricAmber: { borderColor: colors.warningBackground, backgroundColor: colors.warningBackground }, metricHead: { minHeight: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, metricLabel: { color: colors.secondary, fontSize: 12, fontWeight: "500", textAlign: "center", flex: 1 }, metricValue: { color: colors.heading, fontSize: 24, fontWeight: "700", textAlign: "center", marginTop: 8 }, metricDetail: { color: colors.primaryDark, fontSize: 12, textAlign: "center", minHeight: 20, marginTop: 4 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, action: { width: "31.6%", minHeight: 96, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 8, padding: 12, elevation: 1 }, actionIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" }, actionText: { color: colors.white, fontSize: 12, lineHeight: 16, fontWeight: "600", textAlign: "center" }, pressed: { opacity: .82, transform: [{ scale: .98 }] }, hot: { marginTop: 10, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSecondary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }, hotText: { flex: 1, color: colors.primaryDark, fontSize: 14, fontWeight: "600" }, hotBody: { gap: 8 }, attention: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight, borderRadius: 8, padding: 12 }, attentionIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#ffffffb3", alignItems: "center", justifyContent: "center" }, grow: { flex: 1, minWidth: 0 }, attentionTitle: { color: colors.heading, fontSize: 14, fontWeight: "600" }, attentionDetail: { color: colors.secondary, fontSize: 12, marginTop: 3, lineHeight: 17 }, clear: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.successBackground, backgroundColor: colors.successBackground, borderRadius: 8, padding: 16 }, clearText: { color: colors.successText, fontSize: 14, fontWeight: "500" }, stockWarn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.primaryDark, borderRadius: 8, padding: 13 }, stockTitle: { color: colors.white, fontSize: 14, fontWeight: "600" }, stockDetail: { color: "#ffffffcc", fontSize: 12, marginTop: 3 }, moneyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, borderWidth: 1, borderColor: colors.infoBackground, backgroundColor: colors.infoBackground, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }, moneyLabel: { color: colors.heading, fontSize: 14, fontWeight: "500" }, moneyValue: { fontSize: 16, fontWeight: "700" }, chart: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white, borderRadius: 8, padding: 16 }, bars: { height: 140, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 15 }, barCol: { flex: 1, height: 125, alignItems: "center", justifyContent: "flex-end", gap: 7 }, bar: { width: "70%", backgroundColor: colors.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 }, barLabel: { color: colors.secondary, fontSize: 10 }, top: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16, marginTop: 12 }, topTitle: { color: colors.heading, fontSize: 12, fontWeight: "600", marginBottom: 8 }, topRow: { flexDirection: "row", gap: 10, paddingVertical: 5 }, topValue: { color: colors.heading, fontSize: 12, fontWeight: "600" }, muted: { color: colors.secondary, fontSize: 13, textAlign: "center" }, retry: { backgroundColor: colors.heading, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }, retryText: { color: colors.white, fontWeight: "600" }
});




