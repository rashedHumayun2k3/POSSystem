import { Text } from "../i18n/LocalizedText";
import { useEffect, useRef, useState } from "react";import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

type Category = { id: string; name: string; nameBn?: string | null };
type Product = {
  id: string; name: string; sku: string; imageUrl: string | null; unitCode: string;
  sellingPrice: number; marketPrice: number | null; status: string; categoryName: string;
  variantCount: number; totalStock: number; lowStockThreshold: number; buyPrice?: number;
  showOnMarketplace: boolean;
};
const imageUrl = (value: string | null) => !value ? null : /^https?:\/\//i.test(value) ? value : `${MEDIA_URL}${value}`;
const money = (value: number) => `৳${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function ProductsScreen() {
  const auth = useAuth();
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [scanner, setScanner] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const canSeeCosts = ["OWNER", "MANAGER"].includes(auth.session?.user.role ?? "OWNER");
  const isOwner = (auth.session?.user.role ?? "OWNER") === "OWNER";

  useEffect(() => {
    let active = true;
    apiRef.current<Category[]>("/categories").then(value => { if (active) setCategories(value); }).catch(() => {});
    return () => { active = false; };
  }, [auth.session?.businessId]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      const query = new URLSearchParams({ status: "ACTIVE" });
      if (category !== "ALL") query.set("categoryId", category);
      if (search.trim()) query.set("q", search.trim());
      apiRef.current<Product[]>(`/products?${query}`).then(value => { if (active) setProducts(value); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [category, search, reload, auth.session?.businessId, auth.session?.branchId]);

  const lookupBarcode = async () => {
    if (!barcode.trim()) return;
    setScanning(true); setScanError("");
    try {
      const result = await apiRef.current<{ productName?: string; name?: string; variantSku?: string; sku?: string }>(`/products/barcode/${encodeURIComponent(barcode.trim())}`);
      setSearch(result.productName ?? result.name ?? result.variantSku ?? result.sku ?? barcode.trim());
      setCategory("ALL"); setScanner(false); setBarcode("");
    } catch (e) { setScanError((e as Error).message); } finally { setScanning(false); }
  };

  return <View style={s.root}>
    <View style={s.header}>
      <View style={s.titleRow}><Text accessibilityRole="header" style={s.title}>Products</Text>{isOwner && <View style={s.headerButtons}><Pressable style={s.secondaryButton}><Ionicons name="add" size={17} color={colors.primaryDark} /><Text style={s.secondaryText}>New Purchase</Text></Pressable><Pressable style={s.primaryButton}><Ionicons name="add" size={17} color={colors.white} /><Text style={s.primaryText}>New Product</Text></Pressable></View>}</View>
      <View style={s.searchRow}><View style={s.searchBox}><TextInput accessibilityLabel="Search products" value={search} onChangeText={setSearch} placeholder="Name, SKU, or barcode..." placeholderTextColor={colors.muted} autoCapitalize="none" style={s.searchInput} />{!!search && <Pressable accessibilityLabel="Clear search" onPress={() => setSearch("")}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable>}<Ionicons name="search-outline" size={18} color={colors.muted} /></View><Pressable accessibilityRole="button" accessibilityLabel="Scan barcode" onPress={() => { setScanError(""); setScanner(true); }} style={s.scanButton}><Ionicons name="qr-code-outline" size={18} color={colors.white} /><Text style={s.scanText}>Scan</Text></Pressable></View>
    </View>
    <View style={s.categoryBar}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>{[{ id: "ALL", name: "All" }, ...categories].map(item => <Pressable key={item.id} accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={[s.chip, category === item.id && s.activeChip]}><Text style={[s.chipText, category === item.id && s.activeChipText]}>{item.name}</Text></Pressable>)}</ScrollView></View>
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)} colors={[colors.primary]} tintColor={colors.primary} />}>
      {!!error && <View style={s.empty}><Ionicons name="warning-outline" size={36} color={colors.danger} /><Text style={s.error}>{error}</Text><Pressable style={s.primaryButton} onPress={() => setReload(v => v + 1)}><Text style={s.primaryText}>Try again</Text></Pressable></View>}
      {loading && !products.length && <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.helper}>Loading products…</Text></View>}
      {!loading && !error && !products.length && <View style={s.empty}><Ionicons name="cube-outline" size={48} color={colors.muted} /><Text style={s.helper}>No products found</Text></View>}
      {!error && products.map(product => <ProductCard key={product.id} product={product} canSeeCosts={canSeeCosts} />)}
    </ScrollView>
    <Modal visible={scanner} transparent animationType="fade" onRequestClose={() => setScanner(false)}>
      <View style={s.overlay}><SafeAreaView style={s.modal}><View style={s.modalHeader}><Text style={s.modalTitle}>Scan barcode</Text><Pressable accessibilityLabel="Close scanner" onPress={() => setScanner(false)}><Ionicons name="close" size={24} color={colors.heading} /></Pressable></View><Text style={s.helper}>Scan with a USB/Bluetooth scanner or enter the barcode.</Text><TextInput autoFocus accessibilityLabel="Barcode" value={barcode} onChangeText={setBarcode} onSubmitEditing={() => void lookupBarcode()} placeholder="Enter barcode" placeholderTextColor={colors.muted} keyboardType="number-pad" style={s.barcodeInput} />{!!scanError && <Text style={s.error}>{scanError}</Text>}<Pressable disabled={scanning || !barcode.trim()} onPress={() => void lookupBarcode()} style={[s.lookup, (scanning || !barcode.trim()) && s.disabled]}>{scanning ? <ActivityIndicator color={colors.white} /> : <Text style={s.primaryText}>Find product</Text>}</Pressable></SafeAreaView></View>
    </Modal>
  </View>;
}

function ProductCard({ product, canSeeCosts }: { product: Product; canSeeCosts: boolean }) {
  const out = product.totalStock <= 0;
  const low = !out && product.totalStock < product.lowStockThreshold;
  const discounted = product.marketPrice != null && product.marketPrice > product.sellingPrice;
  const discount = discounted ? Math.round(((product.marketPrice! - product.sellingPrice) / product.marketPrice!) * 100) : 0;
  const source = imageUrl(product.imageUrl);
  const name = product.name.replace(/\s*\(\s*\d+%\s*off\s*\)\s*$/i, "").trim();
  return <Pressable onPress={() => router.push({ pathname: "/products/[id]", params: { id: product.id } })} style={({ pressed }) => [s.card, out && s.outCard, low && s.lowCard, pressed && { opacity: .8 }]}>
    <View style={s.cardTop}>{source ? <Image source={{ uri: source }} resizeMode="cover" style={s.productImage} /> : <View style={s.productImage}><Ionicons name="cube-outline" size={25} color={colors.muted} /></View>}<View style={s.copy}><View style={s.nameRow}><Text numberOfLines={1} style={s.productName}>{name}</Text><Text style={[s.status, product.status === "ACTIVE" ? s.activeStatus : s.archivedStatus]}>{product.status === "ACTIVE" ? "Active" : "Archived"}</Text></View><Text style={s.meta}>{product.sku} · {product.categoryName}</Text><View style={s.priceRow}><Text style={s.priceLabel}>Selling Price</Text><Text style={s.price}>{money(product.sellingPrice)}</Text>{discounted && <><Text style={s.oldPrice}>{money(product.marketPrice!)}</Text><Text style={s.discount}>{discount}% off</Text></>}</View>{(out || low) && <Text style={[s.stockMessage, out ? s.outText : s.lowText]}>{out ? "Out of stock — add more stock" : "Low stock — add more stock"}</Text>}</View></View>
    <View style={s.tags}>{canSeeCosts && product.buyPrice != null && <Tag icon="wallet-outline" text={`Buy: ${money(product.buyPrice)}`} />}<Tag icon="cube-outline" text={`${product.variantCount} ${product.variantCount === 1 ? "variant" : "variants"} · ${product.totalStock} ${product.unitCode}`} /><Tag accent={product.showOnMarketplace} icon={product.showOnMarketplace ? "bag-check-outline" : "bag-remove-outline"} text={product.showOnMarketplace ? "On marketplace" : "Not on marketplace"} /></View>
  </Pressable>;
}
function Tag({ icon, text, accent }: { icon: keyof typeof Ionicons.glyphMap; text: string; accent?: boolean }) { return <View style={[s.tag, accent && s.accentTag]}><Ionicons name={icon} size={13} color={accent ? colors.primaryDark : colors.secondary} /><Text style={[s.tagText, accent && s.accentTagText]}>{text}</Text></View>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 16, paddingVertical: 12, gap: 12 }, titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, title: { color: colors.heading, fontSize: 18, fontWeight: "600" }, headerButtons: { flexDirection: "row", gap: 8 }, primaryButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 11, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }, primaryText: { color: colors.white, fontSize: 12, fontWeight: "600" }, secondaryButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 10, backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.secondaryBorder, flexDirection: "row", alignItems: "center", gap: 3 }, secondaryText: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, searchRow: { flexDirection: "row", gap: 8 }, searchBox: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.disabled, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 }, searchInput: { flex: 1, minWidth: 0, color: colors.heading, fontSize: 13, outlineStyle: "none" } as any, scanButton: { minHeight: 43, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 6 }, scanText: { color: colors.white, fontSize: 12, fontWeight: "600" }, categoryBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider }, categories: { paddingHorizontal: 16, paddingVertical: 9, gap: 8 }, chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.disabled }, activeChip: { backgroundColor: colors.primary }, chipText: { color: colors.secondary, fontSize: 12, fontWeight: "500" }, activeChipText: { color: colors.white }, list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 20 }, card: { overflow: "hidden", backgroundColor: colors.white, borderRadius: 12, borderLeftWidth: 1, borderWidth: 1, borderColor: colors.border, borderLeftColor: colors.border, shadowColor: colors.primary, shadowOpacity: .12, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, outCard: { borderLeftWidth: 4, borderLeftColor: colors.danger }, lowCard: { borderLeftWidth: 4, borderLeftColor: colors.warning }, cardTop: { padding: 12, flexDirection: "row", gap: 12 }, productImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.disabled, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0 }, nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, productName: { flex: 1, color: colors.heading, fontSize: 15, fontWeight: "500" }, status: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, overflow: "hidden", fontSize: 11, fontWeight: "500" }, activeStatus: { color: colors.successText, backgroundColor: colors.successBackground }, archivedStatus: { color: colors.neutralIcon, backgroundColor: colors.disabled }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 }, priceRow: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }, priceLabel: { color: colors.secondary, fontSize: 10, fontWeight: "500" }, price: { color: colors.heading, fontSize: 18, fontWeight: "700" }, oldPrice: { color: colors.muted, fontSize: 12, textDecorationLine: "line-through" }, discount: { color: colors.success, fontSize: 12, fontWeight: "500" }, stockMessage: { fontSize: 12, fontWeight: "500", marginTop: 4 }, outText: { color: colors.danger }, lowText: { color: colors.warningText }, tags: { paddingHorizontal: 12, paddingBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tag: { minHeight: 27, borderRadius: 8, paddingHorizontal: 8, backgroundColor: colors.disabled, flexDirection: "row", alignItems: "center", gap: 4 }, tagText: { color: colors.secondary, fontSize: 11 }, accentTag: { backgroundColor: colors.primaryLight }, accentTagText: { color: colors.primaryDark }, empty: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }, helper: { color: colors.secondary, fontSize: 13, textAlign: "center" }, error: { color: colors.dangerText, fontSize: 12, lineHeight: 18, textAlign: "center" }, overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 16 }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: 18, gap: 14 }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: colors.heading, fontSize: 18, fontWeight: "700" }, barcodeInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.heading, fontSize: 15 }, lookup: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, disabled: { opacity: .45 }
});
