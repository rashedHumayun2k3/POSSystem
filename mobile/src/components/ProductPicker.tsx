import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

export type Product = { id: string; name: string; price: string };
type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
};

const products: Product[] = [
  { id: "cotton-t-shirt", name: "Cotton T-Shirt", price: "৳850" },
  { id: "running-shoe", name: "Running Shoe", price: "৳2,400" },
  { id: "sports-cap", name: "Sports Cap", price: "৳450" },
];

export default function ProductPicker({ open, onClose, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const isDesktop = width >= 768;
  const results = products.filter((product) =>
    product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          isDesktop ? styles.desktopBackdrop : styles.mobileBackdrop,
        ]}
      >
        <View
          style={[
            styles.panel,
            isDesktop ? styles.desktopPanel : styles.mobilePanel,
          ]}
        >
          <View style={styles.handle}>
            <View style={styles.handleBar} />
          </View>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close product picker"
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={23} color="#334155" />
            </Pressable>
            <Text style={styles.title}>Choose Product</Text>
            <View style={styles.headerSpacer} />
          </View>
          <KeyboardAvoidingView
            style={styles.body}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Text style={styles.sectionLabel}>
              {search ? "Search results" : "Recently used"}
            </Text>
            <ScrollView
              style={styles.productList}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
            >
              {results.map((product) => (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${product.name}`}
                  onPress={() => {
                    onSelect(product);
                    setSearch("");
                    onClose();
                  }}
                  style={styles.row}
                >
                  <View style={styles.productIcon}>
                    <Ionicons name="cube-outline" size={20} color="#4557d9" />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.meta}>Available · {product.price}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#929aaa" />
                </Pressable>
              ))}
              {results.length === 0 && (
                <Text style={styles.empty}>No products found.</Text>
              )}
            </ScrollView>
            <View style={styles.searchFooter}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={19} color="#929aaa" />
                <TextInput
                  accessibilityLabel="Search products"
                  autoFocus
                  placeholder="Search product or scan barcode"
                  placeholderTextColor="#929aaa"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode"
                  style={styles.scan}
                >
                  <Ionicons name="scan-outline" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(23, 32, 51, 0.52)" },
  mobileBackdrop: { justifyContent: "flex-end" },
  desktopBackdrop: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  panel: { backgroundColor: "#fff", overflow: "hidden" },
  mobilePanel: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  desktopPanel: {
    width: "100%",
    maxWidth: 520,
    height: "85%",
    borderRadius: 18,
    shadowColor: "#172033",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  handle: { alignItems: "center", paddingTop: 11, paddingBottom: 3 },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#dce1eb",
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f4",
  },
  close: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: "#172033",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center",
  },
  headerSpacer: { width: 36 },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
  productList: { flex: 1 },
  searchFooter: {
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#edf0f4",
  },
  searchBox: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 11,
    borderWidth: 1,
    borderColor: "#dce1eb",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    color: "#263248",
    fontSize: 13,
    borderWidth: 0,
    borderColor: "transparent",
    outlineWidth: 0,
  },
  scan: {
    width: 42,
    height: 42,
    marginRight: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4557d9",
  },
  sectionLabel: {
    color: "#929aaa",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  list: { paddingBottom: 10 },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f4",
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef0ff",
  },
  copy: { flex: 1, gap: 3 },
  productName: { color: "#263248", fontSize: 13, fontWeight: "700" },
  meta: { color: "#7e899c", fontSize: 11 },
  empty: {
    color: "#7e899c",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 28,
  },
});
