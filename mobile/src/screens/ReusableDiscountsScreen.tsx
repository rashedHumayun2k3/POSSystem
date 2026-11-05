import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { useAuth } from "../auth/AuthContext";
import PopupSheet from "../components/PopupSheet";
import { DateTimeField } from "../components/DateTimeField";
import { colors } from "../theme";

type Discount = { id: string; name: string; percent: number; reason: string | null; startDate: string; endDate: string | null; createdAt: string; isArchived: boolean; appliedVariantCount: number; activeVariantCount: number };
type Category = { id: string; name: string; parentCategoryId: string | null };
type Product = { id: string; name: string; sku: string; categoryId: string; categoryName: string; variantCount: number; status: string };
type ScopeResult = { productCount: number; variantCount: number; activatedCount: number; scheduledCount: number };
type AppliedVariant = { productId: string; productName: string; variantId: string; variantSku: string; variantValuesJson: string; offerPrice: number; isActive: boolean; startDate: string; endDate: string | null; removedAt: string | null };
type ActiveAssignment = { discountId: string; discountName: string; percent: number; isArchived: boolean; categoryId: string; categoryName: string; productId: string; productName: string; variantId: string; variantSku: string; variantValuesJson: string; offerPrice: number };
type AssignedProduct = { id: string; name: string; categoryId: string; categoryName: string; variants: ActiveAssignment[] };
type TargetMode = "all" | "selected";

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const displayDate = (value: string) => new Date(value).toLocaleDateString();
const variantLabel = (value: string, sku: string) => {
  try {
    const attributes = JSON.parse(value) as Record<string, unknown>;
    const details = Object.values(attributes).filter(item => typeof item === "string" || typeof item === "number").map(String).join(" · ");
    return details ? `${details} · ${sku}` : sku;
  } catch { return sku; }
};
const startOfDay = (value: string) => { if (value === localDate()) return new Date().toISOString(); const [y, m, d] = value.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 0, 1).toISOString(); };
const endOfDay = (value: string) => { const [y, m, d] = value.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 23, 59, 59).toISOString(); };

export default function ReusableDiscountsScreen() {
  const auth = useAuth();
  const { productId: targetedProductId } = useLocalSearchParams<{ productId?: string }>();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [deletingDiscount, setDeletingDiscount] = useState<Discount | null>(null);
  const [createName, setCreateName] = useState("");
  const [percent, setPercent] = useState("10");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(localDate());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveVariantId, setConfirmRemoveVariantId] = useState<string | null>(null);
  const [removingVariantId, setRemovingVariantId] = useState<string | null>(null);
  const [applying, setApplying] = useState<Discount | null>(null);
  const [targetMode, setTargetMode] = useState<TargetMode>("selected");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [scopeTab, setScopeTab] = useState<"categories" | "products">("categories");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [applyResult, setApplyResult] = useState<ScopeResult | null>(null);
  const [applyExistingVariants, setApplyExistingVariants] = useState<AppliedVariant[]>([]);
  const [applyOptionsLoading, setApplyOptionsLoading] = useState(false);
  const [pageTab, setPageTab] = useState<"discounts" | "applied">("discounts");
  const [appliedView, setAppliedView] = useState<"categories" | "products">("categories");
  const [activeAssignments, setActiveAssignments] = useState<ActiveAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentDiscountId, setAssignmentDiscountId] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const [saved, cats] = await Promise.all([
        auth.api<Discount[]>(`/discounts${includeArchived ? "?includeArchived=true" : ""}`),
        categories.length ? Promise.resolve(categories) : auth.api<Category[]>("/categories"),
      ]);
      setDiscounts(includeArchived ? saved.filter(item => item.isArchived) : saved.filter(item => !item.isArchived));
      if (!categories.length) setCategories(cats);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [auth.session?.businessId, auth.session?.branchId, includeArchived, categories.length]);

  useEffect(() => { void load(); }, [load]);
  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true); setAssignmentsError("");
    try { setActiveAssignments(await auth.api<ActiveAssignment[]>("/discounts/active-assignments")); }
    catch (e) { setAssignmentsError((e as Error).message); }
    finally { setAssignmentsLoading(false); }
  }, [auth.session?.businessId, auth.session?.branchId]);
  useEffect(() => { if (pageTab === "applied") void loadAssignments(); }, [pageTab, loadAssignments]);
  const isOwner = auth.session?.user.role === "OWNER";

  const loadProducts = async () => {
    const all: Product[] = [];
    for (let skip = 0; skip < 5000; skip += 100) {
      const page = await auth.api<Product[]>(`/products?status=ACTIVE&skip=${skip}&take=100`);
      all.push(...page);
      if (page.length < 100) break;
    }
    setProducts(all);
    return all;
  };

  const openCreate = () => {
    setError(""); setEditingDiscount(null); setCreateName(""); setPercent("10"); setReason("");
    setStartDate(localDate()); setHasEndDate(false); setEndDate(""); setCreateOpen(true);
  };

  const openEdit = (discount: Discount) => {
    setError(""); setEditingDiscount(discount); setCreateName(discount.name); setPercent(String(discount.percent)); setReason(discount.reason ?? "");
    // An expired unused discount can be restarted today; future dates are preserved.
    const today = localDate();
    const savedStart = localDate(new Date(discount.startDate));
    setStartDate(savedStart < today ? today : savedStart);
    const savedEnd = discount.endDate ? localDate(new Date(discount.endDate)) : "";
    setHasEndDate(!!savedEnd && savedEnd >= today); setEndDate(savedEnd >= today ? savedEnd : ""); setCreateOpen(true);
  };

  const createDiscount = async () => {
    const value = Number(percent);
    if (!createName.trim()) { setError("Enter a name so you can find this discount later."); return; }
    if (!Number.isFinite(value) || value < 1 || value > 90) { setError("Discount must be between 1% and 90%."); return; }
    if (!startDate || (hasEndDate && (!endDate || endDate < startDate))) { setError("Choose a valid start and end date."); return; }
    setSaving(true); setError("");
    try {
      const payload = { name: createName.trim(), percent: value, reason: reason.trim() || null, startDate: startOfDay(startDate), endDate: hasEndDate ? endOfDay(endDate) : null };
      if (editingDiscount) await auth.api(`/discounts/${editingDiscount.id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await auth.api("/discounts", { method: "POST", body: JSON.stringify(payload) });
      setCreateOpen(false); setNotice(editingDiscount ? "Discount updated." : "Discount saved. Open it and choose where to apply it."); setEditingDiscount(null); await load(true);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const deleteDiscount = async () => {
    if (!deletingDiscount) return;
    setSaving(true); setError("");
    try {
      await auth.api(`/discounts/${deletingDiscount.id}`, { method: "DELETE" });
      setDeletingDiscount(null); setNotice("Discount deleted."); await load(true);
    } catch (e) { setError((e as Error).message); setDeletingDiscount(null); }
    finally { setSaving(false); }
  };

  const openApply = async (discount: Discount) => {
    setError(""); setApplyResult(null); setApplying(discount); setTargetMode("selected"); setCategoryIds([]); setScopeTab(targetedProductId ? "products" : "categories"); setProductIds([]); setProductSearch(""); setApplyExistingVariants([]);
    setApplyOptionsLoading(true);
    try {
      const [availableProducts, existing] = await Promise.all([
        products.length ? Promise.resolve(products) : loadProducts(),
        auth.api<AppliedVariant[]>(`/discounts/${discount.id}/applied-variants`),
      ]);
      setApplyExistingVariants(existing);
      if (targetedProductId) {
        const appliedCount = existing.filter(item => item.productId === targetedProductId && !item.removedAt && (item.isActive || new Date(item.startDate).getTime() > Date.now()) && (!item.endDate || new Date(item.endDate).getTime() >= Date.now())).length;
        const product = availableProducts.find(item => item.id === targetedProductId);
        if (!product || appliedCount < product.variantCount) setProductIds([targetedProductId]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setApplyOptionsLoading(false); }
  };

  const applyDiscount = async () => {
    if (!applying) return;
    if (targetMode === "selected" && categoryIds.length === 0 && productIds.length === 0) { setError("Choose at least one category or product, or switch to All products."); return; }
    if (targetMode === "selected" && productIds.length === 0 && categoryIds.every(id => {
      const category = categories.find(item => item.id === id);
      return !category || categoryProductCount(category) === 0;
    })) { setError("The selected categories contain no active products. Choose a category with products or select an individual product."); return; }
    setSaving(true); setError("");
    try {
      const result = await auth.api<ScopeResult>(`/discounts/${applying.id}/apply`, { method: "POST", body: JSON.stringify({ allProducts: targetMode === "all", categoryIds, productIds }) });
      try {
        const updated = await auth.api<AppliedVariant[]>(`/discounts/${applying.id}/applied-variants`);
        setApplyExistingVariants(updated);
      } catch { /* The discount was applied; the next modal open will reload its variants. */ }
      setApplyResult(result); setNotice(`Discount applied to ${result.productCount} products (${result.activatedCount} active, ${result.scheduledCount} scheduled).`);
      await load(true);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const archive = async (discount: Discount) => {
    setSaving(true); setError("");
    try { await auth.api(`/discounts/${discount.id}/${discount.isArchived ? "restore" : "archive"}`, { method: "POST" }); await load(true); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const toggle = (items: string[], set: (values: string[]) => void, id: string) => set(items.includes(id) ? items.filter(x => x !== id) : [...items, id]);
  const appliedCountForProduct = (product: Product) => applyExistingVariants.filter(variant => variant.productId === product.id && !variant.removedAt
    && (variant.isActive || new Date(variant.startDate).getTime() > Date.now())
    && (!variant.endDate || new Date(variant.endDate).getTime() >= Date.now())).length;
  const eligibleProducts = useMemo(() => products.filter(product => {
    const appliedCount = applyExistingVariants.filter(variant => variant.productId === product.id && !variant.removedAt
      && (variant.isActive || new Date(variant.startDate).getTime() > Date.now())
      && (!variant.endDate || new Date(variant.endDate).getTime() >= Date.now())).length;
    return appliedCount < product.variantCount;
  }), [products, applyExistingVariants]);
  const visibleProducts = useMemo(() => products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(productSearch.trim().toLowerCase())), [products, productSearch]);
  const removeAppliedVariant = async (variant: ActiveAssignment) => {
    setRemovingVariantId(variant.variantId); setAssignmentsError("");
    try {
      await auth.api(`/discounts/${variant.discountId}/applied-variants/${variant.variantId}`, { method: "DELETE" });
      await Promise.all([loadAssignments(), load(true)]);
      setNotice(`Removed ${variant.discountName} from ${variant.productName}.`);
      setConfirmRemoveVariantId(null);
    } catch (e) { setAssignmentsError((e as Error).message); }
    finally { setRemovingVariantId(null); }
  };
  const categoryProductCount = (category: Category) => {
    const ids = [category.id, ...categories.filter(item => item.parentCategoryId === category.id).map(item => item.id)];
    return eligibleProducts.filter(product => ids.includes(product.categoryId)).length;
  };
  const categoryTotalCount = (category: Category) => {
    const ids = [category.id, ...categories.filter(item => item.parentCategoryId === category.id).map(item => item.id)];
    return products.filter(product => ids.includes(product.categoryId)).length;
  };
  const visibleAssignments = useMemo(() => activeAssignments.filter(variant => !assignmentDiscountId || variant.discountId === assignmentDiscountId), [activeAssignments, assignmentDiscountId]);
  const assignedProducts = useMemo(() => {
    const grouped = new Map<string, AssignedProduct>();
    for (const variant of visibleAssignments) {
      let product = grouped.get(variant.productId);
      if (!product) {
        product = { id: variant.productId, name: variant.productName, categoryId: variant.categoryId, categoryName: variant.categoryName, variants: [] };
        grouped.set(variant.productId, product);
      }
      product.variants.push(variant);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleAssignments]);
  const matchingProducts = useMemo(() => {
    const term = assignmentSearch.trim().toLowerCase();
    return term ? assignedProducts.filter(product => `${product.name} ${product.categoryName} ${product.variants.map(v => `${v.discountName} ${v.variantSku}`).join(" ")}`.toLowerCase().includes(term)) : assignedProducts;
  }, [assignedProducts, assignmentSearch]);
  const assignedCategories = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; products: AssignedProduct[] }>();
    for (const product of matchingProducts) {
      let category = grouped.get(product.categoryId);
      if (!category) { category = { id: product.categoryId, name: product.categoryName, products: [] }; grouped.set(product.categoryId, category); }
      category.products.push(product);
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [matchingProducts]);
  const renderAssignedProduct = (product: AssignedProduct) => <View key={product.id} style={s.card}>
    <View style={{ paddingHorizontal: 12, paddingTop: 11, paddingBottom: 5 }}>
      <Text style={s.cardTitle}>{product.name}</Text>
      <Text style={s.cardMeta}>{product.categoryName} · {product.variants.length} discounted {product.variants.length === 1 ? "variant" : "variants"}</Text>
    </View>
    {product.variants.map(variant => <View key={variant.variantId} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 12, paddingVertical: 9 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={s.detailText}>{variantLabel(variant.variantValuesJson, variant.variantSku)}</Text><Text style={s.productMeta}>{variant.discountName}</Text></View>
      <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{variant.percent}%</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${variant.discountName} from ${product.name}`} disabled={!!removingVariantId} onPress={() => setConfirmRemoveVariantId(variant.variantId)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle-outline" size={20} color={colors.danger}/></Pressable>
      </View>{confirmRemoveVariantId === variant.variantId && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6, paddingTop: 6 }}><Text style={s.productMeta}>Restore regular price?</Text><Pressable onPress={() => setConfirmRemoveVariantId(null)} style={s.archiveButton}><Text style={s.archiveText}>Cancel</Text></Pressable><Pressable disabled={!!removingVariantId} onPress={() => void removeAppliedVariant(variant)} style={s.deleteButton}><Text style={s.deleteText}>{removingVariantId === variant.variantId ? "Removing..." : "Remove"}</Text></Pressable></View>}
    </View>)}
  </View>;

  if (!isOwner) return <View style={s.state}><Ionicons name="lock-closed-outline" size={28} color={colors.muted}/><Text style={s.stateText}>Reusable discounts are managed by the business owner.</Text></View>;

  return <View style={s.root}>
    <View style={s.header}><View style={s.headerCopy}><Text style={s.title}>Discounts</Text><Text style={s.subtitle}>Create a discount once, then reuse it across products.</Text></View><Pressable accessibilityRole="button" onPress={openCreate} style={s.createButton}><Ionicons name="add" size={18} color={colors.white}/><Text style={s.createText}>New discount</Text></Pressable></View>
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.white, paddingHorizontal: 14 }}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: pageTab === "discounts" }} onPress={() => setPageTab("discounts")} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: pageTab === "discounts" ? colors.primary : "transparent" }}><Text style={{ color: pageTab === "discounts" ? colors.primaryDark : colors.secondary, fontSize: 13, fontWeight: "700" }}>Discount List</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: pageTab === "applied" }} onPress={() => { setAssignmentDiscountId(null); setPageTab("applied"); }} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: pageTab === "applied" ? colors.primary : "transparent" }}><Text style={{ color: pageTab === "applied" ? colors.primaryDark : colors.secondary, fontSize: 13, fontWeight: "700" }}>Applied to products</Text></Pressable>
    </View>
    {!!notice && <View style={s.notice}><Ionicons name="checkmark-circle-outline" size={17} color={colors.successText}/><Text style={s.noticeText}>{notice}</Text><Pressable onPress={() => setNotice("")}><Ionicons name="close" size={18} color={colors.successText}/></Pressable></View>}
    {!!error && !createOpen && !applying && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={pageTab === "applied" ? assignmentsLoading : refreshing} onRefresh={() => void (pageTab === "applied" ? loadAssignments() : load(true))} colors={[colors.primary]}/> }>
      {pageTab === "discounts" ? <>
      {loading ? <View style={s.state}><ActivityIndicator color={colors.primary}/><Text style={s.stateText}>Loading discounts…</Text></View> : discounts.length === 0 ? <View style={s.empty}><Ionicons name="pricetag-outline" size={30} color={colors.muted}/><Text style={s.emptyTitle}>{includeArchived ? "No archived discounts" : "No discounts yet"}</Text><Text style={s.emptyText}>Create a discount, then select all products, categories, or individual products.</Text></View> : discounts.map(discount => {
        const expanded = expandedId === discount.id;
        const expired = !!discount.endDate && new Date(discount.endDate) < new Date();
        return <View key={discount.id} style={s.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedId(expanded ? null : discount.id)} style={s.cardHead}>
            <View style={s.percentBadge}><Text style={s.percentText}>{discount.percent}%</Text></View>
            <View style={s.cardCopy}><Text style={s.cardTitle}>{discount.name}</Text><Text style={s.cardMeta}>{discount.activeVariantCount ? `${discount.activeVariantCount} active discounted variants` : "No active discounted variants"} · {expired ? "Expired" : discount.isArchived ? "Archived" : "Available"}</Text></View>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color={colors.muted}/>
          </Pressable>
          {expanded && <View style={s.cardDetail}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 9, backgroundColor: colors.cardSecondary, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={colors.primaryDark}/>
                <View><Text style={{ color: colors.secondary, fontSize: 10 }}>Starts</Text><Text style={{ color: colors.heading, fontSize: 13, fontWeight: "700" }}>{displayDate(discount.startDate)}</Text></View>
              </View>
              <View style={{ flex: 1, minWidth: 130, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 9, backgroundColor: colors.cardSecondary, paddingHorizontal: 10, paddingVertical: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={colors.primaryDark}/>
                <View><Text style={{ color: colors.secondary, fontSize: 10 }}>Ends</Text><Text style={{ color: colors.heading, fontSize: 13, fontWeight: "700" }}>{discount.endDate ? displayDate(discount.endDate) : "No end date"}</Text></View>
              </View>
            </View>
            {!!discount.reason && <Text style={s.detailText}>{discount.reason}</Text>}
            {discount.activeVariantCount > 0 && <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><Text style={{ flex: 1, color: colors.heading, fontSize: 12, fontWeight: "700" }}>Active discounted variants ({discount.activeVariantCount})</Text><Pressable accessibilityRole="button" accessibilityLabel={`Manage products with ${discount.name}`} onPress={() => { setAssignmentDiscountId(discount.id); setAssignmentSearch(""); setAppliedView("products"); setConfirmRemoveVariantId(null); setPageTab("applied"); }} style={s.archiveButton}><Text style={s.archiveText}>Manage</Text></Pressable></View>
            </View>}
            <View style={s.cardActions}>
              <Pressable accessibilityRole="button" disabled={discount.isArchived || expired} onPress={() => void openApply(discount)} style={[s.applyButton, (discount.isArchived || expired) && s.disabled]}><Ionicons name="pricetag-outline" size={16} color={colors.white}/><Text style={s.applyText}>Apply to products</Text></Pressable>
              {discount.appliedVariantCount === 0 && <><Pressable accessibilityRole="button" disabled={saving} onPress={() => openEdit(discount)} style={s.archiveButton}><Text style={s.archiveText}>Edit</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => setDeletingDiscount(discount)} style={s.deleteButton}><Text style={s.deleteText}>Delete</Text></Pressable></>}
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void archive(discount)} style={s.archiveButton}><Text style={s.archiveText}>{discount.isArchived ? "Restore" : "Archive"}</Text></Pressable>
            </View>
            {discount.appliedVariantCount > 0 && <Text style={s.detailText}>This discount has applied price history, so it can be archived but not edited or deleted.</Text>}
          </View>}
        </View>;
      })}
      <Pressable accessibilityRole="button" onPress={() => { setIncludeArchived(v => !v); setError(""); }} style={s.archiveToggle}><Text style={s.archiveToggleText}>{includeArchived ? "Hide archived discounts" : "View archived discounts"}</Text><Ionicons name={includeArchived ? "chevron-up" : "chevron-forward"} size={16} color={colors.primaryDark}/></Pressable>
      </> : <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="pricetag-outline" size={18} color={colors.primaryDark}/><Text style={{ color: colors.heading, fontSize: 14, fontWeight: "700" }}>Current discounts</Text><Text style={{ color: colors.secondary, fontSize: 11 }}>{assignedProducts.length} products · {visibleAssignments.length} variants</Text></View>
        {!!assignmentDiscountId && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.cardSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}><Text style={{ color: colors.heading, fontSize: 12, fontWeight: "700" }}>Showing: {discounts.find(item => item.id === assignmentDiscountId)?.name ?? activeAssignments.find(item => item.discountId === assignmentDiscountId)?.discountName ?? "Selected discount"}</Text><Pressable accessibilityRole="button" accessibilityLabel="Show all discounts" onPress={() => setAssignmentDiscountId(null)} style={{ padding: 4 }}><Ionicons name="close" size={18} color={colors.secondary}/></Pressable></View>}
        <View style={s.searchBox}><Ionicons name="search-outline" size={17} color={colors.muted}/><TextInput value={assignmentSearch} onChangeText={setAssignmentSearch} placeholder="Search category, product or discount" style={s.searchInput}/></View>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider }}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: appliedView === "categories" }} onPress={() => setAppliedView("categories")} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: appliedView === "categories" ? colors.primary : "transparent" }}><Text style={{ color: appliedView === "categories" ? colors.primaryDark : colors.secondary, fontSize: 12, fontWeight: "700" }}>Categories</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: appliedView === "products" }} onPress={() => setAppliedView("products")} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: appliedView === "products" ? colors.primary : "transparent" }}><Text style={{ color: appliedView === "products" ? colors.primaryDark : colors.secondary, fontSize: 12, fontWeight: "700" }}>Products</Text></Pressable>
        </View>
        {assignmentsLoading ? <View style={s.state}><ActivityIndicator color={colors.primary}/><Text style={s.stateText}>Loading active discounts…</Text></View>
          : assignmentsError ? <View style={s.errorBox}><Text style={s.errorText}>{assignmentsError}</Text><Pressable onPress={() => void loadAssignments()}><Text style={s.archiveToggleText}>Retry</Text></Pressable></View>
          : matchingProducts.length === 0 ? <View style={s.empty}><Ionicons name="pricetag-outline" size={28} color={colors.muted}/><Text style={s.emptyTitle}>{assignmentSearch ? "No matching discounts" : "No active discounts"}</Text><Text style={s.emptyText}>{assignmentSearch ? "Try another product, category or discount name." : "Apply a discount to a product to see it here."}</Text></View>
          : appliedView === "products" ? matchingProducts.map(renderAssignedProduct)
          : assignedCategories.map(category => <View key={category.id} style={s.card}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: openCategoryId === category.id }} onPress={() => setOpenCategoryId(current => current === category.id ? null : category.id)} style={s.cardHead}>
                <View style={s.cardCopy}><Text style={s.cardTitle}>{category.name}</Text><Text style={s.cardMeta}>{category.products.length} products · {category.products.reduce((count, product) => count + product.variants.length, 0)} discounted variants</Text></View>
                <Ionicons name={openCategoryId === category.id ? "chevron-up" : "chevron-down"} size={19} color={colors.muted}/>
              </Pressable>
              {openCategoryId === category.id && <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, padding: 10 }}>{category.products.map(renderAssignedProduct)}</View>}
            </View>)}
      </>}
    </ScrollView>

    <PopupSheet visible={createOpen} onClose={() => !saving && setCreateOpen(false)} title={editingDiscount ? "Edit reusable discount" : "Create reusable discount"}>
      <ScrollView style={s.sheetBody} contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Discount name</Text><TextInput value={createName} onChangeText={setCreateName} placeholder="e.g. Eid Sale" style={s.input} maxLength={120}/>
        <Text style={s.label}>Discount percentage</Text><View style={s.percentInputRow}><TextInput value={percent} onChangeText={v => setPercent(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" style={s.percentInput}/><Text style={s.percentSuffix}>%</Text><Text style={s.help}>1% to 90%</Text></View>
        <Text style={s.label}>Note (optional)</Text><TextInput value={reason} onChangeText={setReason} placeholder="Short reason for this discount" style={s.input}/>
        <Text style={s.label}>Start date</Text><DateTimeField value={startDate} onChange={setStartDate} includeTime={false} minimumDate={new Date()}/>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: hasEndDate }} onPress={() => { setHasEndDate(v => !v); if (!hasEndDate) setEndDate(startDate); }} style={s.checkRow}><View style={[s.checkbox, hasEndDate && s.checked]}>{hasEndDate && <Ionicons name="checkmark" size={14} color={colors.white}/>}</View><Text style={s.checkText}>Set an end date</Text></Pressable>
        {hasEndDate && <><Text style={s.label}>End date</Text><DateTimeField value={endDate} onChange={setEndDate} includeTime={false} minimumDate={new Date(`${startDate}T00:00:00`)}/></>}
        <Text style={s.sheetHint}>You can apply this discount to all active products, one or more categories, or a hand-picked product selection. Archiving the discount later will not cancel products already using it.</Text>
        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void createDiscount()} style={[s.primaryButton, saving && s.disabled]}>{saving ? <ActivityIndicator color={colors.white}/> : <Text style={s.primaryText}>{editingDiscount ? "Save changes" : "Save discount"}</Text>}</Pressable>
      </ScrollView>
    </PopupSheet>

    <PopupSheet visible={!!deletingDiscount} onClose={() => !saving && setDeletingDiscount(null)} title="Delete discount">
      <View style={s.deleteConfirm}><Text style={s.detailText}>Delete “{deletingDiscount?.name}” permanently? This is only available because it has not been applied to any products.</Text><View style={s.cardActions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => setDeletingDiscount(null)} style={s.archiveButton}><Text style={s.archiveText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => void deleteDiscount()} style={[s.deleteConfirmButton, saving && s.disabled]}>{saving ? <ActivityIndicator color={colors.white}/> : <Text style={s.applyText}>Delete discount</Text>}</Pressable></View></View>
    </PopupSheet>

    <PopupSheet visible={!!applying} onClose={() => !saving && setApplying(null)} title={applying ? `Apply ${applying.name}` : "Apply discount"}>
      <View style={s.applySheet}>
        <ScrollView style={s.sheetBody} contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={s.discountSummary}><Text style={s.summaryPercent}>{applying?.percent}% OFF</Text><Text style={s.summaryMeta}>{applying?.startDate ? `Starts ${displayDate(applying.startDate)}` : ""}{applying?.endDate ? ` · Ends ${displayDate(applying.endDate)}` : " · No end date"}</Text></View>
          <Text style={s.label}>Where should this discount apply?</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "stretch" }}>
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: targetMode === "all" }} onPress={() => { setTargetMode("all"); setCategoryIds([]); setProductIds([]); }} style={[s.modeCard, { flex: 1, minWidth: 0 }, targetMode === "all" && s.modeCardSelected]}><View style={[s.radio, targetMode === "all" && s.radioSelected]}>{targetMode === "all" && <View style={s.radioDot}/>}</View><View style={s.modeCopy}><Text style={s.modeTitle}>All active products</Text><Text style={s.modeHint}>Apply to every eligible active product ({eligibleProducts.length} products)</Text></View></Pressable>
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: targetMode === "selected" }} onPress={() => setTargetMode("selected")} style={[s.modeCard, { flex: 1, minWidth: 0 }, targetMode === "selected" && s.modeCardSelected]}><View style={[s.radio, targetMode === "selected" && s.radioSelected]}>{targetMode === "selected" && <View style={s.radioDot}/>}</View><View style={s.modeCopy}><Text style={s.modeTitle}>Choose categories or products</Text><Text style={s.modeHint}>You can combine categories and individual products.</Text></View></Pressable>
          </View>
          {targetMode === "selected" && <>
            {!!(categoryIds.length || productIds.length) && <View style={{ gap: 7 }}>
              <Text style={s.subLabel}>Selected for {applying?.percent}% OFF</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {categoryIds.map(id => { const category = categories.find(item => item.id === id); return category && <Pressable key={`category-${id}`} accessibilityRole="button" accessibilityLabel={`Remove category ${category.name}`} onPress={() => setCategoryIds(current => current.filter(item => item !== id))} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "700" }}>{category.name}: {applying?.percent}%</Text><Ionicons name="close-circle" size={16} color={colors.primaryDark}/></Pressable>; })}
                {productIds.map(id => { const product = products.find(item => item.id === id); return product && <Pressable key={`product-${id}`} accessibilityRole="button" accessibilityLabel={`Remove product ${product.name}`} onPress={() => setProductIds(current => current.filter(item => item !== id))} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "700" }}>{product.name}: {applying?.percent}%</Text><Ionicons name="close-circle" size={16} color={colors.primaryDark}/></Pressable>; })}
              </View>
            </View>}
            <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: scopeTab === "categories" }} onPress={() => setScopeTab("categories")} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: scopeTab === "categories" ? colors.primary : "transparent" }}><Text style={{ color: scopeTab === "categories" ? colors.primaryDark : colors.secondary, fontSize: 12, fontWeight: "700" }}>Categories{categoryIds.length ? ` (${categoryIds.length})` : ""}</Text></Pressable>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: scopeTab === "products" }} onPress={() => setScopeTab("products")} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: scopeTab === "products" ? colors.primary : "transparent" }}><Text style={{ color: scopeTab === "products" ? colors.primaryDark : colors.secondary, fontSize: 12, fontWeight: "700" }}>Individual products{productIds.length ? ` (${productIds.length})` : ""}</Text></Pressable>
            </View>
            {scopeTab === "categories" && <ScrollView nestedScrollEnabled style={{ maxHeight: 260, borderWidth: 1, borderColor: colors.divider, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 10 }}>
              {categories.map(category => { const eligible = categoryProductCount(category); const total = categoryTotalCount(category); return <Pressable key={category.id} accessibilityRole="checkbox" accessibilityState={{ checked: categoryIds.includes(category.id), disabled: eligible === 0 }} disabled={eligible === 0} onPress={() => toggle(categoryIds, setCategoryIds, category.id)} style={[s.optionRow, eligible === 0 && s.disabled]}><View style={[s.checkbox, categoryIds.includes(category.id) && s.checked]}>{categoryIds.includes(category.id) && <Ionicons name="checkmark" size={14} color={colors.white}/>}</View><Text style={s.optionText}>{category.parentCategoryId ? `↳ ${category.name}` : category.name} · {total === 0 ? "No active products" : eligible === 0 ? "Already applied" : eligible < total ? `Partially applied · ${eligible} remaining` : `${eligible} products`}</Text></Pressable>; })}
            </ScrollView>}
            {scopeTab === "products" && <><View style={s.searchBox}><Ionicons name="search-outline" size={17} color={colors.muted}/><TextInput value={productSearch} onChangeText={setProductSearch} placeholder="Search products or SKU" style={s.searchInput}/></View>
              <ScrollView nestedScrollEnabled style={s.productOptions}>{visibleProducts.slice(0, 100).map(product => { const applied = appliedCountForProduct(product); const alreadyApplied = applied >= product.variantCount; return <Pressable key={product.id} accessibilityRole="checkbox" accessibilityState={{ checked: productIds.includes(product.id), disabled: alreadyApplied }} disabled={alreadyApplied} onPress={() => toggle(productIds, setProductIds, product.id)} style={[s.optionRow, alreadyApplied && s.disabled]}><View style={[s.checkbox, productIds.includes(product.id) && s.checked]}>{productIds.includes(product.id) && <Ionicons name="checkmark" size={14} color={colors.white}/>}</View><View style={s.productCopy}><Text numberOfLines={1} style={s.optionText}>{product.name}</Text><Text style={s.productMeta}>{product.sku} · {product.categoryName} · {alreadyApplied ? "Already applied" : applied > 0 ? `Partially applied · ${product.variantCount - applied} variants remaining` : "Not applied"}</Text></View></Pressable>; })}{visibleProducts.length > 100 && <Text style={s.productMeta}>Showing first 100 matches. Search to narrow the list.</Text>}{visibleProducts.length === 0 && !applyOptionsLoading && <Text style={s.productMeta}>No products found.</Text>}</ScrollView></>}
          </>}
          <Text style={s.warning}>Applying this replaces any currently active offer on the selected variants. Previous prices remain in price history.</Text>
          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
          {applyResult && <View style={s.successBox}><Text style={s.successText}>Applied to {applyResult.productCount} products and {applyResult.variantCount} variants. {applyResult.scheduledCount ? `${applyResult.scheduledCount} will start on the scheduled date.` : "The discount is active now."}</Text></View>}
        </ScrollView>
        <View style={s.sheetFooter}><Pressable accessibilityRole="button" disabled={saving || applyOptionsLoading || !!applyResult || eligibleProducts.length === 0} onPress={() => void applyDiscount()} style={[s.primaryButton, (saving || applyOptionsLoading || !!applyResult || eligibleProducts.length === 0) && s.disabled]}>{saving || applyOptionsLoading ? <ActivityIndicator color={colors.white}/> : <Text style={s.primaryText}>Apply discount{targetMode === "selected" && categoryIds.length + productIds.length > 0 ? ` · ${categoryIds.length + productIds.length} selections` : ""}</Text>}</Pressable></View>
      </View>
    </PopupSheet>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }, headerCopy: { flex: 1, minWidth: 0 }, title: { color: colors.heading, fontSize: 21, fontWeight: "800" }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 3 }, createButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 11 }, createText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  content: { padding: 14, paddingBottom: 28, gap: 10 }, tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 12, backgroundColor: colors.primaryLight, padding: 12 }, tipText: { flex: 1, color: colors.primaryDark, fontSize: 12, lineHeight: 18 }, notice: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, borderRadius: 10, backgroundColor: colors.successBackground, padding: 10 }, noticeText: { flex: 1, color: colors.successText, fontSize: 12 },
  card: { overflow: "hidden", borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.white }, cardHead: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, paddingVertical: 9 }, percentBadge: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primaryLight }, percentText: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { color: colors.heading, fontSize: 14, fontWeight: "700" }, cardMeta: { color: colors.muted, fontSize: 11, marginTop: 4 }, cardDetail: { gap: 8, borderTopWidth: 1, borderTopColor: colors.divider, padding: 12 }, detailText: { color: colors.secondary, fontSize: 12 }, cardActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }, applyButton: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 9, backgroundColor: colors.primary, paddingHorizontal: 12 }, applyText: { color: colors.white, fontSize: 12, fontWeight: "700" }, archiveButton: { minHeight: 38, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }, archiveText: { color: colors.secondary, fontSize: 12, fontWeight: "600" }, deleteButton: { minHeight: 38, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: "#FECACA", backgroundColor: colors.dangerBackground, paddingHorizontal: 12 }, deleteText: { color: colors.dangerText, fontSize: 12, fontWeight: "600" }, deleteConfirm: { gap: 16, padding: 16 }, deleteConfirmButton: { minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.danger, paddingHorizontal: 14 }, archiveToggle: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, archiveToggleText: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, disabled: { opacity: .5 },
  empty: { alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 14, backgroundColor: colors.white, padding: 24 }, emptyTitle: { color: colors.heading, fontSize: 15, fontWeight: "700" }, emptyText: { color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }, state: { flex: 1, minHeight: 180, alignItems: "center", justifyContent: "center", gap: 9, padding: 22 }, stateText: { color: colors.muted, fontSize: 13, textAlign: "center" }, errorBox: { borderRadius: 9, backgroundColor: colors.dangerBackground, padding: 10 }, errorText: { color: colors.dangerText, fontSize: 12 },
  sheetBody: { flex: 1, minHeight: 0 }, sheetContent: { gap: 10, padding: 14, paddingBottom: 20 }, label: { color: colors.heading, fontSize: 12, fontWeight: "700", marginTop: 4 }, input: { minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 11, color: colors.heading, fontSize: 13 }, percentInputRow: { flexDirection: "row", alignItems: "center", gap: 8 }, percentInput: { width: 90, height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 11, color: colors.heading, fontSize: 14 }, percentSuffix: { color: colors.heading, fontWeight: "700" }, help: { color: colors.muted, fontSize: 11 }, checkRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9 }, checkbox: { width: 19, height: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 5, backgroundColor: colors.white }, checked: { borderColor: colors.primary, backgroundColor: colors.primary }, checkText: { color: colors.secondary, fontSize: 12 }, sheetHint: { borderRadius: 9, backgroundColor: colors.primaryLight, padding: 10, color: colors.primaryDark, fontSize: 11, lineHeight: 17 }, primaryButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 12 }, primaryText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  applySheet: { flex: 1, minHeight: 0 }, discountSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, backgroundColor: colors.primaryLight, padding: 10 }, summaryPercent: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" }, summaryMeta: { color: colors.secondary, fontSize: 10, textAlign: "right" }, modeCard: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, padding: 10 }, modeCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, radio: { width: 19, height: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white }, radioSelected: { borderColor: colors.primary }, radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }, modeCopy: { flex: 1 }, modeTitle: { color: colors.heading, fontSize: 12, fontWeight: "700" }, modeHint: { color: colors.muted, fontSize: 10, marginTop: 3 }, subLabel: { color: colors.heading, fontSize: 11, fontWeight: "700", marginTop: 5 }, optionRow: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 9, borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 6 }, optionText: { flex: 1, color: colors.secondary, fontSize: 12 }, searchBox: { height: 38, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 9 }, searchInput: { flex: 1, color: colors.heading, fontSize: 12, outlineStyle: "none" } as never, productOptions: { maxHeight: 175, borderWidth: 1, borderColor: colors.divider, borderRadius: 9, paddingHorizontal: 8 }, productCopy: { flex: 1, minWidth: 0 }, productMeta: { color: colors.muted, fontSize: 10 }, selectedCount: { color: colors.primaryDark, fontSize: 11, fontWeight: "600" }, warning: { borderRadius: 9, backgroundColor: colors.warningBackground, padding: 10, color: colors.warningText, fontSize: 11, lineHeight: 16 }, sheetFooter: { borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.white, padding: 12 }, successBox: { borderRadius: 9, backgroundColor: colors.successBackground, padding: 10 }, successText: { color: colors.successText, fontSize: 12 },
});
