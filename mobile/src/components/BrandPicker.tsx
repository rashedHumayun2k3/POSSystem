import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";
export type BrandResult = { id: string; name: string };
export default function BrandPicker({ open, onClose, onSelect, selectedId }: { open: boolean; onClose: () => void; onSelect: (brand: BrandResult) => void; selectedId?: string }) {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const [brands, setBrands] = useState<BrandResult[]>([]); const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return; let live = true; setQuery(""); setAddOpen(false); setName(""); setError(""); setLoading(true);
    api.current<BrandResult[]>("/brands").then(rows => { if (live) setBrands(rows); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, auth.session?.businessId]);
  const create = async () => {
    if (saving || !name.trim()) return; setSaving(true); setError("");
    try { const brand = await api.current<BrandResult>("/brands", { method: "POST", body: JSON.stringify({ name: name.trim() }) }); setAddOpen(false); onSelect(brand); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  return <><PopupSheet visible={open && !addOpen} onClose={onClose} title="Choose Brand"
    headerAction={auth.session?.user.role === "OWNER" ? <Pressable accessibilityRole="button" onPress={() => { setName(""); setError(""); setAddOpen(true); }} style={s.headerAction}><Text style={s.headerActionText}>+ Add New brand</Text></Pressable> : undefined}>
    <View style={s.body}><TextInput accessibilityLabel="Search brand" placeholder="Search brand" value={query} onChangeText={setQuery} maxLength={200} style={s.input} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {loading ? <ActivityIndicator color={colors.primary} /> : <ScrollView keyboardShouldPersistTaps="handled">{brands.filter(b => b.name.toLowerCase().includes(query.trim().toLowerCase())).map(b => <Pressable key={b.id} accessibilityRole="button" disabled={saving} onPress={() => onSelect(b)} style={s.row}><Text>{b.name}{b.id === selectedId ? " ✓" : ""}</Text></Pressable>)}</ScrollView>}

    </View>
  </PopupSheet>
  <PopupSheet visible={open && addOpen} onClose={() => { if (!saving) { setAddOpen(false); setError(""); } }} title="Add New brand">
    <View style={s.body}><Text>Brand name *</Text><TextInput accessibilityLabel="Brand name" placeholder="Enter brand name" value={name} onChangeText={setName} editable={!saving} maxLength={200} style={s.input} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={saving || !name.trim()} onPress={() => void create()} style={[s.save, (saving || !name.trim()) && { opacity: 0.5 }]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveText}>Save Brand</Text>}</Pressable>
    </View>
  </PopupSheet></>;
}
const s = StyleSheet.create({ headerAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }, headerActionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" }, save: { minHeight: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 10 }, saveText: { color: colors.white, fontWeight: "700" }, body: { flex: 1, padding: 16, gap: 12 }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.heading }, row: { minHeight: 48, justifyContent: "center", padding: 12, borderBottomWidth: 1, borderColor: colors.divider }, error: { color: colors.dangerText } });

