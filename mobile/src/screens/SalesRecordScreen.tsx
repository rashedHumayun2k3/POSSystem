import CollectDuePayment from "../components/CollectDuePayment";
import { Text } from "../i18n/LocalizedText";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import SharedDatePicker from "../components/SharedDatePicker";
import {reportToday} from "../components/reportDate";
import { validDate } from "../orders/model";
import { colors } from "../theme";

type Sale = {
  id: string; orderNo: string; businessDate: string; channel: string;
  paymentTerms?:string;isDraft?:boolean;dueAmount:number;paymentStatus: string; orderStatus: string; fulfillmentStatus: string;
  totalAmount: number; profit?: number | null; customerName: string;
  customerPhone?: string | null; handlingUserName?: string | null;
  items: { productName: string; variantSku?: string; qty: number }[];
};
type Channel = "" | "SHOP" | "ONLINE";
const resolveDate = (value?: string) => {
  if (value !== "today") return value && validDate(value) ? value : "";
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const money = (value: number) => `৳${value.toLocaleString()}`;

export default function SalesRecordScreen({ dueOnly = false, embedded = false, onDueChanged }: { dueOnly?: boolean; embedded?: boolean; onDueChanged?: () => void }) {
  const params = useLocalSearchParams<{ from?: string; to?: string; channel?: string }>();
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const { t, lang } = useLanguage();
  const [from, setFrom] = useState(() => resolveDate(params.from));
  const [to, setTo] = useState(() => resolveDate(params.to));
  const [channel, setChannel] = useState<Channel>(params.channel === "SHOP" || params.channel === "ONLINE" ? params.channel : "");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const invalidRange = !!from && !!to && from > to;
  useFocusEffect(useCallback(() => {
    let active = true;
    setOrders([]); setError("");
    if (invalidRange) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({paymentStatus:"PAID",includeCreditSales:"true"});
      if (dueOnly) query.set("dueOnly", "true");
      if (from) query.set("from", from);
      if (to) query.set("to", `${to}T23:59:59`);
      if (search.trim()) query.set("q", search.trim());
      api.current<Sale[]>(`/orders?${query}`)
        .then(value => { if (active) setOrders(value); })
        .catch(reason => { if (active) setError((reason as Error).message); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [dueOnly, from, to, search, invalidRange, reload, auth.session?.businessId, auth.session?.branchId]));
  const groups = new Map<string, Sale[]>();
  for (const order of orders) {
    if (dueOnly && order.dueAmount <= 0) continue;
    const creditSale=order.paymentTerms==="CREDIT"&&order.orderStatus==="COMPLETED"&&(order.channel==="SHOP"||order.channel==="HAWKER");
    if (order.isDraft || (!dueOnly&&order.paymentStatus!=="PAID"&&!creditSale) || order.orderStatus==="CANCELLED" || order.fulfillmentStatus==="RETURNED")continue;
    const shop = order.channel === "SHOP" || order.channel === "HAWKER";
    if ((channel === "SHOP" && !shop) || (channel === "ONLINE" && shop)) continue;
    const day = order.businessDate.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), order]);
  }
  const pendingSales = dueOnly ? [...groups.values()].flat() : [];
  const pendingTotal = pendingSales.reduce((sum, sale) => sum + Math.round(sale.dueAmount * 100), 0) / 100;
  const pendingCustomers = new Set(pendingSales.map(sale => {
    const phone = sale.customerPhone?.replace(/[^0-9]/g, "");
    return phone && phone !== "00000000000" ? phone : sale.customerName.trim().toLocaleLowerCase();
  })).size;
  return <View style={s.screen}>
    {!embedded&&<View style={s.header}><Pressable accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/sale")}><Ionicons name="chevron-back" size={23} color={colors.heading}/></Pressable><Text style={s.title}>{t(dueOnly ? "dueMenu" : "salesRecord.title")}</Text></View>}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)}/> }>
      {dueOnly && !loading && !error && !invalidRange && <View style={s.dueSummary}>
        <Text style={s.dueSummaryLabel}>{t("dueSummary.total")}</Text>
        <Text style={s.dueSummaryAmount}>৳{pendingTotal.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <Text style={s.dueSummaryHint}>{t(pendingCustomers === 1 ? "dueSummary.customer" : "dueSummary.customers", { count: pendingCustomers.toLocaleString(lang === "bn" ? "bn-BD" : "en-BD") })}</Text>
        {!!(from || to || search.trim()) && <Text style={s.dueSummaryHint}>{t("dueSummary.filtered")}</Text>}
      </View>}
      {!dueOnly&&<View style={s.tabs}>{([['', 'orders.channelAll'], ['SHOP', 'orders.channelShop'], ['ONLINE', 'orders.channelOnline']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: channel === value }} onPress={() => setChannel(value)} style={[s.tab, channel === value && s.active]}><Text style={s.text}>{t(label)}</Text></Pressable>)}</View>}
      <Text style={s.muted}>{t("From date")}</Text><SharedDatePicker label={t("From date")} value={from} onChange={setFrom} maximumDate={reportToday()} clearable/>
      <Text style={s.muted}>{t("To date")}</Text><SharedDatePicker label={t("To date")} value={to} onChange={setTo} maximumDate={reportToday()} clearable/>
      {!!(from || to) && <Pressable onPress={() => { setFrom(""); setTo(""); }}><Text style={s.link}>{t("common.clear")}</Text></Pressable>}
      <TextInput accessibilityLabel={t("orders.searchPlaceholder")} placeholder={t("orders.searchPlaceholder")} placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={s.search}/>
      {invalidRange && <Text style={s.error}>{t("Start date must be before end date.")}</Text>}
      {!!error && <View><Text style={s.error}>{error}</Text><Pressable onPress={() => setReload(v => v + 1)}><Text style={s.link}>{t("Retry")}</Text></Pressable></View>}
      {loading && <ActivityIndicator color={colors.primary}/>}
      {!loading && !error && !invalidRange && !groups.size && <Text style={s.empty}>{t("common.noData")}</Text>}
      {[...groups].sort(([a], [b]) => b.localeCompare(a)).map(([day, sales]) => {
        const closed = collapsed.has(day);
        const total = sales.reduce((sum, order) => sum + (dueOnly ? order.dueAmount : order.totalAmount), 0);
        const hasProfit = sales.every(order => typeof order.profit === "number");
        const date = new Date(`${day}T12:00:00`);
        return <View key={day} style={s.group}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !closed }} onPress={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(day)) next.delete(day); else next.add(day); return next; })} style={s.groupHeader}>
            <Ionicons name={closed ? "chevron-forward" : "chevron-down"} size={18} color={colors.primaryDark}/>
            <View style={s.grow}><Text style={s.heading}>{date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { day: "numeric", month: "long", year: "numeric" })}</Text><Text style={s.muted}>{date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-BD", { weekday: "long" })}</Text></View>
            <View><Text style={s.heading}>{t(dueOnly ? "posDue.remaining" : "orders.dayTotal")}: {money(total)}</Text>{!dueOnly && hasProfit && <Text style={s.muted}>{t("orders.dayProfit")}: {money(sales.reduce((sum, order) => sum + (order.profit ?? 0), 0))}</Text>}</View>
          </Pressable>
          {!closed && sales.map(order => <View key={order.id}><Pressable onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })} style={s.order}>
            <View style={s.row}><Text numberOfLines={2} style={[s.heading, s.grow]}>{order.items.map(item => `${item.productName}${item.variantSku ? ` (${item.variantSku})` : ""} ×${item.qty}`).join(", ") || order.orderNo}</Text><Text style={s.heading}>{money(order.totalAmount)}</Text></View>
            <Text style={s.muted}>{order.orderNo} · {order.channel}</Text>{order.dueAmount>0&&<Text style={{fontSize:12,fontWeight:"700",color:colors.dangerText}}>{t("posDue.remaining")}: {money(order.dueAmount)}</Text>}
            {order.customerPhone !== "00000000000" && <Text style={s.text}>{order.customerName} {order.customerPhone}</Text>}
            {!!order.handlingUserName && <Text style={s.muted}>→ {order.handlingUserName}</Text>}
          </Pressable>{dueOnly&&<View style={{padding:12,paddingTop:0}}><CollectDuePayment orderId={order.id} due={order.dueAmount} customer={order.customerName} onSaved={()=>{setReload(v=>v+1);onDueChanged?.();}}/></View>}</View>)}
        </View>;
      })}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  dueSummary: { borderRadius: 16, backgroundColor: colors.primaryDark, padding: 16 },
  dueSummaryLabel: { fontSize: 11, color: "#FFFFFFCC" },
  dueSummaryAmount: { fontSize: 25, fontWeight: "800", color: colors.white, marginTop: 2 },
  dueSummaryHint: { fontSize: 12, color: "#FFFFFFCC", marginTop: 4 },
  screen: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: colors.white }, title: { fontSize: 17, fontWeight: "700", color: colors.heading },
  content: { padding: 12, gap: 10, paddingBottom: 35 }, tabs: { flexDirection: "row", gap: 8 }, tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider }, active: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  search: { padding: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.white, color: colors.heading }, text: { fontSize: 13, color: colors.heading }, muted: { fontSize: 12, color: colors.secondary }, link: { color: colors.primaryDark, paddingVertical: 8 }, error: { color: colors.danger }, empty: { textAlign: "center", padding: 30, color: colors.muted },
  group: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: "hidden", backgroundColor: colors.white }, groupHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, backgroundColor: colors.primaryLight }, grow: { flex: 1 }, heading: { fontSize: 13, fontWeight: "600", color: colors.heading }, row: { flexDirection: "row", gap: 10 }, order: { padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: colors.divider },
});
