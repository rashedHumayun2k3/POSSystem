import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n/LocalizedText";

// One money movement line (title, detail, signed amount). Used by the Cash Book and Cash In / Out history.
const IN = "#047857", OUT = "#B91C1C";
const money = (v: number) => `৳${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CashTransactionRow({ title, sub, amount, first, highlight, onPress }: { title: string; sub: string; amount: number; first?: boolean; highlight?: boolean; onPress?: () => void }) {
  return <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} style={({ pressed }) => [s.row, !first && s.border, highlight && s.highlight, pressed && !!onPress && s.pressed]}>
    <View style={s.flex}>
      <Text numberOfLines={1} style={s.main}>{title}</Text>
      {!!sub && <Text numberOfLines={1} style={s.sub}>{sub}</Text>}
    </View>
    <Text style={[s.amt, { color: amount > 0 ? IN : OUT }]}>{`${amount > 0 ? "+" : "−"}${money(amount)}`}</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  row: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderTopWidth: 1, borderTopColor: "#F1F2F4" },
  pressed: { opacity: .7 },
  highlight: { backgroundColor: "#FFF4ED" },
  flex: { flex: 1, minWidth: 0 },
  main: { fontSize: 14, fontWeight: "500", color: "#111827" },
  sub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  amt: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
