import { useDebouncedSearch, usePickerQuery } from "../query/usePickerQuery";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Text } from "../i18n/LocalizedText";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import ProductIdentity from "./ProductIdentity";
import NewProductForm, { type CreatedProduct } from "./NewProductForm";
import PopupSheet from "./PopupSheet";
import { colors } from "../theme";

export type ProductPickerResult = {
  productId: string; variantId: string; productName: string; variantSku: string;
  barcode: string; sellingPrice: number; imageUrl: string | null; unitCode: string;
  variantValuesJson: string; stock: number; avgLandedCost: number;
  marketPrice: number | null; categoryId: string; originalPrice?: number | null; activeOfferPercent?: number;
};

type RawProduct = { id: string; variantId: string; name: string; sku: string; barcode?: string | null; effectivePrice?: number; originalPrice?: number | null; activeOfferPercent?: number; imageUrl?: string | null; unitCode?: string | null; variantValuesJson?: string; stock?: number; avgLandedCost?: number; marketPrice?: number | null; categoryId?: string };
type Props = { open: boolean; onClose: () => void; onSelect: (product: ProductPickerResult) => void; selectedVariantIds?: Set<string>; showSellingPrice?: boolean; showAverageCost?: boolean; onlyInStock?: boolean; showRecentlyPurchased?: boolean; title?: string; branchId?: string; createProductInline?: boolean };

const mapProduct = (p: RawProduct): ProductPickerResult => ({ productId: p.id, variantId: p.variantId, productName: p.name, variantSku: p.sku, barcode: p.barcode ?? "", sellingPrice: Number(p.effectivePrice ?? 0), originalPrice: p.originalPrice, activeOfferPercent: p.activeOfferPercent, imageUrl: p.imageUrl ?? null, unitCode: p.unitCode ?? "PCS", variantValuesJson: p.variantValuesJson ?? "{}", stock: Number(p.stock ?? 0), avgLandedCost: Number(p.avgLandedCost ?? 0), marketPrice: p.marketPrice ?? null, categoryId: p.categoryId ?? "" });
const mapCreatedProduct = (product: CreatedProduct): ProductPickerResult[] => product.variants.map(variant => ({ productId: product.id, variantId: variant.id, productName: product.name, variantSku: variant.sku, barcode: variant.barcode ?? "", sellingPrice: Number(variant.priceOverride ?? product.sellingPrice ?? 0), imageUrl: variant.imageUrl ?? product.imageUrl ?? null, unitCode: product.unitCode ?? "PCS", variantValuesJson: variant.variantValuesJson ?? "{}", stock: Number(variant.stock ?? 0), avgLandedCost: Number(variant.avgLandedCost ?? 0), marketPrice: product.marketPrice ?? null, categoryId: product.categoryId }));


export default function ProductPicker({ open, onClose, onSelect, selectedVariantIds, showSellingPrice = false, showAverageCost = true, onlyInStock = false, showRecentlyPurchased = true, title = "Choose Product", branchId, createProductInline = false }: Props) {
  const auth = useAuth(); const { width } = useWindowDimensions(); const desktop = width >= 768;
  const searchInput = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<ProductPickerResult[]>([]);
  useEffect(() => { setQuery(""); setNewlyCreated([]); }, [open, auth.session?.businessId, auth.session?.branchId, branchId]);
  const search = query.trim().length >= 2 ? query.trim() : "";
  const debounced = useDebouncedSearch(search, 300);
  const path = debounced
    ? `/products/search?q=${encodeURIComponent(debounced)}${onlyInStock ? "&onlyInStock=true" : ""}`
    : `/products/browse?${onlyInStock ? "onlyInStock=true" : ""}`;
  const productQuery = usePickerQuery<RawProduct[]>("products", path, open && !newProductOpen && search === debounced, branchId);
  const recentQuery = usePickerQuery<RawProduct[]>("products", "/products/recently-purchased?limit=5", open && !newProductOpen && showRecentlyPurchased && !search, branchId);
  const products = (productQuery.data ?? []).map(mapProduct);
  const recent = (recentQuery.data ?? []).map(mapProduct);
  const loading = search !== debounced || productQuery.isLoading;
  const error = productQuery.error ? (productQuery.data ? "Could not refresh products. Showing saved results." : "Could not load products. Please try again.") : "";
  const pick = (p: ProductPickerResult) => { onSelect(p); onClose(); };
  const openNewProduct=()=>{if(createProductInline){setNewProductOpen(true);return}if(Platform.OS==="web"&&typeof window!=="undefined"){window.location.assign("/products/new");return}onClose();router.push("/products/new")};
  const canCreateProduct=(auth.session?.user.role??"").toUpperCase()==="OWNER";
  const baseProducts = query.trim().length < 2 && showRecentlyPurchased && recent.length > 0 ? recent : products;
  const matchingCreated = newlyCreated.filter(product => !query.trim() || product.productName.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleProducts = [...matchingCreated, ...baseProducts.filter(product => !matchingCreated.some(created => created.variantId === product.variantId))];
  return (<>
    <PopupSheet visible={open && !newProductOpen} onClose={onClose} title={title}
      onShow={() => { if (!desktop) setTimeout(() => searchInput.current?.focus(), 250); }}
      headerAction={canCreateProduct ? <Pressable onPress={openNewProduct} style={styles.newProductButton}><Ionicons name="add" size={15} color={colors.primaryDark} /><Text style={styles.newProductText}>New Product</Text></Pressable> : null}>
          <KeyboardAwareScrollView style={{ flex: 1, minHeight: 0 }} enableOnAndroid extraScrollHeight={24} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={19} color={colors.muted} />
            <TextInput ref={searchInput} value={query} onChangeText={setQuery} placeholder="Search product, SKU or barcode" placeholderTextColor={colors.muted} style={styles.search} returnKeyType="search" />
          </View>
          <View style={styles.list}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
            {!loading && !error && visibleProducts.length === 0 ? <Text style={styles.empty}>No products found.</Text> : null}
            {!loading ? visibleProducts.map(product => (
              <Pressable key={product.variantId} onPress={() => pick(product)} style={[styles.row, product.stock <= 0 && styles.outOfStockRow]}>
                <ProductIdentity name={product.productName} sku={`${product.variantSku}${product.barcode ? ` · ${product.barcode}` : ""}`} imageUrl={product.imageUrl} singleLine />
                <View style={styles.stock}>
                  <Text style={styles.stockText}>Qty: <Text style={product.stock > 0 ? styles.inStock : styles.outStock}>{String(product.stock)}</Text></Text>
                  {showSellingPrice ? <>{!!product.originalPrice && product.originalPrice > product.sellingPrice && (product.activeOfferPercent ?? 0) > 0 && <><Text style={[styles.cost, { color: colors.muted, textDecorationLine: "line-through" }]}>Price: ৳{Number(product.originalPrice).toLocaleString()}</Text><Text style={styles.cost}>Offer {product.activeOfferPercent}%</Text></>}<Text style={styles.cost}>Price: ৳{Number(product.sellingPrice).toLocaleString()}</Text></> : null}
                  {showAverageCost ? <Text style={styles.cost}>{product.avgLandedCost > 0 ? `Avg: ৳${Number(product.avgLandedCost).toLocaleString()}` : "New"}</Text> : null}
                </View>
              </Pressable>
            )) : null}
          </View></KeyboardAwareScrollView>
    </PopupSheet>
    {createProductInline && <PopupSheet visible={open && newProductOpen} onClose={() => setNewProductOpen(false)} title="Add New Product">
      <NewProductForm onCreated={created => { const createdRows = mapCreatedProduct(created); setNewlyCreated(createdRows); setQuery(""); setNewProductOpen(false);  }} onOpenExisting={existing => { setQuery(existing.name); setNewProductOpen(false);  }} />
    </PopupSheet>}
  </>);
}

const styles = StyleSheet.create({ newProductButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 9, backgroundColor: colors.primaryLight, paddingHorizontal: 8 }, newProductText: { color: colors.primaryDark, fontSize: 10, fontWeight: "700" }, searchWrap: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 11, backgroundColor: colors.cardSecondary }, search: { flex: 1, height: 43, color: colors.heading, fontSize: 13, outlineStyle: "none" } as never, categoryScroll: { flexGrow: 0, minHeight: 50, maxHeight: 50, marginBottom: 6 }, chips: { alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7 }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 7 }, chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, chipText: { color: colors.secondary, fontSize: 11, fontWeight: "600" }, chipTextActive: { color: colors.primaryDark }, list: { flexGrow: 1, paddingBottom: 24 }, section: { paddingHorizontal: 14, paddingVertical: 6, color: colors.white, backgroundColor: "#9A3412", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, sectionAccent: { color: colors.primaryDark, backgroundColor: colors.primaryLight }, row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.white }, outOfStockRow: { backgroundColor: colors.dangerBackground, borderBottomColor: "#FECACA" }, rowSelected: { backgroundColor: colors.primaryLight }, image: { width: 44, height: 44, borderRadius: 9 }, imageFallback: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.cardSecondary }, copy: { flex: 1, minWidth: 0 }, name: { color: colors.heading, fontSize: 13, fontWeight: "700" }, selectedName: { color: colors.primaryDark }, variant: { color: colors.muted, fontWeight: "400" }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 }, stock: { alignItems: "flex-end" }, stockText: { color: colors.secondary, fontSize: 10 }, inStock: { color: colors.successText, fontWeight: "700" }, outStock: { color: colors.dangerText, fontWeight: "700" }, cost: { color: colors.primaryDark, fontSize: 10, fontWeight: "700", marginTop: 3 }, low: { color: colors.dangerText, fontSize: 9, marginTop: 2 }, loader: { marginVertical: 28 }, error: { color: colors.dangerText, textAlign: "center", padding: 14 }, empty: { color: colors.muted, textAlign: "center", padding: 28 } });
