import { DateRangeRow, DateFieldColumn } from "../components/DateRangeLayout";
import DropdownText from "../components/DropdownText";
import ReportPeriodTabs from "../components/ReportPeriodTabs";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { router, type Href } from "expo-router";
import { productSalesLink } from "../utils/productSalesLink";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import PopupSheet from "../components/PopupSheet";
import ReportDateField from "../components/ReportDateField";
import { reportToday, shiftReportDate } from "../components/reportDate";
import { colors } from "../theme";
import { profitMoney as baseMoney, type ProductProfitReport } from "../types/productProfit";
import { printProductProfit } from "../utils/productProfitPrint";

type ProductOption = { id: string; name: string; sku: string };
type Filters = { from: string; to: string; ids: string[] };
const initialFilters = (): Filters => { const to = reportToday(); return { from: to.slice(0, 8) + "01", to, ids: [] }; };

export default function ProductProfitReportScreen() {
  const {t,lang}=useLanguage();
  const number=(value:number)=>value.toLocaleString(lang==="bn"?"bn-BD":"en-BD");
  const money=(value:number|null|undefined)=>value==null?t("profitReportText.unavailable"):baseMoney(value);
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const [selectedPeriod,setSelectedPeriod]=useState<"today"|"7d"|"month"|"lastMonth"|"custom">("month");
  const customDate=selectedPeriod==="custom";
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

  useEffect(()=>{
    if(!valid||!changed)return;
    const timer=setTimeout(()=>setFilters({...draft,ids:[...draft.ids]}),250);
    return()=>clearTimeout(timer);
  },[draft,valid,changed]);
  useEffect(() => { setSelectedPeriod("month"); setDraft(initialFilters()); setFilters(initialFilters()); setSelection([]); setPicker(false); }, [auth.session?.businessId]);
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

  const selectionLabel = (ids: string[]) => ids.length ? ids.map(id => options.find(p => p.id === id)?.name ?? t("profitReportText.selectedProduct")).join(", ") : t("profitReportText.all");
  const preset = (kind: "today" | "7d" | "month" | "lastMonth") => {
    setSelectedPeriod(kind);
    const today = reportToday();
    const to = kind === "lastMonth" ? shiftReportDate(today.slice(0, 8) + "01", -1) : today;
    const next={...draft,to,from:kind==="today"?to:kind==="7d"?shiftReportDate(to,-6):to.slice(0,8)+"01"};
    setDraft(next);setFilters({...next,ids:[...next.ids]});
  };
  const print = async () => {
    if (!data || printing) return;
    setPrinting(true); setPrintError("");
    try { await printProductProfit(data, auth.session?.businesses.find(b => b.id === auth.session?.businessId)?.name ?? "Business", selectionLabel(filters.ids), auth.session?.branchName ?? t("profitReportText.branches"), { businessId: auth.session?.businessId, branchId: auth.session?.branchId }); }
    catch (e) { setPrintError((e as Error).message); } finally { setPrinting(false); }
  };
  const openHistory = (productId: string) => {
    if (!data) return;
    const href = productSalesLink(productId, data.from, data.to, { businessId: auth.session?.businessId, branchId: auth.session?.branchId });
    if (Platform.OS === "web") window.open(href, "_blank", "noopener,noreferrer"); else router.push(href as Href);
  };
  const thisMonthDate=reportToday();
  const lastMonthDate=shiftReportDate(thisMonthDate.slice(0,8)+"01",-1);
  const monthLabel=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString(lang==="bn"?"bn-BD":"en-GB",{month:lang==="bn"?"long":"short"});
  const periodOptions:Array<{value:typeof selectedPeriod;label:string}>=[
    {value:"today",label:t("profitReportText.today")},
    {value:"7d",label:t("profitReportText.last7")},
    {value:"month",label:`${t("profitReportText.month")} (${monthLabel(thisMonthDate)})`},
    {value:"lastMonth",label:`${t("profitReportText.lastMonth")} (${monthLabel(lastMonthDate)})`},
    {value:"custom",label:t("salesReportLabels.customDate")}
  ];
  const visibleOptions = options.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase()));
  if (!allowed) return <View style={s.state}><Text>{t("profitReportText.permission")}</Text></View>;

  return <View style={s.screen}><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><View style={s.grow}><Text style={s.eyebrow}>{t("profitReportText.management")}</Text><Text style={s.title}>profitReportMenu</Text></View>
      <Pressable accessibilityRole="button" disabled={!data || loading || changed || printing} onPress={() => void print()} style={[s.outline, (!data || loading || changed || printing) && s.disabled]}><Ionicons name="print-outline" size={18} color={colors.primaryDark}/><Text style={s.link}>{printing ? t("profitReportText.preparing") : Platform.OS === "web" ? t("profitReportText.print") : t("profitReportText.export")}</Text></Pressable>
    </View>
    <View style={s.panel}>
      <Text style={s.sectionTitle}>{t("profitReportText.filter")}</Text>
      <ReportPeriodTabs wrapOnMobile items={periodOptions} selected={selectedPeriod} onChange={value=>value==="custom"?setSelectedPeriod("custom"):preset(value)}/>
      {customDate&&<DateRangeRow style={s.wrap}><DateFieldColumn style={s.dateField}><Text style={s.fieldLabel}>{t("profitReportText.from")}</Text><ReportDateField value={draft.from} onChange={from => setDraft(v => ({ ...v, from }))}/></DateFieldColumn><DateFieldColumn style={s.dateField}><Text style={s.fieldLabel}>{t("profitReportText.to")}</Text><ReportDateField value={draft.to} onChange={to => setDraft(v => ({ ...v, to }))}/></DateFieldColumn></DateRangeRow>}
      <Text style={s.fieldLabel}>{t("profitReportText.products")}</Text><Pressable accessibilityRole="button" onPress={() => { setSelection([...draft.ids]); setSearch(""); setPicker(true); }} style={s.select}><DropdownText numberOfLines={2} style={s.grow}>{selectionLabel(draft.ids)}</DropdownText><Ionicons name="chevron-down" size={18} color={colors.primaryDark}/></Pressable>
      {!valid && <Text accessibilityRole="alert" style={s.error}>{t("profitReportText.rangeError")}</Text>}
    </View>
    {loading ? <View style={s.state}><ActivityIndicator color={colors.primary}/><Text style={s.muted}>{t("profitReportText.loadingReport")}</Text></View> : error ? <View style={s.panel}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setReload(v => v + 1)}><Text style={s.link}>{t("profitReportText.retry")}</Text></Pressable></View> : data && <>
      <Text style={s.muted}>{data.from} — {data.to} · {auth.session?.branchName ?? t("profitReportText.branches")} · {selectionLabel(filters.ids)}</Text>
      {data.totals.missingCostLines > 0 && <View style={s.warning}><Text style={s.warningText}>{t("profitReportText.missing",{count:number(data.totals.missingCostLines)})}</Text></View>}
      <View style={s.wrap}><Metric label={t("profitReportText.sales")} value={money(data.totals.sales)} style={s.salesMetric}/><Metric label={t("profitReportText.cost")} value={money(data.totals.cost)} style={s.costMetric}/><Metric label={t("profitReportText.profit")} value={money(data.totals.profit)} style={s.profitMetric}/></View>
      <View style={s.wrap}><Text style={s.muted}>{t("profitReportText.units",{count:number(data.totals.units)})}</Text><Text style={s.muted}>{t("profitReportText.margin",{value:data.totals.marginPercent == null ? t("profitReportText.unavailable") : `${number(data.totals.marginPercent)}%`})}</Text></View>
      {!data.daily.length && <View style={s.panel}><Text style={s.sectionTitle}>{t("profitReportText.empty")}</Text><Text style={s.muted}>{t("profitReportText.emptyHint")}</Text></View>}
      <View style={s.panel}><Text style={s.sectionTitle}>{t("profitReportText.daily")}</Text><View style={s.tableHeader}><Text style={[s.cell, s.bold]}>{t("profitReportText.date")}</Text><Text style={[s.cell, s.right, s.bold]}>{t("profitReportText.sales")}</Text><Text style={[s.cell, s.right, s.bold]}>{t("profitReportText.profitShort")}</Text></View>
        {data.daily.map(day => <View key={day.date} style={s.tableRow}><Text style={s.cell}>{day.date}</Text><Text style={[s.cell, s.right]}>{money(day.totals.sales)}</Text><Text style={[s.cell, s.right, day.totals.profit != null && day.totals.profit < 0 && s.error]}>{money(day.totals.profit)}</Text></View>)}
        <View style={s.tableTotal}><Text style={[s.cell, s.bold]}>{t("profitReportText.total")}</Text><Text style={[s.cell, s.right, s.bold]}>{money(data.totals.sales)}</Text><Text style={[s.cell, s.right, s.bold]}>{money(data.totals.profit)}</Text></View>
      </View>
      <Text style={s.sectionTitle}>{t("profitReportText.summary")}</Text><View style={s.wrap}>
        <Summary title={t("profitReportText.topDay")} name={data.topDay?.date} amount={data.topDay?.totals.profit} kind="profit"/>
        <Summary onPress={data.topProduct ? () => openHistory(data.topProduct!.id) : undefined} title={t("profitReportText.topProduct")} name={data.topProduct?.name} amount={data.topProduct?.totals.profit} kind="profit"/>
        <Summary title={t("profitReportText.topBuyer")} name={data.topBuyingCustomer?.name} amount={data.topBuyingCustomer?.totals.sales} kind="sales"/>
        <Summary title={t("profitReportText.topCustomer")} name={data.topProfitCustomer?.name} amount={data.topProfitCustomer?.totals.profit} kind="profit"/>
      </View><Text style={s.muted}>{t("profitReportText.customerHint")}</Text>
      <View style={s.panel}><Text style={s.sectionTitle}>{t("profitReportText.byProduct")}</Text><Text style={s.muted}>{t("profitReportText.sortHint")}</Text>
        {data.products.map(p => <View key={p.id} style={s.product}><View style={s.grow}><Pressable accessibilityRole="link" accessibilityLabel={t("profitReportText.viewProduct",{name:p.name})} onPress={() => router.push(`/products/${p.id}` as Href)}><Text style={s.link}>{p.name}</Text></Pressable><Text style={s.muted}>{t("profitReportText.productSales",{count:number(p.totals.units),amount:money(p.totals.sales)})}</Text><Text style={s.muted}>{t("profitReportText.productCost",{amount:money(p.totals.cost)})}</Text></View><Text style={[s.bold, p.totals.profit != null && p.totals.profit < 0 ? s.error : s.good]}>{money(p.totals.profit)}</Text></View>)}
      </View>
      
    </>}
    {!!printError && <Text accessibilityRole="alert" style={s.error}>{printError}</Text>}
  </ScrollView>
  <PopupSheet visible={picker} onClose={() => setPicker(false)} title={t("profitReportText.pick")}>
    <View style={s.pickerSearch}><TextInput accessibilityLabel={t("profitReportText.search")} placeholder={t("profitReportText.searchPlaceholder")} value={search} onChangeText={setSearch} style={s.input}/></View>
    {optionsLoading ? <View style={s.state}><ActivityIndicator color={colors.primary}/></View> : optionsError ? <View style={s.state}><Text style={s.error}>{optionsError}</Text><Pressable onPress={() => setReload(v => v + 1)}><Text style={s.link}>{t("profitReportText.retryProducts")}</Text></Pressable></View> : <FlatList style={s.list} data={visibleOptions} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled" ListHeaderComponent={<CheckRow checked={!selection.length} title={t("profitReportText.all")} onPress={() => setSelection([])}/>} ListEmptyComponent={<Text style={s.empty}>{t("profitReportText.noMatch")}</Text>} renderItem={({ item }) => <CheckRow checked={selection.includes(item.id)} title={item.name} subtitle={item.sku} onPress={() => setSelection(current => {
      // First individual click switches from All to just that product.
      if (!current.length) return [item.id];
      return current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id];
    })}/>}/>}<View style={s.pickerFooter}><Text style={s.muted}>{selection.length ? t("profitReportText.selected",{count:number(selection.length)}) : t("profitReportText.allSelected")}</Text><Pressable accessibilityRole="button" disabled={optionsLoading || !!optionsError} onPress={() => { setDraft(v => ({ ...v, ids: [...selection].sort() })); setPicker(false); }} style={[s.primary, (optionsLoading || !!optionsError) && s.disabled]}><Text style={s.primaryText}>{t("profitReportText.use")}</Text></Pressable></View>
  </PopupSheet></View>;
}

function Metric({ label, value, style }: { label: string; value: string; style: object }) { return <View style={[s.metric, style]}><Text style={s.fieldLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={s.metricValue}>{value}</Text></View>; }
function Summary({ title, name, amount, kind, onPress }: { title: string; name?: string; amount?: number | null; kind: string; onPress?: () => void }) { const {t}=useLanguage(); const mobile=useWindowDimensions().width<768; const money=(value:number|null|undefined)=>value==null?t("profitReportText.unavailable"):baseMoney(value); return <View style={[s.summary,mobile && s.summaryMobile]}><Text style={s.fieldLabel}>{title}</Text>{onPress && name ? <Pressable accessibilityRole="link" onPress={onPress}><Text style={s.link}>{name} ↗</Text></Pressable> : <Text style={s.bold}>{name ?? t("profitReportText.noEligible")}</Text>}{name && <Text style={[s.summaryAmount, amount != null && amount < 0 ? s.error : s.good]}>{t(kind==="profit"?"profitReportText.summaryProfit":"profitReportText.summarySales",{amount:money(amount)})}</Text>}</View>; }
function CheckRow({ checked, title, subtitle, onPress }: { checked: boolean; title: string; subtitle?: string; onPress: () => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={title} onPress={onPress} style={s.checkRow}><Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? colors.primaryDark : colors.muted}/><View style={s.grow}><Text style={s.bold}>{title}</Text>{!!subtitle && <Text style={s.muted}>{subtitle}</Text>}</View></Pressable>; }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, page: { padding: 12, paddingBottom: 32, gap: 12, width: "100%", maxWidth: 1120, alignSelf: "center" },
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }, grow: { flex: 1, minWidth: 0, gap: 4 }, eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: "700", letterSpacing: 1 }, title: { fontSize: 23, fontWeight: "800", color: colors.heading }, muted: { fontSize: 12, lineHeight: 19, color: colors.secondary },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 13, padding: 10, gap: 7 }, sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.heading }, fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.secondary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }, dateField: { flex: 1, minWidth: 210, gap: 4 }, chipSelected:{backgroundColor:colors.primary},chipSelectedText:{color:colors.white},chip: { minHeight: 34, paddingHorizontal: 10, justifyContent: "center", backgroundColor: colors.primaryLight, borderRadius: 8 }, link: { fontSize: 13, color: colors.primaryDark, fontWeight: "700" }, outline: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  select: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, primary: { minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, primaryText: { fontSize: 13, fontWeight: "700", color: colors.white }, disabled: { opacity: 0.45 },
  metric: { flex: 1, minWidth: 0, padding: 8, gap: 4, borderWidth: 1, borderRadius: 10 }, salesMetric: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }, costMetric: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }, profitMetric: { backgroundColor: colors.successBackground, borderColor: "#BBF7D0" }, metricValue: { fontSize: 15, fontWeight: "700", color: colors.heading }, good: { color: colors.successText }, error: { color: colors.dangerText, fontSize: 11 }, warning: { padding: 10, borderRadius: 10, backgroundColor: colors.warningBackground }, warningText: { fontSize: 12, lineHeight: 19, color: colors.warningText },
  tableHeader: { flexDirection: "row", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, tableRow: { flexDirection: "row", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, tableTotal: { flexDirection: "row", gap: 8, paddingVertical: 8, backgroundColor: colors.cardSecondary }, cell: { flex: 1, fontSize: 12, color: colors.heading }, right: { textAlign: "right" }, bold: { fontWeight: "700", fontSize: 13, color: colors.heading },
  summaryMobile: { flexBasis: "45%", flexGrow: 1, minWidth: 0, maxWidth: "50%" },
  summary: { flexGrow: 1, flexBasis: 240, alignItems: "center", padding: 12, gap: 6, borderRadius: 12, backgroundColor: "#F3F6FA", borderWidth: 1, borderColor: colors.divider }, summaryAmount: { fontSize: 15, fontWeight: "700", textAlign: "center" }, product: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.divider }, state: { padding: 24, gap: 10, alignItems: "center", justifyContent: "center" },
  pickerSearch: { padding: 14 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, color: colors.heading }, list: { flex: 1, minHeight: 0 }, checkRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider }, empty: { padding: 20, color: colors.secondary }, pickerFooter: { flexShrink: 0, padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.divider },
});
