import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { MEDIA_URL } from "../auth/AuthContext";
import { colors } from "../theme";

// Shared image and title layout from the existing product picker.
export default function ProductIdentity({ name, sku, imageUrl, detail, singleLine = false }: { name: string; sku: string; imageUrl?: string | null; detail?: string; singleLine?: boolean }) {
  const source = !imageUrl ? null : /^https?:\/\//i.test(imageUrl) ? imageUrl : `${MEDIA_URL}${imageUrl}`;
  return <View style={s.row}>{source ? <Image accessibilityLabel={name} source={{ uri: source }} style={s.image} /> : <View style={s.fallback}><Ionicons name="cube-outline" size={22} color={colors.primaryDark} /></View>}<View style={s.copy}><Text numberOfLines={singleLine ? 1 : undefined} style={s.name}>{name}</Text><Text style={s.meta}>{sku}</Text>{detail && <Text style={s.meta}>{detail}</Text>}</View></View>;
}
const s = StyleSheet.create({ row: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }, image: { width: 44, height: 44, borderRadius: 9 }, fallback: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.cardSecondary }, copy: { flex: 1, minWidth: 0 }, name: { color: colors.heading, fontSize: 13, fontWeight: "700" }, meta: { color: colors.muted, fontSize: 10, marginTop: 4 } });
