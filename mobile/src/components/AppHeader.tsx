import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import UserAvatar from "./UserAvatar";
import TaskBell from "../tasks/TaskBell";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

export default function AppHeader({ onMenuPress }: { onMenuPress?: () => void }) {
  const auth = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const { width } = useWindowDimensions();
  const mobile = width < 768;
  const photo = auth.session?.user.photoUrl;
  return <View style={s.header}>
    {mobile ? <View style={s.mobileBrand}><Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onMenuPress} style={s.menuButton}><Ionicons name="menu" size={27} color={colors.heading} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Go to Home" onPress={() => router.replace("/")}><Image source={require("../../assets/logo.png")} resizeMode="contain" style={s.mobileLogo} /></Pressable></View> : <Pressable accessibilityRole="button" accessibilityLabel="Go to Home" onPress={() => router.replace("/")}><Image source={require("../../assets/logo.png")} resizeMode="contain" style={s.logo} /></Pressable>}
    <View style={s.actions}>
      <View accessibilityLabel="Online" style={s.online} />
      <Pressable onPress={toggleLang} accessibilityRole="button" accessibilityLabel={t("Switch language")} style={s.language}><Text style={s.languageText}>{lang === "bn" ? "EN" : "বাং"}</Text></Pressable>
      <TaskBell />
      <Pressable accessibilityRole="button" accessibilityLabel={t("profile.title")} onPress={() => router.push("/profile")}>
        <UserAvatar name={auth.session?.user.name ?? ""} photoUrl={photo} />
      </Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  header: { height: 56, paddingHorizontal: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: "row", alignItems: "center", gap: 12 },
  menuButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.cardSecondary },
  mobileBrand: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
  mobileLogo: { width: 105, height: 36 },
  logo: { width: 152, height: 44 },
  actions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 12 },
  online: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  language: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  languageText: { color: colors.primary, fontSize: 12, lineHeight: 13, fontWeight: "600" },
  icon: { padding: 2 },
});
