import { Stack, Link, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../src/components/AppHeader";

const APP_BACKGROUND = "#fff";

const tabs = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Orders", icon: "receipt", href: "/orders" },
  { label: "POS", icon: "cart" },
  { label: "Products", icon: "cube" },
  { label: "More", icon: "menu" },
] as const;

function AppShell() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  return <SafeAreaView style={s.shell} edges={["top", "left", "right"]}>
    <StatusBar style="dark" />
    <AppHeader />
    <View style={s.screen}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: APP_BACKGROUND } }} /></View>
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map(tab => {
        const href = "href" in tab ? tab.href : undefined;
        const active = href === "/" ? path === "/" : !!href && path.startsWith(href);
        const icon = `${tab.icon}${active ? "" : "-outline"}` as keyof typeof Ionicons.glyphMap;
        const content = <><View style={[s.icon, active && s.activeIcon, tab.label === "POS" && s.pos]}><Ionicons name={icon} size={23} color={tab.label === "POS" ? "#fff" : active ? "#4557d9" : "#929aaa"} /></View><Text style={[s.label, active && s.activeLabel]}>{tab.label}</Text></>;
        return href ? <Link key={tab.label} href={href} accessibilityLabel={tab.label} asChild><Pressable accessibilityState={{ selected: active }} style={s.tab}>{content}</Pressable></Link> : <View key={tab.label} accessibilityLabel={`${tab.label}, coming soon`} accessibilityState={{ disabled: true }} style={s.tab}>{content}</View>;
      })}
    </View>
  </SafeAreaView>;
}

export default function RootLayout() {
  return <SafeAreaProvider style={s.background}><AppShell /></SafeAreaProvider>;
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: APP_BACKGROUND },
  shell: { flex: 1, width: "100%", maxWidth: 768, alignSelf: "center", backgroundColor: APP_BACKGROUND },
  screen: { flex: 1, minHeight: 0 },
  bar: { flexDirection: "row", paddingTop: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e8ebf1" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 53 },
  icon: { width: 42, height: 30, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  activeIcon: { backgroundColor: "#eef0ff" },
  pos: { backgroundColor: "#4557d9", height: 40, width: 46, borderRadius: 20 },
  label: { fontSize: 10, color: "#929aaa", fontWeight: "600" },
  activeLabel: { color: "#4557d9" },
});
