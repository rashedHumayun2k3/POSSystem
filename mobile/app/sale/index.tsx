import SaleScreen from "../../src/screens/SaleScreen";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { Text } from "../../src/i18n/LocalizedText";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { colors } from "../../src/theme";

export default function SaleRoute() {
  const { session } = useAuth();
  const { t } = useLanguage();
  if (session?.user.canAccessPos === false) {
    return <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{t("posPermission.title")}</Text>
      <Text accessibilityRole="alert" style={styles.message}>{t("posPermission.message")}</Text>
    </View>;
  }
  return <SaleScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: "700", color: colors.heading, textAlign: "center" },
  message: { fontSize: 16, lineHeight: 24, color: colors.secondary, textAlign: "center", maxWidth: 420 },
});
