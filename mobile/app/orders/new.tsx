import { useState } from "react";
import { router } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductPicker, {
  type Product,
} from "../../src/components/ProductPicker";

type CartItem = Product & { quantity: number; unitPrice: string };

const customers = [
  { id: "1", name: "Rahim Ahmed", phone: "01700000001", address: "Dhaka" },
  { id: "2", name: "Karim Hasan", phone: "01800000002", address: "Chattogram" },
];
const channels = [
  "📘 Facebook",
  "💬 WhatsApp",
  "📷 Instagram",
  "📞 Phone",
  "🏪 Shop",
  "🌐 MyWebsite",
  "Other",
] as const;

export default function NewOrderScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [cart, setCart] = useState<CartItem[]>([]);
  const productAdded = cart.length > 0;
  const orderTotal = cart.reduce(
    (total, item) => total + (Number(item.unitPrice) || 0) * item.quantity,
    0,
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [customer, setCustomer] = useState<(typeof customers)[number] | null>(
    null,
  );
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const customerAdded = customer !== null;
  const [deliveryZone, setDeliveryZone] = useState<"inside" | "outside">(
    "outside",
  );
  const [deliveryCharge, setDeliveryCharge] = useState("120");
  const [discount, setDiscount] = useState("0");
  const [showDiscount, setShowDiscount] = useState(false);
  const [advancePayment, setAdvancePayment] = useState("0");
  const [channel, setChannel] =
    useState<(typeof channels)[number]>("📘 Facebook");
  const [noteOpen, setNoteOpen] = useState(false);
  const customerMatches = customerSearch.trim()
    ? customers.filter((customer) =>
        (customer.name + customer.phone)
          .toLowerCase()
          .includes(customerSearch.trim().toLowerCase()),
      )
    : [];
  const payableTotal = Math.max(
    orderTotal + (Number(deliveryCharge) || 0) - (Number(discount) || 0),
    0,
  );
  const remainingBalance = Math.max(
    payableTotal - (Number(advancePayment) || 0),
    0,
  );
  const closeCustomerPicker = () => {
    setCustomerOpen(false);
    setCustomerSearch("");
    setShowNewCustomerForm(false);
    setNewCustomer({ name: "", phone: "", address: "" });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to orders"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={21} color="#263248" />
        </Pressable>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>New Online Order</Text>
          <Text style={styles.subtitle}>
            Add products, customer details, and payment
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Products</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add item"
            onPress={() => setProductPickerOpen(true)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={17} color="#4557d9" />
            <Text style={styles.addText}>
              {productAdded ? "Add another" : "Add item"}
            </Text>
          </Pressable>
        </View>
        {cart.length > 0 ? (
          <View style={styles.productList}>
            {cart.map((item) => {
              const unitPrice = item.unitPrice;
              const quantity = item.quantity;
              const orderTotal = (Number(unitPrice) || 0) * quantity;
              return (
                <View key={item.id} style={styles.selectedProductCard}>
                  <Pressable
                    accessibilityLabel="Remove product"
                    onPress={() =>
                      setCart((items) =>
                        items.filter((entry) => entry.id !== item.id),
                      )
                    }
                    style={styles.removeProduct}
                  >
                    <Ionicons name="close" size={18} color="#9aa3b2" />
                  </Pressable>
                  <View style={styles.productIdentityRow}>
                    <View style={styles.productThumbnail}>
                      <Ionicons name="cube-outline" size={30} color="#4557d9" />
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.selectedProductName}>
                        {item.name}
                      </Text>
                      <Text style={styles.productSku}>SKU: {item.id}</Text>
                      <View style={styles.stockRow}>
                        <Ionicons
                          name="cube-outline"
                          size={14}
                          color="#12966f"
                        />
                        <Text style={styles.stockText}>Available in stock</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.productControls}>
                    <View style={styles.controlColumn}>
                      <Text style={styles.controlLabel}>
                        Price (৳ per piece)
                      </Text>
                      <TextInput
                        accessibilityLabel="Unit price"
                        keyboardType="decimal-pad"
                        value={item.unitPrice}
                        onChangeText={(unitPrice) =>
                          setCart((items) =>
                            items.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, unitPrice }
                                : entry,
                            ),
                          )
                        }
                        style={styles.priceInput}
                      />
                    </View>
                    <View style={styles.controlColumn}>
                      <Text style={styles.controlLabel}>Quantity</Text>
                      <View style={styles.quantityRow}>
                        <Pressable
                          accessibilityLabel="Decrease quantity"
                          onPress={() =>
                            setCart((items) =>
                              items.map((entry) =>
                                entry.id === item.id
                                  ? {
                                      ...entry,
                                      quantity: Math.max(1, entry.quantity - 1),
                                    }
                                  : entry,
                              ),
                            )
                          }
                          style={styles.quantityButtonMuted}
                        >
                          <Ionicons name="remove" size={18} color="#657086" />
                        </Pressable>
                        <Text style={styles.quantityValue}>
                          {item.quantity}
                        </Text>
                        <Pressable
                          accessibilityLabel="Increase quantity"
                          onPress={() =>
                            setCart((items) =>
                              items.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, quantity: entry.quantity + 1 }
                                  : entry,
                              ),
                            )
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons name="add" size={18} color="#4557d9" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  <View style={styles.productTotalBar}>
                    <Text style={styles.totalEquation}>
                      ৳{Number(unitPrice || 0).toLocaleString()} × {quantity}{" "}
                      piece
                      {quantity === 1 ? "" : "s"} =
                    </Text>
                    <Text style={styles.productTotalText}>
                      Total ৳{orderTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyProducts}>
            <Ionicons name="cube-outline" size={27} color="#a7afbd" />
            <Text style={styles.emptyText}>No items added yet</Text>
          </View>
        )}
      </View>

      {productAdded && (
        <View
          style={[styles.section, customer && styles.selectedCustomerSection]}
        >
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                customer && styles.selectedCustomerSectionTitle,
              ]}
            >
              Customer
            </Text>
            {!customerOpen && !customerAdded && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add customer"
                onPress={() => setCustomerOpen(true)}
                style={styles.addButton}
              >
                <Ionicons name="add" size={17} color="#4557d9" />
                <Text style={styles.addText}>Add Customer</Text>
              </Pressable>
            )}
          </View>
          {customerOpen && (
            <Modal
              transparent
              visible
              animationType="fade"
              onRequestClose={closeCustomerPicker}
            >
              <View
                style={[
                  styles.modalBackdrop,
                  isDesktop
                    ? styles.desktopModalBackdrop
                    : styles.mobileModalBackdrop,
                ]}
              >
                <View
                  style={[
                    styles.customerModal,
                    isDesktop
                      ? styles.desktopCustomerModal
                      : styles.mobileCustomerModal,
                  ]}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.sectionTitle}>Select Customer</Text>
                    <Pressable
                      accessibilityLabel="Close customer popup"
                      onPress={closeCustomerPicker}
                    >
                      <Ionicons name="close" size={23} color="#334155" />
                    </Pressable>
                  </View>
                  {!showNewCustomerForm ? (
                    <>
                      <View style={styles.customerResults}>
                        {customerMatches.map((customer) => (
                          <Pressable
                            key={customer.id}
                            onPress={() => {
                              setCustomer(customer);
                              closeCustomerPicker();
                            }}
                            style={styles.customerResult}
                          >
                            <Ionicons
                              name="person-circle-outline"
                              size={26}
                              color="#4557d9"
                            />
                            <View>
                              <Text style={styles.customerName}>
                                {customer.name}
                              </Text>
                              <Text style={styles.emptyText}>
                                {customer.phone}
                              </Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        accessibilityLabel="Search customers"
                        placeholder="Search by phone or name"
                        placeholderTextColor="#929aaa"
                        value={customerSearch}
                        onChangeText={setCustomerSearch}
                        style={styles.input}
                      />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowNewCustomerForm(true)}
                        style={styles.addNewCustomerButton}
                      >
                        <Ionicons
                          name="person-add-outline"
                          size={19}
                          color="#4557d9"
                        />
                        <Text style={styles.addNewCustomerText}>
                          Add New Customer
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Text style={styles.newCustomerLabel}>
                        New customer details
                      </Text>
                      <TextInput
                        accessibilityLabel="Customer phone"
                        placeholder="Phone number"
                        placeholderTextColor="#929aaa"
                        keyboardType="phone-pad"
                        value={newCustomer.phone}
                        onChangeText={(phone) =>
                          setNewCustomer((value) => ({ ...value, phone }))
                        }
                        style={styles.input}
                      />
                      <TextInput
                        accessibilityLabel="Customer name"
                        placeholder="Customer name"
                        placeholderTextColor="#929aaa"
                        value={newCustomer.name}
                        onChangeText={(name) =>
                          setNewCustomer((value) => ({ ...value, name }))
                        }
                        style={styles.input}
                      />
                      <TextInput
                        accessibilityLabel="Delivery address"
                        placeholder="Delivery address"
                        placeholderTextColor="#929aaa"
                        multiline
                        value={newCustomer.address}
                        onChangeText={(address) =>
                          setNewCustomer((value) => ({ ...value, address }))
                        }
                        style={[styles.input, styles.addressInput]}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Save customer"
                        disabled={
                          !newCustomer.name.trim() ||
                          !newCustomer.phone.trim() ||
                          !newCustomer.address.trim()
                        }
                        onPress={() => {
                          setCustomer({
                            id: "new",
                            name: newCustomer.name.trim(),
                            phone: newCustomer.phone.trim(),
                            address: newCustomer.address.trim(),
                          });
                          closeCustomerPicker();
                        }}
                        style={[
                          styles.inlineButton,
                          (!newCustomer.name.trim() ||
                            !newCustomer.phone.trim() ||
                            !newCustomer.address.trim()) &&
                            styles.disabledButton,
                        ]}
                      >
                        <Text style={styles.inlineButtonText}>
                          Save customer
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setShowNewCustomerForm(false);
                          setNewCustomer({ name: "", phone: "", address: "" });
                        }}
                        style={styles.cancelNewCustomerButton}
                      >
                        <Text style={styles.cancelNewCustomerText}>
                          Back to customer search
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            </Modal>
          )}
          {customer && (
            <View style={styles.customerSummary}>
              <View style={styles.customerTopRow}>
                <View style={styles.customerAvatar}>
                  <Ionicons name="person-outline" size={21} color="#059669" />
                </View>
                <View style={styles.customerIdentity}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.customerPhone}>{customer.phone}</Text>
                  <View style={styles.customerLocation}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color="#059669"
                    />
                    <Text numberOfLines={1} style={styles.customerAddress}>
                      {customer.address || "Not provided"}
                    </Text>
                  </View>
                  {customer.id === "new" && (
                    <Text style={styles.newCustomerBadge}>
                      New — to be created
                    </Text>
                  )}
                </View>
                <Pressable
                  accessibilityLabel="Change customer"
                  onPress={() => setCustomerOpen(true)}
                  style={styles.changeCustomer}
                >
                  <Text style={styles.changeCustomerText}>Change</Text>
                </Pressable>
              </View>
              <View style={styles.deliveryAddressBlock}>
                <Text style={styles.deliveryAddressLabel}>
                  Delivery address
                </Text>
                <TextInput
                  accessibilityLabel="Delivery address"
                  placeholder="Enter delivery address"
                  placeholderTextColor="#929aaa"
                  value={customer.address}
                  onChangeText={(address) =>
                    setCustomer({ ...customer, address })
                  }
                  style={styles.deliveryAddressInput}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {customerAdded && (
        <View style={styles.channelSection}>
          <Text style={styles.channelSectionTitle}>Channel</Text>
          <View style={styles.channelOptions}>
            {channels.map((option) => {
              const selected = channel === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setChannel(option)}
                  style={[
                    styles.channelButton,
                    selected
                      ? styles.channelButtonActive
                      : styles.channelButtonInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.channelButtonText,
                      selected
                        ? styles.channelButtonTextActive
                        : styles.channelButtonTextInactive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {customerAdded && (
        <View style={styles.orderDetailSection}>
          <View style={styles.orderDetailHeader}>
            <Text style={styles.orderDetailTitle}>Courier service</Text>
            <Pressable
              accessibilityLabel="Manage couriers"
              style={styles.manageCourierButton}
            >
              <Ionicons name="settings-outline" size={18} color="#4b5563" />
            </Pressable>
          </View>
          <View style={styles.courierOptions}>
            <Pressable
              onPress={() => {
                setDeliveryZone("inside");
                setDeliveryCharge("60");
              }}
              style={[
                styles.courierButton,
                deliveryZone === "inside" && styles.courierButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.courierButtonText,
                  deliveryZone === "inside" && styles.courierButtonTextActive,
                ]}
              >
                Within Dhaka · ৳60
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setDeliveryZone("outside");
                setDeliveryCharge("120");
              }}
              style={[
                styles.courierButton,
                deliveryZone === "outside" && styles.courierButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.courierButtonText,
                  deliveryZone === "outside" && styles.courierButtonTextActive,
                ]}
              >
                Outside Dhaka · ৳120
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {customerAdded && (
        <View style={styles.orderDetailSection}>
          {false && (
            <>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.choiceRow}>
                <Text style={styles.label}>Payment terms</Text>
                <Text style={styles.choiceValue}>Cash on delivery</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  ৳{orderTotal.toLocaleString()}
                </Text>
              </View>
            </>
          )}
          <Text style={styles.orderDetailTitle}>Payment</Text>
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>
                Subtotal ({cart.length} product{cart.length === 1 ? "" : "s"})
              </Text>
              <Text style={styles.paymentValue}>
                {"\u09F3"}
                {orderTotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>
                Delivery charge ({"\u09F3"})
              </Text>
              <TextInput
                accessibilityLabel="Delivery charge"
                keyboardType="decimal-pad"
                value={deliveryCharge}
                onChangeText={setDeliveryCharge}
                style={styles.moneyInput}
              />
            </View>
            <Pressable
              onPress={() => setShowDiscount((value) => !value)}
              style={styles.paymentRow}
            >
              <Text style={styles.paymentLabel}>Additional discount</Text>
              <Text style={styles.discountAction}>
                {showDiscount ? "Hide discount" : "Add discount"}
              </Text>
            </Pressable>
            {showDiscount && (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Discount ({"\u09F3"})</Text>
                <TextInput
                  accessibilityLabel="Additional discount"
                  keyboardType="decimal-pad"
                  value={discount}
                  onChangeText={setDiscount}
                  style={styles.moneyInput}
                />
              </View>
            )}
            <View style={styles.paymentTotalRow}>
              <Text style={styles.paymentTotalLabel}>Total (COD)</Text>
              <Text style={styles.paymentTotalValue}>
                {"\u09F3"}
                {payableTotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>
                Advance payment ({"\u09F3"})
              </Text>
              <TextInput
                accessibilityLabel="Advance payment"
                keyboardType="decimal-pad"
                value={advancePayment}
                onChangeText={setAdvancePayment}
                style={styles.moneyInput}
              />
            </View>
            <View style={styles.paymentBalanceRow}>
              <Text style={styles.paymentLabel}>The rest</Text>
              <Text style={styles.balanceValue}>
                {"\u09F3"}
                {remainingBalance.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {customerAdded && (
        <View style={styles.noteSection}>
          {!noteOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add note"
              onPress={() => setNoteOpen(true)}
              style={styles.noteAddButton}
            >
              <View style={styles.noteIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#b45309"
                />
              </View>
              <View style={styles.noteButtonCopy}>
                <Text style={styles.noteAddTitle}>Add Note</Text>
                <Text style={styles.noteAddHint}>
                  Include delivery or order instructions
                </Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color="#b45309" />
            </Pressable>
          ) : (
            <>
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>Order note</Text>
                <Pressable
                  accessibilityLabel="Remove note"
                  onPress={() => setNoteOpen(false)}
                >
                  <Ionicons name="close" size={20} color="#92400e" />
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Order note"
                placeholder="Add delivery or order instructions..."
                placeholderTextColor="#a16207"
                multiline
                style={styles.noteInput}
              />
            </>
          )}
        </View>
      )}

      {customerAdded && (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save order as draft"
            style={styles.draftButton}
          >
            <Text style={styles.draftText}>Save as draft</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm order"
            style={styles.confirmButton}
          >
            <Text style={styles.confirmText}>Confirm order</Text>
          </Pressable>
        </View>
      )}
      <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(selected) => {
          setCart((items) => {
            const existing = items.find((item) => item.id === selected.id);
            if (existing) {
              return items.map((item) =>
                item.id === selected.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              );
            }
            return [
              ...items,
              {
                ...selected,
                quantity: 1,
                unitPrice: selected.price.replace(/[^\d.]/g, ""),
              },
            ];
          });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 4,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: { flex: 1 },
  title: { color: "#172033", fontSize: 24, fontWeight: "400" },
  subtitle: { color: "#7e899c", fontSize: 12, marginTop: 4 },
  section: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e8ebf1",
    borderRadius: 14,
    padding: 14,
    gap: 11,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: "#172033", fontSize: 16, fontWeight: "400" },
  selectedCustomerSection: {
    backgroundColor: "#f3f4f6",
    borderColor: "#9ca3af",
  },
  selectedCustomerSectionTitle: {
    color: "#9ca3af",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#eef0ff",
  },
  addText: { color: "#4557d9", fontSize: 12, fontWeight: "700" },
  emptyProducts: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 10,
    backgroundColor: "#f7f8fc",
  },
  emptyText: { color: "#7e899c", fontSize: 12 },
  productList: { gap: 12 },
  selectedProductCard: {
    position: "relative",
    gap: 11,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#dfe3ff",
    backgroundColor: "#f4f6ff",
  },
  removeProduct: {
    position: "absolute",
    zIndex: 1,
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  productIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 28,
  },
  productThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dfe3ff",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  productDetails: { flex: 1, minWidth: 0 },
  selectedProductName: { color: "#3849b9", fontSize: 15, fontWeight: "400" },
  productSku: { color: "#929aaa", fontSize: 11, marginTop: 3 },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  stockText: { color: "#12966f", fontSize: 12, fontWeight: "400" },
  productControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 30,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: "#e4e8ff",
  },
  controlColumn: { alignItems: "center", gap: 5 },
  controlLabel: { color: "#7e899c", fontSize: 11 },
  priceInput: {
    width: 86,
    height: 36,
    borderWidth: 1,
    borderColor: "#d3d8e2",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#263248",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    paddingHorizontal: 7,
  },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#cfd5ff",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonMuted: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    width: 24,
    color: "#263248",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  productTotalBar: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#9a3412",
  },
  totalEquation: { color: "#fed7aa", fontSize: 13 },
  productTotalText: { color: "#fff", fontSize: 15, fontWeight: "400" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#dce1eb",
    borderRadius: 9,
    paddingHorizontal: 11,
    color: "#263248",
    fontSize: 13,
  },
  addressInput: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
  choiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  label: { color: "#657086", fontSize: 13 },
  choiceValue: { color: "#4557d9", fontSize: 13, fontWeight: "700" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#edf0f4",
    paddingTop: 12,
  },
  totalLabel: { color: "#263248", fontSize: 15, fontWeight: "700" },
  totalValue: { color: "#172033", fontSize: 22, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#17203385",
  },
  mobileModalBackdrop: { justifyContent: "flex-end" },
  desktopModalBackdrop: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  customerModal: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    padding: 16,
    gap: 11,
    overflow: "hidden",
  },
  mobileCustomerModal: {
    maxHeight: "90%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
  },
  desktopCustomerModal: {
    maxHeight: "85%",
    borderRadius: 18,
    paddingBottom: 20,
    shadowColor: "#172033",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#edf0f4",
  },
  newCustomerLabel: {
    color: "#4557d9",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  customerResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
    borderRadius: 9,
    backgroundColor: "#f7f8fc",
  },
  customerResults: { gap: 7 },
  addNewCustomerButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#cfd5ff",
    borderRadius: 10,
    backgroundColor: "#eef0ff",
  },
  addNewCustomerText: { color: "#4557d9", fontSize: 13, fontWeight: "800" },
  cancelNewCustomerButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelNewCustomerText: { color: "#657086", fontSize: 12, fontWeight: "700" },
  inlineButton: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: "#4557d9",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  customerSummary: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  customerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
  },
  customerIdentity: { flex: 1, minWidth: 0, gap: 2 },
  customerName: { color: "#064e3b", fontSize: 14, fontWeight: "800" },
  customerPhone: { color: "#047857", fontSize: 12, marginTop: 1 },
  customerLocation: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  customerAddress: { flex: 1, color: "#059669", fontSize: 12 },
  newCustomerBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fef3c7",
    color: "#b45309",
    fontSize: 10,
    fontWeight: "700",
  },
  changeCustomer: { paddingTop: 2, paddingLeft: 8 },
  changeCustomerText: { color: "#047857", fontSize: 12, fontWeight: "800" },
  deliveryAddressBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#d1fae5",
  },
  deliveryAddressLabel: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  deliveryAddressInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 9,
    backgroundColor: "#fff",
    color: "#263248",
    fontSize: 13,
    paddingHorizontal: 11,
  },
  orderDetailSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    gap: 10,
  },
  orderDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderDetailTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  manageCourierButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  courierOptions: { flexDirection: "row", gap: 8 },
  courierButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  courierButtonActive: { borderColor: "#818cf8", backgroundColor: "#eef2ff" },
  courierButtonText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  courierButtonTextActive: { color: "#4338ca", fontWeight: "800" },
  paymentCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    gap: 13,
  },
  paymentRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentLabel: { flex: 1, color: "#6b7280", fontSize: 13 },
  paymentValue: { color: "#111827", fontSize: 13, fontWeight: "700" },
  moneyInput: {
    width: 96,
    height: 38,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111827",
    fontSize: 13,
    textAlign: "right",
    paddingHorizontal: 9,
  },
  discountAction: { color: "#4f46e5", fontSize: 13, fontWeight: "700" },
  paymentTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 13,
  },
  paymentTotalLabel: { color: "#111827", fontSize: 15, fontWeight: "800" },
  paymentTotalValue: { color: "#4338ca", fontSize: 16, fontWeight: "800" },
  paymentBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 13,
  },
  balanceValue: { color: "#dc2626", fontSize: 14, fontWeight: "800" },
  channelSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#9ca3af",
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    gap: 10,
  },
  channelSectionTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  channelOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  channelButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 12,
  },
  channelButtonActive: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  channelButtonInactive: { borderColor: "#9ca3af", backgroundColor: "#d1d5db" },
  channelButtonText: { fontSize: 12, fontWeight: "700" },
  channelButtonTextActive: { color: "#fff" },
  channelButtonTextInactive: { color: "#111827" },
  addRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 },
  addRowText: { color: "#4557d9", fontSize: 13, fontWeight: "800" },
  noteSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 14,
    backgroundColor: "#fffbeb",
    gap: 10,
  },
  noteAddButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  noteIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  noteButtonCopy: { flex: 1, gap: 2 },
  noteAddTitle: { color: "#92400e", fontSize: 14, fontWeight: "400" },
  noteAddHint: { color: "#b45309", fontSize: 11 },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteTitle: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "400",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  noteInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#78350f",
    fontSize: 13,
    paddingHorizontal: 11,
    paddingTop: 11,
    textAlignVertical: "top",
  },
  actions: { gap: 9 },
  draftButton: {
    minHeight: 50,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#4557d9",
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: { color: "#4557d9", fontSize: 14, fontWeight: "800" },
  confirmButton: {
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: "#4557d9",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
