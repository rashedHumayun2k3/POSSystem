import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../i18n/LocalizedText";
import { useAuth } from "../auth/AuthContext";
import { useModalChrome } from "./ModalChromeContext";
import { colors } from "../theme";

export type CustomerSelection = { id?: string; name: string; phone: string };

export default function CustomerPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (customer: CustomerSelection) => void }) {
  const auth = useAuth(), api = useRef(auth.api); api.current = auth.api;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setBottomNavHidden } = useModalChrome();
  const mobile = width < 768;
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CustomerSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const searchInput = useRef<TextInput>(null);

  useEffect(() => {
    setBottomNavHidden(mobile);
    return () => setBottomNavHidden(false);
  }, [mobile, setBottomNavHidden]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const rows = await api.current<CustomerSelection[]>(`/customers${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
        if (active) setItems(rows);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, auth.session?.businessId]);

  return <Modal visible transparent animationType="fade" onShow={() => { if (mobile && !adding) setTimeout(() => searchInput.current?.focus(), 250); }} onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.keyboardAvoider} behavior="padding" enabled={mobile && Platform.OS === "ios"}>
      <View style={s.overlay}>
        <SafeAreaView style={[s.sheet, s.desktopSheet]}>
          {mobile && <View style={s.handle} />}
          <View style={s.header}>
            <Text style={s.title}>{adding ? "Add Customer" : "Choose Customer"}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}><Text style={s.action}>Close</Text></Pressable>
          </View>
          {!adding && <View style={s.searchBox}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput ref={searchInput} accessibilityLabel="Search customers" placeholder="Search by name or phone" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={s.searchInput} returnKeyType="search" />{!!search && <Pressable accessibilityLabel="Clear customer search" onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable>}</View>}
          {adding ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
            <Text>Customer name *</Text><TextInput accessibilityLabel="Customer name" value={name} onChangeText={setName} style={s.input} />
            <Text>Phone number (optional)</Text><TextInput accessibilityLabel="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={s.input} />
            <Pressable disabled={!name.trim()} onPress={() => onSelect({ name: name.trim(), phone: phone.trim() })} style={[s.button, !name.trim() && s.disabled]}><Text style={s.buttonText}>Use Customer</Text></Pressable>
            <Pressable onPress={() => setAdding(false)}><Text style={s.action}>Back to customers</Text></Pressable>
          </ScrollView> : <>
            <ScrollView style={s.list} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={s.content}>
              {loading ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={s.error}>{error}</Text> : items.length ? items.map(customer => <Pressable key={customer.id ?? customer.phone} onPress={() => onSelect(customer)} style={s.item}><Text style={s.name}>{customer.name}</Text><Text style={s.phone}>{customer.phone}</Text></Pressable>) : <Text style={s.empty}>No customers found.</Text>}
            </ScrollView>
            <View style={s.footer}><Pressable onPress={() => setAdding(true)} style={s.button}><Text style={s.buttonText}>+ Add New Customer</Text></Pressable></View>
          </>}
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const s = StyleSheet.create({
  keyboardAvoider: { flex: 1 }, overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: colors.overlay }, mobileOverlay: { justifyContent: "flex-end", padding: 0 },
  sheet: { width: "100%", backgroundColor: colors.white, overflow: "hidden", borderRadius: 18 }, desktopSheet: { maxWidth: 520, maxHeight: "85%", padding: 16, gap: 12 }, mobileSheet: { maxHeight: "92%", borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingHorizontal: 16 },
  handle: { width: 42, height: 4, alignSelf: "center", marginTop: 9, borderRadius: 2, backgroundColor: colors.divider }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 10 }, title: { fontSize: 18, fontWeight: "700", color: colors.heading },
  searchBox: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, marginTop: 12, backgroundColor: colors.white }, searchInput: { flex: 1, minWidth: 0, color: colors.heading, fontSize: 14 },
  list: { flexShrink: 1, marginTop: 8 }, content: { gap: 4, paddingBottom: 12 }, item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 4 }, name: { fontWeight: "700", color: colors.heading }, phone: { color: colors.secondary, fontSize: 13 }, empty: { color: colors.muted, textAlign: "center", padding: 24 }, error: { color: colors.dangerText, padding: 12 },
  footer: { flexShrink: 0, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, paddingBottom: 8 }, form: { paddingVertical: 14, gap: 12 }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.heading }, action: { color: colors.primaryDark, fontWeight: "600" }, button: { minHeight: 44, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12 }, buttonText: { color: colors.white, fontWeight: "700" }, disabled: { opacity: .5 },
});
