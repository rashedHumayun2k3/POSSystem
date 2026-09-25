import { Text } from "../i18n/LocalizedText";
import { Ionicons } from "@expo/vector-icons";import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "BOOLEAN";
type Field = { id: string; name: string; fieldType: FieldType; optionsJson?: string | null; isRequired: boolean; isVariant: boolean; isPerLot: boolean; sortOrder: number };
type Category = { id: string; name: string; nameBn?: string | null; defaultUnit?: string | null; parentCategoryId?: string | null; parentCategoryName?: string | null; fields: Field[] };
type Picker = { title: string; values: { value: string; label: string }[]; selected: string; select: (value: string) => void } | null;
const units = ["pcs", "pair", "set", "dozen", "kg", "gm", "liter", "ml", "meter", "box"];
const fieldTypes: FieldType[] = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN"];
const blankField = (): Omit<Field, "id"> => ({ name: "", fieldType: "TEXT", optionsJson: null, isRequired: false, isVariant: false, isPerLot: false, sortOrder: 0 });

export default function CategoryDetailScreen() {
  const auth = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [all, setAll] = useState<Category[]>([]);
  const [name, setName] = useState(""); const [nameBn, setNameBn] = useState(""); const [unit, setUnit] = useState("pcs"); const [parentId, setParentId] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [field, setField] = useState<Omit<Field, "id">>(blankField());
  const [picker, setPicker] = useState<Picker>(null);
  const load = useCallback(async () => {
    if (!id) return; setLoading(true); setError("");
    try { const [value, categories] = await Promise.all([auth.api<Category>(`/categories/${id}`), auth.api<Category[]>("/categories")]); setCategory(value); setAll(categories); setName(value.name); setNameBn(value.nameBn ?? ""); setUnit(value.defaultUnit ?? "pcs"); setParentId(value.parentCategoryId ?? ""); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [id, auth.session?.businessId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<void>) => { setSaving(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } };
  const saveMeta = () => run(async () => { if (!name.trim()) throw new Error("Name required."); await auth.api(`/categories/${id}`, { method: "PUT", body: JSON.stringify({ name: name.trim(), nameBn: nameBn.trim() || null, defaultUnit: unit, parentCategoryId: parentId || null }) }); setMessage("Changes saved."); await load(); });
  const submitField = () => run(async () => {
    if (!field.name.trim()) throw new Error("Field name is required.");
    let optionsJson = field.optionsJson?.trim() || null;
    if (field.fieldType === "DROPDOWN" && optionsJson) { try { const parsed = JSON.parse(optionsJson); if (!Array.isArray(parsed)) throw new Error(); } catch { throw new Error("Dropdown options must be a JSON array, for example [\"S\",\"M\",\"L\"]."); } }
    const payload = { ...field, name: field.name.trim(), optionsJson: field.fieldType === "DROPDOWN" ? optionsJson : null };
    await auth.api(`/categories/${id}/fields${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PUT" : "POST", body: JSON.stringify(payload) });
    setField(blankField()); setEditingId(null); setFieldOpen(false); await load();
  });
  const deleteField = (value: Field) => Alert.alert("Delete field", `Delete field “${value.name}”?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void run(async () => { await auth.api(`/categories/${id}/fields/${value.id}`, { method: "DELETE" }); await load(); }) }]);
  const hasChildren = all.some(item => item.parentCategoryId === id);
  const parents = all.filter(item => !item.parentCategoryId && item.id !== id);
  const parentName = all.find(item => item.id === category?.parentCategoryId)?.name ?? category?.parentCategoryName ?? "parent category";

  if (loading && !category) return <View style={s.state}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading category…</Text></View>;
  return <View style={s.root}>
    <View style={s.header}><Text numberOfLines={1} style={s.headerTitle}>{category?.name ?? "Category"}</Text></View>
    <ScrollView contentContainerStyle={s.content}>
      {!!error && <Text style={s.error}>{error}</Text>}{!!message && <Text style={s.success}>{message}</Text>}
      {category && <>
        <View style={s.form}><TextInput value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor={colors.muted} style={s.input} /><TextInput value={nameBn} onChangeText={setNameBn} placeholder="বাংলা নাম (ঐচ্ছিক)" placeholderTextColor={colors.muted} style={s.input} />
          <Select label={unit} press={() => setPicker({ title: "Default unit", values: units.map(value => ({ value, label: value })), selected: unit, select: setUnit })} />
          {!hasChildren && <Select label={parents.find(item => item.id === parentId)?.name ?? "None (top-level category)"} press={() => setPicker({ title: "Parent category", values: [{ value: "", label: "None (top-level category)" }, ...parents.map(item => ({ value: item.id, label: item.name }))], selected: parentId, select: setParentId })} />}
          <Pressable disabled={saving} onPress={() => void saveMeta()} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{saving ? "Saving…" : "Save Changes"}</Text></Pressable>
        </View>
        {category.parentCategoryId ? <View style={s.inherited}><Text style={s.inheritedText}>Uses parent's fields — {parentName}.</Text></View> : <View style={s.fieldsSection}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>Custom Fields</Text><Pressable onPress={() => { setFieldOpen(value => !value); setEditingId(null); setField(blankField()); }}><Text style={s.actionText}>{fieldOpen ? "Cancel" : "Add Field"}</Text></Pressable></View>
          {(fieldOpen || editingId) && <View style={s.form}><TextInput value={field.name} onChangeText={value => setField(current => ({ ...current, name: value }))} placeholder="Field name (e.g. Size, Color)" placeholderTextColor={colors.muted} style={s.input} /><Select label={field.fieldType} press={() => setPicker({ title: "Field type", values: fieldTypes.map(value => ({ value, label: value })), selected: field.fieldType, select: value => setField(current => ({ ...current, fieldType: value as FieldType })) })} />{field.fieldType === "DROPDOWN" && <TextInput value={field.optionsJson ?? ""} onChangeText={value => setField(current => ({ ...current, optionsJson: value }))} placeholder={'Options JSON, e.g. ["S","M","L"]'} placeholderTextColor={colors.muted} multiline style={[s.input, s.optionsInput]} />}<Toggle label="Required" value={field.isRequired} change={value => setField(current => ({ ...current, isRequired: value }))} /><Toggle label="Splits stock" value={field.isVariant} change={value => setField(current => ({ ...current, isVariant: value }))} /><Toggle label="Per-lot" value={field.isPerLot} change={value => setField(current => ({ ...current, isPerLot: value }))} /><Pressable disabled={saving} onPress={() => void submitField()} style={[s.primary, saving && s.disabled]}><Text style={s.primaryText}>{editingId ? "Update Field" : "Add Field"}</Text></Pressable></View>}
          <View style={s.fieldList}>{category.fields.map(value => <View key={value.id} style={s.fieldCard}><View style={s.grow}><Text style={s.fieldName}>{value.name}</Text><View style={s.badges}><Badge text={value.fieldType} />{value.isRequired && <Badge text="Required" danger />}{value.isVariant && <Badge text="Splits stock" />}{value.isPerLot && <Badge text="Per-lot" />}</View>{value.optionsJson && <Text style={s.optionDetail}>Options: {safeOptions(value.optionsJson)}</Text>}</View><View style={s.rowActions}><Pressable onPress={() => { setField({ name: value.name, fieldType: value.fieldType, optionsJson: value.optionsJson, isRequired: value.isRequired, isVariant: value.isVariant, isPerLot: value.isPerLot, sortOrder: value.sortOrder }); setEditingId(value.id); setFieldOpen(false); }} style={s.smallButton}><Text style={s.actionText}>Edit</Text></Pressable><Pressable onPress={() => deleteField(value)} style={s.smallDelete}><Text style={s.deleteText}>Del</Text></Pressable></View></View>)}{!category.fields.length && <Text style={s.empty}>No fields yet. Add fields to collect product-specific attributes.</Text>}</View>
        </View>}
      </>}
    </ScrollView>
    <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}><Pressable style={s.overlay} onPress={() => setPicker(null)}><SafeAreaView style={s.picker}><Text style={s.pickerTitle}>{picker?.title}</Text><ScrollView>{picker?.values.map(option => <Pressable key={option.value || "none"} onPress={() => { picker.select(option.value); setPicker(null); }} style={[s.pickerOption, option.value === picker.selected && s.pickerSelected]}><Text style={s.grow}>{option.label}</Text>{option.value === picker.selected && <Ionicons name="checkmark" size={19} color={colors.primaryDark} />}</Pressable>)}</ScrollView></SafeAreaView></Pressable></Modal>
  </View>;
}

function safeOptions(value: string) { try { const options = JSON.parse(value); return Array.isArray(options) ? options.join(", ") : value; } catch { return value; } }
function Select({ label, press }: { label: string; press: () => void }) { return <Pressable onPress={press} style={s.select}><Text numberOfLines={1} style={s.grow}>{label}</Text><Ionicons name="chevron-down" size={17} color={colors.secondary} /></Pressable>; }
function Toggle({ label, value, change }: { label: string; value: boolean; change: (value: boolean) => void }) { return <View style={s.toggle}><Text style={s.toggleLabel}>{label}</Text><Switch value={value} onValueChange={change} trackColor={{ false: colors.divider, true: colors.highlight }} thumbColor={colors.white} /></View>; }
function Badge({ text, danger }: { text: string; danger?: boolean }) { return <Text style={[s.badge, danger && s.dangerBadge]}>{text}</Text>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.white, paddingHorizontal: 16 }, headerTitle: { flex: 1, color: colors.heading, fontSize: 16, fontWeight: "700" }, content: { padding: 16, paddingBottom: 30, gap: 16 }, form: { gap: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardSecondary, padding: 16 }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.heading, fontSize: 14, outlineStyle: "none" } as never, optionsInput: { minHeight: 70, paddingTop: 11, textAlignVertical: "top" }, select: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 12 }, primary: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary }, primaryText: { color: colors.white, fontSize: 14, fontWeight: "700" }, disabled: { opacity: .55 }, error: { color: colors.dangerText, backgroundColor: colors.dangerBackground, borderRadius: 10, padding: 11, fontSize: 12 }, success: { color: colors.successText, backgroundColor: colors.successBackground, borderRadius: 10, padding: 11, fontSize: 12 }, muted: { color: colors.muted, fontSize: 13 }, inherited: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, backgroundColor: colors.disabled, padding: 16 }, inheritedText: { color: colors.secondary, fontSize: 14 }, fieldsSection: { gap: 12 }, sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: colors.heading, fontSize: 15, fontWeight: "700" }, actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" }, toggle: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, toggleLabel: { color: colors.secondary, fontSize: 13 }, fieldList: { gap: 9 }, fieldCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, backgroundColor: colors.white, padding: 12 }, grow: { flex: 1, minWidth: 0, color: colors.heading }, fieldName: { color: colors.heading, fontSize: 14, fontWeight: "600" }, badges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 }, badge: { color: colors.primaryDark, backgroundColor: colors.primaryLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 }, dangerBadge: { color: colors.dangerText, backgroundColor: colors.dangerBackground }, optionDetail: { color: colors.muted, fontSize: 11, marginTop: 7 }, rowActions: { flexDirection: "row", gap: 6 }, smallButton: { borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, smallDelete: { borderWidth: 1, borderColor: "#FECACA", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, deleteText: { color: colors.danger, fontSize: 12 }, empty: { color: colors.muted, textAlign: "center", paddingVertical: 20, fontSize: 13 }, overlay: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, padding: 16 }, picker: { width: "100%", maxWidth: 430, maxHeight: "75%", borderRadius: 18, backgroundColor: colors.white, padding: 16 }, pickerTitle: { color: colors.heading, fontSize: 17, fontWeight: "700", marginBottom: 8 }, pickerOption: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 9, paddingHorizontal: 11 }, pickerSelected: { backgroundColor: colors.primaryLight },
});

