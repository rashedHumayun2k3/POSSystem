import { useState } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductPicker from "../../src/components/ProductPicker";

export default function NewOrderScreen() {
  const [productAdded, setProductAdded] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerAdded, setCustomerAdded] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.titleRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to orders" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={21} color="#263248" />
      </Pressable>
      <View style={styles.titleCopy}>
        <Text style={styles.title}>New Online Order</Text>
        <Text style={styles.subtitle}>Add products, customer details, and payment</Text>
      </View>
    </View>

    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Products</Text><Pressable accessibilityRole="button" accessibilityLabel="Add item" onPress={() => setProductPickerOpen(true)} style={styles.addButton}><Ionicons name="add" size={17} color="#4557d9" /><Text style={styles.addText}>{productAdded ? "Add another" : "Add item"}</Text></Pressable></View>
      {productAdded ? <View style={styles.productRow}><View style={styles.productIcon}><Ionicons name="cube-outline" size={21} color="#4557d9" /></View><View style={styles.productCopy}><Text style={styles.productName}>Selected product</Text><Text style={styles.emptyText}>1 item · ৳850</Text></View><Text style={styles.productTotal}>৳850</Text></View> : <View style={styles.emptyProducts}><Ionicons name="cube-outline" size={27} color="#a7afbd" /><Text style={styles.emptyText}>No items added yet</Text></View>}
    </View>

    {productAdded && <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Customer</Text>{!customerOpen && !customerAdded && <Pressable accessibilityRole="button" accessibilityLabel="Add customer" onPress={() => setCustomerOpen(true)} style={styles.addButton}><Ionicons name="add" size={17} color="#4557d9" /><Text style={styles.addText}>Add Customer</Text></Pressable>}</View>
      {customerOpen && !customerAdded && <><TextInput accessibilityLabel="Customer phone" placeholder="Phone number" placeholderTextColor="#929aaa" keyboardType="phone-pad" style={styles.input} /><TextInput accessibilityLabel="Customer name" placeholder="Customer name" placeholderTextColor="#929aaa" style={styles.input} /><TextInput accessibilityLabel="Delivery address" placeholder="Delivery address" placeholderTextColor="#929aaa" multiline style={[styles.input, styles.addressInput]} /><Pressable accessibilityRole="button" accessibilityLabel="Save customer" onPress={() => { setCustomerAdded(true); setCustomerOpen(false); }} style={styles.inlineButton}><Text style={styles.inlineButtonText}>Save customer</Text></Pressable></>}
      {customerAdded && <View style={styles.savedRow}><Ionicons name="checkmark-circle" size={20} color="#12966f" /><Text style={styles.savedText}>Customer added</Text></View>}
    </View>}

    {customerAdded && <View style={styles.section}>
      {!paymentOpen && <Pressable accessibilityRole="button" accessibilityLabel="Add payment" onPress={() => setPaymentOpen(true)} style={styles.addRow}><Ionicons name="add-circle-outline" size={21} color="#4557d9" /><Text style={styles.addRowText}>Add Payment</Text></Pressable>}
      {paymentOpen && <><Text style={styles.sectionTitle}>Payment</Text><View style={styles.choiceRow}><Text style={styles.label}>Payment terms</Text><Text style={styles.choiceValue}>Cash on delivery</Text></View><View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>৳850</Text></View></>}
      {!noteOpen && <Pressable accessibilityRole="button" accessibilityLabel="Add note" onPress={() => setNoteOpen(true)} style={styles.addRow}><Ionicons name="add-circle-outline" size={21} color="#4557d9" /><Text style={styles.addRowText}>Add Note</Text></Pressable>}
      {noteOpen && <TextInput accessibilityLabel="Order note" placeholder="Order note (optional)" placeholderTextColor="#929aaa" multiline style={[styles.input, styles.noteInput]} />}
    </View>}

    {customerAdded && <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Save order as draft" style={styles.draftButton}><Text style={styles.draftText}>Save as draft</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Confirm order" style={styles.confirmButton}><Text style={styles.confirmText}>Confirm order</Text></Pressable>
    </View>}
    <ProductPicker open={productPickerOpen} onClose={() => setProductPickerOpen(false)} onSelect={() => setProductAdded(true)} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 4 },
  backButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#eef0ff", alignItems: "center", justifyContent: "center" },
  titleCopy: { flex: 1 }, title: { color: "#172033", fontSize: 24, fontWeight: "800" }, subtitle: { color: "#7e899c", fontSize: 12, marginTop: 4 },
  section: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e8ebf1", borderRadius: 14, padding: 14, gap: 11 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: "#172033", fontSize: 16, fontWeight: "800" },
  addButton: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: "#eef0ff" }, addText: { color: "#4557d9", fontSize: 12, fontWeight: "700" },
  emptyProducts: { minHeight: 80, alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, backgroundColor: "#f7f8fc" }, emptyText: { color: "#7e899c", fontSize: 12 },
  productRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, backgroundColor: "#f7f8fc" }, productIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef0ff" }, productCopy: { flex: 1, gap: 3 }, productName: { color: "#263248", fontSize: 13, fontWeight: "700" }, productTotal: { color: "#172033", fontSize: 14, fontWeight: "800" },
  input: { minHeight: 46, borderWidth: 1, borderColor: "#dce1eb", borderRadius: 9, paddingHorizontal: 11, color: "#263248", fontSize: 13 }, addressInput: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" }, choiceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }, label: { color: "#657086", fontSize: 13 }, choiceValue: { color: "#4557d9", fontSize: 13, fontWeight: "700" }, totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#edf0f4", paddingTop: 12 }, totalLabel: { color: "#263248", fontSize: 15, fontWeight: "700" }, totalValue: { color: "#172033", fontSize: 22, fontWeight: "800" },
  inlineButton: { minHeight: 44, borderRadius: 9, backgroundColor: "#4557d9", alignItems: "center", justifyContent: "center" }, inlineButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" }, savedRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7 }, savedText: { color: "#187a5f", fontSize: 13, fontWeight: "700" }, addRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 }, addRowText: { color: "#4557d9", fontSize: 13, fontWeight: "800" }, noteInput: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
  actions: { gap: 9 }, draftButton: { minHeight: 50, borderRadius: 11, borderWidth: 1, borderColor: "#4557d9", alignItems: "center", justifyContent: "center" }, draftText: { color: "#4557d9", fontSize: 14, fontWeight: "800" }, confirmButton: { minHeight: 52, borderRadius: 11, backgroundColor: "#4557d9", alignItems: "center", justifyContent: "center" }, confirmText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});