import ProcessGuide from "../components/ProcessGuide";
import LotCourierPicker from "../components/LotCourierPicker";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import ProductIdentity from "../components/ProductIdentity";
import ProductPicker, { type ProductPickerResult } from "../components/ProductPicker";
import SupplierPicker, { type SupplierResult } from "../components/SupplierPicker";
import PopupSheet from "../components/PopupSheet";
import BrandPicker, { type BrandResult } from "../components/BrandPicker";
import { productPayment } from "../lib/purchasePayments";
import LotCostForm from "../components/LotCostForm";
import { lotCostTypes } from "../lib/lotCostTypes";
import LotCosts from "../components/LotCosts";
import PurchaseCostPayments from "../components/PurchaseCostPayments";
import PurchasePaymentSource, { type PurchasePayment } from "../components/PurchasePaymentSource";
import type { CostType, LotImportPreview, PurchaseDetail, PurchaseItem, PurchaseLot, ReceiveSession } from "../types/purchases";
import { PurchaseProgress } from "./PurchasesScreen";
import { lotUsableQuantity, receiptQuantities } from "../lib/purchaseReceiving";

type Tab = "guide" | "products" | "lots" | "costs" | "summary";
type ReceiptEntry = { usable: string; damaged: string; missing: string; weight: string };
const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const number = (value: string) => { const n = Number(value); if (!Number.isFinite(n) || n < 0) throw new Error("Enter valid non-negative numbers."); return n; };
const decimalOnly = (value: string) => { const clean = value.replace(/[^0-9.]/g, ""); const [whole, ...fraction] = clean.split("."); return fraction.length ? `${whole}.${fraction.join("")}` : whole; };
const newLotNumber = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour = date.getHours();
  return `Lot-${pad(date.getDate())}-${months[date.getMonth()]}-${date.getFullYear()}-${pad(hour % 12 || 12)}-${pad(date.getMinutes())}-${hour >= 12 ? "PM" : "AM"}`;
};
const commonCosts: CostType[] = ["AGENT_FEE", "TRANSPORT", "LABOR", "CUSTOMS", "PAYMENT_FEE", "OTHER"];
const costIcons: Partial<Record<CostType, React.ComponentProps<typeof Ionicons>["name"]>> = { AGENT_FEE: "person-outline", TRANSPORT: "car-outline", LABOR: "people-outline", CUSTOMS: "shield-checkmark-outline", PAYMENT_FEE: "card-outline", OTHER: "ellipsis-horizontal-circle-outline", CHINA_LOCAL: "location-outline", COURIER: "cube-outline" };
const banglaCostTypes:Partial<Record<CostType,string>>={AGENT_FEE:"এজেন্ট ফি",TRANSPORT:"পরিবহন",LABOR:"শ্রমিক খরচ",CUSTOMS:"কাস্টমস",PAYMENT_FEE:"পেমেন্ট ফি",OTHER:"অন্যান্য",CHINA_LOCAL:"চীনের স্থানীয় খরচ",COURIER:"কুরিয়ার খরচ",SHIPPING_INTL:"আন্তর্জাতিক শিপিং"};
const processGuideCopy={
  en:{tab:"Process Guide",heading:"Purchase Order Steps",intro:"Follow these stages from buying products through final receiving.",start:"Start this step",steps:[
    ["Add products and buy","Build the product list, enter quantities and purchase prices, then record product payments."],
    ["Approve and finalize the PO","Approval locks the product list. After approval, you cannot add, edit or remove products from this PO."],
    ["Create courier lots","When products are ready for shipping, create a lot and assign its products. One PO can contain multiple lots."],
    ["Receive products from the courier","Mark each lot as shipped, then record the quantities and weights received from the courier."],
    ["Complete the purchase order","After every lot is received and all quantities are resolved, complete the PO."]
  ],step:"Step"},
  bn:{tab:"কাজের ধাপ",heading:"এই পারচেজ অর্ডারের কাজ যেভাবে এগোবে",intro:"পণ্য কেনা থেকে হাতে বুঝে পাওয়া পর্যন্ত নিচের ধাপগুলো অনুসরণ করুন।",start:"এই ধাপ শুরু করুন",steps:[
    ["পণ্য যোগ করে কেনার তালিকা তৈরি করুন","যে পণ্যগুলো কিনবেন সেগুলো যোগ করুন, পরিমাণ ও ক্রয়মূল্য লিখুন, তারপর পেমেন্টের তথ্য সংরক্ষণ করুন।"],
    ["PO যাচাই করে চূড়ান্ত অনুমোদন দিন","সব তথ্য ঠিক আছে নিশ্চিত হয়ে PO অনুমোদন করুন। অনুমোদনের পর এই PO-তে নতুন পণ্য যোগ করা বা আগের পণ্য পরিবর্তন কিংবা মুছে ফেলা যাবে না।"],
    ["কুরিয়ারের জন্য লট তৈরি করুন","পণ্য কুরিয়ারে দেওয়ার জন্য প্রস্তুত হলে একটি লট তৈরি করে পণ্যগুলো সেই লটে রাখুন। প্রয়োজন অনুযায়ী একই PO-র জন্য একাধিক লট তৈরি করা যাবে।"],
    ["কুরিয়ার থেকে পণ্য বুঝে নিন","প্রতিটি লট কুরিয়ারে পাঠানোর পর পণ্য হাতে এলে পাওয়া পরিমাণ ও ওজন সঠিকভাবে লিখে রিসিভ করুন।"],
    ["পারচেজ অর্ডার সম্পন্ন করুন","সব লটের পণ্য বুঝে পাওয়া এবং সব পরিমাণের হিসাব মিলে গেলে PO সম্পন্ন করুন।"]
  ],step:"ধাপ"}
} as const;

function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.secondaryButton, disabled && s.disabled]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChange} keyboardType={numeric ? "decimal-pad" : "default"} /></View>;
}
function Sheet({ title, open, close, children }: { title: string; open: boolean; close: () => void; children: React.ReactNode }) {
  return <Modal visible={open} transparent animationType="slide" onRequestClose={close}><View style={s.overlay}><View style={s.sheet}><View style={s.row}><Text style={s.title}>{title}</Text><Button title="Close" onPress={close} secondary /></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.stack}>{children}</ScrollView></View></View></Modal>;
}

export default function PurchaseDetailScreen() {
  const compact = useWindowDimensions().width < 600;
  const {lang}=useLanguage();
  const guideCopy=processGuideCopy[lang];
  const auth = useAuth(); const { id } = useLocalSearchParams<{ id: string }>();
  const api = useRef(auth.api); api.current = auth.api;
  const role = auth.session?.user.role; const owner = role === "OWNER"; const approver = owner || role === "MANAGER"; const receiver = owner || role === "WAREHOUSE";
  const [productBrands, setProductBrands] = useState<Record<string, string | null>>({});
  const [productImages, setProductImages] = useState<Record<string, string | null>>({});
  const [trip, setTrip] = useState<PurchaseDetail | null>(null); const [payments, setPayments] = useState<PurchasePayment[] | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [tab, setTab] = useState<Tab>("guide");
  const [lotCostOpen, setLotCostOpen] = useState(false);
  const [courierOpen, setCourierOpen] = useState(false);
  const [lotDetailsOpen, setLotDetailsOpen] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false); const [product, setProduct] = useState<ProductPickerResult | null>(null);
  const [editItem, setEditItem] = useState<PurchaseItem | null>(null); const [itemOpen, setItemOpen] = useState(false);
  const [itemQty, setItemQty] = useState("1"); const [unitPrice, setUnitPrice] = useState("");
  const [brand, setBrand] = useState<BrandResult | null>(null); const [brandOpen, setBrandOpen] = useState(false); const [brandLoading, setBrandLoading] = useState(false);
  const [supplier, setSupplier] = useState<SupplierResult | null>(null); const [supplierOpen, setSupplierOpen] = useState(false);
  const [lotOpen, setLotOpen] = useState(false); const [editingLot, setEditingLot] = useState<PurchaseLot | null>(null);
  const weightInputRef = useRef<TextInput>(null);
  const [weightInvalid, setWeightInvalid] = useState(false);
  const [lotNo, setLotNo] = useState(""); const [declaredWeight, setDeclaredWeight] = useState(""); const [weightUnit, setWeightUnit] = useState<"g" | "kg">("kg"); const [tracking, setTracking] = useState("");
  const [lotQuantities, setLotQuantities] = useState<Record<string, string>>({}); const [preview, setPreview] = useState<LotImportPreview | null>(null);
  const [costOpen, setCostOpen] = useState(false); const [costLot, setCostLot] = useState(""); const [costType, setCostType] = useState<CostType>("AGENT_FEE");
  const [costAmount, setCostAmount] = useState(""); const [costNote, setCostNote] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false); const [receiveLot, setReceiveLot] = useState<PurchaseLot | null>(null);
  const [entries, setEntries] = useState<Record<string, ReceiptEntry>>({}); const [billedWeight, setBilledWeight] = useState(""); const [weightOkay, setWeightOkay] = useState(true); const [receiveNote, setReceiveNote] = useState("");
  const [rejecting, setRejecting] = useState<ReceiveSession | null>(null); const [reason, setReason] = useState("");
  const [closeOpen, setCloseOpen] = useState(false); const [closeReason, setCloseReason] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; heading?:string; confirmLabel?:string; action: () => Promise<unknown> } | null>(null);
  const load = useCallback(async () => {
    const data = await api.current<PurchaseDetail>(`/purchase-trips/${id}`);
    setTrip({ ...data, lots: data.lots ?? [], sessions: data.sessions ?? [] }); setPayments(null);
    try { setPayments(await api.current<PurchasePayment[]>(`/purchase-trips/${id}/payments`)); } catch { /* Costs has a payment retry action. */ }
  }, [id, auth.session?.businessId, auth.session?.branchId]);
  useEffect(() => { setTrip(null); setSelectedLotId(null); setLotDetailsOpen(false); setActionsOpen(false); void load().catch(e => setError(e.message)); }, [load]);
  useEffect(() => {
    if (!trip) return;
    let live = true;
    const missing = trip.items.filter(item => !(item.variantId in productImages));
    void Promise.all(missing.map(async item => {
      try {
        const rows = await api.current<{ variantId: string; imageUrl: string | null }[]>(`/products/search?q=${encodeURIComponent(item.variantSku)}`);
        return [item.variantId, rows.find(row => row.variantId === item.variantId)?.imageUrl ?? null] as const;
      } catch { return [item.variantId, null] as const; }
    })).then(rows => { if (live && rows.length) setProductImages(current => ({ ...current, ...Object.fromEntries(rows) })); });
    return () => { live = false; };
  }, [trip, productImages]);
  useEffect(() => {
    if (!trip) return;
    let live = true;
    void Promise.all([...new Set(trip.items.map(item => item.variantId))].map(async variantId => {
      try {
        const value = await api.current<{ brandName: string | null }>(`/brands/variant/${variantId}`);
        return [variantId, value.brandName] as const;
      } catch { return [variantId, null] as const; }
    })).then(rows => { if (live) setProductBrands(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [trip]);
  const run = async (operation: () => Promise<unknown>, after?: () => void) => {
    if (busy) return; setBusy(true); setError("");
    try { await operation(); after?.(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const post = (path: string, body: unknown = {}) => api.current(`/purchase-trips/${id}${path}`, { method: "POST", body: JSON.stringify(body) });
  const formError = error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null;
  const openItem = (item?: PurchaseItem) => {
    setError(""); setEditItem(item ?? null); setProduct(null); setItemQty(item ? String(item.qtyBought) : "1"); setUnitPrice(item ? String(item.totalCost / item.qtyBought) : "");
    setSupplier(item?.supplierId ? { id: item.supplierId, name: item.supplierName ?? "", address: item.supplierAddress, phone: null, country: null } : null);
    if (item) setItemOpen(true); else setPicker(true);
  };
  useEffect(() => {
    const variantId = editItem?.variantId ?? product?.variantId;
    setBrand(null);
    if (!variantId) { setBrandLoading(false); return; }
    setBrandLoading(true);
    let live = true;
    api.current<{ brandId: string | null; brandName: string | null }>(`/brands/variant/${variantId}`)
      .then(value => { if (live) setBrand(value.brandId ? { id: value.brandId, name: value.brandName ?? "" } : null); })
      .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setBrandLoading(false); });
    return () => { live = false; };
  }, [editItem?.variantId, product?.variantId, auth.session?.businessId]);
  const validItemInput = itemQty.trim() !== "" && Number.isFinite(Number(itemQty)) && Number(itemQty) >= 1 &&
    Math.abs(Number(itemQty) * 1000 - Math.round(Number(itemQty) * 1000)) < 0.000001 &&
    unitPrice.trim() !== "" && Number.isFinite(Number(unitPrice)) && Number(unitPrice) >= 0;
  const saveItem = () => run(async () => {
    const count = number(itemQty); const price = number(unitPrice);
    if (count < 1) throw new Error("Ordered quantity must be at least 1.");
    if (!unitPrice.trim()) throw new Error("Enter purchase price.");
    await api.current(`/purchase-trips/${id}/items${editItem ? `/${editItem.id}` : ""}`, { method: editItem ? "PUT" : "POST", body: JSON.stringify({
      variantId: product?.variantId, qtyBought: count, totalCost: Math.round(count * price * 100) / 100, unitWeightGrams: editItem?.unitWeightGrams ?? 0,
      supplierId: supplier?.id ?? null, brandId: brand?.id ?? null, memoPhotoUrl: editItem?.memoPhotoUrl ?? null, paidNow: 0, dueAmount: Math.round(count * price * 100) / 100, promisedDate: editItem?.promisedDate ?? null,
    }) });
  }, () => setItemOpen(false));
  const openLot = (lot?: PurchaseLot) => {
    setError(""); setEditingLot(lot ?? null); setLotNo(lot?.lotNo ?? newLotNumber());
    setWeightInvalid(false); setWeightUnit(lot ? "g" : "kg"); setDeclaredWeight(lot ? String(lot.declaredWeightGrams) : ""); setTracking(lot?.trackingNumber ?? "");
    setLotQuantities(Object.fromEntries((lot?.items ?? []).map(i => [i.purchaseItemId, String(i.qty)]))); setPreview(null); setLotOpen(true);
  };
  const importExcel = async () => {
    setBusy(true); setError(""); setPreview(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return; const file = result.assets[0];
      if ((file.size ?? 0) > 5 * 1024 * 1024) throw new Error("Choose a workbook smaller than 5 MB.");
      let base64: string;
      if (Platform.OS === "web") {
        if (!file.file) throw new Error("Could not read this workbook.");
        base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file.file!); });
        URL.revokeObjectURL(file.uri);
      } else base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      setPreview(await api.current<LotImportPreview>(`/purchase-trips/${id}/lots/import/preview`, { method: "POST", body: JSON.stringify({ fileName: file.name, base64 }) }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const usePreview = () => {
    const values: Record<string, string> = {};
    preview?.rows.forEach(row => { if (row.purchaseItemId) values[row.purchaseItemId] = String(Number(values[row.purchaseItemId] ?? 0) + row.qty); });
    setLotQuantities(values); setPreview(null);
  };
  const saveLot = () => run(async () => {
    if (!declaredWeight.trim() || !Number.isFinite(Number(declaredWeight)) || Number(declaredWeight) <= 0) { setWeightInvalid(true); weightInputRef.current?.focus(); throw new Error("Please enter the weight of the products before saving the lot."); }
    setWeightInvalid(false);
    const items = Object.entries(lotQuantities).map(([purchaseItemId, value]) => {
      const qty = number(value);
      const item = trip!.items.find(i => i.id === purchaseItemId)!;
      if (!value.trim() || qty <= 0 || qty > remainingForLot(item)) throw new Error(`Enter a quantity greater than zero and no more than ${remainingForLot(item)} for ${item.productName}.`);
      return { purchaseItemId, qty };
    });
    if (!items.length) throw new Error("Select at least one product for this lot.");
    const saved = await api.current<PurchaseLot>(`/purchase-trips/${id}/lots${editingLot ? `/${editingLot.id}` : ""}`, { method: editingLot ? "PUT" : "POST", body: JSON.stringify({ lotNo, declaredWeightGrams: Math.round(number(declaredWeight) * (weightUnit === "kg" ? 1000 : 1) * 1000) / 1000, trackingNumber: tracking || null, note: editingLot?.note ?? null, items }) });
    setSelectedLotId(saved.id);
  }, () => { setLotOpen(false); setLotDetailsOpen(true); });
  const openCost = (lotId = "") => { setError(""); setCostLot(lotId); setCostType(lotId ? "CHINA_LOCAL" : "AGENT_FEE"); setCostAmount(""); setCostNote(""); setCostOpen(true); };
  const openReceive = (lot: PurchaseLot | null) => {
    setError(""); setReceiveLot(lot); setWeightOkay(!lot?.billedWeightGrams || lot.billedWeightGrams === lot.declaredWeightGrams); setBilledWeight(lot?.billedWeightGrams ? String(lot.billedWeightGrams / 1000) : ""); setReceiveNote("");
    const lines = lot?.items ?? trip!.items.map(i => ({ purchaseItemId: i.id, qty: Math.max(0, i.qtyBought - i.qtyUsable - i.qtyDamaged - i.qtyMissing) }));
    setEntries(Object.fromEntries(lines.filter(i => i.qty > 0).map(i => { const item = trip!.items.find(p => p.id === i.purchaseItemId)!;
      return [i.purchaseItemId, { usable: String(i.qty), damaged: "0", missing: "0", weight: item.unitWeightGrams ? String(Math.round(i.qty * item.unitWeightGrams * 1000) / 1000) : "" }]; })));
    setReceiveOpen(true);
  };
  const saveReceive = () => run(async () => {
    const preparedItems = Object.entries(entries).map(([purchaseItemId, e]) => {
      const item = trip!.items.find(i => i.id === purchaseItemId)!;
      const expected = receiveLot?.items.find(i => i.purchaseItemId === purchaseItemId)?.qty;
      try {
        const quantities = receiptQuantities(e, expected, item.qtyBought - item.qtyUsable - item.qtyDamaged - item.qtyMissing);
        return { purchaseItemId, ...quantities };
      } catch (error) { throw new Error(`${item.productName}: ${(error as Error).message}`); }
    });
    const billedWeightGrams = weightOkay && receiveLot ? receiveLot.declaredWeightGrams : number(billedWeight) * 1000;
    const totalPhysicalQty = preparedItems.reduce((total, item) => total + item.qtyUsable + item.qtyDamaged, 0);
    if (totalPhysicalQty > 0 && billedWeightGrams <= 0) throw new Error(lang === "bn" ? "কুরিয়ারের বিল করা ওজন কেজিতে লিখুন।" : "Enter the courier billed weight in Kg.");
    const items = preparedItems.map(item => {
      const physicalQty = item.qtyUsable + item.qtyDamaged;
      const measuredWeightGrams = physicalQty > 0 ? Math.max(0.001, Math.round((billedWeightGrams * physicalQty / totalPhysicalQty) * 1000) / 1000) : 0;
      return { ...item, measuredWeightGrams, perLotValuesJson: "{}" };
    });
    await post("/sessions", { shipmentId: receiveLot?.id ?? null, receivedAt: new Date().toISOString(), transportMode: "COURIER", vehicleOrTrackingNo: receiveLot?.trackingNumber ?? null, note: receiveNote || null, billedWeightGrams, items });
  }, () => setReceiveOpen(false));

  if (!trip) return <View style={s.page}>{formError}<ActivityIndicator color={colors.primary} /><Button title="Retry" onPress={() => void load().catch(e => setError(e.message))} /></View>;
  const draft = trip.status === "DRAFT" || trip.status === "PENDING_APPROVAL";
  const approved = !draft && trip.status !== "CANCELLED"; const open = approved && trip.status !== "COMPLETED";
  const allPurchaseCostsPaid = payments !== null && trip.items.every(item => item.totalCost <= 0 || productPayment(item, trip.items, payments)?.amount === item.totalCost) && trip.costs.every(cost => cost.amount <= 0 || payments.some(payment => payment.costKey === cost.id && payment.amount === cost.amount));
  const selectedLot = trip.lots.find(l => l.id === selectedLotId);
  const selectedLotCosts = selectedLot ? trip.costs.filter(cost => cost.shipmentId === selectedLot.id) : [];
  const selectedLotPaymentsPaid = payments !== null && selectedLotCosts.length > 0 && selectedLotCosts.every(cost => cost.amount <= 0 || payments.some(payment => payment.costKey === cost.id && payment.amount === cost.amount));
  const receiveEntriesValid = Object.values(entries).length > 0 && Object.values(entries).every(entry => entry.usable.trim() !== "" && Number.isFinite(Number(entry.usable)) && Number(entry.usable) >= 0);
  const totalProducts = trip.items.reduce((sum, i) => sum + i.totalCost, 0); const totalCosts = trip.costs.reduce((sum, c) => sum + c.amount, 0);
  const productPaid = payments?.some(p => p.costKey === "00000000-0000-0000-0000-000000000000") ?? false;
  const tabs: { key: Tab; label: string }[] = [{ key: "guide", label: guideCopy.tab }, { key: "products", label: "Products" }, ...(approved ? [{ key: "lots" as Tab, label: "Lots" }] : []), { key: "costs", label: "Costs" }, ...(approved ? [{ key: "summary" as Tab, label: "Cost Summary" }] : [])];
  const guideDone = [trip.items.length > 0, approved, trip.lots.length > 0, trip.lots.length > 0 && trip.lots.every(lot => lot.status === "RECEIVED"), trip.status === "COMPLETED"];
  const nextGuideStep = guideDone.findIndex(done => !done);
  const startGuideStep = (index:number) => { setActionsOpen(false); setTab(index === 0 ? "products" : index === 1 ? "costs" : "lots"); };
  const remainingForLot = (item: PurchaseItem) => item.qtyBought - trip.lots.filter(l => l.id !== editingLot?.id).flatMap(l => l.items).filter(i => i.purchaseItemId === item.id).reduce((sum, i) => sum + i.qty, 0)
    - trip.sessions.filter(s => !s.shipmentId && s.status !== "REJECTED").flatMap(s => s.items).filter(i => i.purchaseItemId === item.id).reduce((sum, i) => sum + i.qtyUsable + i.qtyDamaged + i.qtyMissing, 0);
  const renderSession = (session: ReceiveSession) => <View key={session.id} style={s.card}>
    <Text style={s.subtitle}>{session.sessionNo} · {session.status.replaceAll("_", " ")}</Text><Text style={s.muted}>{new Date(session.receivedAt).toLocaleString()} · {session.receivedByName}</Text>
    {session.items.map(i => <Text key={i.id} style={s.body}>{trip.items.find(p => p.id === i.purchaseItemId)?.productName}: {i.qtyUsable} usable / {i.qtyDamaged} damaged / {i.qtyMissing} missing · {i.measuredWeightGrams} g</Text>)}
    {!!session.note && <Text style={s.body}>{session.note}</Text>}{!!session.rejectionReason && <Text style={s.error}>{session.rejectionReason}</Text>}
    {session.status === "PENDING_APPROVAL" && approver && open && <View style={s.row}><Button title="Approve receipt" disabled={busy} onPress={() => void run(() => post(`/sessions/${session.id}/approve`))} /><Button title="Reject" secondary onPress={() => { setReason(""); setRejecting(session); setError(""); }} /></View>}
  </View>;

  return <View style={s.root}>
    <View style={s.header}><View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="Back to purchases" onPress={() => router.canGoBack() ? router.back() : router.replace("/more/purchases")} style={s.productIcon}><Ionicons name="arrow-back" size={22} color={colors.heading} /></Pressable><View style={{ flex: 1 }}><Text style={s.muted}>Purchase Order</Text><Text style={s.title}>{trip.note?.trim() || trip.tripNo}</Text></View><Text style={s.statusPill}>{trip.status.replaceAll("_", " ")}</Text>{busy && <ActivityIndicator color={colors.primary} />}{((owner && draft) || (approver && open && tab === "lots")) && <Pressable accessibilityRole="button" accessibilityLabel="PO actions" accessibilityState={{ expanded: actionsOpen }} onPress={() => setActionsOpen(value => !value)} style={s.actionsToggle}><Text style={s.actionsIcon}>⋯</Text></Pressable>}</View>
      {owner && draft && actionsOpen && <View style={s.actionsMenu}><Pressable accessibilityRole="button" disabled={busy || payments === null || payments.length > 0} style={[s.button, (busy || payments === null || payments.length > 0) && s.disabled, s.cancelAction]} onPress={() => { setActionsOpen(false); setConfirm({ title: "Cancel this PO?", action: () => post("/cancel") }); }}><Text style={s.error}>Cancel PO</Text></Pressable></View>}
      {approver && open && tab === "lots" && actionsOpen && <View style={s.actionsMenu}><Pressable accessibilityRole="button" disabled={busy} style={[s.button, s.cancelAction, busy && s.disabled]} onPress={() => { setActionsOpen(false); setCloseReason(""); setCloseOpen(true); setError(""); }}><Text style={s.error}>Close PO manually</Text></Pressable></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>{tabs.map(t => <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => { setActionsOpen(false); setTab(t.key); }} style={[s.segment, tab === t.key && s.segmentActive]}><Ionicons name={t.key === "guide" ? "map-outline" : t.key === "products" ? "cube-outline" : t.key === "lots" ? "airplane-outline" : t.key === "costs" ? "wallet-outline" : "stats-chart-outline"} size={17} color={tab === t.key ? colors.primaryDark : colors.secondary} /><Text style={[s.segmentText, tab === t.key && { color: colors.primaryDark }]}>{t.label}</Text></Pressable>)}</ScrollView></View>
    <ScrollView contentContainerStyle={[s.page, (tab === "products" || tab === "costs" || tab === "lots") && { width: "100%", maxWidth: 1120, alignSelf: "center" }]} keyboardShouldPersistTaps="handled">
      {tab !== "guide" && ((tab === "products" || tab === "costs" || tab === "lots") ? <View style={s.overview}>
        {!["DRAFT", "PRODUCT_APPROVED", "IN_PROGRESS", "COMPLETED"].includes(trip.status) ? <PurchaseProgress status={trip.status} /> : <View style={s.stepper}>{(["DRAFT", "PRODUCT_APPROVED", "IN_PROGRESS", "COMPLETED"] as const).map((status, index, steps) => {
          const current = steps.indexOf(trip.status as typeof steps[number]);
          return <View key={status} style={s.step}><View style={s.stepTrack}><View style={[s.stepLine, index === 0 && { opacity: 0 }, index <= current && { backgroundColor: colors.primary }]} /><View style={[s.stepCircle, index <= current && s.stepCircleActive]}>{index < current ? <Ionicons name="checkmark" size={15} color={colors.white} /> : <Text style={[s.stepNumber, index <= current && { color: colors.white }]}>{index + 1}</Text>}</View><View style={[s.stepLine, index === 3 && { opacity: 0 }, index < current && { backgroundColor: colors.primary }]} /></View><Text style={[s.stepLabel, index === current && { color: colors.primaryDark, fontWeight: "700" }]}>{(lang==="bn"?["ড্রাফট তৈরি","পণ্য অনুমোদিত","কাজ চলছে","সম্পন্ন"]:["Draft created","Product approved","In progress","Completed"])[index]}</Text></View>;
        })}</View>}
      </View> : <><PurchaseProgress status={trip.status} /><View style={s.card}><Text style={s.subtitle}>Products {money(totalProducts)} · Costs {money(totalCosts)}</Text><Text style={s.muted}>Total {money(totalProducts + totalCosts)} · All amounts in BDT</Text></View></>)}{formError}
      {tab === "guide" && <ProcessGuide title={guideCopy.heading} steps={guideCopy.steps.map(([title,description],index)=>({title,description,icon:(["cart-outline","checkmark-circle-outline","cube-outline","download-outline","flag-outline"] as const)[index],done:guideDone[index],action:index===nextGuideStep?{label:guideCopy.start,onPress:()=>startGuideStep(index)}:undefined}))}/>}
      {tab === "products" && <>
        <View style={s.lotInstruction}><Ionicons name="information-circle-outline" size={21} color={colors.primaryDark}/><View style={s.flex}><Text style={s.lotInstructionTitle}>{guideCopy.step} 1: {guideCopy.steps[0][0]}</Text><Text style={s.lotInstructionText}>{guideCopy.steps[0][1]}</Text></View></View>
        <View style={s.sectionHeading}><View style={{ flex: 1 }}><Text style={s.subtitle}>{lang==="bn"?"প্রোডাক্ট":"Products"} <Text style={s.muted}>({trip.items.length})</Text></Text><Text style={s.muted}>{lang==="bn"?"এই PO-তে কেনার জন্য যোগ করা পণ্য":"Items in this purchase order"}</Text></View>{owner && draft && <Pressable accessibilityRole="button" disabled={busy || payments === null || productPaid} onPress={() => openItem()} style={[s.addProductLabel, (busy || payments === null || productPaid) && s.disabled]}><Ionicons name="add" size={16} color={colors.primaryDark} /><Text style={s.addProductLabelText}>{lang==="bn"?"প্রোডাক্ট যোগ করুন":"Add product"}</Text></Pressable>}</View>
        {productPaid && draft && <Text style={s.muted}>This historical PO was paid as a whole. Its existing product lines are locked.</Text>}
        {trip.items.map(item => <View style={[s.productCard, payments !== null && !!productPayment(item, trip.items, payments) && { backgroundColor: colors.successBackground }]} key={item.id}><View style={s.productIdentity}><View style={s.productHeading}><ProductIdentity name={item.productName} sku={item.variantSku} imageUrl={productImages[item.variantId]} detail={[productBrands[item.variantId] ? `Brand: ${productBrands[item.variantId]}` : null, item.supplierName ? `Supplier: ${item.supplierName}` : null].filter(Boolean).join(" · ") || undefined} />
          {owner && draft && !productPaid && payments !== null && !productPayment(item, trip.items, payments) && <View style={s.productActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.productName}`} disabled={busy} onPress={() => openItem(item)} style={[s.productIcon, busy && s.disabled]}><Ionicons name="create-outline" size={20} color={colors.primaryDark} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.productName}`} disabled={busy} onPress={() => setConfirm({ title: `Remove ${item.productName}?`, action: () => api.current(`/purchase-trips/${id}/items/${item.id}`, { method: "DELETE" }) })} style={[s.productIcon, busy && s.disabled]}><Ionicons name="trash-outline" size={20} color={colors.dangerText} /></Pressable>
          </View>}</View></View>
          {draft ? <View style={s.productBottom}>
            <View style={s.bottomInline}><Ionicons name="cart-outline" size={15} color={colors.primaryDark} /><Text style={s.metricLabel}>Ordered quantity: <Text style={s.bottomValue}>{item.qtyBought}</Text></Text></View>
            <Text style={s.muted}>|</Text>
            <View style={s.bottomInline}><Ionicons name="pricetag-outline" size={15} color={colors.primaryDark} /><Text style={s.metricLabel}>Unit purchase price: <Text style={s.bottomValue}>{money(item.qtyBought > 0 ? item.totalCost / item.qtyBought : 0)}</Text></Text></View>
            <Text style={s.muted}>|</Text>
            <View style={s.bottomInline}><Ionicons name="wallet-outline" size={15} color={colors.primaryDark} /><Text style={s.metricLabel}>Product purchase cost: <Text style={s.bottomValue}>{money(item.totalCost)}</Text></Text></View>
          </View> : <>
          <View style={s.quantityGrid}>{([["Ordered", item.qtyBought, "cart-outline"], ["Shipped", item.qtyShipped, "airplane-outline"], ["Received", item.qtyUsable + item.qtyDamaged, "checkmark-done-outline"], ["Missing", item.qtyMissing, "alert-circle-outline"]] as const).map(([label, value, icon]) => <View key={label} style={[s.quantityCell, { backgroundColor: label === "Ordered" ? colors.primaryLight : label === "Shipped" ? colors.infoBackground : label === "Received" ? colors.successBackground : colors.warningBackground }, compact && { flexBasis: "45%" }]}><View style={[s.inline, { justifyContent: "center" }]}><Ionicons name={icon} size={15} color={colors.neutralIcon} /><Text style={s.metricLabel}>{label}</Text></View><Text style={s.quantityValue}>{value}</Text></View>)}</View>
          <View style={s.productFooter}><View style={s.productBottom}>
            <View style={s.bottomInline}><Ionicons name="checkmark-circle-outline" size={15} color={colors.successText} /><Text style={s.metricLabel}>Usable: <Text style={s.bottomValue}>{item.qtyUsable}</Text></Text></View>
            <Text style={s.muted}>|</Text>
            <View style={s.bottomInline}><Ionicons name="alert-circle-outline" size={15} color={colors.warningText} /><Text style={s.metricLabel}>Damaged: <Text style={s.bottomValue}>{item.qtyDamaged}</Text></Text></View>
            <Text style={s.muted}>|</Text>
            <View style={s.bottomInline}><Ionicons name="wallet-outline" size={15} color={colors.primaryDark} /><Text style={s.metricLabel}>Purchase amount: <Text style={s.bottomValue}>{money(item.totalCost)}</Text></Text></View>
          </View>
          <View style={s.inline}><Ionicons name="information-circle-outline" size={16} color={colors.muted} /><Text style={[s.muted, { flex: 1 }]}>{item.unitWeightGrams > 0 ? `Saved unit weight: ${item.unitWeightGrams} g` : "Weigh this product when it arrives."}</Text></View></View>
          </>}
          <View style={s.productPaymentRow}>
            <Text style={[s.productPaymentBadge, { backgroundColor: payments === null ? colors.disabled : productPayment(item, trip.items, payments) ? colors.successText : item.totalCost === 0 ? colors.disabled : colors.dangerBackground, color: payments === null ? colors.secondary : productPayment(item, trip.items, payments) ? colors.white : item.totalCost === 0 ? colors.secondary : colors.dangerText }]}>{payments === null ? "Payment status unavailable" : productPayment(item, trip.items, payments) ? `Paid ${money(item.totalCost)}` : item.totalCost === 0 ? "No payment required" : `Unpaid · Due ${money(item.totalCost)}`}</Text>
            {payments === null && <Button title="Retry payments" secondary onPress={() => void load().catch(e => setError(e.message))} />}
            {approver && draft && !busy && payments !== null && !productPaid && !productPayment(item, trip.items, payments) && item.totalCost > 0 && <PurchasePaymentSource compact tripId={trip.id} costKey={item.id} purchaseItemId={item.id} poNumber={trip.tripNo} itemTitle={item.productName} amount={item.totalCost} onPaid={result => { setPayments(current => [...(current ?? []).filter(p => p.costKey !== item.id), result]); void load().catch(e => setError(e.message)); }} />}
          </View>
        </View>)}
        {!trip.items.length && <View style={s.emptyProducts}><Ionicons name="cube-outline" size={32} color={colors.neutralIcon} /><Text style={s.subtitle}>{lang==="bn"?"এখনো কোনো প্রোডাক্ট যোগ করা হয়নি":"No products yet"}</Text><Text style={s.muted}>{lang==="bn"?"এই PO শুরু করতে কেনার প্রোডাক্ট যোগ করুন।":"Add products to start this PO."}</Text></View>}
        {trip.attachments.map((attachment, index) => { const a = attachment as { name?: string; url?: string }; return a.url ? <Button key={index} title={a.name ?? "Open attachment"} secondary onPress={() => void Linking.openURL(a.url!.startsWith("/") ? MEDIA_URL + a.url : a.url!)} /> : null; })}
        {draft && trip.items.length > 0 && <View style={s.footerAction}><Pressable accessibilityRole="button" onPress={() => setTab("costs")} style={s.continueAction}><Text style={[s.buttonText, { flexShrink: 1 }]}>Continue to cost</Text><Ionicons name="arrow-forward" size={19} color={colors.white} /></Pressable></View>}
        {owner && open && allPurchaseCostsPaid && <View style={s.footerAction}><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setTab("lots"); setActionsOpen(false); }} style={[s.continueAction, busy && s.disabled]}><Text style={s.buttonText}>Prepare Lot</Text><Ionicons name="arrow-forward" size={19} color={colors.white} /></Pressable></View>}
      </>}
      {tab === "lots" && approved && <>
        <View style={s.lotInstruction}><Ionicons name="information-circle-outline" size={21} color={colors.primaryDark}/><View style={s.flex}><Text style={s.lotInstructionTitle}>{guideCopy.step} 3: {guideCopy.steps[2][0]}</Text><Text style={s.lotInstructionText}>{guideCopy.steps[2][1]}</Text></View></View>
        {owner && open && trip.items.some(item => item.qtyBought > trip.lots.flatMap(lot => lot.items).filter(line => line.purchaseItemId === item.id).reduce((total, line) => total + line.qty, 0)) && <Button title="Create Lot for Courier" disabled={busy} onPress={() => openLot()} />}
        {trip.lots.map(lot => <Pressable key={lot.id} accessibilityRole="button" onPress={() => { setSelectedLotId(lot.id); setLotCostOpen(false); setLotDetailsOpen(true); setError(""); }} style={[s.card, selectedLotId === lot.id && s.selected, lot.status === "RECEIVED" && {backgroundColor:colors.successBackground,borderColor:colors.successText}]}><View style={s.row}><Text style={s.subtitle}>{lot.lotNo}</Text><View style={{backgroundColor:lot.status === "RECEIVED" ? colors.successText : colors.primaryLight,paddingHorizontal:10,paddingVertical:5,borderRadius:7}}><Text style={[s.badge,lot.status === "RECEIVED" && {color:colors.white}]}>{lot.status === "READY" ? (lang === "bn" ? "কুরিয়ারে পাঠানোর জন্য প্রস্তুত" : "Ready for Courier") : lot.status === "SENT" ? (lang === "bn" ? "কুরিয়ারে পাঠানো হয়েছে" : "SENT TO COURIER") : lot.status}</Text></View></View><Text style={s.body}>{lang === "bn" ? `${lot.items.reduce((sum, i) => sum + i.qty, 0)}টি পণ্য · ঘোষিত ওজন: ${(lot.declaredWeightGrams / 1000).toLocaleString(undefined,{maximumFractionDigits:6})} কেজি` : `${lot.items.reduce((sum, i) => sum + i.qty, 0)} pieces · Declared weight: ${(lot.declaredWeightGrams / 1000).toLocaleString(undefined,{maximumFractionDigits:6})} Kg`}</Text><Text style={s.muted}>{lang === "bn" ? "পণ্য, ওজন, খরচ ও গ্রহণের তথ্য দেখতে চাপ দিন" : "Tap to view items, weights, costs and receiving"}</Text></Pressable>)}
        {!trip.lots.length && <Text style={s.muted}>No shipment lots yet.</Text>}

      </>}
      {tab === "costs" && <>
        <PurchaseCostPayments onBack={() => setTab("products")} headerActions={owner && trip.status !== "CANCELLED" && <View style={s.row}>{(draft || trip.status === "COMPLETED") && <Pressable accessibilityRole="button" onPress={() => openCost()} style={s.addProductLabel}><Ionicons name="add" size={16} color={colors.primaryDark}/><Text style={s.addProductLabelText}>{lang==="bn"?(draft?"সাধারণ খরচ যোগ করুন":"PO সম্পন্ন হওয়ার পরের খরচ যোগ করুন"):(draft?"Add common cost":"Add post-completion cost")}</Text></Pressable>}{open && trip.lots.some(l => l.status !== "RECEIVED") && <Pressable accessibilityRole="button" onPress={() => openCost(trip.lots.find(l => l.status !== "RECEIVED")!.id)} style={s.lotCostAction}><Ionicons name="add" size={17} color={colors.primaryDark}/><Text style={s.secondaryText}>{lang==="bn"?"লটের খরচ যোগ করুন":"Add lot cost"}</Text></Pressable>}</View>} tripId={trip.id} poNumber={trip.tripNo} items={trip.items} costs={trip.costs} lots={trip.lots} allowPay={approver && trip.status !== "CANCELLED"}
          canDelete={cost => owner && (cost.isPostCompletion || (cost.shipmentId ? trip.lots.some(l => l.id === cost.shipmentId && l.status !== "RECEIVED") : draft))}
          onDelete={cost => setConfirm({ title: "Remove this unpaid cost?", action: () => api.current(`/purchase-trips/${id}/costs/${cost.id}`, { method: "DELETE" }) })}
          onUpdated={() => void load().catch(e => setError(e.message))}
          onPaid={() => void load().catch(e => setError(e.message))} approving={busy} onApprove={approver && draft ? () => setConfirm({heading:`${guideCopy.step} 2: ${guideCopy.steps[1][0]}`,title:guideCopy.steps[1][1],confirmLabel:lang==="bn"?"হ্যাঁ, অনুমোদন দিন":"Yes, approve PO",action:async()=>{await post("/approve",{note:null});setTab("lots");}}) : undefined} />
      </>}
      {tab === "summary" && approved && <>
        {trip.items.map(item => { const lines = trip.sessions.filter(s => s.status === "APPROVED").flatMap(s => s.items).filter(i => i.purchaseItemId === item.id);
          return <View key={item.id} style={s.card}><Text style={s.subtitle}>{item.productName} · {item.variantSku}</Text><Text style={s.body}>Landed cost / usable unit: {money(item.landedUnitCost)}</Text><Text style={s.body}>Allocated costs: {money(item.allocatedSharedCost)}</Text><Text style={s.body}>Recorded loss: {money(lines.reduce((sum, i) => sum + i.lossAmount, 0))}</Text><Text style={s.muted}>Usable {item.qtyUsable} · Damaged {item.qtyDamaged} · Missing {item.qtyMissing}</Text></View>; })}
        {trip.lots.flatMap(l => l.weightWarnings.map((w, i) => <Text key={`${l.id}-${i}`} style={s.warning}>{l.lotNo}: {w}</Text>))}<Text style={s.muted}>Weight warnings do not block receiving. Post-completion costs are excluded from landed cost.</Text>{!!trip.forceCloseReason && <Text style={s.warning}>Manual close: {trip.forceCloseReason}</Text>}
      </>}
    </ScrollView>
        {selectedLot && <LotCourierPicker visible={courierOpen} selectedId={selectedLot.shippingCompanyId} selectedMethod={selectedLot.shippingMethod} onClose={()=>setCourierOpen(false)} onSave={async (company, method)=>{await api.current(`/purchase-trips/${id}/lots/${selectedLot.id}`,{method:"PUT",body:JSON.stringify({lotNo:selectedLot.lotNo,declaredWeightGrams:selectedLot.declaredWeightGrams,trackingNumber:selectedLot.trackingNumber,note:selectedLot.note,items:selectedLot.items,shippingCompanyId:company.id,shippingMethod:method})});await load();}} />}
    {selectedLot && lotCostOpen && <PopupSheet visible={lotCostOpen} title="Add lot cost" onClose={() => setLotCostOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16}}><LotCostForm showTitle={false} key={selectedLot.id} tripId={trip.id} lotId={selectedLot.id} onCancel={() => setLotCostOpen(false)} onSaved={() => { setLotCostOpen(false); void load().catch(e => setError(e.message)); }} /></ScrollView></PopupSheet>}
    {selectedLot && <PopupSheet visible={lotDetailsOpen && !lotCostOpen && !courierOpen && !lotOpen && !costOpen && !receiveOpen && !confirm && !rejecting} title={`${selectedLot.lotNo} ${lang==="bn"?"বিস্তারিত":"details"}`} headerAction={<View style={{backgroundColor:colors.primaryLight,paddingHorizontal:10,paddingVertical:5,borderRadius:7}}><Text style={s.badge}>{selectedLot.status === "READY" ? (lang==="bn"?"কুরিয়ারে দেওয়ার জন্য প্রস্তুত":"Ready for Courier") : selectedLot.status === "SENT" ? (lang==="bn"?"কুরিয়ারে পাঠানো হয়েছে":"SENT TO COURIER") : selectedLot.status === "RECEIVED"?(lang==="bn"?"পণ্য বুঝে পাওয়া হয়েছে":"RECEIVED"):selectedLot.status}</Text></View>} onClose={() => setLotDetailsOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.stack, { padding: 16 }]}>{formError}<View style={{gap:6,padding:12,borderWidth:1,borderColor:colors.divider,borderRadius:10,backgroundColor:colors.white}}><Text style={s.subtitle}>{lang==="bn"?"লটের কাজগুলো":"Lot Tasks"}</Text>{([
            [lang==="bn"?"কুরিয়ারের জন্য লট তৈরি করুন":"Create Lot for Courier", true],
            [lang==="bn"?"শিপিং কোম্পানি নির্বাচন করুন":"Assign Shipping Company", !!selectedLot.shippingCompanyId],
            [lang==="bn"?"খরচ যোগ করুন (যদি থাকে)":"Add Cost (if any)", trip.costs.some(cost => cost.shipmentId === selectedLot.id)],
            [lang==="bn"?"‘শিপড হিসেবে চিহ্নিত করুন’ বাটনে ক্লিক করুন":"Click Mark as Shipped", selectedLot.status === "SENT" || selectedLot.status === "RECEIVED"],
            [lang==="bn"?"সব পেমেন্ট পরিশোধ করা হয়েছে":"All Payments Paid", selectedLotPaymentsPaid],
            [lang==="bn"?"কুরিয়ার থেকে পণ্য বুঝে নিন":"Receive from Courier Service", selectedLot.status === "RECEIVED"],
          ] as const).map(([label,checked])=><View key={label} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled:true}} style={{flexDirection:"row",alignItems:"center",gap:8,minHeight:30}}><Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? colors.successText : colors.muted}/><Text style={{fontSize:12,color:checked ? colors.heading : colors.secondary,flex:1}}>{label}{label === "All Payments Paid" && payments === null ? " (status unavailable)" : ""}</Text></View>)}</View>
          
          <View style={{flexDirection:"row",gap:8}}>{([[(lang==="bn"?"ঘোষিত":"Declared"),selectedLot.declaredWeightGrams],[(lang==="bn"?"মাপা":"Measured"),selectedLot.measuredWeightGrams],[(lang==="bn"?"বিল করা":"Billed"),selectedLot.billedWeightGrams]] as const).map(([label,grams])=><View key={label} style={{flex:1,minWidth:0,alignItems:"center",gap:4,paddingHorizontal:6,paddingVertical:10,borderWidth:1,borderColor:colors.divider,borderRadius:9,backgroundColor:colors.disabled}}><Text style={s.metricLabel}>{label}</Text><Text style={{fontSize:16,fontWeight:"700",color:colors.heading,textAlign:"center"}}>{(grams / 1000).toLocaleString(undefined,{maximumFractionDigits:6})} Kg</Text></View>)}</View>
          {!!selectedLot.trackingNumber && <Text style={s.body}>Tracking: {selectedLot.trackingNumber}</Text>}
          <View style={{gap:8}}><Text style={s.subtitle}>{lang==="bn"?"এই লটের নির্বাচিত প্রোডাক্ট":"Selected Products for the Lot"}</Text>
          {selectedLot.items.map(line => {
            const item = trip.items.find(i => i.id === line.purchaseItemId);
            return <View key={line.purchaseItemId} style={{flexDirection:"row",alignItems:"center",gap:10,padding:10,borderWidth:1,borderColor:colors.divider,borderRadius:10,backgroundColor:colors.white}}>
              <View accessibilityRole="checkbox" accessibilityLabel={`${item?.productName ?? "Product"} selected`} accessibilityState={{checked:true,disabled:true}}><Ionicons name="checkbox" size={22} color={colors.primaryDark}/></View>
              <ProductIdentity name={item?.productName ?? "Product"} sku={item?.variantSku ?? ""} imageUrl={item ? productImages[item.variantId] : null} />
              <View style={{alignItems:"center",justifyContent:"center",paddingHorizontal:10,paddingVertical:6,borderRadius:8,backgroundColor:colors.primaryLight,maxWidth:"35%"}}><Text style={{fontSize:10,color:colors.secondary}}>{lang==="bn"?"লটের পরিমাণ":"Lot Qty"}</Text><Text style={{fontSize:17,fontWeight:"700",color:colors.primaryDark,textAlign:"center"}}>{line.qty}</Text></View>
            </View>;
          })}</View>
          {selectedLot.weightWarnings.map((w, i) => <Text key={i} style={s.warning}>{w}</Text>)}
          <View style={{flexDirection:"row",alignItems:"center",gap:12,padding:12,borderWidth:1,borderColor:colors.info,borderRadius:10,backgroundColor:colors.infoBackground}}><View style={{flex:1,minWidth:0,gap:3}}><Text style={s.label}>{lang==="bn"?"ইমপোর্ট / এক্সপোর্ট শিপিং কোম্পানি":"Import / Export Shipping Company"}</Text><Text style={s.body}>{selectedLot.shippingCompanyName || (lang==="bn"?"নির্বাচন করা হয়নি":"Not assigned")}</Text>{selectedLot.shippingCompanyId && <Text style={s.muted}>{selectedLot.shippingMethod === "AIR" ? (lang==="bn"?"এয়ার":"Air") : (lang==="bn"?"সি":"Sea")} · {money(selectedLot.ratePerKg ?? 0)}/Kg · {lang==="bn"?"আনুমানিক":"Estimated"} {money(selectedLot.calculatedShippingCost ?? 0)}</Text>}</View>{owner && open && selectedLot.status === "READY" && <Pressable accessibilityRole="button" onPress={()=>setCourierOpen(true)} style={{paddingVertical:8,paddingLeft:8}}><Text style={{color:colors.primaryDark,fontWeight:"600",textAlign:"right"}}>{selectedLot.shippingCompanyId ? (lang==="bn"?"+ শিপিং কোম্পানি পরিবর্তন করুন":"+ Change Shipping Company") : (lang==="bn"?"+ শিপিং কোম্পানি নির্বাচন করুন":"+ Assign Shipping Company")}</Text></Pressable>}</View>
          <View style={{gap:8,padding:12,borderWidth:1,borderColor:colors.warning,borderRadius:10,backgroundColor:colors.warningBackground}}>
            <LotCosts lotId={selectedLot.id} lotNo={selectedLot.lotNo} tripId={trip.id} poNumber={trip.tripNo} costs={trip.costs} payments={payments} allowPay={approver && trip.status !== "CANCELLED"}
              canDelete={cost => owner && (cost.isPostCompletion || selectedLot.status !== "RECEIVED")}
              onDelete={cost => setConfirm({ title: "Remove this unpaid cost?", action: () => api.current(`/purchase-trips/${id}/costs/${cost.id}`, { method: "DELETE" }) })}
              onUpdated={() => void load().catch(e => setError(e.message))}
              onPaid={payment => { setPayments(current => [...(current ?? []).filter(p => p.costKey !== payment.costKey), payment]); void load().catch(e => setError(e.message)); }} />
            {owner && open && selectedLot.status !== "RECEIVED" && <Pressable accessibilityRole="button" onPress={() => setLotCostOpen(true)} style={{alignSelf:"flex-end",paddingVertical:8,paddingLeft:8}}><Text style={{color:colors.primaryDark,fontWeight:"600",textAlign:"right"}}>{lang==="bn"?"+ লটের খরচ যোগ করুন":"+ Add lot cost"}</Text></Pressable>}
          </View>
          {owner && open && selectedLot.status === "READY" && <View style={s.row}><Button title={lang==="bn"?"লট পরিবর্তন করুন":"Edit lot"} secondary onPress={() => openLot(selectedLot)} /><Button title={lang==="bn"?"শিপড হিসেবে চিহ্নিত করুন":"Mark as Shipped"} disabled={busy || !selectedLot.shippingCompanyId} onPress={() => setConfirm({ title: lang==="bn"?`${selectedLot.lotNo} কুরিয়ারে পাঠানো হয়েছে হিসেবে চিহ্নিত করবেন? এরপর পণ্যের পরিমাণ পরিবর্তন করা যাবে না।`:`Mark ${selectedLot.lotNo} as shipped? Product quantities will be locked.`, action: async () => { await post(`/lots/${selectedLot.id}/send`); setLotDetailsOpen(false); } })} /></View>}
          {receiver && open && selectedLot.status === "SENT" && !trip.sessions.some(s => s.shipmentId === selectedLot.id && s.status !== "REJECTED") && <Button title={lang==="bn"?"পণ্য বুঝে নিয়ে ওজন লিখুন":"Receive and weigh"} disabled={busy || !selectedLotPaymentsPaid} onPress={() => openReceive(selectedLot)} />}
          {trip.sessions.filter(s => s.shipmentId === selectedLot.id).map(renderSession)}
        </ScrollView></PopupSheet>}
    <ProductPicker createProductInline showRecentlyPurchased={false} open={picker} onClose={() => setPicker(false)} onSelect={p => { setProductImages(current => ({ ...current, [p.variantId]: p.imageUrl })); setProduct(p); setPicker(false); setItemOpen(true); }} />
    <PopupSheet visible={itemOpen && !supplierOpen && !brandOpen} title={editItem ? "Edit product" : "Add product"} onClose={() => setItemOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.stack, { padding: 16 }]}>{formError}<View style={s.productHeading}><ProductIdentity name={editItem?.productName ?? product?.productName ?? ""} sku={editItem?.variantSku ?? product?.variantSku ?? ""} imageUrl={editItem ? productImages[editItem.variantId] : product?.imageUrl} /></View><View style={s.productFields}><View style={s.productField}><Field label="Ordered Quantity" value={itemQty} onChange={setItemQty} numeric /></View><View style={s.productField}><Field label="Unit Purchase Price (BDT)" value={unitPrice} onChange={setUnitPrice} numeric /></View><View style={s.productTotalField}><Text style={s.totalEquals}>=</Text><View style={s.productField}><Text style={s.label}>Total Purchase Cost (BDT)</Text><TextInput accessibilityLabel="Total Purchase Cost (BDT), read only" editable={false} value={validItemInput ? (Math.round(Number(itemQty) * Number(unitPrice) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""} style={[s.input, s.readonlyTotal]} /></View></View></View><View style={s.labelActions}><Pressable accessibilityRole="button" disabled={brandLoading || busy} onPress={() => setBrandOpen(true)} style={[s.labelButton, (brandLoading || busy) && s.disabled]}><Text style={s.labelButtonText}>+ {brand ? `Brand: ${brand.name}` : "Choose brand (optional)"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => setSupplierOpen(true)} style={[s.labelButton, busy && s.disabled]}><Text style={s.labelButtonText}>+ {supplier ? `Supplier: ${supplier.name}` : "Choose supplier (optional)"}</Text></Pressable></View><Button title="Save product" disabled={busy || brandLoading || !validItemInput} onPress={saveItem} /></ScrollView></PopupSheet>
    <BrandPicker open={brandOpen} selectedId={brand?.id} onClose={() => setBrandOpen(false)} onSelect={value => { setBrand(value); setBrandOpen(false); }} />
    <SupplierPicker open={supplierOpen} selectedId={supplier?.id} onClose={() => setSupplierOpen(false)} onSelect={value => { setSupplier(value); setSupplierOpen(false); }} />
    <PopupSheet visible={lotOpen} title={editingLot ? "Edit lot" : "Create lot"} onClose={() => setLotOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.stack, { padding: 16 }]}>{formError}<View style={s.lotFields}><View style={s.lotHalf}><Field label="Lot number" value={lotNo} onChange={setLotNo} /></View><View style={s.lotHalf}><Text style={s.label}>Declared total weight</Text><View style={[s.weightInputBox, weightInvalid && { borderColor: colors.danger, borderWidth: 2 }]}><TextInput ref={weightInputRef} accessibilityLabel="Declared total weight" value={declaredWeight} onChangeText={value => { setDeclaredWeight(value); if (value.trim() && Number.isFinite(Number(value)) && Number(value) > 0) { setWeightInvalid(false); setError(""); } }} keyboardType="decimal-pad" style={s.weightInput} /><View style={s.weightUnits}>{(["g", "kg"] as const).map(unit => <Pressable key={unit} accessibilityRole="radio" accessibilityLabel={unit === "g" ? "Grams" : "Kilograms"} accessibilityState={{ checked: weightUnit === unit }} onPress={() => { if (unit !== weightUnit) { const value = Number(declaredWeight); if (declaredWeight.trim() && Number.isFinite(value) && value >= 0) setDeclaredWeight(String(Number((value * (unit === "kg" ? 0.001 : 1000)).toFixed(unit === "kg" ? 6 : 3)))); setWeightUnit(unit); } }} style={[s.weightUnit, weightUnit === unit && { backgroundColor: colors.primaryLight }]}><Text style={{ color: weightUnit === unit ? colors.primaryDark : colors.secondary, fontWeight: "600", fontSize: 12 }}>{unit === "g" ? "Gram" : "Kg"}</Text></Pressable>)}</View></View></View><View style={s.lotHalf}><Field label="Tracking number (optional)" value={tracking} onChange={setTracking} /></View></View>
      <Text style={s.subtitle}>Select products for this lot</Text>
      {trip.items.map(item => {
        const selected = Object.prototype.hasOwnProperty.call(lotQuantities, item.id);
        const available = remainingForLot(item);
        return <View key={item.id} style={[s.lotProduct, selected && s.lotProductSelected]}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={item.productName} accessibilityState={{ checked: selected, disabled: busy || (!selected && available <= 0) }} disabled={busy || (!selected && available <= 0)} onPress={() => setLotQuantities(current => { const next = { ...current }; if (selected) delete next[item.id]; else next[item.id] = String(available); return next; })} style={[s.lotProductChoice, !selected && available <= 0 && s.disabled]}>
            <Ionicons name={selected ? "checkbox" : "square-outline"} size={23} color={selected ? colors.primaryDark : colors.neutralIcon} />
            <ProductIdentity name={item.productName} sku={item.variantSku} imageUrl={productImages[item.variantId]} detail={`Ordered Qty: ${item.qtyBought}${available < item.qtyBought ? ` · Remaining: ${available}` : ""}`} />
          </Pressable>
          {selected && <View style={s.lotQuantity}><Field label="Lot quantity" value={lotQuantities[item.id]} numeric onChange={value => setLotQuantities(current => ({ ...current, [item.id]: value }))} /></View>}
        </View>;
      })}<Button title="Save ready lot" disabled={busy || preview !== null || !Object.keys(lotQuantities).length} onPress={saveLot} />
    </ScrollView></PopupSheet>
    <PopupSheet visible={costOpen} title={lang==="bn"?"খরচ যোগ করুন":"Add cost"} onClose={() => setCostOpen(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.stack, { padding: 16 }]}>{formError}<View style={s.costOwnerRow}><Text style={s.metricLabel}>{lang==="bn"?"খরচটি কোথায় প্রযোজ্য":"Cost belongs to"}</Text>{(draft || trip.status === "COMPLETED") && <Pressable accessibilityRole="button" accessibilityState={{ selected: !costLot }} onPress={() => { setCostLot(""); setCostType("AGENT_FEE"); }} style={s.costOwnerOption}><Text style={[s.costOwnerText, !costLot && { color: colors.primaryDark }]}>{lang==="bn"?"PO-এর সাধারণ খরচ":"Common PO cost"}</Text></Pressable>}{trip.lots.filter(l => l.status !== "RECEIVED" || trip.status === "COMPLETED").map(l => <Pressable key={l.id} accessibilityRole="button" accessibilityState={{ selected: costLot === l.id }} onPress={() => { setCostLot(l.id); setCostType("CHINA_LOCAL"); }} style={s.costOwnerOption}><Text style={[s.costOwnerText, costLot === l.id && { color: colors.primaryDark }]}>{l.lotNo}</Text></Pressable>)}</View>
      <View accessibilityRole="radiogroup" accessibilityLabel={lang==="bn"?"খরচের ধরন":"Cost type"} style={s.costTypeGrid}>{(costLot ? lotCostTypes : commonCosts).map(type => {const typeLabel=lang==="bn"?(banglaCostTypes[type]??type.replaceAll("_"," ")):type.replaceAll("_", " ");return <Pressable key={type} accessibilityRole="radio" accessibilityLabel={typeLabel} accessibilityState={{ checked: costType === type, disabled: busy }} disabled={busy} onPress={() => setCostType(type)} style={[s.costTypeCard, costType === type && s.costTypeSelected, busy && s.disabled]}><Ionicons name={costIcons[type] ?? "receipt-outline"} size={22} color={costType === type ? colors.primaryDark : colors.neutralIcon}/><Text style={[s.costTypeLabel, costType === type && { color: colors.primaryDark }]}>{typeLabel}</Text><Ionicons name={costType === type ? "radio-button-on" : "radio-button-off"} size={20} color={costType === type ? colors.primaryDark : colors.muted}/></Pressable>})}</View><Field label={lang==="bn"?"পরিমাণ (টাকা)":"Amount (BDT)"} value={costAmount} onChange={setCostAmount} numeric /><Field label={lang==="bn"?"নোট (ঐচ্ছিক)":"Note (optional)"} value={costNote} onChange={setCostNote} /><Button title={lang==="bn"?"খরচ সেভ করুন":"Save cost"} disabled={busy || costAmount.trim() === ""} onPress={() => void run(() => post("/costs", { costType, shipmentId: costLot || null, amount: number(costAmount), note: costNote || null }), () => { setCostOpen(false); setTab("costs"); })} />
    </ScrollView></PopupSheet>
    <Sheet open={receiveOpen} title={lang==="bn"?`${receiveLot?.lotNo ?? "পুরোনো PO"} গ্রহণ করুন`:`Receive ${receiveLot?.lotNo ?? "historical PO"}`} close={() => setReceiveOpen(false)}>{formError}{receiveLot && <><Text style={s.muted}>{lang==="bn"?"এই লটের প্রতিটি পণ্যের হিসাব দিন। কোনো পণ্য ক্ষতিগ্রস্ত বা মিসিং হলে তার পরিমাণ লিখুন।":"Account for every piece in this lot. Enter the damaged or missing quantity for each product."}</Text><View style={s.receiveWeightRow}><Pressable accessibilityRole="checkbox" accessibilityState={{checked:weightOkay}} onPress={()=>setWeightOkay(value=>!value)} style={s.receiveWeightCheck}><Ionicons name={weightOkay?"checkbox":"square-outline"} size={21} color={weightOkay?colors.successText:colors.muted}/><Text style={s.label}>{lang==="bn"?(weightOkay?"ওজন ঠিক আছে":"ওজন ঠিক নেই"):(weightOkay?"The weight is correct":"The weight is not correct")}</Text></Pressable>{!weightOkay&&<View style={s.receivedWeightField}><Text style={s.label}>{lang==="bn"?"প্রাপ্ত ওজন":"Received Weight"}</Text><View style={s.receiveWeightInput}><TextInput accessibilityLabel={lang==="bn"?"প্রাপ্ত ওজন (কেজি)":"Received Weight (Kg)"} value={billedWeight} onChangeText={value=>setBilledWeight(decimalOnly(value))} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" style={[s.input,s.receiveWeightTextInput]}/><Text style={s.receiveWeightUnit}>Kg</Text></View></View>}</View></>}
      {Object.entries(entries).map(([itemId, e]) => { const item = trip.items.find(i => i.id === itemId)!; const expected = receiveLot?.items.find(i => i.purchaseItemId === itemId)?.qty;
        const updateQuantity = (key:keyof ReceiptEntry,value:string) => setEntries(current => {
            const previous = current[itemId];
            const next = { ...previous, [key]: decimalOnly(value) };
            if (expected !== undefined && (key === 'damaged' || key === 'missing')) {
              try {
                next.usable = String(lotUsableQuantity(expected, next.damaged, next.missing));
                const previousSavedWeight = Math.round((Number(previous.usable) + Number(previous.damaged)) * item.unitWeightGrams * 1000) / 1000;
                if (item.unitWeightGrams > 0 && previous.weight !== '' && Number(previous.weight) === previousSavedWeight)
                  next.weight = String(Math.round((Number(next.usable) + Number(next.damaged)) * item.unitWeightGrams * 1000) / 1000);
              } catch { next.usable = ''; }
            }
            return { ...current, [itemId]: next };
          });
        return <View style={s.card} key={itemId}><Text style={s.subtitle}>{item.productName}{expected !== undefined ? (lang==="bn"?` · লটে পরিমাণ ${expected}`:` · Lot qty ${expected}`) : ""}</Text>{expected !== undefined ? <View style={s.receiveQuantityRow}>{([['usable',lang==="bn"?'ভালো পণ্য':'Good Condition',true],['damaged',lang==="bn"?'ক্ষতিগ্রস্ত':'Damaged',false],['missing',lang==="bn"?'মিসিং':'Missing',false]] as [keyof ReceiptEntry,string,boolean][]).map(([key,label,readonly])=><View key={key} style={s.receiveQuantityCell}><Text numberOfLines={1} style={s.receiveQuantityLabel}>{label}</Text><TextInput accessibilityLabel={label} editable={!readonly} value={e[key]} onChangeText={value=>updateQuantity(key,value)} keyboardType="decimal-pad" inputMode="decimal" style={[s.receiveQuantityInput,readonly&&s.receiveQuantityReadonly]}/></View>)}</View> : ([['usable',lang==="bn"?'ভালো পণ্য':'Usable'],['damaged',lang==="bn"?'ক্ষতিগ্রস্ত':'Damaged'],['missing',lang==="bn"?'মিসিং':'Missing']] as [keyof ReceiptEntry,string][]).map(([key,label])=><Field key={key} label={label} value={e[key]} numeric onChange={value=>updateQuantity(key,value)}/>)}
          </View>; })}
      <View style={s.field}><Text style={s.label}>{lang==="bn"?"পণ্য গ্রহণের নোট (ঐচ্ছিক)":"Receiving note (optional)"}</Text><TextInput accessibilityLabel={lang==="bn"?"পণ্য গ্রহণের নোট (ঐচ্ছিক)":"Receiving note (optional)"} multiline textAlignVertical="top" numberOfLines={4} value={receiveNote} onChangeText={setReceiveNote} style={[s.input,s.receiveNote]}/></View><Text style={s.muted}>{lang==="bn"?(owner?"সেভ করলে পণ্য গ্রহণ অনুমোদিত হবে এবং স্টক সঙ্গে সঙ্গে আপডেট হবে। লট অনুমোদনের জন্য কুরিয়ার খরচের একটি হিসাব থাকা আবশ্যক।":"পণ্য গ্রহণের এই তথ্য ম্যানেজারের অনুমোদনের অপেক্ষায় থাকবে। লট অনুমোদনের জন্য কুরিয়ার খরচের একটি হিসাব থাকা আবশ্যক।"):`${owner ? "Saving approves this receipt and updates stock immediately." : "This receipt will wait for manager approval."} A courier cost row is required for lot approval.`}</Text><Button title={lang==="bn"?(owner?"অনুমোদন করে গ্রহণ করুন":"গ্রহণের তথ্য জমা দিন"):(owner?"Approve and receive":"Submit receipt")} disabled={busy || !receiveEntriesValid} onPress={saveReceive} />
    </Sheet>
    <Sheet open={rejecting !== null} title="Reject receipt" close={() => setRejecting(null)}>{formError}<Field label="Reason" value={reason} onChange={setReason} /><Button title="Reject receipt" disabled={busy} onPress={() => void run(() => post(`/sessions/${rejecting!.id}/reject`, { reason }), () => setRejecting(null))} /></Sheet>
    <Sheet open={closeOpen} title="Close PO" close={() => setCloseOpen(false)}>{formError}<Text style={s.body}>Resolve all pending receipts first. A reason is required if any quantity remains unaccounted for.</Text><Field label="Close reason" value={closeReason} onChange={setCloseReason} /><Button title="Close PO" disabled={busy} onPress={() => void run(() => post("/close", { forceCloseReason: closeReason || null }), () => setCloseOpen(false))} /></Sheet>

    <Sheet open={confirm!==null} title="Confirmation" close={()=>setConfirm(null)}>{formError}{!!confirm?.heading&&<Text style={s.subtitle}>{confirm.heading}</Text>}<Text style={s.body}>{confirm?.title}</Text><Button title={confirm?.confirmLabel??(lang==="bn"?"নিশ্চিত করুন":"Confirm")} disabled={busy} onPress={() => void run(confirm!.action, () => setConfirm(null))} /></Sheet>
  </View>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  lotFields: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 }, lotHalf: { width: "48.5%", minWidth: 0, gap: 6 }, weightInputBox: { minHeight: 46, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white, overflow: "hidden" }, weightInput: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: 8, color: colors.heading }, weightUnits: { flexDirection: "row", paddingRight: 4, gap: 2 }, weightUnit: { minWidth: 32, paddingHorizontal: 4, minHeight: 36, borderRadius: 6, alignItems: "center", justifyContent: "center" }, lotProduct: { borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.white, overflow: "hidden" }, lotProductSelected: { borderColor: colors.primary }, lotProductChoice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, minHeight: 64 }, lotQuantity: { paddingHorizontal: 12, paddingBottom: 12, width: "50%" },
  productPaymentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }, productPaymentBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, fontSize: 12, fontWeight: "600" },
  costOwnerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, costOwnerOption: { minHeight: 36, justifyContent: "center", paddingHorizontal: 3 }, costOwnerText: { fontSize: 13, fontWeight: "700", color: colors.secondary },
  costTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, costTypeCard: { flexGrow: 1, flexBasis: "45%", minWidth: 0, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.white }, costTypeSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, costTypeLabel: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.heading },
  lotCostAction: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 9 },
  lotInstruction:{flexDirection:"row",alignItems:"flex-start",gap:10,padding:13,borderWidth:1,borderColor:colors.activeBorder,borderRadius:11,backgroundColor:colors.primaryLight},lotInstructionTitle:{fontSize:13,fontWeight:"700",lineHeight:20,color:colors.heading},lotInstructionText:{fontSize:12,lineHeight:19,color:colors.secondary,marginTop:2},
  statusPill: { color: colors.primaryDark, backgroundColor: colors.primaryLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, fontSize: 10, fontWeight: "700" },
  tabsRow:{flexDirection:"row",alignItems:"center",gap:4}, segment: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40, paddingHorizontal: 11, borderRadius: 9, backgroundColor: colors.disabled }, segmentActive: { backgroundColor: colors.primaryLight }, segmentText: { color: colors.secondary, fontSize: 13, fontWeight: "600" },
  overview: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, overflow: "hidden" },
  stepper: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 20 }, step: { flex: 1, gap: 8 }, stepTrack: { flexDirection: "row", alignItems: "center" }, stepLine: { flex: 1, height: 2, backgroundColor: colors.divider }, stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.disabled, borderWidth: 1, borderColor: colors.divider }, stepCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary }, stepNumber: { fontSize: 12, fontWeight: "700", color: colors.secondary }, stepLabel: { fontSize: 11, lineHeight: 16, color: colors.secondary, textAlign: "center", paddingHorizontal: 3 },
  metricLabel: { color: colors.secondary, fontSize: 12 },
  inline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 5 }, addProduct: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 42, paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.primary }, addProductLabel: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 2, paddingVertical: 5 }, addProductLabelText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  productCard: { padding: 16, gap: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white }, thumbnail: { width: 42, height: 42, borderRadius: 9, backgroundColor: colors.disabled, alignItems: "center", justifyContent: "center" },
  quantityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, quantityCell: { alignItems: "center", justifyContent: "center", flex: 1, flexBasis: "20%", minWidth: 0, backgroundColor: colors.disabled, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, gap: 3 }, quantityValue: { textAlign: "center", fontSize: 21, color: colors.heading, fontWeight: "700" }, productFooter: { borderTopWidth: 1, borderColor: colors.divider, paddingTop: 6, gap: 4 }, productBottom: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, bottomInline: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }, bottomValue: { fontSize: 13, fontWeight: "700", color: colors.heading },
  emptyProducts: { padding: 30, alignItems: "center", gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, borderRadius: 14 }, footerAction: { alignItems: "flex-end", borderTopWidth: 1, borderColor: colors.divider, paddingTop: 16 }, continueAction: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 14, minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },

  root: { flex: 1, backgroundColor: colors.background }, header: { padding: 14, gap: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.divider },
  actionsToggle: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }, actionsIcon: { fontSize: 28, color: colors.heading }, actionsMenu: { alignSelf: "flex-end", borderWidth: 1, borderColor: colors.divider, borderRadius: 10, backgroundColor: colors.white }, cancelAction: { backgroundColor: colors.white, minWidth: 150 },
  page: { padding: 16, gap: 14, paddingBottom: 40 }, stack: { gap: 14, paddingBottom: 24 }, row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  title: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.heading }, subtitle: { fontSize: 15, fontWeight: "700", color: colors.heading }, body: { fontSize: 14, color: colors.heading, lineHeight: 21 }, muted: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
  card: { padding: 15, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, gap: 10 }, selected: { borderColor: colors.primary, backgroundColor: colors.cardSecondary },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, secondaryButton: { backgroundColor: colors.primaryLight }, buttonText: { color: colors.white, fontWeight: "700", fontSize: 13 }, secondaryText: { color: colors.primaryDark }, disabled: { opacity: 0.45 },
  labelActions: { alignItems: "flex-end", gap: 0 }, labelButton: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center", paddingVertical: 4 }, labelButtonText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  productIdentity: { gap: 2 },
  productHeading: { flexDirection: "row", alignItems: "center", gap: 8 }, productName: { flex: 1, minWidth: 0, gap: 3 }, productActions: { flexDirection: "row", flexShrink: 0 }, productIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  selectedProduct: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 12 }, selectedProductImage: { width: 64, height: 64, borderRadius: 8 }, selectedProductFallback: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  productFields: { flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-end", gap: 6 }, productTotalField: { flex: 1.2, minWidth: 0, flexDirection: "row", alignItems: "flex-end", gap: 4 }, totalEquals: { height: 46, lineHeight: 46, fontSize: 20, color: colors.secondary }, readonlyTotal: { backgroundColor: colors.disabled, color: colors.heading, marginTop: 6 }, productField: { flex: 1, minWidth: 0 },
  field: { gap: 6 }, label: { fontSize: 13, color: colors.secondary }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, color: colors.heading, backgroundColor: colors.white },
  receiveWeightRow:{flexDirection:"row",alignItems:"center",gap:10},receiveWeightCheck:{flexDirection:"row",alignItems:"center",gap:6,minHeight:44},receivedWeightField:{flex:1,minWidth:0,flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:8},receiveWeightInput:{flex:1,minWidth:100,maxWidth:180,position:"relative"},receiveWeightTextInput:{textAlign:"center",paddingRight:34},receiveWeightUnit:{position:"absolute",right:10,top:14,color:colors.secondary,fontSize:12},receiveQuantityRow:{flexDirection:"row",alignItems:"flex-end",gap:6},receiveQuantityCell:{flex:1,minWidth:0,gap:5},receiveQuantityLabel:{fontSize:11,color:colors.secondary},receiveQuantityInput:{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:8,paddingHorizontal:8,color:colors.heading,backgroundColor:colors.white,textAlign:"center"},receiveQuantityReadonly:{backgroundColor:colors.disabled,fontWeight:"700"},receiveNote:{minHeight:96,paddingTop:10},
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 18 }, stat: { minWidth: 60, gap: 4 }, badge: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  error: { color: colors.dangerText, fontSize: 13, lineHeight: 20 }, warning: { color: colors.warningText, backgroundColor: colors.warningBackground, padding: 12, borderRadius: 9, lineHeight: 20 }, overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: 16 }, sheet: { width: "100%", maxWidth: 660, maxHeight: "92%", backgroundColor: colors.background, borderRadius: 18, padding: 18, gap: 16 },
});
