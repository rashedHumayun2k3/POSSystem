import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { DateFieldColumn, DateRangeRow } from "./DateRangeLayout";
import ReportDateField from "./ReportDateField";
import { reportToday } from "./reportDate";
import CashTransactionRow from "./CashTransactionRow";
import { type CashBookReport, type CashFilter, type CashPeriod, type CashRow, type CashSource, kindLabel, periodRange, sourceLabel, validRange } from "../utils/cashBook";

// Transactions panel (All / In / Out + list). Used by the Cash Book and Cash In / Out.
// Pass from/to to follow the parent's period; without them it shows its own Today / 7 Days / This Month / Custom filter.
const periods: { value: CashPeriod; label: string }[] = [{ value: "TODAY", label: "Today" }, { value: "7D", label: "7 Days" }, { value: "MONTH", label: "This Month" }, { value: "CUSTOM", label: "Custom" }];

export default function CashTransactions({ from, to, source = "ALL", reload = 0 }: { from?: string; to?: string; source?: CashSource; reload?: number }) {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const router = useRouter();
  const { t, lang } = useLanguage();
  const today = reportToday();
  const ownPeriod = !from || !to;
  const [period, setPeriod] = useState<CashPeriod>("TODAY");
  const [custom, setCustom] = useState(() => periodRange("7D", today));
  const [filter, setFilter] = useState<CashFilter>("ALL");
  const [data, setData] = useState<CashBookReport | null>(null);
  const [items, setItems] = useState<CashRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const range = !ownPeriod ? { from, to } : period === "CUSTOM" ? custom : periodRange(period, today);
  const rangeError = ownPeriod && period === "CUSTOM" ? validRange(custom.from, custom.to, today) : "";
  const scope = `${auth.session?.businessId}:${auth.session?.branchId}`;

  useEffect(() => { setPage(1); }, [range.from, range.to, source, filter, scope, reload, retry]);
  useEffect(() => {
    if (rangeError) { setLoading(false); return; }
    let active = true; setLoading(true); setError("");
    api.current<CashBookReport>(`/reports/cash-activity?from=${range.from}&to=${range.to}&source=${source}&direction=${filter}&page=${page}`)
      .then(r => { if (!active) return; setData(r); setItems(prev => page === 1 ? r.items ?? [] : [...prev, ...(r.items ?? [])]); })
      .catch(e => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to, source, filter, page, scope, reload, retry, rangeError]);

  const loc = lang === "bn" ? "bn-BD-u-nu-latn" : "en-GB";
  const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: "UTC" });
  // Date-only entries (e.g. capital added for a date) are stored as midnight UTC: no real time to show.
  const time = (at: string) => /T00:00:00(\.0+)?Z?$/.test(at) ? "" : new Date(at).toLocaleTimeString(lang === "bn" ? "bn-BD-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const openRow = (row: CashRow) => {
    if (row.referenceType === "ORDER") return router.push({ pathname: "/orders/[id]", params: { id: row.referenceId } });
    if (row.referenceType === "EXPENSE") return router.push({ pathname: "/more/expenses/[id]", params: { id: row.referenceId } });
    if (row.referenceType === "PURCHASE") return router.push({ pathname: "/more/purchases/[id]", params: { id: row.referenceId } });
  };
  const tabs: [CashFilter, string, number | undefined][] = [["ALL", "All", data?.allCount], ["IN", "In", data?.inCount], ["OUT", "Out", data?.outCount]];

  return <View style={s.panel}>
    <View style={s.head}>
      <Text style={s.h2}>Transactions</Text>
      {ownPeriod && <>
        <View style={s.seg}>
          {periods.map(p => <Pressable key={p.value} accessibilityRole="button" accessibilityState={{ selected: period === p.value }} onPress={() => setPeriod(p.value)} style={[s.segBtn, period === p.value && s.segOn]}>
            <Text style={[s.segText, period === p.value && s.segTextOn]}>{p.label}</Text>
          </Pressable>)}
        </View>
        {period === "CUSTOM" && <DateRangeRow style={s.dates}>
          <DateFieldColumn style={s.flex}><Text style={s.fieldLabel}>From</Text><ReportDateField value={custom.from} onChange={v => setCustom(c => ({ ...c, from: v }))} /></DateFieldColumn>
          <DateFieldColumn style={s.flex}><Text style={s.fieldLabel}>To</Text><ReportDateField value={custom.to} onChange={v => setCustom(c => ({ ...c, to: v }))} /></DateFieldColumn>
        </DateRangeRow>}
        {!!rangeError && <Text style={s.error}>{rangeError}</Text>}
      </>}
      <View style={s.tabs}>
        {tabs.map(([k, l, c]) => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: filter === k }} onPress={() => setFilter(k)} style={[s.tab, filter === k && s.tabOn]}>
          <Text style={[s.tabText, filter === k && s.tabTextOn]}>{l}</Text>{c !== undefined && <Text style={s.tabCount}>{` ${c}`}</Text>}
        </Pressable>)}
      </View>
    </View>
    {!data && loading ? <View style={s.empty}><ActivityIndicator color={colors.primary} /></View>
      : !data && error ? <View style={s.empty}><Text style={s.error}>{error}</Text><Pressable onPress={() => setRetry(v => v + 1)} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>
      : !items.length ? <View style={s.empty}><Text style={s.emptyTitle}>No money moved</Text><Text style={s.muted}>No money moved in this period.</Text></View>
      : items.map((row, i) => <CashTransactionRow key={`${row.id}-${row.source}`} first={i === 0} highlight={row.kind === "INVESTMENT"} onPress={() => openRow(row)} amount={row.amount} title={rowTitle(row, t)}
        sub={[range.from !== range.to ? fmtDate(row.date) : "", time(row.at), rowDetail(row), source !== "ALL" ? "" : sourceLabel(row.source, lang)].filter(Boolean).join(" · ")} />)}
    {data && items.length < data.totalItems && <Pressable disabled={loading} onPress={() => setPage(p => p + 1)} style={s.more}>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={s.moreText}>Load more</Text>}
    </Pressable>}
    {!!error && !!data && <Text style={[s.error, { padding: 10 }]}>{error}</Text>}
  </View>;
}

function rowTitle(row: CashRow, t: (value: string) => string) {
  if (row.referenceType === "ORDER") return `${t(kindLabel[row.kind])} #${row.title}`;
  if (row.referenceType === "EXPENSE") return `${t("Expense")}: ${row.title}`;
  return t(kindLabel[row.kind]);
}
function rowDetail(row: CashRow) {
  if (row.referenceType === "ORDER") return row.firstProduct ? `${row.firstProduct}${row.productCount > 1 ? ` +${row.productCount - 1}` : ""}` : "";
  return "";
}

const s = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: colors.white, overflow: "hidden" },
  head: { gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  h2: { fontSize: 15, fontWeight: "600", color: "#111827" },
  flex: { flex: 1, minWidth: 0 },
  muted: { fontSize: 13, color: "#6B7280" },
  seg: { flexDirection: "row", alignSelf: "flex-start", maxWidth: "100%", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: colors.white, padding: 3 },
  segBtn: { minHeight: 34, justifyContent: "center", borderRadius: 7, paddingHorizontal: 10 },
  segOn: { backgroundColor: "#111827" },
  segText: { fontSize: 13, fontWeight: "500", color: "#6B7280" }, segTextOn: { color: colors.white },
  dates: { flexDirection: "row", gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 4 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tab: { minHeight: 34, flexDirection: "row", alignItems: "center", borderRadius: 7, paddingHorizontal: 10 },
  tabOn: { backgroundColor: "#F3F4F6" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#6B7280" }, tabTextOn: { color: "#111827" },
  tabCount: { fontSize: 13, color: "#9CA3AF" },
  empty: { alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  more: { minHeight: 46, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: "#F1F2F4" },
  moreText: { fontSize: 13, fontWeight: "600", color: "#EA580C" },
  retry: { borderRadius: 9, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { fontSize: 12, fontWeight: "700", color: colors.white },
  error: { fontSize: 12, color: colors.dangerText, textAlign: "center" },
});
