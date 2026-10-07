import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import * as Print from "expo-print";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { colors } from "../theme";
import { code128Bars, validateBarcode, MAX_TOTAL_LABELS } from "../barcodes/model";
import type { CartonSummary, CartonDetail, CartonItem, StoreroomSummary, TripWithCartons, DamagedItem, LocationLookupItem } from "../storeroom/types";
type Product = {
    variantId: string;
    name: string;
    sku: string;
    effectivePrice: number;
};
function useRoomData<T>(path: string) {
    const auth = useAuth(), api = useRef(auth.api);
    api.current = auth.api;
    const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
    const version = useRef(0), loadedPath = useRef("");
    const load = useCallback(async () => { const request = ++version.current; setLoading(true); setError(""); try {
        const value = await api.current<T>(path);
        if (request === version.current) {
            loadedPath.current = path;
            setData(value);
        }
    }
    catch (e) {
        if (request === version.current)
            setError((e as Error).message);
    }
    finally {
        if (request === version.current)
            setLoading(false);
    } }, [path, auth.session?.businessId, auth.session?.branchId]);
    useFocusEffect(useCallback(() => { setData(null); void load(); return () => { version.current++; }; }, [load]));
    return { data: loadedPath.current === path ? data : null, error, loading, load };
}
function Button({ title, onPress, disabled = false, danger = false }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
}) { return <Pressable disabled={disabled} onPress={onPress} style={[s.button, danger && s.danger, disabled && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>; }
function Card({ children }: {
    children: ReactNode;
}) { return <View style={s.card}>{children}</View>; }
function Field({ label, value, onChange, numeric = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    numeric?: boolean;
}) { return <View style={s.gap}><Text style={s.muted}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType={numeric ? "decimal-pad" : "default"} style={s.input}/></View>; }
function Status({ value }: {
    value: string;
}) { const { t } = useLanguage(); return <Text style={[s.badge, { backgroundColor: value === "DONE" ? colors.successBackground : value === "SEALED" ? colors.infoBackground : colors.warningBackground }]}>{t(`storeroom.${value.toLowerCase()}`)}</Text>; }
function Page({ title, loading, error, refresh, children }: {
    title: string;
    loading: boolean;
    error: string;
    refresh: () => void;
    children: ReactNode;
}) { const { t } = useLanguage(); const auth = useAuth(); if (!["OWNER", "WAREHOUSE"].includes(auth.session?.user.role ?? ""))
    return <View style={s.content}><Text style={s.error}>{t("storeroomMobile.noAccess")}</Text></View>; return <View style={s.root}><View style={s.header}><Pressable accessibilityLabel={t("Back")} onPress={() => router.canGoBack() ? router.back() : router.replace("/more")}><Ionicons name="chevron-back" size={24} color={colors.heading}/></Pressable><Text style={s.title}>{title}</Text></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh}/>}>{!!error && <Card><Text style={s.error}>{error}</Text><Button title={t("Retry")} onPress={refresh}/></Card>}{loading && <ActivityIndicator color={colors.primary}/>}{children}</ScrollView></View>; }
function Sheet({ title, visible, close, busy, error, children }: {
    title: string;
    visible: boolean;
    close: () => void;
    busy: boolean;
    error: string;
    children: ReactNode;
}) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && close()}><View style={s.overlay}><View style={s.sheet}><View style={s.row}><Text style={s.title}>{title}</Text><Pressable disabled={busy} onPress={close}><Ionicons name="close" size={25} color={colors.heading}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{!!error && <Text style={s.error}>{error}</Text>}{children}</ScrollView></View></View></Modal>; }
function Search({ onPick }: {
    onPick: (p: Product) => void;
}) { const { t } = useLanguage(), auth = useAuth(), api = useRef(auth.api); api.current = auth.api; const [q, setQ] = useState(""), [items, setItems] = useState<Product[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(""); useEffect(() => { let active = true; setItems([]); setError(""); setBusy(false); if (q.trim().length < 2)
    return; const timer = setTimeout(() => { setBusy(true); api.current<Product[]>(`/products/search?q=${encodeURIComponent(q.trim())}`).then(v => { if (active)
    setItems(v); }).catch(e => { if (active)
    setError(e.message); }).finally(() => { if (active)
    setBusy(false); }); }, 300); return () => { active = false; clearTimeout(timer); }; }, [q, auth.session?.businessId, auth.session?.branchId]); return <View style={s.gap}><TextInput style={s.input} value={q} onChangeText={setQ} placeholder={t("storeroom.searchPlaceholder")} placeholderTextColor={colors.muted}/>{busy && <ActivityIndicator />}{!!error && <Text style={s.error}>{error}</Text>}{items.slice(0, 8).map(p => <Pressable key={p.variantId} style={s.searchRow} onPress={() => { setQ(""); onPick(p); }}><Text style={s.name}>{p.name}</Text><Text style={s.muted}>{p.sku}</Text></Pressable>)}</View>; }
function CartonRow({ item, onDelete }: {
    item: CartonSummary;
    onDelete?: () => void;
}) { const { t } = useLanguage(); return <Card><Pressable style={s.gap} onPress={() => router.push(`/more/storeroom/cartons/${item.id}` as never)}><View style={s.row}><Text style={s.name}>{item.cartonNo} · {item.tripNo}</Text><Status value={item.status}/></View><Text style={s.muted}>{item.location || t("storeroom.noLocation")}</Text><Text style={s.muted}>{item.totalQtyInCarton} {t("storeroom.pcs")} · {item.totalLabeled} {t("storeroom.labeled")} · {item.totalDamaged} {t("storeroom.damaged")}</Text></Pressable>{onDelete && item.status === "SEALED" && <Button title={t("Delete")} danger onPress={onDelete}/>}</Card>; }
export default function StoreroomScreen() { const { t } = useLanguage(); const auth = useAuth(); const [tab, setTab] = useState("trips"); const summary = useRoomData<StoreroomSummary>("/cartons/summary"), list = useRoomData<TripWithCartons[] | CartonSummary[] | DamagedItem[]>(tab === "trips" ? "/cartons/trips" : tab === "all" ? "/cartons" : "/cartons/damaged"); const [lookup, setLookup] = useState<LocationLookupItem[] | null>(null), [lookupBusy, setLookupBusy] = useState(false), [lookupError, setLookupError] = useState(""); const lookupVersion = useRef(0); useEffect(() => { lookupVersion.current++; setLookup(null); setLookupBusy(false); }, [auth.session?.businessId, auth.session?.branchId]); const find = async (p: Product) => { const version = ++lookupVersion.current; setLookupBusy(true); setLookupError(""); setLookup(null); try {
    const value = await auth.api<LocationLookupItem[]>(`/cartons/location?variantId=${p.variantId}`);
    if (version === lookupVersion.current)
        setLookup(value);
}
catch (e) {
    if (version === lookupVersion.current)
        setLookupError((e as Error).message);
}
finally {
    if (version === lookupVersion.current)
        setLookupBusy(false);
} }; return <Page title={t("storeroom.title")} loading={summary.loading || list.loading} error={summary.error || list.error} refresh={() => { void summary.load(); void list.load(); }}>{summary.data && <View style={s.row}>{([["sealed", summary.data.sealed], ["opened", summary.data.opened + summary.data.partial], ["done", summary.data.done], ["damaged", summary.data.totalDamaged]] as const).map(([key, value]) => <View key={key} style={s.stat}><Text style={s.statValue}>{value}</Text><Text style={s.muted}>{t(`storeroom.${key}`)}</Text></View>)}</View>}<Card><Text style={s.name}>{t("storeroom.findProduct")}</Text><Search onPick={p => void find(p)}/>{lookupBusy && <ActivityIndicator />}{!!lookupError && <Text style={s.error}>{lookupError}</Text>}{lookup?.length === 0 && <Text style={s.muted}>{t("storeroom.notInAnyCarton")}</Text>}{lookup?.map(item => <Pressable key={item.cartonId} style={s.searchRow} onPress={() => router.push(`/more/storeroom/cartons/${item.cartonId}` as never)}><Text style={s.name}>{item.cartonNo} · {item.tripNo}</Text><Text style={s.muted}>{item.location || t("storeroom.noLocation")} · {item.qtyInCarton} {t("storeroom.pcs")}</Text><Status value={item.status}/></Pressable>)}</Card><View style={s.row}>{["trips", "all", "damaged"].map(value => <Pressable key={value} onPress={() => setTab(value)} style={[s.tab, tab === value && s.tabOn]}><Text style={s.name}>{t(`storeroom.tab_${value}`)}</Text></Pressable>)}</View>{!list.loading && list.data?.length === 0 && <Text style={s.empty}>{t(tab === "damaged" ? "storeroom.noDamaged" : "storeroom.noCartons")}</Text>}{tab === "trips" && (list.data as TripWithCartons[] | null)?.map(trip => <Pressable key={trip.tripId} onPress={() => router.push(`/more/storeroom/${trip.tripId}` as never)}><Card><Text style={s.name}>{trip.tripNo}</Text><Text style={s.muted}>{trip.cartonCount} {t("storeroom.cartons")} · {trip.sealedCount} {t("storeroom.sealed")}</Text><View style={s.track}><View style={[s.fill, { width: `${trip.cartonCount ? trip.doneCount / trip.cartonCount * 100 : 0}%` }]}/></View><Text style={s.muted}>{trip.cartonCount ? Math.round(trip.doneCount / trip.cartonCount * 100) : 0}% {t("storeroom.done")}</Text></Card></Pressable>)}{tab === "all" && (list.data as CartonSummary[] | null)?.map(item => <CartonRow key={item.id} item={item}/>)}{tab === "damaged" && (list.data as DamagedItem[] | null)?.map((item, i) => <Pressable key={`${item.cartonId}-${i}`} onPress={() => router.push(`/more/storeroom/cartons/${item.cartonId}` as never)}><Card><Text style={s.name}>{item.productName}</Text><Text style={s.muted}>{item.variantSku} · {item.cartonNo} · {item.tripNo}</Text><Text style={s.error}>{item.qtyDamaged} {t("storeroom.damaged")}</Text></Card></Pressable>)}</Page>; }
export function TripCartonsScreen() { const { tripId } = useLocalSearchParams<{
    tripId: string;
}>(), auth = useAuth(), { t } = useLanguage(); const room = useRoomData<CartonSummary[]>(`/cartons?tripId=${tripId}`); const [open, setOpen] = useState(false), [manual, setManual] = useState(false), [count, setCount] = useState(""), [nos, setNos] = useState(""), [location, setLocation] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [deleting, setDeleting] = useState<string | null>(null); const create = async () => { const customNos = nos.split(',').map(x => x.trim()).filter(Boolean), quantity = manual ? customNos.length : Number(count); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200 || new Set(customNos).size !== customNos.length) {
    setError(t("storeroomMobile.invalidCount"));
    return;
} setBusy(true); setError(""); try {
    await auth.api("/cartons/bulk", { method: "POST", body: JSON.stringify({ tripId, count: quantity, locationPrefix: location || undefined, customNos: manual ? customNos : undefined }) });
    setOpen(false);
    setCount("");
    setNos("");
    setLocation("");
    await room.load();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }; return <Page title={t("storeroom.cartons")} loading={room.loading} error={room.error} refresh={() => void room.load()}><Button title={t("storeroom.addCartons")} onPress={() => { setError(""); setOpen(true); }}/>{room.data?.length === 0 && <Text style={s.empty}>{t("storeroom.noCartonsYet")}</Text>}{room.data?.map(item => <CartonRow key={item.id} item={item} onDelete={auth.session?.user.role === "OWNER" ? () => { setError(""); setDeleting(item.id); } : undefined}/>)}<Sheet visible={open} title={t("storeroom.addCartons")} busy={busy} close={() => setOpen(false)} error={error}><View style={s.row}>{[false, true].map(value => <Pressable key={String(value)} style={[s.tab, manual === value && s.tabOn]} onPress={() => setManual(value)}><Text>{t(value ? "storeroom.mode_manual" : "storeroom.mode_auto")}</Text></Pressable>)}</View><Field label={t(manual ? "storeroom.manualNosPlaceholder" : "storeroom.countPlaceholder")} value={manual ? nos : count} onChange={manual ? setNos : setCount} numeric={!manual}/><Text style={s.muted}>{t(manual ? "storeroom.manualNoteHint" : "storeroom.autoNoteHint")}</Text><Field label={t("storeroom.locationPlaceholder")} value={location} onChange={setLocation}/><Button title={t("storeroom.addCartons")} disabled={busy} onPress={() => void create()}/></Sheet><ConfirmDialog visible={!!deleting} title={t("storeroom.confirmDelete")} message={error || t("storeroom.confirmDelete")} confirmLabel={t("Delete")} cancelLabel={t("Cancel")} destructive busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => { if (busy)
    return; setBusy(true); void auth.api(`/cartons/${deleting}`, { method: "DELETE" }).then(async () => { setDeleting(null); await room.load(); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}/></Page>; }
type OpenRow = {
    variantId: string;
    name: string;
    qty: string;
    damaged: string;
    price: string;
};
export function CartonDetailScreen() {
    const { cartonId } = useLocalSearchParams<{
        cartonId: string;
    }>(), auth = useAuth(), { t } = useLanguage();
    const room = useRoomData<CartonDetail>(`/cartons/${cartonId}`), carton = room.data;
    const [panel, setPanel] = useState<"open" | "edit" | "label" | "print" | null>(null), [rows, setRows] = useState<OpenRow[]>([]), [location, setLocation] = useState(""), [notes, setNotes] = useState(""), [item, setItem] = useState<CartonItem | null>(null), [qty, setQty] = useState("1"), [busy, setBusy] = useState(false), [error, setError] = useState("");
    const show = (next: "open" | "edit" | "label" | "print", selected?: CartonItem) => { setError(""); setPanel(next); setLocation(carton?.location ?? ""); setNotes(carton?.notes ?? ""); setRows(carton?.items.map(i => ({ variantId: i.variantId, name: i.productName, qty: String(i.qtyInCarton), damaged: String(i.qtyDamaged), price: String(i.labelPrice) })) ?? []); setItem(selected ?? null); setQty(String(Math.max(1, selected?.qtyRemaining ?? 1))); };
    const submit = async () => { if (busy || !carton)
        return; setError(""); if (panel === "open" && (!rows.length || rows.some(r => !r.qty.trim() || !r.price.trim() || ![Number(r.qty), Number(r.damaged), Number(r.price)].every(Number.isFinite) || Number(r.qty) <= 0 || Number(r.damaged) < 0 || Number(r.damaged) > Number(r.qty) || Number(r.price) < 0))) {
        setError(t("storeroomMobile.invalidContents"));
        return;
    } if (panel === "label" && (!item || !qty.trim() || !Number.isFinite(Number(qty)) || Number(qty) <= 0 || Number(qty) > item.qtyRemaining)) {
        setError(t("storeroomMobile.invalidLabels"));
        return;
    } setBusy(true); try {
        const path = panel === "open" ? `/cartons/${cartonId}/open` : panel === "label" ? `/cartons/${cartonId}/items/${item!.id}/label` : `/cartons/${cartonId}`;
        const body = panel === "open" ? { location, notes, items: rows.map(r => ({ variantId: r.variantId, qtyInCarton: Number(r.qty), qtyDamaged: Number(r.damaged), labelPrice: Number(r.price) })) } : panel === "label" ? { qtyNowLabeled: Number(qty) } : { location, notes };
        await auth.api(path, { method: panel === "edit" ? "PATCH" : "POST", body: JSON.stringify(body) });
        setPanel(null);
        await room.load();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const print = async () => { if (!item || busy)
        return; const quantity = Number(qty); if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TOTAL_LABELS) {
        setError(t("storeroomMobile.invalidPrint", { max: MAX_TOTAL_LABELS }));
        return;
    } const barcodeError = validateBarcode(item.barcode ?? ""); if (barcodeError) {
        setError(barcodeError);
        return;
    } setBusy(true); setError(""); try {
        const bars = code128Bars(item.barcode!);
        const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
        const label = `<section><b>TOSS Active</b><div>${escape(item.productName)}</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bars.width} 55" height="45" width="100%">${bars.bars.map(b => `<rect x="${b.x}" width="${b.width}" y="0" height="55"/>`).join('')}</svg><small>${escape(item.barcode!)}</small><b>৳${item.labelPrice.toFixed(2)}</b><small>${escape(carton?.cartonNo ?? "")}</small></section>`;
        await Print.printAsync({ html: `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:8mm}body{margin:0;font-family:Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}section{border:1px solid #ddd;padding:3mm;text-align:center;break-inside:avoid;font-size:11px}b,small{display:block}svg{display:block;margin:2mm 0}</style></head><body><div class="grid">${Array.from({ length: quantity }, () => label).join('')}</div></body></html>` });
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const changeRow = (index: number, key: "qty" | "damaged" | "price", value: string) => setRows(current => current.map((r, i) => i === index ? { ...r, [key]: value } : r));
    return <Page title={carton?.cartonNo ?? t("storeroom.carton")} loading={room.loading} error={room.error} refresh={() => void room.load()}>{carton && <><Card><View style={s.row}><Status value={carton.status}/><Text style={s.name}>{carton.tripNo}</Text></View><Text style={s.muted}>{carton.location || t("storeroom.noLocation")}</Text>{!!carton.notes && <Text style={s.muted}>{carton.notes}</Text>}{carton.openedAt && <Text style={s.muted}>{t("storeroom.openedAt")}: {new Date(carton.openedAt).toLocaleDateString()}</Text>}<Button title={t("Edit")} onPress={() => show("edit")}/></Card>{carton.status !== "DONE" && <Button title={t(carton.status === "SEALED" ? "storeroom.openCarton" : "storeroom.editContents")} onPress={() => show("open")}/>}<Text style={s.title}>{t("storeroom.contents")}</Text>{carton.items.map(i => <Card key={i.id}><Text style={s.name}>{i.productName}</Text><Text style={s.muted}>{i.variantSku}</Text><Text style={s.muted}>{i.qtyInCarton} {t("storeroom.pcs")} · {i.qtyLabeled} {t("storeroom.labeled")} · {i.qtyDamaged} {t("storeroom.damaged")} · {i.qtyRemaining} {t("storeroom.remaining")}</Text><Text style={s.name}>৳{i.labelPrice.toFixed(2)}</Text><View style={s.row}>{i.qtyRemaining > 0 && <Button title={t("storeroom.label")} onPress={() => show("label", i)}/>}<Button title={t(i.qtyRemaining > 0 ? "storeroom.print" : "storeroom.reprint")} onPress={() => show("print", i)}/></View></Card>)}</>}
    <Sheet visible={!!panel} title={t(panel === "open" ? "storeroom.whatsInside" : panel === "label" ? "storeroom.recordLabeling" : panel === "print" ? "storeroom.printLabels" : "Edit")} busy={busy} error={error} close={() => setPanel(null)}>{(panel === "open" || panel === "edit") && <><Field label={t("storeroom.locationPlaceholder")} value={location} onChange={setLocation}/><Field label={t("storeroom.notesPlaceholder")} value={notes} onChange={setNotes}/></>}{panel === "open" && <>{!!carton?.totalLabeled && <Text style={s.warning}>{t("storeroomMobile.resetWarning")}</Text>}<Search onPick={p => setRows(current => current.some(r => r.variantId === p.variantId) ? current : [...current, { variantId: p.variantId, name: p.name, qty: "", damaged: "0", price: String(p.effectivePrice) }])}/>{rows.map((r, index) => <Card key={r.variantId}><Text style={s.name}>{r.name}</Text><Field label={t("storeroom.qty")} value={r.qty} numeric onChange={v => changeRow(index, "qty", v)}/><Field label={t("storeroom.damaged")} value={r.damaged} numeric onChange={v => changeRow(index, "damaged", v)}/><Field label={t("storeroom.priceLabel")} value={r.price} numeric onChange={v => changeRow(index, "price", v)}/><Button title={t("Remove")} danger onPress={() => setRows(current => current.filter((_, i) => i !== index))}/></Card>)}</>}{(panel === "label" || panel === "print") && item && <><Text style={s.name}>{item.productName}</Text><Text style={s.muted}>{item.qtyRemaining} {t("storeroom.remaining")} · ৳{item.labelPrice.toFixed(2)}</Text><Field label={t(panel === "label" ? "storeroom.qtyLabeledNow" : "storeroom.labelQty")} value={qty} numeric onChange={setQty}/>{panel === "label" && <Button title={t("storeroom.printFirst")} disabled={busy} onPress={() => { setError(""); setPanel("print"); }}/>}</>}{panel === "print" ? <>{item && <PrintPreview item={item}/>}<Button title={t("storeroom.printLabels")} disabled={busy} onPress={() => void print()}/>{!!item && item.qtyRemaining > 0 && <Button title={t("storeroom.recordLabeling")} disabled={busy} onPress={() => { setError(""); setPanel("label"); }}/>}</> : <Button title={t(panel === "label" ? "storeroom.markLabeled" : panel === "open" ? "storeroom.saveContents" : "Save")} disabled={busy} onPress={() => void submit()}/>}</Sheet></Page>;
}
function PrintPreview({ item }: {
    item: CartonItem;
}) { if (validateBarcode(item.barcode ?? ""))
    return null; const data = code128Bars(item.barcode!); return <Card><Text style={[s.name, { textAlign: "center" }]}>TOSS Active</Text><Text style={[s.name, { textAlign: "center" }]}>{item.productName}</Text><Svg width="100%" height={55} viewBox={`0 0 ${data.width} 55`}>{data.bars.map((bar, i) => <Rect key={i} x={bar.x} y={0} width={bar.width} height={55} fill="#111827"/>)}</Svg><Text style={[s.muted, { textAlign: "center" }]}>{item.barcode}</Text><Text style={[s.name, { textAlign: "center" }]}>৳{item.labelPrice.toFixed(2)}</Text></Card>; }
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: colors.white }, content: { padding: 16, gap: 12, paddingBottom: 32 }, card: { padding: 14, gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, title: { fontSize: 18, fontWeight: "700", color: colors.heading, flexShrink: 1 }, name: { fontSize: 14, fontWeight: "600", color: colors.heading, flexShrink: 1 }, muted: { fontSize: 12, color: colors.secondary, lineHeight: 18 }, error: { fontSize: 13, color: colors.danger }, warning: { fontSize: 13, color: colors.warningText }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }, gap: { gap: 6 }, button: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: "center" }, buttonText: { color: colors.white, fontWeight: "600", fontSize: 13 }, danger: { backgroundColor: colors.danger }, disabled: { opacity: .5 }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.heading, backgroundColor: colors.white }, stat: { flex: 1, minWidth: 65, padding: 10, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center" }, statValue: { fontSize: 22, fontWeight: "700", color: colors.primaryDark }, tab: { padding: 10, borderRadius: 10, backgroundColor: colors.white }, tabOn: { backgroundColor: colors.primaryLight }, badge: { fontSize: 11, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, color: colors.heading }, empty: { textAlign: "center", padding: 24, color: colors.muted }, searchRow: { padding: 12, gap: 5, borderBottomWidth: 1, borderColor: colors.divider }, track: { height: 6, borderRadius: 3, backgroundColor: colors.disabled, overflow: "hidden" }, fill: { height: 6, backgroundColor: colors.success }, overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: colors.overlay }, sheet: { width: "100%", maxWidth: 560, maxHeight: "90%", padding: 16, borderRadius: 18, backgroundColor: colors.white } });
