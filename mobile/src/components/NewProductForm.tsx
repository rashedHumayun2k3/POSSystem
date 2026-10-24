import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
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

type Props = {
  onCreated: (product: CreatedProduct) => void;
  onOpenExisting?: (product: ExistingProduct) => void;
  contentStyle?: object;
};

export default function NewProductForm({ onCreated, onOpenExisting, contentStyle }: Props) {
  const auth = useAuth();
  const { lang } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<ExistingProduct[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

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
        if (active) setProductSuggestions(Array.isArray(rows) ? rows.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []);
      } catch { if (active) setProductSuggestions([]); }
      finally { if (active) setSuggestionsLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [auth.session?.businessId, categoryId, name]);

  const selectedCategory = categories.find(item => item.id === categoryId);
  const visibleCategories = categories.filter(item => item.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()));
  const duplicateProduct = productSuggestions.find(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());

  const save = async () => {
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
    setSaving(true); setError("");
    try {
      const category = categories.find(item => item.id === categoryId);
      const product = await auth.api<CreatedProduct>("/products", {
        method: "POST",
        body: JSON.stringify({
          categoryId, name: name.trim(), sku: sku.trim(), imageUrl: null, description: null, defectNotes: null,
          unitCode: category?.defaultUnit || "pcs", sellingPrice: price, marketPrice: null,
          packagingCostPerUnit: 0, lowStockThreshold: 5, attributesJson: "{}", note: null,
          variantCombinations: hasQuantity ? [{ values: {}, qty, costPrice: cost }] : null,
          branchId: hasQuantity ? auth.session?.branchId : undefined,
          warrantyDurationValue: null, warrantyDurationUnit: null, wholesaleMinQty: null,
          wholesaleUnitPrice: null, wholesaleNote: null,
        }),
      });
      onCreated(product);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  return <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, contentStyle]}>
    {!!error && <Text style={s.error}>{error}</Text>}
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
      <Field label={lang === "bn" ? "SKU কোড (ঐচ্ছিক)" : "SKU CODE (OPTIONAL)"} value={sku} onChangeText={value => { setSku(value); setError(""); }} placeholder={lang === "bn" ? "খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে" : "Leave blank to generate automatically"} autoCapitalize="characters" />
      <Field label={lang === "bn" ? "বিক্রয়মূল্য (ঐচ্ছিক)" : "SELLING PRICE (OPTIONAL)"} note={lang === "bn" ? "খালি রাখলে ০ হিসেবে সেভ হবে। পরে মূল্য নির্ধারণ করতে পারবেন।" : "Leave blank to save the price as zero. You can set it later."} value={sellingPrice} onChangeText={setSellingPrice} placeholder={lang === "bn" ? "০.০০" : "0.00"} keyboardType="decimal-pad" />
      <Field label={lang === "bn" ? "শুরুর স্টক পরিমাণ (ঐচ্ছিক)" : "OPENING QUANTITY (OPTIONAL)"} value={quantity} onChangeText={setQuantity} placeholder={lang === "bn" ? "০" : "0"} keyboardType="decimal-pad" />
      <Field label={lang === "bn" ? "প্রতি ইউনিট ক্রয়মূল্য (ঐচ্ছিক)" : "UNIT COST (OPTIONAL)"} note={lang === "bn" ? "শুরুর স্টক না থাকলে খালি রাখুন।" : "Leave blank when there is no opening stock. Blank cost with opening stock is saved as zero."} value={costPrice} onChangeText={setCostPrice} placeholder={lang === "bn" ? "০.০০" : "0.00"} keyboardType="decimal-pad" />
      <Text style={s.hint}>{lang === "bn" ? "শুরুর স্টক দিলে একটি ডিফল্ট ভ্যারিয়েন্ট তৈরি হবে। খালি রাখলে পণ্যটি শূন্য স্টক দিয়ে তৈরি হবে।" : "Add opening stock now, or leave it blank to create the product with zero stock."}</Text>
      <Pressable disabled={saving || loading || suggestionsLoading || !!duplicateProduct} onPress={() => void save()} style={[s.submit, (saving || loading || suggestionsLoading || !!duplicateProduct) && s.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.submitText}>Save Product</Text>}</Pressable>
    </> : null}
  </KeyboardAwareScrollView>;
}

function Field(props: { label: string; note?: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "decimal-pad"; autoCapitalize?: "none" | "sentences" | "words" | "characters" }) {
  return <View style={s.field}><View style={s.fieldLabelRow}><Text style={s.label}>{props.label}</Text>{props.note && <Text style={s.fieldNote}>({<Text>{props.note}</Text>})</Text>}</View><TextInput value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor={colors.muted} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize} style={s.input} /></View>;
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 16 }, field: { gap: 7 }, fieldLabelRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, rowGap: 3 }, fieldNote: { flexShrink: 1, color: colors.muted, fontSize: 12, lineHeight: 18 }, label: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }, categoryInputWrap: { position: "relative", flexDirection: "row", alignItems: "center" }, categorySearchInput: { flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 13, color: colors.heading, backgroundColor: colors.white, fontSize: 15 }, categoryDropdown: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, categoryOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.divider }, categoryOptionText: { color: colors.heading, fontSize: 14, fontWeight: "600" }, categoryUnit: { color: colors.muted, fontSize: 12 }, noCategories: { padding: 14, color: colors.muted, fontSize: 13 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.dangerText, fontSize: 13 }, suggestions: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, suggestionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, suggestionCopy: { flex: 1, minWidth: 0 }, suggestionName: { color: colors.heading, fontSize: 13, fontWeight: "600" }, suggestionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, suggestionLoader: { padding: 14 }, duplicateNotice: { gap: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningBackground, padding: 11 }, duplicateText: { color: colors.warningText, fontSize: 12, lineHeight: 17 }, openExisting: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 }, openExistingText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" }, submit: { minHeight: 48, marginTop: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, submitText: { color: colors.white, fontSize: 14, fontWeight: "700" }, disabled: { opacity: 0.5 },
});
