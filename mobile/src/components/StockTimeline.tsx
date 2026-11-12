import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

export type StockHistoryEntry = {
  id: string; movementType: string; reason: string; qty: number; affectsStock: boolean; balanceAfter: number;
  note: string | null; userName: string | null; createdAt: string;
  refKind: "PO" | "ORDER" | null; refId: string | null; refNo: string | null; tag: string | null;
};
export type StockHistory = { onHand: number; committed: number; damaged: number; openingWithoutHistory: number; entries: StockHistoryEntry[] };

type Filter = "ALL" | "IN" | "OUT";
const DHAKA = "Asia/Dhaka";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: DHAKA });
const fmtQty = (n: number) => Number(n.toFixed(3)).toLocaleString("en-BD", { maximumFractionDigits: 3 });

const REASONS: Record<string, [string, string]> = {
  PURCHASE: ["নতুন কেনা", "New purchase"],
  SALE: ["বিক্রি হয়েছে", "Sold"],
  RETURN: ["কাস্টমার ফেরত দিয়েছে", "Customer return"],
  EXISTING_STOCK: ["আগের স্টক যোগ", "Existing stock"],
  FOUND_EXTRA: ["বাড়তি পাওয়া গেছে", "Found extra"],
  DAMAGED: ["নষ্ট হয়েছে", "Damaged"],
  LOST_THEFT: ["হারিয়ে / চুরি গেছে", "Lost / theft"],
  RECOUNT: ["গুনে ঠিক করা হয়েছে", "Recount correction"],
  VARIANT_SPLIT: ["ভ্যারিয়েন্টে ভাগ করা", "Split into variants"],
  DAMAGED_ARRIVAL: ["নষ্ট অবস্থায় এসেছে", "Damaged on arrival"],
  DAMAGED_RETURNED: ["নষ্ট পণ্য সাপ্লায়ারকে ফেরত", "Damaged returned to supplier"],
  DAMAGED_WRITEOFF: ["নষ্ট পণ্য বাদ দেওয়া হয়েছে", "Damaged written off"],
  OTHER: ["অন্যান্য", "Other"],
};

export default function StockTimeline({ history, lang }: { history: StockHistory | null; lang: string }) {
  const bn = lang === "bn";
  const say = (b: string, e: string) => (bn ? b : e);
  const wide = useWindowDimensions().width >= 768;
  const [filter, setFilter] = useState<Filter>("ALL");
  const node = wide ? 52 : 44, top = wide ? 64 : 56;

  const groups = useMemo(() => {
    const rows = (history?.entries ?? []).filter(e => filter === "ALL" || (filter === "IN" ? e.qty > 0 : e.qty < 0));
    const today = dayKey(new Date().toISOString());
    const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
    const out: { label: string; rows: StockHistoryEntry[] }[] = [];
    for (const r of rows) {
      const k = dayKey(r.createdAt);
      const label = k === today ? say("আজ", "Today") : k === yesterday ? say("গতকাল", "Yesterday")
        : new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: DHAKA });
      if (out[out.length - 1]?.label !== label) out.push({ label, rows: [] });
      out[out.length - 1].rows.push(r);
    }
    return out;
  }, [history, filter, bn]);

  if (!history) return null;
  const latest = history.entries[0];
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: DHAKA });
  const updated = latest ? `${new Date(latest.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: DHAKA })}, ${time(latest.createdAt)}` : "";
  const sellable = history.onHand - history.committed;
  const openRef = (e: StockHistoryEntry) => {
    if (!e.refId) return;
    router.push(e.refKind === "PO" ? `/more/purchases/${e.refId}` as never : `/orders/${e.refId}` as never);
  };

  return <View style={st.wrap}>
    <View style={st.headerRow}>
      <Text style={st.sectionLabel}>{say("স্টকের ইতিহাস", "STOCK HISTORY")}</Text>
      <View style={st.chips}>{([["ALL", "সব", "All"], ["IN", "যোগ", "Added"], ["OUT", "কমানো", "Removed"]] as const).map(([k, b, e]) =>
        <Pressable key={k} onPress={() => setFilter(k)} style={[st.chip, filter === k && st.chipActive]}><Text style={[st.chipText, filter === k && st.chipTextActive]}>{say(b, e)}</Text></Pressable>)}</View>
    </View>

    {/* Current stock = top node */}
    <View style={st.row}>
      <View style={[st.rail, { width: top }]}>
        <View style={[st.currentCircle, { width: top, height: top, borderRadius: top / 2 }]}><Text style={[st.currentText, wide && { fontSize: 22 }]}>{fmtQty(history.onHand)}</Text></View>
        {groups.length > 0 && <View style={st.line} />}
      </View>
      <View style={st.currentCopy}>
        <Text style={st.currentLabel}>{say("বর্তমান স্টক", "Current stock")}</Text>
        {!!updated && <Text style={st.muted}>{say("আপডেট", "Updated")} {updated}</Text>}
        {history.committed > 0 && <Text style={st.muted}>{say(`${fmtQty(history.committed)}টি অর্ডারের জন্য আলাদা রাখা (এখনো দোকান থেকে যায়নি) · বিক্রি করা যাবে ${fmtQty(sellable)}টি`, `${fmtQty(history.committed)} set aside for orders (still in the shop) · ${fmtQty(sellable)} can be sold`)}</Text>}
        {history.damaged > 0 && <Text style={st.muted}>{say(`নষ্ট (আলাদা রাখা): ${fmtQty(history.damaged)}টি`, `Damaged (kept separately): ${fmtQty(history.damaged)}`)}</Text>}
      </View>
    </View>

    {groups.length === 0 && <Text style={st.empty}>{filter === "ALL" ? say("এখনো কোনো স্টক পরিবর্তন হয়নি।", "No stock changes yet.") : say("এই ফিল্টারে কিছু নেই।", "Nothing for this filter.")}</Text>}

    {groups.map((g, gi) => <View key={g.label + gi}>
      <View style={st.row}><View style={[st.rail, { width: top }]}><View style={st.line} /></View><Text style={st.dayLabel}>{g.label}</Text></View>
      {g.rows.map((e, i) => {
        const last = gi === groups.length - 1 && i === g.rows.length - 1 && !(filter === "ALL" && history.openingWithoutHistory !== 0);
        const add = e.qty > 0;
        const before = e.affectsStock ? e.balanceAfter - e.qty : e.balanceAfter;
        const [rb, re] = REASONS[e.reason] ?? REASONS.OTHER;
        return <View key={e.id} style={st.row}>
          <View style={[st.rail, { width: top }]}>
            <View style={[st.qtyCircle, { width: node, height: node, borderRadius: node / 2 }, add ? st.inCircle : st.outCircle]}>
              <Text style={[st.qtyText, { color: add ? colors.successText : colors.dangerText }]}>{add ? "+" : "−"}{fmtQty(Math.abs(e.qty))}</Text>
            </View>
            {!last && <View style={st.line} />}
          </View>
          <View style={st.card}>
            <View style={st.titleRow}><Text style={st.title}>{say(rb, re)}</Text><Text style={st.time}>{time(e.createdAt)}</Text></View>
            <View style={st.metaRow}>
              {!!e.refNo && <Pressable disabled={!e.refId} onPress={() => openRef(e)} style={st.refBadge}><Text style={st.refText}>{e.refNo}</Text></Pressable>}
              {e.tag === "DAMAGED" && <View style={st.tag}><Text style={st.tagText}>{say("নষ্ট · বিক্রির স্টকে নেই", "Damaged · not in sellable stock")}</Text></View>}
              {!!e.userName && <Text style={st.muted}>{say("করেছেন", "by")} {e.userName}</Text>}
              <Text style={[st.muted, st.balance]}>{fmtQty(before)} → <Text style={st.balanceAfter}>{fmtQty(e.balanceAfter)}</Text></Text>
            </View>
            {!!e.note && <View style={st.noteBox}><Text style={st.noteText}>{e.note}</Text></View>}
          </View>
        </View>;
      })}
    </View>)}

    {filter === "ALL" && history.openingWithoutHistory !== 0 && <View style={st.row}>
      <View style={[st.rail, { width: top }]}><View style={[st.qtyCircle, st.openCircle, { width: node, height: node, borderRadius: node / 2 }]}><Text style={[st.qtyText, { color: colors.secondary }]}>{fmtQty(history.openingWithoutHistory)}</Text></View></View>
      <View style={st.card}><Text style={st.title}>{say("শুরুর স্টক (আগের কোনো রেকর্ড নেই)", "Opening stock (no earlier record)")}</Text><Text style={st.muted}>{say("এই পরিমাণ স্টক ইতিহাস রাখা শুরুর আগে থেকেই ছিল।", "This stock existed before history was recorded.")}</Text></View>
    </View>}
  </View>;
}

const st = StyleSheet.create({
  wrap: { gap: 0 },
  headerRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  chips: { flexDirection: "row", gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: colors.white },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 12, color: colors.secondary, fontWeight: "600" },
  chipTextActive: { color: colors.primaryDark },
  row: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  rail: { alignItems: "center" },
  line: { flex: 1, width: 2, minHeight: 10, backgroundColor: colors.divider },
  currentCircle: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  currentText: { color: colors.white, fontSize: 19, fontWeight: "800" },
  currentCopy: { flex: 1, minWidth: 0, justifyContent: "center", paddingBottom: 14, gap: 2 },
  currentLabel: { color: colors.heading, fontSize: 15, fontWeight: "700" },
  dayLabel: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: "700", paddingVertical: 8 },
  qtyCircle: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  inCircle: { borderColor: colors.success, backgroundColor: colors.successBackground },
  outCircle: { borderColor: colors.danger, backgroundColor: colors.dangerBackground },
  openCircle: { borderColor: colors.border, backgroundColor: colors.cardSecondary },
  qtyText: { fontSize: 13, fontWeight: "800" },
  card: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 6, marginBottom: 10 },
  titleRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 },
  title: { flexShrink: 1, color: colors.heading, fontSize: 14, fontWeight: "700" },
  time: { color: colors.muted, fontSize: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  refBadge: { borderRadius: 6, backgroundColor: colors.infoBackground, paddingHorizontal: 7, paddingVertical: 2 },
  refText: { color: colors.infoText, fontSize: 11, fontWeight: "700" },
  tag: { borderRadius: 6, backgroundColor: colors.warningBackground, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { color: colors.warningText, fontSize: 11, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 12 },
  balance: { marginLeft: "auto" },
  balanceAfter: { color: colors.heading, fontWeight: "800" },
  noteBox: { backgroundColor: colors.cardSecondary, borderRadius: 8, padding: 8 },
  noteText: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 20 },
});
