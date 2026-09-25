import { Text } from "../../src/i18n/LocalizedText";
import { colors } from "../../src/theme";import { useState } from "react";
import { router } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProductPicker, {
  type ProductPickerResult,
} from "../../src/components/ProductPicker";

type CartItem = ProductPickerResult & { quantity: number; unitPrice: string };

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
      style={styles.screen}
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
          <Ionicons name="arrow-back" size={21} color={colors.heading} />
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
            <Ionicons name="add" size={17} color={colors.primaryDark} />
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
                <View key={item.variantId} style={styles.selectedProductCard}>
                  <Pressable
                    accessibilityLabel="Remove product"
                    onPress={() =>
                      setCart((items) =>
                        items.filter((entry) => entry.variantId !== item.variantId),
                      )
                    }
                    style={styles.removeProduct}
                  >
                    <Ionicons name="close" size={18} color={colors.muted} />
                  </Pressable>
                  <View style={styles.productIdentityRow}>
                    <View style={styles.productThumbnail}>
                      <Ionicons name="cube-outline" size={30} color={colors.primaryDark} />
                    </View>
                    <View style={styles.productDetails}>
                      <Text style={styles.selectedProductName}>
                        {item.productName}
                      </Text>
                      <Text style={styles.productSku}>SKU: {item.variantSku}</Text>
                      <View style={styles.stockRow}>
                        <Ionicons
                          name="cube-outline"
                          size={14}
                          color={colors.successText}
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
                              entry.variantId === item.variantId
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
                                entry.variantId === item.variantId
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
                          <Ionicons name="remove" size={18} color={colors.secondary} />
                        </Pressable>
                        <Text style={styles.quantityValue}>
                          {item.quantity}
                        </Text>
                        <Pressable
                          accessibilityLabel="Increase quantity"
                          onPress={() =>
                            setCart((items) =>
                              items.map((entry) =>
                                entry.variantId === item.variantId
                                  ? { ...entry, quantity: entry.quantity + 1 }
                                  : entry,
                              ),
                            )
                          }
                          style={styles.quantityButton}
                        >
                          <Ionicons name="add" size={18} color={colors.primaryDark} />
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
            <Ionicons name="cube-outline" size={27} color={colors.muted} />
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
                <Ionicons name="add" size={17} color={colors.primaryDark} />
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
                      <Ionicons name="close" size={23} color={colors.secondary} />
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
                              color={colors.primaryDark}
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
                        placeholderTextColor={colors.muted}
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
                          color={colors.primaryDark}
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
                        placeholderTextColor={colors.muted}
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
                        placeholderTextColor={colors.muted}
                        value={newCustomer.name}
                        onChangeText={(name) =>
                          setNewCustomer((value) => ({ ...value, name }))
                        }
                        style={styles.input}
                      />
                      <TextInput
                        accessibilityLabel="Delivery address"
                        placeholder="Delivery address"
                        placeholderTextColor={colors.muted}
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
                  <Ionicons name="person-outline" size={21} color={colors.primaryDark} />
                </View>
                <View style={styles.customerIdentity}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.customerPhone}>{customer.phone}</Text>
                  <View style={styles.customerLocation}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={colors.primaryDark}
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
                  placeholderTextColor={colors.muted}
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
              <Ionicons name="settings-outline" size={18} color={colors.secondary} />
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
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.noteButtonCopy}>
                <Text style={styles.noteAddTitle}>Add Note</Text>
                <Text style={styles.noteAddHint}>
                  Include delivery or order instructions
                </Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.primaryDark} />
            </Pressable>
          ) : (
            <>
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>Order note</Text>
                <Pressable
                  accessibilityLabel="Remove note"
                  onPress={() => setNoteOpen(false)}
                >
                  <Ionicons name="close" size={20} color={colors.primaryDark} />
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Order note"
                placeholder="Add delivery or order instructions..."
                placeholderTextColor={colors.muted}
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
            const existing = items.find((item) => item.variantId === selected.variantId);
            if (existing) {
              return items.map((item) =>
                item.variantId === selected.variantId
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              );
            }
            return [
              ...items,
              {
                ...selected,
                quantity: 1,
                unitPrice: String(selected.sellingPrice),
              },
            ];
          });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", backgroundColor: colors.white, padding: 16, paddingBottom: 48, gap: 16 },
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: { flex: 1 },
  title: { color: colors.heading, fontSize: 23, fontWeight: "400", letterSpacing: -0.4 },
  subtitle: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    padding: 15,
    gap: 12,
    shadowColor: colors.heading,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: colors.heading, fontSize: 15, fontWeight: "400" },
  selectedCustomerSection: {
    backgroundColor: colors.cardSecondary,
    borderColor: colors.border,
  },
  selectedCustomerSectionTitle: {
    color: colors.primaryDark,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  addText: { color: colors.primaryDark, fontSize: 12, fontWeight: "400" },
  emptyProducts: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
  },
  emptyText: { color: colors.secondary, fontSize: 12 },
  productList: { gap: 12 },
  selectedProductCard: {
    position: "relative",
    gap: 11,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
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
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  productDetails: { flex: 1, minWidth: 0 },
  selectedProductName: { color: colors.heading, fontSize: 15, fontWeight: "400" },
  productSku: { color: colors.muted, fontSize: 11, marginTop: 3 },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  stockText: { color: colors.successText, fontSize: 11, fontWeight: "400" },
  productControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 30,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  controlColumn: { alignItems: "center", gap: 5 },
  controlLabel: { color: colors.secondary, fontSize: 10, fontWeight: "400" },
  priceInput: {
    width: 86,
    height: 36,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    borderRadius: 8,
    backgroundColor: colors.card,
    color: colors.heading,
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonMuted: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    width: 24,
    color: colors.heading,
    fontSize: 15,
    fontWeight: "400",
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
    backgroundColor: colors.primaryDark,
  },
  totalEquation: { color: colors.primaryLight, fontSize: 12 },
  productTotalText: { color: colors.white, fontSize: 15, fontWeight: "400" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 9,
    paddingHorizontal: 11,
    backgroundColor: colors.card,
    color: colors.heading,
    fontSize: 13,
  },
  addressInput: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
  choiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  label: { color: colors.secondary, fontSize: 12 },
  choiceValue: { color: colors.primaryDark, fontSize: 12, fontWeight: "400" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  totalLabel: { color: colors.heading, fontSize: 15, fontWeight: "400" },
  totalValue: { color: colors.primaryDark, fontSize: 22, fontWeight: "400" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    backgroundColor: colors.card,
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
    shadowColor: colors.heading,
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
    borderBottomColor: colors.divider,
  },
  newCustomerLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "400",
    marginTop: 4,
  },
  customerResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 10,
    borderRadius: 9,
    backgroundColor: colors.cardSecondary,
  },
  customerResults: { gap: 7 },
  addNewCustomerButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  addNewCustomerText: { color: colors.primaryDark, fontSize: 13, fontWeight: "400" },
  cancelNewCustomerButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelNewCustomerText: { color: colors.secondary, fontSize: 12, fontWeight: "400" },
  inlineButton: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineButtonText: { color: colors.white, fontSize: 13, fontWeight: "400" },
  disabledButton: { opacity: 0.45 },
  customerSummary: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary,
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  customerIdentity: { flex: 1, minWidth: 0, gap: 2 },
  customerName: { color: colors.heading, fontSize: 14, fontWeight: "400" },
  customerPhone: { color: colors.secondary, fontSize: 12, marginTop: 1 },
  customerLocation: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  customerAddress: { flex: 1, color: colors.secondary, fontSize: 12 },
  newCustomerBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.warningBackground,
    color: colors.warningText,
    fontSize: 10,
    fontWeight: "400",
  },
  changeCustomer: { paddingTop: 2, paddingLeft: 8 },
  changeCustomerText: { color: colors.primaryDark, fontSize: 12, fontWeight: "400" },
  deliveryAddressBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deliveryAddressLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 6,
  },
  deliveryAddressInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.card,
    color: colors.heading,
    fontSize: 13,
    paddingHorizontal: 11,
  },
  orderDetailSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.cardSecondary,
    gap: 10,
  },
  orderDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderDetailTitle: {
    color: colors.primaryDark,
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
    borderColor: colors.divider,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  courierButtonActive: { borderColor: colors.activeBorder, backgroundColor: colors.primaryLight },
  courierButtonText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "400",
    textAlign: "center",
  },
  courierButtonTextActive: { color: colors.primaryDark, fontWeight: "400" },
  paymentCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    backgroundColor: colors.card,
    gap: 13,
  },
  paymentRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentLabel: { flex: 1, color: colors.secondary, fontSize: 13 },
  paymentValue: { color: colors.heading, fontSize: 13, fontWeight: "400" },
  moneyInput: {
    width: 96,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    color: colors.heading,
    fontSize: 13,
    textAlign: "right",
    paddingHorizontal: 9,
  },
  discountAction: { color: colors.primaryDark, fontSize: 13, fontWeight: "400" },
  paymentTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 13,
  },
  paymentTotalLabel: { color: colors.heading, fontSize: 15, fontWeight: "400" },
  paymentTotalValue: { color: colors.primaryDark, fontSize: 18, fontWeight: "400" },
  paymentBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 13,
  },
  balanceValue: { color: colors.dangerText, fontSize: 14, fontWeight: "400" },
  channelSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.cardSecondary,
    gap: 10,
  },
  channelSectionTitle: {
    color: colors.primaryDark,
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
  channelButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  channelButtonInactive: { borderColor: colors.divider, backgroundColor: colors.card },
  channelButtonText: { fontSize: 12, fontWeight: "400" },
  channelButtonTextActive: { color: colors.white },
  channelButtonTextInactive: { color: colors.heading },
  addRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 },
  addRowText: { color: colors.primaryDark, fontSize: 13, fontWeight: "400" },
  noteSection: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.cardSecondary,
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
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  noteButtonCopy: { flex: 1, gap: 2 },
  noteAddTitle: { color: colors.heading, fontSize: 14, fontWeight: "400" },
  noteAddHint: { color: colors.secondary, fontSize: 11 },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteTitle: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "400",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  noteInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    color: colors.heading,
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
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  draftText: { color: colors.primaryDark, fontSize: 14, fontWeight: "400" },
  confirmButton: {
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { color: colors.white, fontSize: 15, fontWeight: "400" },
});
