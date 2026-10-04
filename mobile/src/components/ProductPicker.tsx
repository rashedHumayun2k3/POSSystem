import { Text } from "../i18n/LocalizedText";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import PopupSheet from "./PopupSheet";
import { colors } from "../theme";

export type ProductPickerResult = {
  productId: string; variantId: string; productName: string; variantSku: string;
  barcode: string; sellingPrice: number; imageUrl: string | null; unitCode: string;
  variantValuesJson: string; stock: number; avgLandedCost: number;
  marketPrice: number | null; categoryId: string;
};

type RawProduct = { id: string; variantId: string; name: string; sku: string; barcode?: string | null; effectivePrice?: number; imageUrl?: string | null; unitCode?: string | null; variantValuesJson?: string; stock?: number; avgLandedCost?: number; marketPrice?: number | null; categoryId?: string };
type Category = { id: string; name: string };
type Props = { open: boolean; onClose: () => void; onSelect: (product: ProductPickerResult) => void; selectedVariantIds?: Set<string>; showSellingPrice?: boolean; showAverageCost?: boolean; onlyInStock?: boolean; showRecentlyPurchased?: boolean; title?: string; branchId?: string };

const mapProduct = (p: RawProduct): ProductPickerResult => ({ productId: p.id, variantId: p.variantId, productName: p.name, variantSku: p.sku, barcode: p.barcode ?? "", sellingPrice: Number(p.effectivePrice ?? 0), imageUrl: p.imageUrl ?? null, unitCode: p.unitCode ?? "PCS", variantValuesJson: p.variantValuesJson ?? "{}", stock: Number(p.stock ?? 0), avgLandedCost: Number(p.avgLandedCost ?? 0), marketPrice: p.marketPrice ?? null, categoryId: p.categoryId ?? "" });
const media = (value: string | null) => !value ? null : /^https?:\/\//i.test(value) ? value : `${MEDIA_URL}${value}`;

export default function ProductPicker({ open, onClose, onSelect, selectedVariantIds, showSellingPrice = false, showAverageCost = true, onlyInStock = false, showRecentlyPurchased = true, title = "Choose Product", branchId }: Props) {
  const auth = useAuth(); const { width } = useWindowDimensions(); const desktop = width >= 768;
  const searchInput = useRef<TextInput>(null);
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("ALL"); const [categories, setCategories] = useState<Category[]>([]); const [recent, setRecent] = useState<ProductPickerResult[]>([]); const [products, setProducts] = useState<ProductPickerResult[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  const branchOptions = branchId ? { headers: { "X-Branch-Id": branchId } } : undefined;
  useEffect(() => { if (!open) return; setQuery(""); setCategory("ALL"); setError(""); if (!showRecentlyPurchased) { setCategories([]); setRecent([]); return; } auth.api<RawProduct[]>("/products/recently-purchased?limit=5", branchOptions).then(rows => setRecent(rows.map(mapProduct))).catch(() => setRecent([])); }, [open, showRecentlyPurchased, branchId, auth.session?.businessId]);
  useEffect(() => { if (!open) return; const q = query.trim(); const timer = setTimeout(async () => { setLoading(true); setError(""); try { const path = q.length >= 2 ? `/products/search?q=${encodeURIComponent(q)}${onlyInStock ? "&onlyInStock=true" : ""}` : `/products/browse?${category !== "ALL" ? `categoryId=${encodeURIComponent(category)}&` : ""}${onlyInStock ? "onlyInStock=true" : ""}`; setProducts((await auth.api<RawProduct[]>(path, branchOptions)).map(mapProduct)); } catch { setProducts([]); setError("Could not load products. Please try again."); } finally { setLoading(false); } }, q.length >= 2 ? 300 : 0); return () => clearTimeout(timer); }, [open, query, category, onlyInStock, branchId, auth.session?.businessId]);
  const grouped = useMemo(() => products.reduce<Record<string, ProductPickerResult[]>>((all, product) => { const key = product.productName[0]?.toUpperCase() || "#"; (all[key] ||= []).push(product); return all; }, {}), [products]);
  const pick = (p: ProductPickerResult) => { onSelect(p); onClose(); };
  const openNewProduct=()=>{if(Platform.OS==="web"&&typeof window!=="undefined"){window.location.assign("/products/new");return}onClose();router.push("/products/new")};
  const canCreateProduct=(auth.session?.user.role??"").toUpperCase()==="OWNER";
  const visibleProducts = query.trim().length < 2 && showRecentlyPurchased && recent.length > 0 ? recent : products;
  return (
    <PopupSheet visible={open} onClose={onClose} title={title}
      onShow={() => { if (!desktop) setTimeout(() => searchInput.current?.focus(), 250); }}
      headerAction={canCreateProduct ? <Pressable onPress={openNewProduct} style={styles.newProductButton}><Ionicons name="add" size={15} color={colors.primaryDark} /><Text style={styles.newProductText}>New Product</Text></Pressable> : null}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={19} color={colors.muted} />
            <TextInput ref={searchInput} value={query} onChangeText={setQuery} placeholder="Search product, SKU or barcode" placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={styles.list}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
            {!loading && !error && visibleProducts.length === 0 ? <Text style={styles.empty}>No products found.</Text> : null}
            {!loading ? visibleProducts.map(product => (
              <Pressable key={product.variantId} onPress={() => pick(product)} style={styles.row}>
                {media(product.imageUrl) ? <Image source={{ uri: media(product.imageUrl)! }} style={styles.image} /> : <View style={styles.imageFallback}><Ionicons name="cube-outline" size={22} color={colors.primaryDark} /></View>}
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.name}>{String(product.productName ?? "")}</Text>
                  <Text style={styles.meta}>{String(product.variantSku ?? "")}{product.barcode ? ` · ${String(product.barcode)}` : ""}</Text>
                </View>
                <View style={styles.stock}>
                  <Text style={styles.stockText}>Have: <Text style={product.stock > 0 ? styles.inStock : styles.outStock}>{String(product.stock)}</Text></Text>
                  {showSellingPrice ? <Text style={styles.cost}>৳{Number(product.sellingPrice).toLocaleString()}</Text> : null}
                  {showAverageCost ? <Text style={styles.cost}>{product.avgLandedCost > 0 ? `Avg: ৳${Number(product.avgLandedCost).toLocaleString()}` : "New"}</Text> : null}
                </View>
              </Pressable>
            )) : null}
          </ScrollView>
    </PopupSheet>
  );
}

const styles = StyleSheet.create({ newProductButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 9, backgroundColor: colors.primaryLight, paddingHorizontal: 8 }, newProductText: { color: colors.primaryDark, fontSize: 10, fontWeight: "700" }, searchWrap: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.cardSecondary }, search: { flex: 1, height: 43, color: colors.heading, fontSize: 13, outlineStyle: "none" } as never, categoryScroll: { flexGrow: 0, minHeight: 50, maxHeight: 50, marginBottom: 6 }, chips: { alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7 }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 7 }, chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, chipText: { color: colors.secondary, fontSize: 11, fontWeight: "600" }, chipTextActive: { color: colors.primaryDark }, list: { flexGrow: 1, paddingBottom: 24 }, section: { paddingHorizontal: 14, paddingVertical: 6, color: colors.white, backgroundColor: "#9A3412", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, sectionAccent: { color: colors.primaryDark, backgroundColor: colors.primaryLight }, row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.white }, rowSelected: { backgroundColor: colors.primaryLight }, image: { width: 44, height: 44, borderRadius: 9 }, imageFallback: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.cardSecondary }, copy: { flex: 1, minWidth: 0 }, name: { color: colors.heading, fontSize: 13, fontWeight: "700" }, selectedName: { color: colors.primaryDark }, variant: { color: colors.muted, fontWeight: "400" }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 }, stock: { alignItems: "flex-end" }, stockText: { color: colors.secondary, fontSize: 10 }, inStock: { color: colors.successText, fontWeight: "700" }, outStock: { color: colors.muted }, cost: { color: colors.primaryDark, fontSize: 10, fontWeight: "700", marginTop: 3 }, low: { color: colors.dangerText, fontSize: 9, marginTop: 2 }, loader: { marginVertical: 28 }, error: { color: colors.dangerText, textAlign: "center", padding: 14 }, empty: { color: colors.muted, textAlign: "center", padding: 28 } });
