import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

// Past and current discount offers for one variant. Renders nothing when there is no history.
type Offer = { id: string; label: string; price: number; reason?: string | null; isActive: boolean; createdByName: string; startDate: string; endDate?: string | null; deletedAt?: string | null };
const money = (v: number) => `৳${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (v: string) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export default function DiscountHistory({ variantId, reload }: { variantId?: string; reload?: unknown }) {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const [rows, setRows] = useState<Offer[]>([]);
  useEffect(() => {
    if (!variantId) return;
    let active = true;
    api.current<Offer[]>(`/products/variants/${variantId}/discount-history`).then(r => { if (active) setRows(r); }).catch(() => { if (active) setRows([]); });
    return () => { active = false; };
  }, [variantId, reload]);
  if (!rows.length) return null;

  const now = Date.now();
  const status = (o: Offer) => o.deletedAt ? "Removed" : o.endDate && new Date(o.endDate).getTime() < now ? "Ended"
    : new Date(o.startDate).getTime() > now ? "Scheduled" : o.isActive ? "Active" : "Inactive";
  return <View style={s.card}>
    <Text style={s.title}>Discount History</Text>
    {rows.map((o, i) => {
      const st = status(o);
      return <View key={o.id} style={[s.row, i > 0 && s.border]}>
        <View style={s.flex}>
          <Text numberOfLines={1} style={s.label}>{o.label}</Text>
          <Text numberOfLines={2} style={s.sub}>{[`${day(o.startDate)} – ${o.endDate ? day(o.endDate) : "…"}`, o.createdByName, o.reason].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={s.right}>
          <Text style={s.price}>{money(o.price)}</Text>
          <Text style={[s.badge, st === "Active" ? s.on : st === "Scheduled" ? s.wait : s.off]}>{st}</Text>
        </View>
      </View>;
    })}
  </View>;
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.white, padding: 14 },
  title: { fontSize: 13, fontWeight: "700", color: colors.heading, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "600", color: colors.heading },
  sub: { fontSize: 11, color: colors.secondary, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 4 },
  price: { fontSize: 13, fontWeight: "700", color: colors.heading },
  badge: { fontSize: 10, fontWeight: "700", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  on: { backgroundColor: colors.successBackground, color: colors.successText },
  wait: { backgroundColor: colors.primaryLight, color: colors.primaryDark },
  off: { backgroundColor: colors.disabled, color: colors.secondary },
});
