import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import BrandPicker from "./BrandPicker";

type ProductBrand = { brandId: string | null; brandName: string | null };

export default function ProductBrandField({ productId, editable }: { productId: string; editable: boolean }) {
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
  return <View style={s.card}>
    <Text style={s.label}>{bn ? "ব্র্যান্ডের নাম" : "Brand Name"}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={bn ? "ব্র্যান্ড নির্বাচন করুন" : "Select brand"}
      disabled={!editable || busy || (!brand && !error)} onPress={() => setOpen(true)} style={s.select}>
      <Text>{brand?.brandName ?? (bn ? "ব্র্যান্ড নির্বাচন করুন (ঐচ্ছিক)" : "Select brand (optional)")}</Text>
      {busy || (!brand && !error) ? <ActivityIndicator color={colors.primary} /> : editable ? <Ionicons name="chevron-down" size={18} color={colors.muted} /> : null}
    </Pressable>
    {editable && brand?.brandId && <Pressable disabled={busy} onPress={() => void save(null)} style={s.clear}><Text>{bn ? "ব্র্যান্ড সরিয়ে দিন" : "Clear brand"}</Text></Pressable>}
    {!!error && <Text style={s.error}>{error}</Text>}
    <BrandPicker open={open} onClose={() => setOpen(false)} selectedId={brand?.brandId ?? undefined} onSelect={value => void save(value.id)} />
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 8 },
  label: { color: colors.heading, fontWeight: "600" },
  select: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { alignSelf: "flex-start", paddingVertical: 8 },
  error: { color: colors.danger },
});
