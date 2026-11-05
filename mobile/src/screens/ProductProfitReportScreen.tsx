import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, type Href } from "expo-router";
import { productSalesLink } from "../utils/productSalesLink";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useAuth } from "../auth/AuthContext";
import PopupSheet from "../components/PopupSheet";
import ReportDateField from "../components/ReportDateField";
import { reportToday, shiftReportDate } from "../components/reportDate";
import { colors } from "../theme";
import { profitBasis, profitMoney as money, type ProductProfitReport } from "../types/productProfit";
import { printProductProfit } from "../utils/productProfitPrint";

type ProductOption = { id: string; name: string; sku: string };
type Filters = { from: string; to: string; ids: string[] };
const initialFilters = (): Filters => { const to = reportToday(); return { from: to.slice(0, 8) + "01", to, ids: [] }; };

export default function ProductProfitReportScreen() {
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [result, setResult] = useState<{ key: string; report: ProductProfitReport } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [reload, setReload] = useState(0);
  const scope = `${auth.session?.businessId}:${auth.session?.branchId}`;
  const key = `${scope}:${JSON.stringify(filters)}:${reload}`;
  const data = result?.key === key ? result.report : null;
  const allowed = ["OWNER", "MANAGER"].includes(auth.session?.user.role ?? "");
  const valid = draft.from <= draft.to && (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 <= 3660;
  const changed = JSON.stringify(draft) !== JSON.stringify(filters);

  useEffect(() => { setDraft(initialFilters()); setFilters(initialFilters()); setSelection([]); setPicker(false); }, [auth.session?.businessId]);
  useEffect(() => {
    if (!allowed) return;
    let active = true; setOptionsLoading(true); setOptionsError(""); setOptions([]);
    api.current<ProductOption[]>("/reports/product-profit/products").then(value => { if (active) setOptions(value); })
      .catch(e => { if (active) setOptionsError((e as Error).message); }).finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [auth.session?.businessId, allowed, reload]);
  useEffect(() => {
    if (!allowed) return;
    let active = true; setLoading(true); setError(""); setPrintError("");
    const query = new URLSearchParams({ from: filters.from, to: filters.to });
    filters.ids.forEach(id => query.append("productIds", id));
    api.current<ProductProfitReport>(`/reports/product-profit?${query}`).then(report => { if (active) setResult({ key, report }); })
      .catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, allowed]);

  const selectionLabel = (ids: string[]) => ids.length ? ids.map(id => options.find(p => p.id === id)?.name ?? "Selected product").join(", ") : "All products";
  const preset = (kind: "today" | "7d" | "month") => {
    const to = reportToday();
    setDraft(current => ({ ...current, to, from: kind === "today" ? to : kind === "7d" ? shiftReportDate(to, -6) : to.slice(0, 8) + "01" }));
  };
  const print = async () => {
    if (!data || printing) return;
    setPrinting(true); setPrintError("");
    try { await printProductProfit(data, auth.session?.businesses.find(b => b.id === auth.session?.businessId)?.name ?? "Business", selectionLabel(filters.ids), auth.session?.branchName ?? "All branches", { businessId: auth.session?.businessId, branchId: auth.session?.branchId }); }
    catch (e) { setPrintError((e as Error).message); } finally { setPrinting(false); }
  };
  const openHistory = (productId: string) => {
    if (!data) return;
    const href = productSalesLink(productId, data.from, data.to, { businessId: auth.session?.businessId, branchId: auth.session?.branchId });
    if (Platform.OS === "web") window.open(href, "_blank", "noopener,noreferrer"); else router.push(href as Href);
  };
  const visibleOptions = options.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase()));
  if (!allowed) return <View style={s.state}><Text>This report is available to owners and managers.</Text></View>;

  return <View style={s.screen}><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><View style={s.grow}><Text style={s.eyebrow}>MANAGEMENT REPORT</Text><Text style={s.title}>Product Profit Report</Text><Text style={s.muted}>Sales, product costs and profit for your selected products.</Text></View>
      <Pressable accessibilityRole="button" disabled={!data || loading || changed || printing} onPress={() => void print()} style={[s.outline, (!data || loading || changed || printing) && s.disabled]}><Ionicons name="print-outline" size={18} color={colors.primaryDark}/><Text style={s.link}>{printing ? "Preparing…" : Platform.OS === "web" ? "Print / PDF" : "Export PDF"}</Text></Pressable>
    </View>
    <View style={s.panel}>
      <Text style={s.sectionTitle}>Filter report</Text>
      <View style={s.wrap}>{([["today", "Today"], ["7d", "Last 7 days"], ["month", "This month"]] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="button" onPress={() => preset(id)} style={s.chip}><Text style={s.link}>{label}</Text></Pressable>)}</View>
      <View style={s.wrap}><View style={s.dateField}><Text style={s.fieldLabel}>From date</Text><ReportDateField value={draft.from} onChange={from => setDraft(v => ({ ...v, from }))}/></View><View style={s.dateField}><Text style={s.fieldLabel}>To date</Text><ReportDateField value={draft.to} onChange={to => setDraft(v => ({ ...v, to }))}/></View></View>
      <Text style={s.fieldLabel}>Products</Text><Pressable accessibilityRole="button" onPress={() => { setSelection([...draft.ids]); setSearch(""); setPicker(true); }} style={s.select}><Text numberOfLines={2} style={s.grow}>{selectionLabel(draft.ids)}</Text><Ionicons name="chevron-down" size={18} color={colors.primaryDark}/></Pressable>
      {!valid && <Text accessibilityRole="alert" style={s.error}>Choose a valid date range of up to 10 years.</Text>}
      <View style={s.wrap}><Pressable accessibilityRole="button" disabled={!valid || loading} onPress={() => { setFilters({ ...draft, ids: [...draft.ids] }); setReload(v => v + 1); }} style={[s.primary, (!valid || loading) && s.disabled]}><Text style={s.primaryText}>{loading ? "Loading…" : "Apply filters"}</Text></Pressable>{changed && <Text style={s.muted}>Apply filters to update the report.</Text>}</View>
    </View>
    {loading ? <View style={s.state}><ActivityIndicator color={colors.primary}/><Text style={s.muted}>Loading product profit…</Text></View> : error ? <View style={s.panel}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setReload(v => v + 1)}><Text style={s.link}>Try again</Text></Pressable></View> : data && <>
      <Text style={s.muted}>{data.from} — {data.to} · {auth.session?.branchName ?? "All branches"} · {selectionLabel(filters.ids)}</Text>
      {data.totals.missingCostLines > 0 && <View style={s.warning}><Text style={s.warningText}>{data.totals.missingCostLines} sale lines have missing or zero saved purchase costs. Affected cost and profit totals are unavailable. Profit rankings omit incomplete entries.</Text></View>}
      <View style={s.wrap}><Metric label="Sales amount" value={money(data.totals.sales)} style={s.salesMetric}/><Metric label="Total product cost" value={money(data.totals.cost)} style={s.costMetric}/><Metric label="Product profit" value={money(data.totals.profit)} style={s.profitMetric}/></View>
      <View style={s.wrap}><Text style={s.muted}>Units sold: {data.totals.units.toLocaleString()}</Text><Text style={s.muted}>Profit margin: {data.totals.marginPercent == null ? "Not available" : `${data.totals.marginPercent}%`}</Text></View>
      {!data.daily.length && <View style={s.panel}><Text style={s.sectionTitle}>No completed sales in this selection</Text><Text style={s.muted}>Try a wider date range or choose other products. Confirmed orders awaiting delivery are not counted.</Text></View>}
      <View style={s.panel}><Text style={s.sectionTitle}>Daily profit</Text><View style={s.tableHeader}><Text style={[s.cell, s.bold]}>Date</Text><Text style={[s.cell, s.right, s.bold]}>Sales amount</Text><Text style={[s.cell, s.right, s.bold]}>Profit</Text></View>
        {data.daily.map(day => <View key={day.date} style={s.tableRow}><Text style={s.cell}>{day.date}</Text><Text style={[s.cell, s.right]}>{money(day.totals.sales)}</Text><Text style={[s.cell, s.right, day.totals.profit != null && day.totals.profit < 0 && s.error]}>{money(day.totals.profit)}</Text></View>)}
        <View style={s.tableTotal}><Text style={[s.cell, s.bold]}>Total profit</Text><Text style={[s.cell, s.right, s.bold]}>{money(data.totals.sales)}</Text><Text style={[s.cell, s.right, s.bold]}>{money(data.totals.profit)}</Text></View>
      </View>
      <Text style={s.sectionTitle}>Management summary</Text><View style={s.wrap}>
        <Summary title="Highest-profit day" name={data.topDay?.date} amount={data.topDay?.totals.profit} kind="profit"/>
        <Summary onPress={data.topProduct ? () => openHistory(data.topProduct!.id) : undefined} title="Highest-profit product" name={data.topProduct?.name} amount={data.topProduct?.totals.profit} kind="profit"/>
        <Summary title="Top buying customer" name={data.topBuyingCustomer?.name} amount={data.topBuyingCustomer?.totals.sales} kind="sales"/>
        <Summary title="Most profitable customer" name={data.topProfitCustomer?.name} amount={data.topProfitCustomer?.totals.profit} kind="profit"/>
      </View><Text style={s.muted}>Customer rankings exclude anonymous sales and use only the selected products and dates.</Text>
      <View style={s.panel}><Text style={s.sectionTitle}>Profit by product</Text><Text style={s.muted}>Highest profit first · loss-making products shown in red</Text>
        {data.products.map(p => <View key={p.id} style={s.product}><View style={s.grow}><Pressable accessibilityRole="link" accessibilityLabel={`View ${p.name}`} onPress={() => router.push(`/products/${p.id}` as Href)}><Text style={s.link}>{p.name}</Text></Pressable><Text style={s.muted}>{p.totals.units} units · Sales {money(p.totals.sales)}</Text><Text style={s.muted}>Product cost {money(p.totals.cost)}</Text></View><Text style={[s.bold, p.totals.profit != null && p.totals.profit < 0 ? s.error : s.good]}>{money(p.totals.profit)}</Text></View>)}
      </View>
      <View style={s.panel}><Text style={s.sectionTitle}>How this report is calculated</Text><Text style={s.muted}>{profitBasis}</Text><Text style={s.muted}>Product profit = sales after discounts − saved cost per sold order item × quantity. This is not net business profit. Days without eligible sales are omitted.</Text></View>
    </>}
    {!!printError && <Text accessibilityRole="alert" style={s.error}>{printError}</Text>}
  </ScrollView>
  <PopupSheet visible={picker} onClose={() => setPicker(false)} title="Select products">
    <View style={s.pickerSearch}><TextInput accessibilityLabel="Search products" placeholder="Search product name or SKU" value={search} onChangeText={setSearch} style={s.input}/></View>
    {optionsLoading ? <View style={s.state}><ActivityIndicator color={colors.primary}/></View> : optionsError ? <View style={s.state}><Text style={s.error}>{optionsError}</Text><Pressable onPress={() => setReload(v => v + 1)}><Text style={s.link}>Retry product list</Text></Pressable></View> : <FlatList style={s.list} data={visibleOptions} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled" ListHeaderComponent={<CheckRow checked={!selection.length} title="All products" onPress={() => setSelection([])}/>} ListEmptyComponent={<Text style={s.empty}>No matching products.</Text>} renderItem={({ item }) => <CheckRow checked={selection.includes(item.id)} title={item.name} subtitle={item.sku} onPress={() => setSelection(current => {
      // First individual click switches from All to just that product.
      if (!current.length) return [item.id];
      return current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id];
    })}/>}/>}<View style={s.pickerFooter}><Text style={s.muted}>{selection.length ? `${selection.length} selected` : "All products selected"}</Text><Pressable accessibilityRole="button" disabled={optionsLoading || !!optionsError} onPress={() => { setDraft(v => ({ ...v, ids: [...selection].sort() })); setPicker(false); }} style={[s.primary, (optionsLoading || !!optionsError) && s.disabled]}><Text style={s.primaryText}>Use selection</Text></Pressable></View>
  </PopupSheet></View>;
}

function Metric({ label, value, style }: { label: string; value: string; style: object }) { return <View style={[s.metric, style]}><Text style={s.fieldLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.metricValue}>{value}</Text></View>; }
function Summary({ title, name, amount, kind, onPress }: { title: string; name?: string; amount?: number | null; kind: string; onPress?: () => void }) { return <View style={s.summary}><Text style={s.fieldLabel}>{title}</Text>{onPress && name ? <Pressable accessibilityRole="link" onPress={onPress}><Text style={s.link}>{name} ↗</Text></Pressable> : <Text style={s.bold}>{name ?? "No eligible sales"}</Text>}{name && <Text style={[s.summaryAmount, amount != null && amount < 0 ? s.error : s.good]}>{money(amount)} {kind}</Text>}</View>; }
function CheckRow({ checked, title, subtitle, onPress }: { checked: boolean; title: string; subtitle?: string; onPress: () => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={title} onPress={onPress} style={s.checkRow}><Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? colors.primaryDark : colors.muted}/><View style={s.grow}><Text style={s.bold}>{title}</Text>{!!subtitle && <Text style={s.muted}>{subtitle}</Text>}</View></Pressable>; }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, page: { padding: 12, paddingBottom: 32, gap: 12, width: "100%", maxWidth: 1120, alignSelf: "center" },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }, grow: { flex: 1, minWidth: 0, gap: 4 }, eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 1 }, title: { fontSize: 23, fontWeight: "800", color: colors.heading }, muted: { fontSize: 12, lineHeight: 19, color: colors.secondary },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 13, padding: 10, gap: 7 }, sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.heading }, fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.secondary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }, dateField: { flex: 1, minWidth: 210, gap: 4 }, chip: { minHeight: 34, paddingHorizontal: 10, justifyContent: "center", backgroundColor: colors.primaryLight, borderRadius: 8 }, link: { fontSize: 13, color: colors.primaryDark, fontWeight: "700" }, outline: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  select: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, primary: { minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, primaryText: { fontSize: 13, fontWeight: "700", color: colors.white }, disabled: { opacity: 0.45 },
  metric: { flex: 1, minWidth: 0, padding: 8, gap: 4, borderWidth: 1, borderRadius: 10 }, salesMetric: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }, costMetric: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }, profitMetric: { backgroundColor: colors.successBackground, borderColor: "#BBF7D0" }, metricValue: { fontSize: 15, fontWeight: "700", color: colors.heading }, good: { color: colors.successText }, error: { color: colors.dangerText, fontSize: 11 }, warning: { padding: 10, borderRadius: 10, backgroundColor: colors.warningBackground }, warningText: { fontSize: 12, lineHeight: 19, color: colors.warningText },
  tableHeader: { flexDirection: "row", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, tableRow: { flexDirection: "row", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, tableTotal: { flexDirection: "row", gap: 8, paddingVertical: 8, backgroundColor: colors.cardSecondary }, cell: { flex: 1, fontSize: 12, color: colors.heading }, right: { textAlign: "right" }, bold: { fontWeight: "700", fontSize: 13, color: colors.heading },
  summary: { flexGrow: 1, flexBasis: 240, alignItems: "center", padding: 12, gap: 6, borderRadius: 12, backgroundColor: "#F3F6FA", borderWidth: 1, borderColor: colors.divider }, summaryAmount: { fontSize: 15, fontWeight: "700", textAlign: "center" }, product: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, state: { padding: 24, gap: 10, alignItems: "center", justifyContent: "center" },
  pickerSearch: { padding: 14 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, color: colors.heading }, list: { flex: 1, minHeight: 0 }, checkRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }, empty: { padding: 20, color: colors.secondary }, pickerFooter: { flexShrink: 0, padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.divider },
});
