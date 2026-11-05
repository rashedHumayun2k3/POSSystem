import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

type Sale = {
  id: string; orderNo: string; channel: string; source?: string | null; createdAt: string;
  totalAmount: number; paymentStatus: string; items: { productId: string; qty: number }[];
};
type SourceFilter = "ALL" | "POS" | "ORDER";

export default function ProductSalesHistoryScreen({ productId: suppliedProductId, productName }: { productId?: string; productName?: string } = {}) {
  const params = useLocalSearchParams<{ id?: string }>();
  const productId = suppliedProductId ?? (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const auth = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<SourceFilter>("ALL");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoading(true); setError("");
    auth.api<Sale[]>(`/products/${productId}/orders`)
      .then(value => { if (active) setSales(value); })
      .catch(e => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, auth.session?.businessId, auth.session?.branchId, reload]);

  const productSales = sales.filter(sale => sale.items.some(item => item.productId === productId));
  const filtered = productSales.filter(sale => {
    const isPos = sale.source === "POS" || sale.channel === "SHOP" || sale.channel === "HAWKER";
    return filter === "ALL" || (filter === "POS" ? isPos : !isPos);
  });
  if (loading) return <View style={s.state}><ActivityIndicator color={colors.primary}/><Text style={s.muted}>Loading sales history…</Text></View>;
  if (error) return <View style={s.state}><Text style={s.error}>{error}</Text><Pressable onPress={() => setReload(value => value + 1)}><Text style={s.action}>Try again</Text></Pressable></View>;

  return <ScrollView contentContainerStyle={s.content}>
    <View style={s.cardHead}><Text style={s.cardLabel}>Sales History</Text><Pressable accessibilityRole="link" onPress={() => router.push("/orders")}><Text style={s.action}>View all orders</Text></Pressable></View>
    <View style={s.filters}>{(["ALL", "POS", "ORDER"] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && s.filterTextActive]}>{value === "ALL" ? "All sales" : value === "POS" ? "POS sales" : "Order sales"}</Text></Pressable>)}</View>
    {!filtered.length ? <Text style={s.empty}>No sales found for this product.</Text> : filtered.map(sale => {
      const qty = sale.items.filter(item => item.productId === productId).reduce((sum, item) => sum + Number(item.qty), 0);
      const isPos = sale.source === "POS" || sale.channel === "SHOP" || sale.channel === "HAWKER";
      return <Pressable key={sale.id} onPress={() => router.push({ pathname: "/orders/[id]", params: { id: sale.id } })} style={s.saleRow}>
        <View style={s.saleCopy}><Text style={s.orderNo}>{sale.orderNo.startsWith("#") ? sale.orderNo : `#${sale.orderNo}`}</Text><Text style={s.muted}>{new Date(sale.createdAt).toLocaleDateString()} {new Date(sale.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {qty} pcs · {isPos ? "POS" : "Order"}</Text></View>
        <Text style={s.amount}>{`৳${Number(sale.totalAmount).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`}</Text>
        <Text style={[s.payment, sale.paymentStatus === "PAID" ? s.paid : s.due]}>{sale.paymentStatus === "PAID" ? "Paid" : "Due"}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { padding: 14, gap: 10 },
  cardHead: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardLabel: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  action: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  filters: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  filter: { minHeight: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.disabled },
  filterActive: { backgroundColor: colors.primary }, filterText: { color: colors.secondary, fontSize: 12 }, filterTextActive: { color: colors.white, fontWeight: "600" },
  saleRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 12, paddingVertical: 8 },
  saleCopy: { flex: 1, minWidth: 0, gap: 3 }, orderNo: { color: colors.heading, fontSize: 13, fontWeight: "700" }, muted: { color: colors.secondary, fontSize: 11 },
  amount: { color: colors.heading, fontSize: 12, fontWeight: "700" }, payment: { minWidth: 48, textAlign: "right", fontSize: 11, fontWeight: "600" }, paid: { color: colors.successText }, due: { color: colors.warningText },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 20 }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }, error: { color: colors.dangerText, fontSize: 12, textAlign: "center" },
});
