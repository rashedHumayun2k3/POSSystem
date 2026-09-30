import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { colors } from "../../src/theme";

type Category = { id: string; name: string; defaultUnit?: string | null };
type ExistingProduct = { id: string; name: string; sku: string; categoryName: string };

export default function NewProductScreen() {
  const auth = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [name, setName] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<ExistingProduct[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [costPrice, setCostPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    auth.api<Category[]>("/categories").then((items) => {
      if (!active) return;
      setCategories(items);
    }).catch((e) => {
      if (active) setError((e as Error).message);
    }).finally(() => {
      if (active) { setLoading(false); setLoaded(true); }
    });
    return () => { active = false; };
  }, [auth.session?.businessId]);

  useEffect(() => {
    const query = name.trim();
    if (!categoryId || query.length < 2) {
      setProductSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const params = new URLSearchParams({ status: "ACTIVE", categoryId, q: query });
        const rows = await auth.api<ExistingProduct[]>(`/products?${params.toString()}`);
        if (active) setProductSuggestions(Array.isArray(rows) ? rows.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []);
      } catch {
        if (active) setProductSuggestions([]);
      } finally {
        if (active) setSuggestionsLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [auth.session?.businessId, categoryId, name]);

  const selectedCategory = categories.find((item) => item.id === categoryId);
  const visibleCategories = categories.filter((item) => item.name.toLowerCase().includes(categoryQuery.trim().toLowerCase()));
  const duplicateProduct = productSuggestions.find(item => item.name.trim().toLowerCase() === name.trim().toLowerCase());

  const save = async () => {
    const qty = Number(quantity), cost = Number(costPrice), price = Number(sellingPrice);
    if (!categoryId) return setError("Choose a category.");
    if (!name.trim()) return setError("Enter a product name.");
    if (duplicateProduct) return setError(`“${duplicateProduct.name}” already exists in this category. Open the existing product instead.`);
    if (!Number.isFinite(price) || price <= 0) return setError("Enter a selling price greater than zero.");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Enter an opening quantity greater than zero.");
    if (!Number.isFinite(cost) || cost < 0) return setError("Enter a valid cost price.");
    setSaving(true); setError("");
    try {
      const category = categories.find((item) => item.id === categoryId);
      const product = await auth.api<{ id: string }>("/products", {
        method: "POST",
        body: JSON.stringify({
          categoryId, name: name.trim(), imageUrl: null, description: null, defectNotes: null,
          unitCode: category?.defaultUnit || "pcs", sellingPrice: price, marketPrice: null,
          packagingCostPerUnit: 0, lowStockThreshold: 5, attributesJson: "{}", note: null,
          variantCombinations: [{ values: {}, qty, costPrice: cost }], branchId: auth.session?.branchId,
          warrantyDurationValue: null, warrantyDurationUnit: null, wholesaleMinQty: null,
          wholesaleUnitPrice: null, wholesaleNote: null,
        }),
      });
      router.replace({ pathname: "/products/[id]", params: { id: product.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.heading} /></Pressable>
      <Text style={s.title}>Add Product</Text>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {!!error && <Text style={s.error}>{error}</Text>}
      <View style={s.field}>
        <Text style={s.label}>CATEGORY *</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : !categories.length ? <Text style={s.hint}>{loaded ? "Add a category before creating a product." : "Loading categories…"}</Text> : <>
          <View style={s.categoryInputWrap}><TextInput value={categoryOpen ? categoryQuery : selectedCategory?.name ?? ""} onFocus={() => { setCategoryQuery(""); setCategoryOpen(true); }} onChangeText={(value) => { setCategoryQuery(value); setCategoryId(""); setCategoryOpen(true); }} placeholder="Type to search and select a category" placeholderTextColor={colors.muted} style={[s.input,s.categorySearchInput]} accessibilityLabel="Search product categories"/><Ionicons name={categoryOpen ? "chevron-up" : "chevron-down"} size={19} color={colors.muted}/></View>
          {categoryOpen && <ScrollView style={s.categoryDropdown} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{visibleCategories.length ? visibleCategories.map((category) => <Pressable key={category.id} onPress={() => { setCategoryId(category.id); setCategoryQuery(""); setCategoryOpen(false); Keyboard.dismiss(); }} style={s.categoryOption}><Text style={s.categoryOptionText}>{category.name}</Text><Text style={s.categoryUnit}>{category.defaultUnit || "pcs"}</Text></Pressable>) : <Text style={s.noCategories}>No matching categories.</Text>}</ScrollView>}
        </>}
      </View>
      {categoryId ? <>
        <View style={s.field}>
          <Text style={s.label}>PRODUCT NAME *</Text>
          <TextInput value={name} onFocus={() => setSuggestionsOpen(name.trim().length >= 2)} onChangeText={(value) => { setName(value); setSuggestionsOpen(value.trim().length >= 2); setError(""); }} placeholder="Product name" placeholderTextColor={colors.muted} style={s.input} accessibilityLabel="Product name" autoCorrect={false} />
          {suggestionsOpen && name.trim().length >= 2 && <View style={s.suggestions}>{suggestionsLoading ? <ActivityIndicator color={colors.primary} style={s.suggestionLoader} /> : productSuggestions.length ? productSuggestions.map(item => <Pressable key={item.id} onPress={() => { setName(item.name); setSuggestionsOpen(false); Keyboard.dismiss(); }} style={s.suggestionRow}><View style={s.suggestionCopy}><Text numberOfLines={1} style={s.suggestionName}>{item.name}</Text><Text style={s.suggestionMeta}>{item.categoryName} · SKU {item.sku}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>) : <Text style={s.suggestionEmpty}>No matching products in this category.</Text>}</View>}
          {duplicateProduct && <View style={s.duplicateNotice}><Text style={s.duplicateText}>This exact product name already exists in {selectedCategory?.name}.</Text><Pressable onPress={() => router.replace({ pathname: "/products/[id]", params: { id: duplicateProduct.id } })} style={s.openExisting}><Text style={s.openExistingText}>Open existing product</Text><Ionicons name="arrow-forward" size={15} color={colors.primaryDark} /></Pressable></View>}
        </View>
        <Field label="SELLING PRICE *" value={sellingPrice} onChangeText={setSellingPrice} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="OPENING QUANTITY *" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="decimal-pad" />
        <Field label="UNIT COST *" value={costPrice} onChangeText={setCostPrice} placeholder="0.00" keyboardType="decimal-pad" />
        <Text style={s.hint}>A default variant will be created with the opening stock and cost you enter.</Text>
        <Pressable disabled={saving || loading || suggestionsLoading || !!duplicateProduct} onPress={() => void save()} style={[s.submit, (saving || loading || suggestionsLoading || !!duplicateProduct) && s.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.submitText}>Save Product</Text>}</Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "decimal-pad" }) {
  return <View style={s.field}><Text style={s.label}>{props.label}</Text><TextInput value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor={colors.muted} keyboardType={props.keyboardType} style={s.input} /></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider }, back: { width: 36, height: 40, justifyContent: "center" }, title: { color: colors.heading, fontSize: 18, fontWeight: "700" }, content: { padding: 16, gap: 16 }, field: { gap: 7 }, label: { color: colors.secondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }, categoryInputWrap: { position: "relative", flexDirection: "row", alignItems: "center" }, categorySearchInput: { flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 13, color: colors.heading, backgroundColor: colors.white, fontSize: 15 }, categoryDropdown: { maxHeight: 280, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, categoryOption: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.divider }, categoryOptionText: { color: colors.heading, fontSize: 14, fontWeight: "600" }, categoryUnit: { color: colors.muted, fontSize: 12 }, suggestions: { maxHeight: 260, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.white, overflow: "hidden" }, suggestionRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, suggestionCopy: { flex: 1, minWidth: 0 }, suggestionName: { color: colors.heading, fontSize: 13, fontWeight: "600" }, suggestionMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, suggestionLoader: { padding: 14 }, suggestionEmpty: { color: colors.muted, fontSize: 12, padding: 13 }, duplicateNotice: { gap: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningBackground, padding: 11 }, duplicateText: { color: colors.warningText, fontSize: 12, lineHeight: 17 }, openExisting: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5 }, openExistingText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" }, noCategories: { padding: 14, color: colors.muted, fontSize: 13 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 }, error: { color: colors.dangerText, fontSize: 13 }, submit: { minHeight: 48, marginTop: 8, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, submitText: { color: colors.white, fontSize: 14, fontWeight: "700" }, disabled: { opacity: 0.5 },
});
