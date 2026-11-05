import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { MEDIA_URL } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

export default function ExpenseDocumentLink({ url }: { url?: string | null }) {
  const { lang } = useLanguage();
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  const href = /^https?:\/\//i.test(url) ? url : url.startsWith("/uploads/") ? `${MEDIA_URL}${url}` : null;
  if (!href) return null;
  return <View><Pressable accessibilityRole="link" onPress={event => {
    event.stopPropagation(); setFailed(false);
    void Linking.openURL(href).catch(() => setFailed(true));
  }} style={{ paddingVertical: 10 }}><Text style={{ color: colors.primary, fontWeight: "700" }}>{lang === "bn" ? "খরচের স্লিপ / ডকুমেন্ট দেখুন" : "View expense slip / document"}</Text></Pressable>
    {failed && <Text>{lang === "bn" ? "ডকুমেন্ট খোলা যায়নি। আবার চেষ্টা করুন।" : "Could not open document. Please try again."}</Text>}
  </View>;
}
