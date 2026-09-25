import { Text } from "../i18n/LocalizedText";
import { Ionicons } from "@expo/vector-icons";import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

type CategoryField = { id: string; name: string };
export type Category = { id: string; name: string; nameBn?: string | null; defaultUnit?: string | null; parentCategoryId?: string | null; fields: CategoryField[] };
const units = ["pcs", "pair", "set", "dozen", "kg", "gm", "liter", "ml", "meter", "box"];

export default function CategoriesScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ new?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(params.new === "1");
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [parentId, setParentId] = useState("");
  const [picker, setPicker] = useState<"unit" | "parent" | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const isOwner = auth.session?.user.role === "OWNER";

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try { setCategories(await auth.api<Category[]>("/categories")); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [auth.session?.businessId, auth.session?.branchId]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim()) { setError("Name required."); return; }
    setSaving(true); setError("");
    try {
      await auth.api("/categories", { method: "POST", body: JSON.stringify({ name: name.trim(), nameBn: nameBn.trim() || null, defaultUnit: unit, parentCategoryId: parentId || null }) });
      setName(""); setNameBn(""); setUnit("pcs"); setParentId(""); setShowNew(false); await load(true);
    } catch (e) { setError((e as Error).message || "Failed to create category."); }
    finally { setSaving(false); }
  };
  const remove = (category: Category) => Alert.alert("Delete category", `Delete “${category.name}”? This cannot be undone if it has no products.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { setDeleting(category.id); setError(""); try { await auth.api(`/categories/${category.id}`, { method: "DELETE" }); await load(true); } catch (e) { setError((e as Error).message || "Cannot delete this category."); } finally { setDeleting(null); } } },
  ]);
  const top = categories.filter(category => !category.parentCategoryId);
  const selectedParent = top.find(category => category.id === parentId)?.name ?? "None (top-level category)";

  return <View style={s.root}>
    <View style={s.header}><Text style={s.headerTitle}>Categories</Text>{isOwner ? <Pressable onPress={() => setShowNew(value => !value)}><Text style={s.newText}>{showNew ? "Cancel" : "New"}</Text></Pressable> : <View style={s.headerSpacer} />}</View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} colors={[colors.primary]} />}>
      {showNew && <View style={s.form}>
        <TextInput value={name} onChangeText={setName} placeholder="Category name (e.g. Electronics)" placeholderTextColor={colors.muted} style={s.input} />
        <TextInput value={nameBn} onChangeText={setNameBn} placeholder="বাংলা নাম (ঐচ্ছিক) — e.g. ইলেকট্রনিক্স" placeholderTextColor={colors.muted} style={s.input} />
        <View style={s.formRow}><Text style={s.formLabel}>Default unit</Text><Pressable onPress={() => setPicker("unit")} style={s.select}><Text style={s.selectText}>{unit}</Text><Ionicons name="chevron-down" size={17} color={colors.secondary} /></Pressable></View>
        <View style={s.formRow}><Text style={s.formLabel}>Parent category</Text><Pressable onPress={() => setPicker("parent")} style={s.select}><Text numberOfLines={1} style={s.selectText}>{selectedParent}</Text><Ionicons name="chevron-down" size={17} color={colors.secondary} /></Pressable></View>
        <Pressable disabled={saving} onPress={() => void create()} style={[s.primaryButton, saving && s.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.primaryText}>Create Category</Text>}</Pressable>
      </View>}
      {!!error && <View style={s.errorBox}><Text style={s.error}>{error}</Text></View>}
      {loading ? <View style={s.state}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading categories…</Text></View> : !categories.length ? <View style={s.state}><Ionicons name="pricetags-outline" size={38} color={colors.muted} /><Text style={s.muted}>No categories yet.</Text></View> : top.map(parent => <View key={parent.id} style={s.group}>
        <CategoryRow category={parent} owner={isOwner} deleting={deleting === parent.id} onDelete={remove} />
        {categories.filter(category => category.parentCategoryId === parent.id).map(child => <View key={child.id} style={s.subWrap}><CategoryRow category={child} owner={isOwner} deleting={deleting === child.id} onDelete={remove} sub /></View>)}
      </View>)}
    </ScrollView>
    <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}><Pressable style={s.overlay} onPress={() => setPicker(null)}><SafeAreaView style={s.pickerCard}><Text style={s.pickerTitle}>{picker === "unit" ? "Default unit" : "Parent category"}</Text><ScrollView>{picker === "unit" ? units.map(value => <Option key={value} label={value} selected={unit === value} press={() => { setUnit(value); setPicker(null); }} />) : <><Option label="None (top-level category)" selected={!parentId} press={() => { setParentId(""); setPicker(null); }} />{top.map(category => <Option key={category.id} label={category.name} selected={parentId === category.id} press={() => { setParentId(category.id); setPicker(null); }} />)}</>}</ScrollView></SafeAreaView></Pressable></Modal>
  </View>;
}

function CategoryRow({ category, owner, deleting, onDelete, sub }: { category: Category; owner: boolean; deleting: boolean; onDelete: (category: Category) => void; sub?: boolean }) {
  const edit = () => router.push({ pathname: "/more/categories/[id]", params: { id: category.id } });
  return <View style={s.card}><Pressable onPress={edit} style={s.cardCopy}><Text style={s.categoryName}>{sub ? "— " : ""}{category.name}</Text><Text style={s.detail}>{sub ? "Uses parent's fields" : `${category.fields?.length ?? 0} ${(category.fields?.length ?? 0) === 1 ? "field" : "fields"} · default unit: ${category.defaultUnit ?? "pcs"}`}</Text></Pressable>{owner && <View style={s.actions}><Pressable onPress={edit} style={s.editButton}><Text style={s.editText}>Edit</Text></Pressable><Pressable disabled={deleting} onPress={() => onDelete(category)} style={s.deleteButton}>{deleting ? <ActivityIndicator size="small" color={colors.danger} /> : <Text style={s.deleteText}>Delete</Text>}</Pressable></View>}</View>;
}
function Option({ label, selected, press }: { label: string; selected: boolean; press: () => void }) { return <Pressable onPress={press} style={[s.option, selected && s.optionSelected]}><Text style={[s.optionText, selected && s.optionTextSelected]}>{label}</Text>{selected && <Ionicons name="checkmark" size={19} color={colors.primaryDark} />}</Pressable>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.white, paddingHorizontal: 16 }, headerTitle: { flex: 1, color: colors.heading, fontSize: 16, fontWeight: "700" }, headerSpacer: { width: 30 }, newText: { color: colors.primaryDark, fontSize: 14, fontWeight: "600" }, content: { padding: 16, paddingTop: 12, paddingBottom: 30, gap: 10 }, form: { gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSecondary, padding: 16 }, input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.secondaryBorder, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.heading, fontSize: 14, outlineStyle: "none" } as never, formRow: { flexDirection: "row", alignItems: "center", gap: 10 }, formLabel: { width: 98, color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, select: { minHeight: 42, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.secondaryBorder, backgroundColor: colors.white, paddingHorizontal: 11 }, selectText: { flex: 1, color: colors.heading, fontSize: 13 }, primaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, primaryText: { color: colors.white, fontSize: 14, fontWeight: "700" }, disabled: { opacity: .55 }, errorBox: { borderRadius: 10, backgroundColor: colors.dangerBackground, padding: 11 }, error: { color: colors.dangerText, fontSize: 12 }, state: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 }, muted: { color: colors.muted, fontSize: 13 }, group: { gap: 8 }, subWrap: { marginLeft: 20 }, card: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white, padding: 12 }, cardCopy: { flex: 1, minWidth: 0 }, categoryName: { color: colors.heading, fontSize: 14, fontWeight: "600" }, detail: { marginTop: 3, color: colors.muted, fontSize: 12 }, actions: { flexDirection: "row", gap: 8 }, editButton: { minHeight: 30, justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.secondaryBorder, paddingHorizontal: 9 }, editText: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, deleteButton: { minWidth: 54, minHeight: 30, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#FECACA", paddingHorizontal: 8 }, deleteText: { color: colors.danger, fontSize: 12, fontWeight: "500" }, overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: 16 }, pickerCard: { width: "100%", maxWidth: 430, maxHeight: "75%", gap: 8, borderRadius: 18, backgroundColor: colors.white, padding: 16 }, pickerTitle: { color: colors.heading, fontSize: 17, fontWeight: "700", marginBottom: 5 }, option: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 9, paddingHorizontal: 12 }, optionSelected: { backgroundColor: colors.primaryLight }, optionText: { flex: 1, color: colors.heading, fontSize: 14 }, optionTextSelected: { color: colors.primaryDark, fontWeight: "600" },
});
