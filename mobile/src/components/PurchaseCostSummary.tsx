import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

export default function PurchaseCostSummary({ productCost, additionalCosts }: { productCost: number; additionalCosts: number }) {
  const compact = useWindowDimensions().width < 600;
  const money = (value: number) => `৳${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return <View style={[s.financials, compact && { flexDirection: "column" }]}>{[["Product Purchase Cost", productCost], ["Additional Costs", additionalCosts], ["Total PO Cost", productCost + additionalCosts]].map(([label, amount], index) => <View key={String(label)} style={[s.financialMetric, index === 2 && s.grandTotal]}><View style={[s.inline, { justifyContent: "center" }]}><Ionicons name={index === 0 ? "cube-outline" : index === 1 ? "wallet-outline" : "receipt-outline"} size={16} color={colors.secondary} /><Text style={s.metricLabel}>{label}</Text>{index === 2 && <Text style={s.muted}>BDT</Text>}</View><Text style={[s.amount, index === 2 && { color: colors.primaryDark }]}>{money(Number(amount))}</Text></View>)}</View>;
}
const s = StyleSheet.create({
  financials: { flexDirection: "row", borderTopWidth: 1, borderColor: colors.divider, padding: 4, gap: 2 },
  financialMetric: { alignItems: "center", justifyContent: "center", flex: 1, paddingHorizontal: 8, paddingVertical: 6, gap: 3, minWidth: 0 },
  grandTotal: { backgroundColor: colors.primaryLight, borderRadius: 10 },
  amount: { textAlign: "center", color: colors.heading, fontSize: 18, fontWeight: "700" }, metricLabel: { color: colors.secondary, fontSize: 12 },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }, muted: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
});
