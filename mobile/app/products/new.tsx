import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NewProductForm from "../../src/components/NewProductForm";
import { Text } from "../../src/i18n/LocalizedText";
import { colors } from "../../src/theme";

export default function NewProductScreen() {
  return <SafeAreaView style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.heading} /></Pressable>
      <Text style={s.title}>Add Product</Text>
    </View>
    <NewProductForm onCreated={product => router.replace({ pathname: "/products/[id]", params: { id: product.id } })} onOpenExisting={product => router.replace({ pathname: "/products/[id]", params: { id: product.id } })} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 36, height: 40, justifyContent: "center" },
  title: { color: colors.heading, fontSize: 18, fontWeight: "700" },
});
