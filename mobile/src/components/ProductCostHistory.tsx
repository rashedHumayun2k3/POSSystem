import ProductExpenseActions from "./ProductExpenseActions";
import { Ionicons } from "@expo/vector-icons";
import ProductExpensePicker, { type LinkedExpense } from "./ProductExpensePicker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

type Variant = { id: string; sku: string; variantValuesJson: string };
type Entry = { variantName?: string; id: string; date: string; kind: string; quantity: number | null; unitCost: number | null; previousCost: number | null; purchaseId: string | null; purchaseNo: string | null; branch: string | null; user: string | null; note: string | null };
type History = { averageCost: number; lastPurchaseCost: number | null; stock: number; totalCount: number; items: Entry[] };
const money = (value: number | null) => value == null ? "Not recorded" : `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
function label(variant: Variant) {
  try { return Object.values(JSON.parse(variant.variantValuesJson || "{}")).join(" / ") || variant.sku; }
  catch { return variant.sku; }
}

export default function ProductCostHistory({ productId, variants, reload }: { productId: string; variants: Variant[]; reload: () => Promise<void> }) {
  const auth = useAuth();
  const { t, lang } = useLanguage();
  const [expenses, setExpenses] = useState<LinkedExpense[]>([]);
  const [summaries, setSummaries] = useState<Record<string, History>>({});
  const variantIds = variants.map(v => v.id).join(",");
  const [page, setPage] = useState(0);
  const [editPage, setEditPage] = useState(0);
  const [editsExpanded, setEditsExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null); setError(""); setLoading(true);
    Promise.all(variants.map(async variant => {
      const items: Entry[] = [];
      let summary: History | undefined;
      for (let skip = 0; active;) {
        const result = await auth.api<History>(`/products/variants/${variant.id}/cost-history?skip=${skip}&take=100`);
        summary = result;
        items.push(...result.items.map(item => ({ ...item, variantName: label(variant) })));
        skip += result.items.length;
        if (!active || !result.items.length || skip >= result.totalCount) break;
      }
      return { variant, summary: summary!, items };
    }))
      .then(async results => {
        const linked: LinkedExpense[] = [];
        for (let skip = 0; active;) {
          const result = await auth.api<{items: LinkedExpense[]; total: number}>(`/products/${productId}/expenses?skip=${skip}&take=100`);
          linked.push(...result.items); skip += result.items.length;
          if (!result.items.length || skip >= result.total) break;
        }
        if (!active) return;
        setExpenses(linked);
        setSummaries(Object.fromEntries(results.map(r => [r.variant.id, r.summary])));
        const items = results.flatMap(r => r.items).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        setData({ averageCost: 0, lastPurchaseCost: null, stock: 0, totalCount: results.reduce((n, r) => n + r.summary.totalCount, 0), items });
      })
      .catch(e => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, variantIds, retry, auth.session?.businessId, auth.session?.branchId]);

  const purchases: (Entry & { expense?: LinkedExpense })[] = [...(data?.items.filter(item => item.kind !== "COST_CORRECTION") ?? []), ...expenses.map(expense => ({ id: expense.id, date: expense.expenseDate, kind: "EXPENSE", quantity: null, unitCost: null, previousCost: null, purchaseId: null, purchaseNo: null, branch: null, user: null, note: expense.note, expense }))].sort((a,b) => b.date.localeCompare(a.date));
  const corrections = data?.items.filter(item => item.kind === "COST_CORRECTION") ?? [];

  return <View style={s.container}>
      {auth.session?.user.role === "OWNER" && <ProductExpensePicker productId={productId} saved={() => { setPage(0); setRetry(n => n + 1); }} />}
    {loading ? <ActivityIndicator color={colors.primary} /> : error ? <View style={s.card}><Text style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(v => v + 1)} style={s.chip}><Text>Try again</Text></Pressable></View> : data && <>
      {variants.map(v => summaries[v.id] && <CostEditor key={v.id} variant={v} summary={summaries[v.id]} showName={variants.length > 1} saved={async () => { setPage(0); setEditPage(0); setRetry(n => n + 1); await reload(); }} />)}
      {purchases.length > 0 && <Text style={s.title}>{lang === "bn" ? "পণ্যের খরচের ইতিহাস" : "Product cost history"}</Text>}
      {purchases.slice(page * 25, (page + 1) * 25).map((item, index) => {
        if (item.expense) return <View key={item.id} style={s.card}>
          <Text style={s.title}>{lang === "bn" ? "পণ্যের খরচ" : "Product expense"} · {item.expense.title || item.expense.subType}</Text>
          <Text style={s.text}>{item.expense.subType} · {money(item.expense.amount)}</Text>
          {item.expense.status === "PENDING" && <Text style={{ color: colors.warningText }}>{lang === "bn" ? "অনুমোদনের অপেক্ষায়" : "Awaiting approval"}</Text>}
          <Text style={s.muted}>{new Date(item.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/more/expenses/[id]", params: { id: item.id, productId } } as never)} style={s.purchaseLink}><Text style={s.link}>{lang === "bn" ? "খরচের বিস্তারিত দেখুন →" : "View expense →"}</Text></Pressable>
          <ProductExpenseActions expense={item.expense} onSaved={() => setRetry(n => n + 1)} />
          {auth.session?.user.role === "OWNER" && <Pressable accessibilityRole="button" onPress={() => { void auth.api(`/products/${productId}/expenses/${item.id}`, { method: "DELETE" }).then(() => setRetry(n => n + 1)).catch(e => setError(e.message)); }}><Text style={s.link}>{lang === "bn" ? "পণ্য থেকে সংযোগ সরান" : "Unlink from product"}</Text></Pressable>}
        </View>;
        const opening = item.kind === "OPENING_STOCK";
        
        // Older opening-stock entries store the entered cost in this exact note format.
        const recordedCost = opening ? item.note?.match(/^Stock recorded at ৳([0-9]+(?:\.[0-9]+)?)\/unit$/) : null;
        const cost = item.unitCost ?? (recordedCost ? Number(recordedCost[1]) : null);
        const date = new Date(item.date);
        return <View key={item.id} style={s.card}>
          <Text style={s.title}>Phase {purchases.slice(page * 25 + index).filter(row => !row.expense).length} · {opening ? "Initial Stock" : item.purchaseNo || "Purchase received"}</Text>
          {variants.length > 1 && <Text style={s.muted}>{item.variantName}</Text>}
          <Text style={s.text}>{opening ? "Initial purchase cost" : "Purchase cost"}: <Text style={s.title}>{money(cost)}{cost != null ? " / unit" : ""}</Text></Text>
          <Text style={s.muted}>Date: {Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "2-digit", month: "short", year: "numeric" })}{` · ${opening ? t("productCostHistory.initialQty") : t("productCostHistory.receivedQty")}: ${item.quantity ?? t("productCostHistory.missing")}`}</Text>
          {item.purchaseId && <Pressable accessibilityRole="link" onPress={() => router.push(`/more/purchases/${item.purchaseId}`)} style={s.purchaseLink}><Text style={s.link}>View PO →</Text></Pressable>}
        </View>;
      })}
      <HistoryPages page={page} total={purchases.length} change={setPage} />
      {corrections.length > 0 && <View style={s.editHistory}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: editsExpanded }} onPress={() => setEditsExpanded(value => !value)} style={[s.heading, s.editHistoryHeader]}><Text style={s.title}>Cost Editing History</Text><Ionicons name={editsExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.secondary} /></Pressable>
        {editsExpanded && <>
        {corrections.slice(editPage * 25, (editPage + 1) * 25).map(item => <View key={item.id} style={s.card}>
          <Text style={s.title}>{money(item.previousCost)} → {money(item.unitCost)} / unit</Text>
          {variants.length > 1 && <Text style={s.muted}>{item.variantName}</Text>}
          <Text style={s.muted}>Date: {new Date(item.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</Text>
          {item.user && <Text style={s.muted}>Edited by: {item.user}</Text>}
        </View>)}
        <HistoryPages page={editPage} total={corrections.length} change={setEditPage} />
        </>}
      </View>}
    </>}
  </View>;
}
function HistoryPages({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  if (total <= 25) return null;
  return <View style={s.heading}>
    <Pressable accessibilityRole="button" disabled={page === 0} onPress={() => change(page - 1)} style={[s.chip, page === 0 && s.disabled]}><Text>Previous</Text></Pressable>
    <Text style={s.muted}>{page + 1} / {Math.ceil(total / 25)}</Text>
    <Pressable accessibilityRole="button" disabled={(page + 1) * 25 >= total} onPress={() => change(page + 1)} style={[s.chip, (page + 1) * 25 >= total && s.disabled]}><Text>Next</Text></Pressable>
  </View>;
}
function CostEditor({ variant, summary, showName, saved }: { variant: Variant; summary: History; showName: boolean; saved: () => Promise<void> }) {
  const auth = useAuth();
  const { t, lang } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(summary.averageCost));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const save = async () => {
    if (!/^\d+(\.\d{1,2})?$/.test(value.trim()) || Number(value) > 999999999999.99) {
      setError("Enter a valid cost with up to 2 decimal places."); return;
    }
    setBusy(true); setError("");
    try {
      await auth.api(`/products/variants/${variant.id}/purchase-cost`, { method: "PUT", body: JSON.stringify({ costPerUnit: Number(value), expectedCost: summary.averageCost }) });
      setEditing(false); setSuccess(true);
      await saved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <View style={s.card}>
    <View style={s.heading}><Text style={s.title}>Current Purchase Cost{showName ? ` · ${label(variant)}` : ""}</Text>
      {!editing && auth.session?.user.role === "OWNER" && <Pressable accessibilityRole="button" style={s.chip} onPress={() => { setValue(String(summary.averageCost)); setError(""); setSuccess(false); setEditing(true); }}><Text style={s.link}>Edit</Text></Pressable>}
    </View>
    <Text style={s.title}>{money(summary.averageCost)} / unit</Text>
    {editing && <>
      <TextInput accessibilityLabel={t("productCostHistory.input", { variant: label(variant) })} value={value} onChangeText={setValue} editable={!busy} keyboardType="decimal-pad" style={s.costInput} />
      <Text style={s.muted}>Saving changes the cost used for future profit calculations. Stock and selling price stay the same.</Text>
      <View style={s.wrap}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[s.chip, s.selected, busy && s.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.selectedText}>Save cost</Text>}</Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(false)} style={s.chip}><Text>Cancel</Text></Pressable></View>
    </>}
    {!!error && <Text style={s.error}>{error}</Text>}
    {success && <Text accessibilityLiveRegion="polite" style={s.link}>Purchase cost saved.</Text>}
  </View>;
}
const s = StyleSheet.create({
  editHistoryHeader: { padding: 12, borderRadius: 10, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border },
  editHistory: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.divider, gap: 10 },
  costInput: { minHeight: 44, borderWidth: 1, borderColor: colors.divider, borderRadius: 8, paddingHorizontal: 10, fontSize: 16, color: colors.heading },
  container: { gap: 12 }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { padding: 12, gap: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 10 },
  purchaseLink: { alignSelf: "flex-start", paddingVertical: 8 },
  heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 14, fontWeight: "700", color: colors.heading }, text: { fontSize: 12, color: colors.secondary },
  muted: { fontSize: 12, lineHeight: 18, color: colors.muted }, chip: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.divider, alignSelf: "flex-start" },
  selected: { backgroundColor: colors.primary }, selectedText: { color: colors.white, fontSize: 12 },
  link: { color: colors.primary, fontWeight: "600", fontSize: 12 }, error: { color: colors.danger }, disabled: { opacity: 0.4 },
});
