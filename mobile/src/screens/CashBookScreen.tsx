import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import CashTransactions from "../components/CashTransactions";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { DateFieldColumn, DateRangeRow } from "../components/DateRangeLayout";
import ReportDateField from "../components/ReportDateField";
import { reportToday } from "../components/reportDate";
import { type CashBookReport, type CashPeriod, type CashSource, periodRange, sourceLabel, validRange } from "../utils/cashBook";
import PageTitle from "../components/PageTitle";

const periods: { value: CashPeriod; label: string }[] = [{ value: "TODAY", label: "Today" }, { value: "7D", label: "7 Days" }, { value: "MONTH", label: "This Month" }, { value: "CUSTOM", label: "Custom" }];
const wallets = [{ id: "CASH", color: "#0F766E" }, { id: "BKASH", color: "#E2136E" }, { id: "NAGAD", color: "#F26522" }, { id: "CARD", color: "#4F46E5" }] as const;
type WalletId = typeof wallets[number]["id"];
const IN = "#047857", OUT = "#B91C1C";

export default function CashBookScreen() {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const { t, lang } = useLanguage();
  const today = reportToday();
  const [period, setPeriod] = useState<CashPeriod>("TODAY");
  const [custom, setCustom] = useState(() => periodRange("7D", today));
  const [source, setSource] = useState<CashSource>("ALL");
  const [walletData, setWalletData] = useState<Partial<Record<WalletId, CashBookReport>>>({});
  const [data, setData] = useState<CashBookReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const range = period === "CUSTOM" ? custom : periodRange(period, today);
  const rangeError = period === "CUSTOM" ? validRange(custom.from, custom.to, today) : "";
  const scope = `${auth.session?.businessId}:${auth.session?.branchId}`;
  const url = (src: string, dir: string, pg: number) => `/reports/cash-activity?from=${range.from}&to=${range.to}&source=${src}&direction=${dir}&page=${pg}`;

  // Wallet balances: one call per wallet, refreshed only when the period changes.
  useEffect(() => {
    if (rangeError) return;
    let active = true;
    Promise.all(wallets.map(w => api.current<CashBookReport>(url(w.id, "ALL", 1)).then(r => [w.id, r] as const)))
      .then(rows => { if (active) setWalletData(Object.fromEntries(rows)); }).catch(() => {});
    return () => { active = false; };
  }, [range.from, range.to, scope, reload, rangeError]);

  // Summary cards (the transaction list loads itself in CashTransactions).
  useEffect(() => {
    if (rangeError) { setLoading(false); return; }
    let active = true; setLoading(true); setError("");
    api.current<CashBookReport>(url(source, "ALL", 1))
      .then(r => { if (active) setData(r); })
      .catch(e => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range.from, range.to, source, scope, reload, rangeError]);

  const money = (n: number) => `৳${Math.abs(Number(n || 0)).toLocaleString(lang === "bn" ? "bn-BD-u-nu-latn" : "en-IN", { maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(lang === "bn" ? "bn-BD-u-nu-latn" : "en-GB", { ...opts, timeZone: "UTC" });
  const refresh = () => setReload(v => v + 1);
  const periodText = range.from === range.to
    ? `${range.to === today ? `${t("Today")} · ` : ""}${fmtDate(range.to, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
    : `${fmtDate(range.from, { day: "numeric", month: "short" })} – ${fmtDate(range.to, { day: "numeric", month: "short", year: "numeric" })}`;

  const walletClose = (id: WalletId) => walletData[id]?.closing ?? 0;
  const total = wallets.reduce((s, w) => s + walletClose(w.id), 0);
  const selected = source === "ALL" ? null : source as WalletId;
  const shown = selected ? [selected] : wallets.map(w => w.id);
  const now = shown.reduce((s, id) => s + walletClose(id), 0);
  const open = shown.reduce((s, id) => s + (walletData[id]?.opening ?? 0), 0);
  const diff = now - open;
  const ready = wallets.every(w => walletData[w.id]);


  return <View style={s.screen}>
    <View style={s.header}><View style={s.titleToolbar}><PageTitle>Cash Book</PageTitle></View></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} colors={[colors.primary]} />}>
      <View style={s.head}>
        <Text style={s.muted}>{periodText}</Text>
      </View>
      <View style={s.seg}>
        {periods.map(p => <Pressable key={p.value} accessibilityRole="button" accessibilityState={{ selected: period === p.value }} onPress={() => setPeriod(p.value)} style={[s.segBtn, period === p.value && s.segOn]}>
          <Text style={[s.segText, period === p.value && s.segTextOn]}>{p.label}</Text>
        </Pressable>)}
      </View>
      {period === "CUSTOM" && <DateRangeRow style={s.dates}>
        <DateFieldColumn style={s.flex}><Text style={s.fieldLabel}>From</Text><ReportDateField value={custom.from} onChange={from => setCustom(v => ({ ...v, from }))} /></DateFieldColumn>
        <DateFieldColumn style={s.flex}><Text style={s.fieldLabel}>To</Text><ReportDateField value={custom.to} onChange={to => setCustom(v => ({ ...v, to }))} /></DateFieldColumn>
      </DateRangeRow>}
      {!!rangeError && <Text style={s.error}>{rangeError}</Text>}

      <View style={s.panel}>
        <View style={s.total}>
          <View style={s.flex}>
            <Text style={s.label}>{selected ? `${sourceLabel(selected)} ${t("in hand")}` : t("Total money in hand")}</Text>
            {ready ? <Text style={s.big}>{`${now < 0 ? "−" : ""}${money(now)}`}</Text> : <ActivityIndicator style={s.bigLoader} color={colors.primary} />}
            {ready && <Text style={s.sub}>{`${t("Opening")} ${money(open)} · `}<Text style={{ color: diff >= 0 ? IN : OUT, fontWeight: "700" }}>{`${diff >= 0 ? "+" : "−"}${money(diff)} ${t(period === "TODAY" ? "today" : "in period")}`}</Text></Text>}
          </View>
          {selected && <Text style={s.scope}>{`${t("Showing")} ${sourceLabel(selected)} ${t("only")}`}</Text>}
        </View>
        <View style={s.wallets}>
          {wallets.map((w, i) => {
            const b = walletClose(w.id), pct = total > 0 ? Math.max(0, Math.round(b / total * 100)) : 0, on = selected === w.id;
            return <Pressable key={w.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSource(on ? "ALL" : w.id)}
              style={[s.wallet, i < wallets.length - 1 && s.walletBorder, on && s.walletOn]}>
              <View style={s.wTop}><View style={[s.dot, { backgroundColor: w.color }]} /><Text style={s.wName}>{sourceLabel(w.id)}</Text></View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={s.wAmt}>{walletData[w.id] ? `${b < 0 ? "−" : ""}${money(b)}` : "—"}</Text>
              <View style={s.bar}><View style={[s.barFill, { width: `${pct}%`, backgroundColor: w.color }]} /></View>
              <Text style={s.pct}>{`${pct}% ${t("of total")}`}</Text>
              {on && <View style={s.walletLine} />}
            </Pressable>;
          })}
        </View>
      </View>

      {data && <View style={s.kpis}>
        <Kpi label="Money In" value={`+${money(data.moneyIn)}`} color={IN} meta={`${data.inCount} ${t("entries")}`} />
        <Kpi label="Money Out" value={`−${money(data.moneyOut)}`} color={OUT} meta={t("Incl. purchases & refunds")} />
        <Kpi label="Partner Investment" value={money(data.investmentIn)} meta={`${t("Sales")} ${money(data.salesIn)}`} />
        <Kpi label="Expenses" value={money(data.expenseOut)} meta={`${t("Purchases")} ${money(data.purchaseOut)}`} />
      </View>}

      {!rangeError && <CashTransactions from={range.from} to={range.to} source={source} reload={reload} />}
      {!!error && <Text style={s.error}>{error}</Text>}
    </ScrollView>

  </View>;
}

function Kpi({ label, value, meta, color }: { label: string; value: string; meta: string; color?: string }) {
  return <View style={[s.panel, s.kpi]}>
    <Text style={s.label}>{label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit style={[s.kVal, color ? { color } : null]}>{value}</Text>
    <Text numberOfLines={1} style={s.kMeta}>{meta}</Text>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 16, paddingVertical: 12 },
  titleToolbar: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110, gap: 14 },
  flex: { flex: 1, minWidth: 0 },
  head: { gap: 2 },
  h1: { fontSize: 20, fontWeight: "700", color: "#111827" },
  h2: { fontSize: 15, fontWeight: "600", color: "#111827" },
  muted: { fontSize: 13, color: "#6B7280" },
  seg: { flexDirection: "row", alignSelf: "flex-start", maxWidth: "100%", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, backgroundColor: colors.white, padding: 3 },
  segBtn: { minHeight: 36, justifyContent: "center", borderRadius: 7, paddingHorizontal: 12 },
  segOn: { backgroundColor: "#111827" },
  segText: { fontSize: 13, fontWeight: "500", color: "#6B7280" }, segTextOn: { color: colors.white },
  dates: { flexDirection: "row", gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", marginBottom: 4 },
  panel: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: colors.white, overflow: "hidden" },
  total: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 10, padding: 18 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: .5, textTransform: "uppercase", color: "#6B7280" },
  big: { fontSize: 30, fontWeight: "700", color: "#111827", marginTop: 6, fontVariant: ["tabular-nums"] },
  bigLoader: { alignSelf: "flex-start", marginVertical: 12 },
  sub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  scope: { fontSize: 12, fontWeight: "600", color: "#EA580C", backgroundColor: "#FFF4ED", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden" },
  wallets: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  wallet: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 14 },
  walletBorder: { borderRightWidth: 1, borderRightColor: "#E5E7EB" },
  walletOn: { backgroundColor: "#FFF4ED" },
  walletLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: "#EA580C" },
  wTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  wName: { fontSize: 13, fontWeight: "600", color: "#111827" },
  wAmt: { fontSize: 15, fontWeight: "700", color: "#111827", marginTop: 6, fontVariant: ["tabular-nums"] },
  bar: { height: 4, borderRadius: 4, backgroundColor: "#F1F2F4", marginTop: 10, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 4 },
  pct: { fontSize: 11, color: "#9CA3AF", marginTop: 6 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { flexBasis: "47%", flexGrow: 1, padding: 14 },
  kVal: { fontSize: 19, fontWeight: "700", color: "#111827", marginTop: 8, fontVariant: ["tabular-nums"] },
  kMeta: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  txHead: { gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
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
