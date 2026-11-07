import DropdownText, { dropdownLabel } from "./DropdownText";
import { productBodyTextStyle } from "./productTypography";
import ProductSectionTitle from "./ProductSectionTitle";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import BrandPicker from "./BrandPicker";

type ProductBrand = { brandId: string | null; brandName: string | null };

export default function ProductBrandField({ productId, editable, compact = false }: { productId: string; editable: boolean; compact?: boolean }) {
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const { lang } = useLanguage();
  const bn = lang === "bn";
  const [brand, setBrand] = useState<ProductBrand | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setBrand(null); setError(""); setOpen(false);
    api.current<ProductBrand>(`/products/${productId}/brand`).then(value => { if (active) setBrand(value); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [productId, auth.session?.businessId]);
  const save = async (brandId: string | null) => {
    if (busy) return;
    setOpen(false); setBusy(true); setError("");
    try { setBrand(await api.current<ProductBrand>(`/products/${productId}/brand`, { method: "PATCH", body: JSON.stringify({ brandId }) })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <View style={compact ? s.compact : s.card}>
    {!compact && <ProductSectionTitle inverse>{bn ? "ব্র্যান্ডের নাম" : "Brand Name"}</ProductSectionTitle>}
    <Pressable accessibilityRole="button" accessibilityLabel={bn ? "ব্র্যান্ড নির্বাচন করুন" : "Select brand"}
      disabled={!editable || busy || (!brand && !error)} onPress={() => setOpen(true)} style={compact ? s.compactSelect : s.select}>
      <DropdownText style={[s.brandValue, productBodyTextStyle]}>{compact && <Text style={{fontWeight:"700"}}>{bn ? "ব্র্যান্ড: " : "Brand: "}</Text>}{dropdownLabel(brand?.brandName, compact ? (bn ? "দেওয়া হয়নি" : "Not set") : (bn ? "ব্র্যান্ড নির্বাচন করুন (ঐচ্ছিক)" : "Select brand (optional)"))}</DropdownText>
      {busy || (!brand && !error) ? <ActivityIndicator color={colors.primary} /> : editable ? <Ionicons name="chevron-down" size={18} color={colors.muted} /> : null}
    </Pressable>
    {editable && brand?.brandId && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void save(null)} style={({ pressed }) => [s.clear, (pressed || busy) && s.clearDimmed]}><Ionicons name="close-circle-outline" size={17} color={colors.danger} /><Text style={[s.clearText, productBodyTextStyle]}>{bn ? "ব্র্যান্ড সরিয়ে দিন" : "Clear brand"}</Text></Pressable>}
    {!!error && <Text style={[s.error, productBodyTextStyle]}>{error}</Text>}
    <BrandPicker open={open} onClose={() => setOpen(false)} selectedId={brand?.brandId ?? undefined} onSelect={value => void save(value.id)} />
  </View>;
}
const s = StyleSheet.create({
  compact: { gap: 6 }, compactSelect: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, brandValue: { color: colors.heading, fontSize: 14, flexShrink: 1 },
  card: { backgroundColor: "#3B0764", borderWidth: 1, borderColor: "#581C87", borderRadius: 12, padding: 16, gap: 8 },
  select: { minHeight: 44, gap: 8, alignSelf: "stretch", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, backgroundColor: colors.white },
  clearText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  clearDimmed: { opacity: 0.55 },
  error: { color: "#FECACA" },
});
