import { Text } from "../i18n/LocalizedText";
import { useEffect, useRef, useState } from "react";import { ActivityIndicator, Image, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PageTitle from "../components/PageTitle";
import { Picker } from "@react-native-picker/picker";
import { useLanguage } from "../i18n/LanguageContext";

type Category = { id: string; name: string; nameBn?: string | null };
type Product = {
  id: string; name: string; sku: string; imageUrl: string | null; unitCode: string;
  sellingPrice: number; marketPrice: number | null; status: string; categoryName: string;
  variantCount: number; totalStock: number; lowStockThreshold: number; buyPrice?: number;
  showOnMarketplace: boolean; activeOfferPercent?: number;
};
const PAGE_SIZE = 20;
const imageUrl = (value: string | null) => !value ? null : /^https?:\/\//i.test(value) ? value : `${MEDIA_URL}${value}`;
const money = (value: number) => `৳${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
const layout = StyleSheet.create({
  titleToolbar: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pageTitle: { flex: 1 }, toolbarActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  toolbarButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.disabled },
  toolbarButtonActive: { backgroundColor: colors.primaryLight },
  addProductButton: { width: 40, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary },
  filterModal: { width: "100%", maxWidth: 420, borderRadius: 18, backgroundColor: colors.white, padding: 18, gap: 10 },
  filterLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 4 },
  filterOption: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 3 },
  filterOptionText: { color: colors.secondary, fontSize: 14 }, filterOptionSelected: { color: colors.primaryDark, fontWeight: "700" },
  activeFilters: { backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  activeFilter: { maxWidth: "100%", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: "#9A3412" },
  activeFilterText: { flexShrink: 1, color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  dropdownField: { marginBottom: 14 },
  dropdownLabel: { color: colors.secondary, fontSize: 12, fontWeight: "600", marginBottom: 7 },
  dropdownBox: { borderWidth: 1, borderColor: "#D6DEE8", borderRadius: 12, backgroundColor: "#F8FAFC", overflow: "hidden" },
  dropdownPicker: { width: "100%", color: colors.heading, backgroundColor: "transparent", fontSize: 14, height: 52 },
  dropdownArrow: { position: "absolute", right: 10, top: 11, width: 30, height: 30, borderRadius: 8, backgroundColor: "#FFF0E5", alignItems: "center", justifyContent: "center" },
});

export default function ProductsScreen() {
  const auth = useAuth();
  const { lang } = useLanguage();
  const [brandId, setBrandId] = useState("ALL");
  const [brands, setBrands] = useState<Category[]>([]);
  const [brandError, setBrandError] = useState("");
  const [brandsLoading, setBrandsLoading] = useState(false);
  const apiRef = useRef(auth.api); apiRef.current = auth.api;
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [filterOpen, setFilterOpen] = useState(false);


  const [sort, setSort] = useState("name_asc");
  const [stock, setStock] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minDraft, setMinDraft] = useState("");
  const [maxDraft, setMaxDraft] = useState("");
  const [priceError, setPriceError] = useState("");
  useEffect(() => { setMinDraft(minPrice); setMaxDraft(maxPrice); setPriceError(""); }, [filterOpen, minPrice, maxPrice]);
  const bn = lang === "bn";
  const sortOptions = [
    { value: "name_asc", label: bn ? "নাম: A → Z" : "Name: A → Z" },
    { value: "name_desc", label: bn ? "নাম: Z → A" : "Name: Z → A" },
    { value: "qty_asc", label: bn ? "পরিমাণ: কম → বেশি" : "Quantity: Low → High" },
    { value: "qty_desc", label: bn ? "পরিমাণ: বেশি → কম" : "Quantity: High → Low" },
    { value: "price_asc", label: bn ? "বিক্রয়মূল্য: কম → বেশি" : "Selling price: Low → High" },
    { value: "price_desc", label: bn ? "বিক্রয়মূল্য: বেশি → কম" : "Selling price: High → Low" },
    { value: "newest", label: bn ? "নতুন আগে" : "Newest first" },
    { value: "oldest", label: bn ? "পুরোনো আগে" : "Oldest first" },
  ];
  const stockOptions = [
    { value: "all", label: bn ? "সব স্টক" : "All stock" },
    { value: "in", label: bn ? "স্টকে আছে" : "In stock" },
    { value: "low", label: bn ? "স্টক কম" : "Low stock" },
    { value: "out", label: bn ? "স্টক নেই" : "Out of stock" },
  ];
  const applyPrices = () => {
    const normalize = (value: string) => value.trim().replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
    const min = normalize(minDraft), max = normalize(maxDraft);
    if ([min, max].some(value => value !== "" && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)))) || (min !== "" && max !== "" && Number(min) > Number(max))) {
      setPriceError(bn ? "সঠিক মূল্যসীমা দিন। সর্বনিম্ন মূল্য সর্বোচ্চ মূল্যের বেশি হতে পারবে না।" : "Enter a valid price range. Minimum must not exceed maximum."); return;
    }
    setMinPrice(min); setMaxPrice(max); setFilterOpen(false);
  };

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [scanner, setScanner] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const canSeeCosts = ["OWNER", "MANAGER"].includes(auth.session?.user.role ?? "OWNER");
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (sort !== "name_asc") activeFilters.push({ key: "sort", label: sortOptions.find(item => item.value === sort)!.label, clear: () => setSort("name_asc") });
  if (stock !== "all") activeFilters.push({ key: "stock", label: stockOptions.find(item => item.value === stock)!.label, clear: () => setStock("all") });
  if (minPrice || maxPrice) activeFilters.push({ key: "price", label: `${bn ? "বিক্রয়মূল্য" : "Selling price"}: ৳${minPrice || "0"} – ${maxPrice ? `৳${maxPrice}` : (bn ? "সীমাহীন" : "Any")}`, clear: () => { setMinPrice(""); setMaxPrice(""); } });
  if (brandId !== "ALL") activeFilters.push({ key: "brand", label: `${lang === "bn" ? "ব্র্যান্ড" : "Brand"}: ${brands.find(item => item.id === brandId)?.name ?? (lang === "bn" ? "নির্বাচিত ব্র্যান্ড" : "Selected brand")}`, clear: () => setBrandId("ALL") });
  if (category !== "ALL") activeFilters.push({ key: "category", label: `${lang === "bn" ? "ক্যাটাগরি" : "Category"}: ${categories.find(item => item.id === category)?.name ?? (lang === "bn" ? "নির্বাচিত ক্যাটাগরি" : "Selected category")}`, clear: () => setCategory("ALL") });
  if (statusFilter !== "ACTIVE") activeFilters.push({ key: "status", label: lang === "bn" ? (statusFilter === "INACTIVE" ? "নিষ্ক্রিয় পণ্য" : "সব পণ্য") : (statusFilter === "INACTIVE" ? "Inactive products" : "All products"), clear: () => setStatusFilter("ACTIVE") });
  if (search.trim()) activeFilters.push({ key: "search", label: `${lang === "bn" ? "অনুসন্ধান" : "Search"}: ${search.trim()}`, clear: () => setSearch("") });
  const filterActive = activeFilters.length > 0;
  const requestScope = `${auth.session?.businessId}:${auth.session?.branchId}:${category}:${brandId}:${statusFilter}:${search}:${sort}:${stock}:${minPrice}:${maxPrice}:${reload}`;
  const scopeRef = useRef(requestScope); scopeRef.current = requestScope;

  useEffect(() => { setBrandId("ALL"); setBrands([]); }, [auth.session?.businessId]);
  useEffect(() => {
    if (!filterOpen) return;
    let active = true;
    setBrandsLoading(true); setBrandError("");
    apiRef.current<Category[]>("/products/brand-options").then(value => { if (active) setBrands(value); })
      .catch(e => { if (active) setBrandError(e.message); })
      .finally(() => { if (active) setBrandsLoading(false); });
    return () => { active = false; };
  }, [filterOpen, auth.session?.businessId]);

  useEffect(() => {
    let active = true;
    apiRef.current<Category[]>("/categories").then(value => { if (active) setCategories(value); }).catch(() => {});
    return () => { active = false; };
  }, [auth.session?.businessId]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError(""); setProducts([]); setHasMore(false);
      const query = new URLSearchParams({ skip: "0", take: String(PAGE_SIZE) });
      if (statusFilter !== "ALL") query.set("status", statusFilter);
      if (category !== "ALL") query.set("categoryId", category);
      if (brandId !== "ALL") query.set("brandId", brandId);
      if (search.trim()) query.set("q", search.trim());
      query.set("sort", sort); query.set("stock", stock);
      if (minPrice) query.set("minPrice", minPrice);
      if (maxPrice) query.set("maxPrice", maxPrice);
      apiRef.current<Product[]>(`/products?${query}`).then(value => {
        if (active) { setProducts(value); setHasMore(value.length === PAGE_SIZE); }
      }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    }, search.trim() ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [category, brandId, search, statusFilter, sort, stock, minPrice, maxPrice, reload, auth.session?.businessId, auth.session?.branchId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const scope = requestScope;
    setLoadingMore(true);
    try {
      const query = new URLSearchParams({ skip: String(products.length), take: String(PAGE_SIZE) });
      if (statusFilter !== "ALL") query.set("status", statusFilter);
      if (category !== "ALL") query.set("categoryId", category);
      if (brandId !== "ALL") query.set("brandId", brandId);
      if (search.trim()) query.set("q", search.trim());
      query.set("sort", sort); query.set("stock", stock);
      if (minPrice) query.set("minPrice", minPrice);
      if (maxPrice) query.set("maxPrice", maxPrice);
      const next = await apiRef.current<Product[]>(`/products?${query}`);
      if (scopeRef.current !== scope) return;
      setProducts(current => [...current, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (e) { if (scopeRef.current === scope) setError((e as Error).message); }
    finally { setLoadingMore(false); }
  };

  const lookupBarcode = async () => {
    if (!barcode.trim()) return;
    setScanning(true); setScanError("");
    try {
      const result = await apiRef.current<{ productName?: string; name?: string; variantSku?: string; sku?: string }>(`/products/barcode/${encodeURIComponent(barcode.trim())}`);
      setSearch(result.productName ?? result.name ?? result.variantSku ?? result.sku ?? barcode.trim()); setSearchOpen(true);
      setCategory("ALL"); setBrandId("ALL"); setStock("all"); setMinPrice(""); setMaxPrice(""); setScanner(false); setBarcode("");
    } catch (e) { setScanError((e as Error).message); } finally { setScanning(false); }
  };

  return <View style={s.root}>
    <View style={s.header}>
      <View style={layout.titleToolbar}><PageTitle style={layout.pageTitle}>Products</PageTitle><View style={layout.toolbarActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search products" onPress={() => { setSearchOpen(value => !value); if (searchOpen) setSearch(""); }} style={layout.toolbarButton}><Ionicons name={searchOpen ? "close" : "search-outline"} size={21} color={colors.heading}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan barcode" onPress={() => { setScanError(""); setScanner(true); }} style={layout.toolbarButton}><Ionicons name="qr-code-outline" size={20} color={colors.heading}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Filter products" onPress={() => setFilterOpen(true)} style={[layout.toolbarButton, filterActive && layout.toolbarButtonActive]}><Ionicons name="filter-outline" size={20} color={filterActive ? colors.primaryDark : colors.heading}/></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Add product" onPress={() => router.push("/products/new")} style={layout.addProductButton}><Ionicons name="add" size={23} color={colors.white}/></Pressable>
      </View></View>
      {searchOpen && <View style={s.searchRow}><View style={s.searchBox}><Ionicons name="search-outline" size={18} color={colors.muted}/><TextInput autoFocus accessibilityLabel="Search products" value={search} onChangeText={setSearch} placeholder="Name, SKU, or barcode..." placeholderTextColor={colors.muted} autoCapitalize="none" style={s.searchInput} />{!!search && <Pressable accessibilityLabel="Clear search" onPress={() => setSearch("")}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable>}</View></View>}
    </View>
    {filterActive && <View style={layout.activeFilters}>{activeFilters.map(filter => <Pressable key={filter.key} accessibilityRole="button" accessibilityLabel={`${lang === "bn" ? "ফিল্টার সরান" : "Remove filter"}: ${filter.label}`} onPress={filter.clear} style={layout.activeFilter}>
      <Text style={layout.activeFilterText}>{filter.label}</Text><Ionicons name="close" size={18} color="#FFFFFF" />
    </Pressable>)}</View>}
    <View style={s.categoryBar}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>{[{ id: "ALL", name: "All" }, ...categories].map(item => <Pressable key={item.id} accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={[s.chip, category === item.id && s.activeChip]}><Text style={[s.chipText, category === item.id && s.activeChipText]}>{item.name}</Text></Pressable>)}</ScrollView></View>
    <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(v => v + 1)} colors={[colors.primary]} tintColor={colors.primary} />}>
      {!!error && <View style={s.empty}><Ionicons name="warning-outline" size={36} color={colors.danger} /><Text style={s.error}>{error}</Text><Pressable style={s.primaryButton} onPress={() => setReload(v => v + 1)}><Text style={s.primaryText}>Try again</Text></Pressable></View>}
      {loading && !products.length && <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.helper}>Loading products…</Text></View>}
      {!loading && !error && !products.length && <View style={s.empty}><Ionicons name="cube-outline" size={48} color={colors.muted} /><Text style={s.helper}>No products found</Text></View>}
      {!error && products.map(product => <ProductCard key={product.id} product={product} offerPercent={product.activeOfferPercent} canSeeCosts={canSeeCosts} />)}
      {!loading && !error && hasMore && <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void loadMore()} style={s.loadMore}><Text style={s.loadMoreText}>{loadingMore ? "Loading…" : "Load more products"}</Text><Text style={s.loadMoreCount}>Showing {products.length} products</Text></Pressable>}
    </ScrollView>
    <Modal visible={scanner} transparent animationType="fade" onRequestClose={() => setScanner(false)}>
      <View style={s.overlay}><SafeAreaView style={s.modal}><View style={s.modalHeader}><Text style={s.modalTitle}>Scan barcode</Text><Pressable accessibilityLabel="Close scanner" onPress={() => setScanner(false)}><Ionicons name="close" size={24} color={colors.heading} /></Pressable></View><Text style={s.helper}>Scan with a USB/Bluetooth scanner or enter the barcode.</Text><TextInput autoFocus accessibilityLabel="Barcode" value={barcode} onChangeText={setBarcode} onSubmitEditing={() => void lookupBarcode()} placeholder="Enter barcode" placeholderTextColor={colors.muted} keyboardType="number-pad" style={s.barcodeInput} />{!!scanError && <Text style={s.error}>{scanError}</Text>}<Pressable disabled={scanning || !barcode.trim()} onPress={() => void lookupBarcode()} style={[s.lookup, (scanning || !barcode.trim()) && s.disabled]}>{scanning ? <ActivityIndicator color={colors.white} /> : <Text style={s.primaryText}>Find product</Text>}</Pressable></SafeAreaView></View>
    </Modal>
    <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
      <Pressable style={s.overlay} onPress={() => setFilterOpen(false)}><Pressable style={layout.filterModal} onPress={event => event.stopPropagation()}>
        <View style={s.modalHeader}><Text style={s.modalTitle}>Filter products</Text><Pressable accessibilityLabel="Close filter" onPress={() => setFilterOpen(false)}><Ionicons name="close" size={23} color={colors.heading}/></Pressable></View>
        <ScrollView style={{ maxHeight: 450 }} keyboardShouldPersistTaps="handled">
        <FilterDropdown label={bn ? "সাজান" : "Sort by"} value={sort} options={sortOptions} onChange={setSort} />
        <FilterDropdown label={bn ? "স্টকের অবস্থা" : "Stock status"} value={stock} options={stockOptions} onChange={setStock} />
        <FilterDropdown label={bn ? "পণ্যের অবস্থা" : "Product status"} value={statusFilter} onChange={setStatusFilter} options={[
          { value: "ACTIVE", label: bn ? "সক্রিয় পণ্য" : "Active products" },
          { value: "INACTIVE", label: bn ? "নিষ্ক্রিয় পণ্য" : "Inactive products" },
          { value: "ALL", label: bn ? "সব পণ্য" : "All products" },
        ]} />
        <FilterDropdown label={bn ? "ব্র্যান্ডের নাম" : "Brand Name"} value={brandId} onChange={setBrandId} disabled={brandsLoading} options={[
          { value: "ALL", label: bn ? "সব ব্র্যান্ড" : "All brands" },
          ...brands.map(brand => ({ value: brand.id, label: brand.name })),
        ]} />
        {!!brandError && <Text style={s.error}>{brandError}</Text>}
        {brandsLoading && <ActivityIndicator color={colors.primary} />}
        <Text style={layout.filterLabel}>{bn ? "বিক্রয়মূল্যের সীমা" : "Selling price range"}</Text>
        <View style={{ flexDirection: "row", gap: 8, paddingVertical: 10 }}>
          <TextInput accessibilityLabel={bn ? "সর্বনিম্ন মূল্য" : "Minimum price"} placeholder={bn ? "সর্বনিম্ন (৳)" : "Minimum (৳)"} keyboardType="decimal-pad" value={minDraft} onChangeText={setMinDraft} style={[s.barcodeInput, { flex: 1, minWidth: 0 }]} maxLength={15} />
          <TextInput accessibilityLabel={bn ? "সর্বোচ্চ মূল্য" : "Maximum price"} placeholder={bn ? "সর্বোচ্চ (৳)" : "Maximum (৳)"} keyboardType="decimal-pad" value={maxDraft} onChangeText={setMaxDraft} style={[s.barcodeInput, { flex: 1, minWidth: 0 }]} maxLength={15} />
        </View>
        {!!priceError && <Text style={s.error}>{priceError}</Text>}
        <Pressable accessibilityRole="button" onPress={applyPrices} style={s.primaryButton}><Text style={s.primaryText}>{bn ? "প্রয়োগ করুন" : "Apply filters"}</Text></Pressable>
        </ScrollView>
      </Pressable></Pressable>
    </Modal>
  </View>;
}

function FilterDropdown({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <View style={layout.dropdownField}>
    <Text style={layout.dropdownLabel}>{label}</Text>
    <View style={[layout.dropdownBox, disabled && { opacity: 0.55 }]}>
      <Picker accessibilityLabel={label} selectedValue={value} enabled={!disabled} mode="dropdown" onValueChange={next => { if (next !== value) onChange(next); }} style={[layout.dropdownPicker, Platform.OS === "web" && ({ appearance: "none", borderWidth: 0, paddingLeft: 14, paddingRight: 48, cursor: disabled ? "default" : "pointer" } as any), Platform.OS === "ios" && { height: 150 }]} dropdownIconColor="transparent">
        {options.map(option => <Picker.Item key={option.value} label={option.label} value={option.value} style={{ fontSize: 14, color: colors.heading }} />)}
      </Picker>
      {Platform.OS !== "ios" && <View pointerEvents="none" style={layout.dropdownArrow}><Ionicons name="chevron-down" size={17} color="#9A3412" /></View>}
    </View>
  </View>;
}

function ProductCard({ product, offerPercent, canSeeCosts }: { product: Product; offerPercent?: number; canSeeCosts: boolean }) {
  const out = product.totalStock <= 0;
  const low = !out && product.totalStock < product.lowStockThreshold;
  const discount = Math.round(Number(offerPercent ?? 0));
  const discounted = discount > 0;
  const hasMarketComparison = product.marketPrice != null && product.marketPrice > product.sellingPrice;
  const source = imageUrl(product.imageUrl);
  const name = product.name.replace(/\s*\(\s*\d+%\s*off\s*\)\s*$/i, "").trim();
  return <Pressable onPress={() => router.push({ pathname: "/products/[id]", params: { id: product.id } })} style={({ pressed }) => [s.card, out && s.outCard, low && s.lowCard, pressed && { opacity: .8 }]}>
    <View style={s.cardTop}>{source ? <Image source={{ uri: source }} resizeMode="cover" style={s.productImage} /> : <View style={s.productImage}><Ionicons name="cube-outline" size={25} color={colors.muted} /></View>}<View style={s.copy}><View style={s.nameRow}><Text numberOfLines={1} style={s.productName}>{name}</Text>{discounted && <Text style={[s.status, { color: colors.white, backgroundColor: colors.primary }]}>Offer {discount}%</Text>}</View><Text style={s.meta}>{product.sku} · {product.categoryName}</Text><View style={s.priceRow}><Text style={s.priceLabel}>Selling Price</Text><Text style={s.price}>{money(product.sellingPrice)}</Text>{hasMarketComparison && <Text style={s.oldPrice}>{money(product.marketPrice!)}</Text>}</View>{(out || low) && <Text style={[s.stockMessage, out ? s.outText : s.lowText]}>{out ? "Out of stock — add more stock" : "Low stock — add more stock"}</Text>}</View></View>
    <View style={s.tags}>{canSeeCosts && product.buyPrice != null && <Tag icon="wallet-outline" text={`Buy: ${money(product.buyPrice)}`} />}<Tag icon="cube-outline" text={`${product.variantCount} ${product.variantCount === 1 ? "variant" : "variants"} · ${product.totalStock} ${product.unitCode}`} /><Tag accent={product.showOnMarketplace} icon={product.showOnMarketplace ? "bag-check-outline" : "bag-remove-outline"} text={product.showOnMarketplace ? "On marketplace" : "Not on marketplace"} /></View>
  </Pressable>;
}
function Tag({ icon, text, accent }: { icon: keyof typeof Ionicons.glyphMap; text: string; accent?: boolean }) { return <View style={[s.tag, accent && s.accentTag]}><Ionicons name={icon} size={13} color={accent ? colors.primaryDark : colors.secondary} /><Text style={[s.tagText, accent && s.accentTagText]}>{text}</Text></View>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 16, paddingVertical: 12, gap: 12 }, titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, title: { color: colors.heading, fontSize: 18, fontWeight: "600" }, headerButtons: { flexDirection: "row", gap: 8 }, primaryButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 11, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }, primaryText: { color: colors.white, fontSize: 12, fontWeight: "600" }, secondaryButton: { minHeight: 36, borderRadius: 10, paddingHorizontal: 10, backgroundColor: colors.cardSecondary, borderWidth: 1, borderColor: colors.secondaryBorder, flexDirection: "row", alignItems: "center", gap: 3 }, secondaryText: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, searchRow: { flexDirection: "row", gap: 8 }, searchBox: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.disabled, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7 }, searchInput: { flex: 1, minWidth: 0, color: colors.heading, fontSize: 13, outlineStyle: "none" } as any, scanButton: { minHeight: 43, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 6 }, scanText: { color: colors.white, fontSize: 12, fontWeight: "600" }, categoryBar: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider }, categories: { paddingHorizontal: 16, paddingVertical: 9, gap: 8 }, chip: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.disabled }, activeChip: { backgroundColor: colors.primary }, chipText: { color: colors.secondary, fontSize: 12, fontWeight: "500" }, activeChipText: { color: colors.white }, list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 8 }, card: { overflow: "hidden", backgroundColor: colors.white, borderRadius: 12, borderLeftWidth: 1, borderWidth: 1, borderColor: colors.border, borderLeftColor: colors.border, shadowColor: colors.primary, shadowOpacity: .12, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, outCard: { borderLeftWidth: 4, borderLeftColor: colors.danger }, lowCard: { borderLeftWidth: 4, borderLeftColor: colors.warning }, cardTop: { padding: 12, flexDirection: "row", gap: 12 }, productImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.disabled, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0 }, nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 }, productName: { flex: 1, color: colors.heading, fontSize: 15, fontWeight: "500" }, status: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, overflow: "hidden", fontSize: 11, fontWeight: "500" }, activeStatus: { color: colors.successText, backgroundColor: colors.successBackground }, archivedStatus: { color: colors.neutralIcon, backgroundColor: colors.disabled }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 }, priceRow: { marginTop: 5, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }, priceLabel: { color: colors.secondary, fontSize: 10, fontWeight: "500" }, price: { color: colors.heading, fontSize: 18, fontWeight: "700" }, oldPrice: { color: colors.muted, fontSize: 12, textDecorationLine: "line-through" }, discount: { color: colors.success, fontSize: 12, fontWeight: "500" }, stockMessage: { fontSize: 12, fontWeight: "500", marginTop: 4 }, outText: { color: colors.danger }, lowText: { color: colors.warningText }, tags: { paddingHorizontal: 12, paddingBottom: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tag: { minHeight: 27, borderRadius: 8, paddingHorizontal: 8, backgroundColor: colors.disabled, flexDirection: "row", alignItems: "center", gap: 4 }, tagText: { color: colors.secondary, fontSize: 11 }, accentTag: { backgroundColor: colors.primaryLight }, accentTagText: { color: colors.primaryDark }, loadMore: { minHeight: 46, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 11, backgroundColor: colors.white }, loadMoreText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" }, loadMoreCount: { color: colors.muted, fontSize: 10 }, empty: { minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }, helper: { color: colors.secondary, fontSize: 13, textAlign: "center" }, error: { color: colors.dangerText, fontSize: 12, lineHeight: 18, textAlign: "center" }, overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 16 }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: 18, gap: 14 }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: colors.heading, fontSize: 18, fontWeight: "700" }, barcodeInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.heading, fontSize: 15 }, lookup: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, disabled: { opacity: .45 }
});
