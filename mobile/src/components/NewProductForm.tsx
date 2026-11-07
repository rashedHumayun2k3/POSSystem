import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

type Category = { id: string; name: string; defaultUnit?: string | null };
type ExistingProduct = { id: string; name: string; sku: string; categoryName: string };
export type CreatedProduct = {
  id: string; categoryId: string; name: string; sku: string; imageUrl: string | null;
  unitCode: string; sellingPrice: number; marketPrice: number | null;
  variants: Array<{ id: string; sku: string; barcode: string; imageUrl: string | null; variantValuesJson: string; stock: number; avgLandedCost: number; priceOverride: number | null }>;
};

export type EditableProduct = {
  id: string; categoryId: string; name: string; sku: string; sellingPrice: number;
  marketPrice: number | null; lowStockThreshold: number; description: string | null;
  unitCode: string; note: string | null; defectNotes: string | null; packagingCostPerUnit?: number;
  warrantyDurationValue: number | null; warrantyDurationUnit: string | null;
  wholesaleMinQty: number | null; wholesaleUnitPrice: number | null; wholesaleNote: string | null;
};
type Props = {
  quickCreate?: boolean;
  initialProduct?: EditableProduct;
  onUpdate?: (payload: object) => Promise<void>;
  onSavingChange?: (busy: boolean) => void;
  onCreated?: (product: CreatedProduct) => void;
  onOpenExisting?: (product: ExistingProduct) => void;
  contentStyle?: object;
};

export default function NewProductForm({ quickCreate = false, onCreated, onOpenExisting, contentStyle, initialProduct, onUpdate, onSavingChange }: Props) {
  const auth = useAuth();
  const { lang } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [productSuggestions, setProductSuggestions] = useState<ExistingProduct[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sellingPrice, setSellingPrice] = useState(initialProduct ? String(initialProduct.sellingPrice) : "");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [details, setDetails] = useState({
    marketPrice: initialProduct?.marketPrice?.toString() ?? "",
    lowStockThreshold: String(initialProduct?.lowStockThreshold ?? 5),
    description: initialProduct?.description ?? "", unitCode: initialProduct?.unitCode ?? "",
    note: initialProduct?.note ?? "", defectNotes: initialProduct?.defectNotes ?? "",
    packagingCostPerUnit: String(initialProduct?.packagingCostPerUnit ?? 0),
    warrantyDurationValue: initialProduct?.warrantyDurationValue?.toString() ?? "",
    warrantyDurationUnit: initialProduct?.warrantyDurationUnit ?? "MONTHS",
    wholesaleMinQty: initialProduct?.wholesaleMinQty?.toString() ?? "",
    wholesaleUnitPrice: initialProduct?.wholesaleUnitPrice?.toString() ?? "",
    wholesaleNote: initialProduct?.wholesaleNote ?? "",
  });
  const [generating, setGenerating] = useState(false);
  const busy = useRef(false);
  const skuRun = useRef(0);
  useEffect(() => { ++skuRun.current; setGenerating(false); }, [name, categoryId, auth.session?.businessId]);
  useEffect(() => () => { ++skuRun.current; }, []);
  const generateSku = async () => {
    if (!categoryId || !name.trim() || generating || saving) return;
    const run = ++skuRun.current;
    setGenerating(true); setError("");
    try {
      const result = await auth.api<{sku:string}>(`/products/generate-sku?${new URLSearchParams({categoryId,name:name.trim()})}`);
      if (run === skuRun.current) setSku(result.sku);
    } catch(e) { if (run === skuRun.current) setError((e as Error).message); }
    finally { if (run === skuRun.current) setGenerating(false); }
  };

  useEffect(() => {
    let active = true;
    auth.api<Category[]>("/categories").then(items => { if (active) setCategories(items); })
      .catch(e => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) { setLoading(false); setLoaded(true); } });
    return () => { active = false; };
  }, [auth.session?.businessId]);

  useEffect(() => {
    const query = name.trim();
    if (!categoryId || query.length < 2) { setProductSuggestions([]); setSuggestionsLoading(false); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const params = new URLSearchParams({ status: "ACTIVE", q: query });
        const rows = await auth.api<ExistingProduct[]>(`/products?${params.toString()}`);
        if (active) setProductSuggestions(Array.isArray(rows) ? rows.filter(item => item.id !== initialProduct?.id && item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []);
      } catch { if (active) setProductSuggestions([]); }
      finally { if (active) setSuggestionsLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [auth.session?.businessId, categoryId, name]);

  const selectedCategory = categories.find(item => item.id === categoryId);
  const visibleCategories = categories.filter(item => item.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()));
  const duplicateProduct = productSuggestions.find(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());

  const save = async () => {
    if (busy.current || generating) return;
    const hasQuantity = quantity.trim().length > 0;
    const hasCost = costPrice.trim().length > 0;
    const qty = hasQuantity ? Number(quantity) : 0;
    const cost = hasCost ? Number(costPrice) : 0;
    const price = sellingPrice.trim() ? Number(sellingPrice) : 0;
    if (!categoryId) return setError("Choose a category.");
    if (!name.trim()) return setError("Enter a product name.");
    if (sku.trim().length > 50) return setError("SKU code cannot exceed 50 characters.");
    if (duplicateProduct) return setError(`“${duplicateProduct.name}” already exists in this company. Open the existing product instead.`);
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid selling price.");
    if (hasQuantity && (!Number.isFinite(qty) || qty <= 0)) return setError("Enter an opening quantity greater than zero.");
    if (hasCost && (!Number.isFinite(cost) || cost < 0)) return setError("Enter a valid unit cost.");
    if (hasCost && !hasQuantity) return setError("Enter an opening quantity to record a unit cost.");
    for (const key of ["marketPrice","lowStockThreshold","packagingCostPerUnit","warrantyDurationValue","wholesaleMinQty","wholesaleUnitPrice"] as const) {
      if (details[key].trim() && (!Number.isFinite(Number(details[key])) || Number(details[key]) < 0)) return setError("Enter valid non-negative numeric values.");
    }
    if (!Number.isInteger(Number(details.lowStockThreshold)) || (details.warrantyDurationValue && !Number.isInteger(Number(details.warrantyDurationValue)))) return setError("Stock threshold and warranty duration must be whole numbers.");
    const shared = {
      categoryId, name:name.trim(), sku:sku.trim(), sellingPrice:price,
      marketPrice:details.marketPrice.trim() ? Number(details.marketPrice) : null,
      lowStockThreshold:Number(details.lowStockThreshold), description:details.description.trim() || null,
      unitCode:details.unitCode.trim() || selectedCategory?.defaultUnit || "pcs",
      note:details.note.trim() || null, defectNotes:details.defectNotes.trim() || null,
      packagingCostPerUnit:Number(details.packagingCostPerUnit),
      warrantyDurationValue:details.warrantyDurationValue.trim() ? Number(details.warrantyDurationValue) : null,
      warrantyDurationUnit:details.warrantyDurationValue.trim() ? details.warrantyDurationUnit : null,
      wholesaleMinQty:details.wholesaleMinQty.trim() ? Number(details.wholesaleMinQty) : null,
      wholesaleUnitPrice:details.wholesaleUnitPrice.trim() ? Number(details.wholesaleUnitPrice) : null,
      wholesaleNote:details.wholesaleNote.trim() || null,
    };
    busy.current=true; setSaving(true); onSavingChange?.(true); setError("");
    try {
      if (initialProduct && onUpdate) { await onUpdate(shared); return; }
      const product = await auth.api<CreatedProduct>("/products", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: null, attributesJson: "{}",
          variantCombinations: hasQuantity ? [{ values: {}, qty, costPrice: cost }] : null,
          branchId: hasQuantity ? auth.session?.branchId : undefined,
          ...shared,
        }),
      });
      onCreated?.(product);
    } catch (e) { setError((e as Error).message); }
    finally { busy.current=false; setSaving(false); onSavingChange?.(false); }
  };

  return <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, contentStyle]}>
    {quickCreate && <Text style={s.hint}>{lang === "bn" ? "ক্যাটাগরি ও নাম দিয়ে পণ্য তৈরি করুন। দাম, স্টক ও ছবি পরের পাতায় যোগ করতে পারবেন।" : "Choose a category and enter a name. Add price, stock and photos on the next page."}</Text>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {initialProduct && <Text style={s.sectionTitle}>{lang === "bn" ? "পণ্যের পরিচিতি" : "Product information"}</Text>}
    <View style={s.field}>
      <Text style={s.label}>{lang === "bn" ? "ক্যাটাগরি *" : "CATEGORY *"}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : !categories.length ? <Text style={s.hint}>{loaded ? "Add a category before creating a product." : "Loading categories…"}</Text> : <>
        <View style={s.categoryInputWrap}><TextInput value={categoryOpen ? categoryQuery : selectedCategory?.name ?? ""} onFocus={() => { setCategoryQuery(""); setCategoryOpen(true); }} onChangeText={value => { setCategoryQuery(value); setCategoryId(""); setCategoryOpen(true); }} placeholder={lang === "bn" ? "ক্যাটাগরি লিখে খুঁজুন ও নির্বাচন করুন" : "Type to search and select a category"} placeholderTextColor={colors.muted} style={[s.input, s.categorySearchInput]} accessibilityLabel="Search product categories"/><Ionicons name={categoryOpen ? "chevron-up" : "chevron-down"} size={19} color={colors.muted}/></View>
        {categoryOpen && <ScrollView style={s.categoryDropdown} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{visibleCategories.length ? visibleCategories.map(category => <Pressable key={category.id} onPress={() => { setCategoryId(category.id); setCategoryQuery(""); setCategoryOpen(false); Keyboard.dismiss(); }} style={s.categoryOption}><Text style={s.categoryOptionText}>{category.name}</Text><Text style={s.categoryUnit}>{category.defaultUnit || "pcs"}</Text></Pressable>) : <Text style={s.noCategories}>No matching categories.</Text>}</ScrollView>}
      </>}
    </View>
    {categoryId ? <>
      <View style={s.field}>
        <Text style={s.label}>{lang === "bn" ? "পণ্যের নাম *" : "PRODUCT NAME *"}</Text>
        <TextInput value={name} onFocus={() => setSuggestionsOpen(name.trim().length >= 2)} onChangeText={value => { setName(value); setSuggestionsOpen(value.trim().length >= 2); setError(""); }} placeholder={lang === "bn" ? "পণ্যের নাম লিখুন" : "Product name"} placeholderTextColor={colors.muted} style={s.input} accessibilityLabel="Product name" autoCorrect={false} />
        {suggestionsOpen && name.trim().length >= 2 && (suggestionsLoading || productSuggestions.length > 0) && <View style={s.suggestions}>{suggestionsLoading ? <ActivityIndicator color={colors.primary} style={s.suggestionLoader} /> : productSuggestions.map(item => <Pressable key={item.id} onPress={() => { setName(item.name); setSuggestionsOpen(false); Keyboard.dismiss(); }} style={s.suggestionRow}><View style={s.suggestionCopy}><Text numberOfLines={1} style={s.suggestionName}>{item.name}</Text><Text style={s.suggestionMeta}>{item.categoryName} · SKU {item.sku}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View>}
        {duplicateProduct && <View style={s.duplicateNotice}><Text style={s.duplicateText}>{lang === "bn" ? "এই কোম্পানিতে একই নামে একটি পণ্য আগে থেকেই আছে।" : "A product with this exact name already exists in this company."}</Text>{onOpenExisting && <Pressable onPress={() => onOpenExisting(duplicateProduct)} style={s.openExisting}><Text style={s.openExistingText}>Open existing product</Text><Ionicons name="arrow-forward" size={15} color={colors.primaryDark} /></Pressable>}</View>}
      </View>
      {!quickCreate && <>
      <Field action={<Pressable accessibilityRole="button" disabled={saving || generating || !name.trim() || !categoryId} onPress={()=>void generateSku()} style={[s.openExisting, {marginLeft:"auto"}, (saving || generating || !name.trim()) && s.disabled]}>{generating ? <ActivityIndicator size="small" color={colors.primary}/> : <Text style={s.openExistingText}>{lang === "bn" ? "SKU কোড তৈরি করুন" : "Generate SKU Code"}</Text>}</Pressable>} label={lang === "bn" ? "SKU কোড (ঐচ্ছিক)" : "SKU CODE (OPTIONAL)"} note={lang === "bn" ? "খালি রাখলে ক্যাটাগরির ২টি অক্ষর, পণ্যের নামের ৩টি অক্ষর ও সিরিয়াল দিয়ে তৈরি হবে (যেমন SH-NIK-1)। একই ব্যবসায় একই SKU ব্যবহার করা যাবে না।" : "Leave blank for 2 category characters + 3 product-name characters + serial (e.g. SH-NIK-1). SKU must be unique within your business."} value={sku} onChangeText={value => { ++skuRun.current; setGenerating(false); setSku(value); setError(""); }} placeholder={lang === "bn" ? "খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে" : "Leave blank to generate automatically"} autoCapitalize="characters" />
      {initialProduct && <Text style={s.sectionTitle}>{lang === "bn" ? "মূল্য ও স্টক" : "Pricing & inventory"}</Text>}
      <Field label={lang === "bn" ? "বিক্রয়মূল্য (ঐচ্ছিক)" : "SELLING PRICE (OPTIONAL)"} note={lang === "bn" ? "খালি রাখলে ০ হিসেবে সেভ হবে। পরে মূল্য নির্ধারণ করতে পারবেন।" : "Leave blank to save the price as zero. You can set it later."} value={sellingPrice} onChangeText={setSellingPrice} placeholder={lang === "bn" ? "০.০০" : "0.00"} keyboardType="decimal-pad" />
      {!initialProduct && <>
      <Field label={lang === "bn" ? "শুরুর স্টক পরিমাণ (ঐচ্ছিক)" : "OPENING QUANTITY (OPTIONAL)"} value={quantity} onChangeText={setQuantity} placeholder={lang === "bn" ? "০" : "0"} keyboardType="decimal-pad" />
      <Field label={lang === "bn" ? "প্রতি ইউনিট ক্রয়মূল্য (ঐচ্ছিক)" : "UNIT COST (OPTIONAL)"} note={lang === "bn" ? "শুরুর স্টক না থাকলে খালি রাখুন।" : "Leave blank when there is no opening stock. Blank cost with opening stock is saved as zero."} value={costPrice} onChangeText={setCostPrice} placeholder={lang === "bn" ? "০.০০" : "0.00"} keyboardType="decimal-pad" />
      <Text style={s.hint}>{lang === "bn" ? "শুরুর স্টক দিলে একটি ডিফল্ট ভ্যারিয়েন্ট তৈরি হবে। খালি রাখলে পণ্যটি শূন্য স্টক দিয়ে তৈরি হবে।" : "Add opening stock now, or leave it blank to create the product with zero stock."}</Text>
      </>}
      {initialProduct && <Text style={s.hint}>{lang === "bn" ? "স্টক ও ক্রয়মূল্য পরিবর্তন করতে Stock এবং Product Cost ট্যাব ব্যবহার করুন।" : "Use the Stock and Product Cost tabs to adjust quantity and purchase cost."}</Text>}
      {([
        { title: "", bn: "", fields: [
          ["marketPrice", "Market price", "বাজারমূল্য", true],
          ["lowStockThreshold", "Low stock threshold", "কম স্টকের সীমা", true],
          ["unitCode", "Unit", "ইউনিট", false],
          ["packagingCostPerUnit", "Packaging cost per unit", "প্রতি ইউনিট প্যাকেজিং খরচ", true],
        ] },
        { title: "Description & notes", bn: "বিবরণ ও নোট", fields: [
          ["description", "Description", "বিবরণ", false],
          ["defectNotes", "Defect notes", "ত্রুটির বিবরণ", false],
          ["note", "Note", "নোট", false],
        ] },
        { title: "Wholesale (optional)", bn: "পাইকারি (ঐচ্ছিক)", fields: [
          ["wholesaleMinQty", "Minimum quantity", "সর্বনিম্ন পরিমাণ", true],
          ["wholesaleUnitPrice", "Unit price", "ইউনিট মূল্য", true],
          ["wholesaleNote", "Wholesale note", "পাইকারি নোট", false],
        ] },
      ] as const).map(group => <View key={group.title} style={s.fieldGroup}>
        {!!group.title && <Text style={s.sectionTitle}>{lang === "bn" ? group.bn : group.title}</Text>}
        <View style={s.fieldGrid}>{group.fields.map(([key,en,bn,numeric]) => <View key={key} style={numeric || key === "unitCode" ? s.halfField : s.fullField}><Field label={lang === "bn" ? bn : en} value={details[key]} onChangeText={value => setDetails(current => ({...current,[key]:value}))} placeholder={key === "unitCode" ? selectedCategory?.defaultUnit || "pcs" : numeric ? "0" : ""} keyboardType={numeric ? "decimal-pad" : undefined} multiline={["description","note","defectNotes","wholesaleNote"].includes(key)}/></View>)}</View>
      </View>)}
      <View style={s.fieldGroup}>
        <Text style={s.sectionTitle}>{lang === "bn" ? "ওয়ারেন্টি" : "Warranty"}</Text>
        <Text style={s.label}>{lang === "bn" ? "ওয়ারেন্টির মেয়াদ (ঐচ্ছিক)" : "Warranty duration (optional)"}</Text>
        <View style={s.warrantyRow}>
          <TextInput accessibilityLabel={lang === "bn" ? "ওয়ারেন্টির মেয়াদ" : "Warranty duration"} value={details.warrantyDurationValue} onChangeText={value => setDetails(current => ({...current,warrantyDurationValue:value}))} placeholder="0" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[s.input,s.warrantyAmount]} />
          <View style={s.warrantyUnits}>{([ ["DAYS","Days","দিন"], ["MONTHS","Months","মাস"], ["YEARS","Years","বছর"] ] as const).map(([unit,en,bn]) => <Pressable key={unit} accessibilityRole="radio" accessibilityState={{checked:details.warrantyDurationUnit === unit}} onPress={() => setDetails(current => ({...current,warrantyDurationUnit:unit}))} style={[s.warrantyUnit,details.warrantyDurationUnit === unit && s.warrantyUnitSelected]}><Text style={[s.unitText,details.warrantyDurationUnit === unit && s.unitTextSelected]}>{lang === "bn" ? bn : en}</Text></Pressable>)}</View>
        </View>
        <Text style={s.fieldNote}>{lang === "bn" ? "ওয়ারেন্টি না থাকলে মেয়াদ খালি রাখুন।" : "Leave the duration blank if there is no warranty."}</Text>
      </View>
      </>}
      <Pressable accessibilityRole="button" disabled={!name.trim() || saving || generating || loading || suggestionsLoading || !!duplicateProduct} onPress={() => void save()} style={[s.submit, (!name.trim() || saving || generating || loading || suggestionsLoading || !!duplicateProduct) && s.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.submitText}>{initialProduct ? (lang === "bn" ? "পরিবর্তন সেভ করুন" : "Save changes") : quickCreate ? (lang === "bn" ? "পণ্য তৈরি করুন" : "Create product") : "Save Product"}</Text>}</Pressable>
    </> : null}
  </KeyboardAwareScrollView>;
}

function Field(props: { label: string; action?: React.ReactNode; multiline?: boolean; note?: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "decimal-pad"; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return <View style={s.field}><View style={s.fieldLabelRow}><Text style={s.label}>{props.label}</Text>{props.action}</View>{props.note && <Text style={s.fieldNote}>({<Text>{props.note}</Text>})</Text>}<TextInput multiline={props.multiline} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor={colors.muted} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} accessibilityLabel={props.label} style={[s.input, props.multiline && s.multilineInput]} /></View>;
}

const s = StyleSheet.create({
  sectionTitle: { color: colors.heading, fontSize: 15, fontWeight: "700", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  fieldGroup: { gap: 12 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  halfField: { flexGrow: 1, flexBasis: "45%", minWidth: 130 },
  fullField: { width: "100%" },
  multilineInput: { minHeight: 86, paddingTop: 12, paddingBottom: 12, textAlignVertical: "top" },
  warrantyRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  warrantyAmount: { flexGrow: 1, flexBasis: 80, minWidth: 70 },
  warrantyUnits: { flexGrow: 2, flexBasis: 210, flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: colors.disabled, borderWidth: 1, borderColor: colors.divider },
  warrantyUnit: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, paddingHorizontal: 6, borderWidth: 1, borderColor: "transparent" },
  warrantyUnitSelected: { backgroundColor: colors.white, borderColor: colors.primary },
  unitText: { color: colors.secondary, fontSize: 13, fontWeight: "600" },
  unitTextSelected: { color: colors.primaryDark },
  content: { padding: 16, gap: 16 }, field: { gap: 7 }, fieldLabelRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, rowGap: 3 }, fieldNote: { flexShrink: 1, color: colors.muted, fontSize: 12, lineHeight: 18 }, label: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }, categoryInputWrap: { position: "relative", flexDirection: "row", alignItems: "center" }, categorySearchInput: { flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 13, color: colors.heading, backgroundColor: colors.white, fontSize: 15 }, categoryDropdown: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, categoryOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.divider }, categoryOptionText: { color: colors.heading, fontSize: 14, fontWeight: "600" }, categoryUnit: { color: colors.muted, fontSize: 12 }, noCategories: { padding: 14, color: colors.muted, fontSize: 13 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.dangerText, fontSize: 13 }, suggestions: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, suggestionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, suggestionCopy: { flex: 1, minWidth: 0 }, suggestionName: { color: colors.heading, fontSize: 13, fontWeight: "600" }, suggestionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, suggestionLoader: { padding: 14 }, duplicateNotice: { gap: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningBackground, padding: 11 }, duplicateText: { color: colors.warningText, fontSize: 12, lineHeight: 17 }, openExisting: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 }, openExistingText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" }, submit: { minHeight: 48, marginTop: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, submitText: { color: colors.white, fontSize: 14, fontWeight: "700" }, disabled: { opacity: 0.5 },
});
