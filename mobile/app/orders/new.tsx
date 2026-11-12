import ProcessGuide from "../../src/components/ProcessGuide";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { Text } from "../../src/i18n/LocalizedText";
import { useAuth } from "../../src/auth/AuthContext";
import { colors } from "../../src/theme";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import PopupSheet from "../../src/components/PopupSheet";
import { WALLETS, type Wallet } from "../../src/components/AdvanceRefundChoice";
import { decimalInput } from "../../src/utils/numericInput";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Text as PlainText,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import ProductPicker, {
  type ProductPickerResult,
} from "../../src/components/ProductPicker";
import OrderCustomerPicker, {
  type OrderCustomer,
} from "../../src/components/OrderCustomerPicker";
import PageTitle from "../../src/components/PageTitle";

type CartItem = ProductPickerResult & { quantity: number; unitPrice: string };
type OrderBranch = { id: string; name: string; isActive: boolean };
const channels = [
  "📘 Facebook",
  "💬 WhatsApp",
  "📷 Instagram",
  "📞 Phone",
  "🏪 Shop",
  "🌐 MyWebsite",
  "Other",
] as const;

const taka = (n: number) => `৳${Number((Number(n) || 0).toFixed(2)).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

// Shows an amount as text with a pencil; tap to edit inline, ✓ to finish.
function AmountRow({ label, value, onChange, minus = false, addLabel }: { label: string; value: string; onChange: (v: string) => void; minus?: boolean; addLabel?: string }) {
  const [editing, setEditing] = useState(false);
  const amount = Number(value) || 0;
  if (editing) return <View style={styles.paymentRow}>
    <Text style={styles.paymentLabel}>{label}</Text>
    <TextInput autoFocus keyboardType="decimal-pad" value={value} onChangeText={v => onChange(decimalInput(v))} onSubmitEditing={() => setEditing(false)} onBlur={() => setEditing(false)} selectTextOnFocus style={styles.moneyInput} accessibilityLabel={label} />
    <Pressable accessibilityLabel="Done" hitSlop={8} onPress={() => setEditing(false)} style={styles.editIcon}><Ionicons name="checkmark" size={18} color={colors.primaryDark} /></Pressable>
  </View>;
  if (!amount && addLabel) return <Pressable onPress={() => setEditing(true)} style={styles.paymentRow}><Text style={styles.paymentLabel}>{label}</Text><Text style={styles.discountAction}>{addLabel}</Text></Pressable>;
  return <Pressable accessibilityLabel={`Edit ${label}`} onPress={() => setEditing(true)} style={styles.paymentRow}>
    <Text style={styles.paymentLabel}>{label}</Text>
    <Text style={styles.paymentValue}>{minus && amount ? "− " : ""}{taka(amount)}</Text>
    <Ionicons name="create-outline" size={16} color={colors.primaryDark} style={styles.editIcon} />
  </Pressable>;
}

// Numbered section heading; the number turns into a green tick once the section is filled.
function StepTitle({ n, done, title }: { n: number; done?: boolean; title: string }) {
  return <View style={styles.stepTitle}>
    <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>{done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : <Text style={styles.stepBadgeText}>{n}</Text>}</View>
    <Text style={styles.stepTitleText}>{title}</Text>
  </View>;
}

export default function NewOrderScreen() {
  const auth = useAuth();
  const { lang } = useLanguage();
  const [showSteps, setShowSteps] = useState(true);
  const [branches, setBranches] = useState<OrderBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState("");
  const [branchReload, setBranchReload] = useState(0);
  const [orderBranchId, setOrderBranchId] = useState<string | null>(auth.session?.branchId ?? null);
  useEffect(() => {
    let active = true;
    setBranchesError("");
    const selectedBranchId = auth.session?.branchId;
    if (selectedBranchId) {
      setOrderBranchId(selectedBranchId);
      setBranches([{ id: selectedBranchId, name: auth.session?.branchName ?? "Selected branch", isActive: true }]);
      setBranchesLoading(false);
      return () => { active = false; };
    }
    setOrderBranchId(null);
    setBranchesLoading(true);
    auth.api<OrderBranch[]>("/branches/mine").then(rows => {
      if (!active) return;
      const activeBranches = (rows || []).filter(branch => branch.isActive !== false);
      setBranches(activeBranches);
      const headerBranchId = auth.session?.branchId;
      setOrderBranchId(current => headerBranchId && activeBranches.some(branch => branch.id === headerBranchId)
        ? headerBranchId
        : current && activeBranches.some(branch => branch.id === current)
          ? current
          : activeBranches.length === 1 ? activeBranches[0].id : null);
    }).catch(error => { if (active) setBranchesError((error as Error).message || "Could not load branches."); })
      .finally(() => { if (active) setBranchesLoading(false); });
    return () => { active = false; };
  }, [auth.session?.businessId, auth.session?.branchId, auth.session?.branchName, branchReload]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const productAdded = cart.length > 0;
  const orderTotal = cart.reduce(
    (total, item) => total + (Number(item.unitPrice) || 0) * item.quantity,
    0,
  );
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customer, setCustomer] = useState<OrderCustomer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const customerAdded = customer !== null;
  const [deliveryZone, setDeliveryZone] = useState<"inside" | "outside">(
    "outside",
  );
  const deliveryZoneRef = useRef(deliveryZone); deliveryZoneRef.current = deliveryZone;
  const [deliveryCharge, setDeliveryCharge] = useState("120");
  // Zone charges come from the default courier (Settings → Couriers); 60/120 only until it loads.
  type CourierRow = { id: string; name: string; isActive?: boolean; isDefault?: boolean; insideDhakaCharge?: number; outsideDhakaCharge?: number; returnCharge?: number; codFeeType?: string; codFeeValue?: number; contact?: string | null; phone?: string | null; trackingUrlTemplate?: string | null };
  const [defaultCourier, setDefaultCourier] = useState<CourierRow | null>(null);
  const [zoneCharges, setZoneCharges] = useState({ inside: "60", outside: "120" });
  const [chargeEditOpen, setChargeEditOpen] = useState(false);
  const [chargeDraft, setChargeDraft] = useState({ inside: "", outside: "" });
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeError, setChargeError] = useState("");
  useEffect(() => {
    let alive = true;
    auth.api<CourierRow[]>("/couriers").then(rows => {
      if (!alive) return;
      const c = rows.find(r => r.isDefault && r.isActive !== false) ?? rows.find(r => r.isActive !== false) ?? null;
      setDefaultCourier(c);
      if (c) {
        const next = { inside: String(c.insideDhakaCharge ?? 60), outside: String(c.outsideDhakaCharge ?? 120) };
        setZoneCharges(next);
        setDeliveryCharge(current => (current === "60" || current === "120") ? next[deliveryZoneRef.current] : current);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [auth.session?.businessId]);
  const saveZoneCharges = async () => {
    const inside = Number(chargeDraft.inside), outside = Number(chargeDraft.outside);
    if (!Number.isFinite(inside) || !Number.isFinite(outside) || inside < 0 || outside < 0) { setChargeError(lang === "bn" ? "সঠিক টাকার পরিমাণ দিন।" : "Enter valid amounts."); return; }
    setChargeSaving(true); setChargeError("");
    try {
      if (defaultCourier) {
        const c = defaultCourier;
        await auth.api(`/couriers/${c.id}`, { method: "PATCH", body: JSON.stringify({ name: c.name, insideDhakaCharge: inside, outsideDhakaCharge: outside, returnCharge: c.returnCharge ?? 0, codFeeType: c.codFeeType ?? "PCT", codFeeValue: c.codFeeValue ?? 0, contact: c.contact ?? c.phone ?? null, trackingUrlTemplate: c.trackingUrlTemplate ?? null, isActive: c.isActive !== false }) });
        setDefaultCourier({ ...c, insideDhakaCharge: inside, outsideDhakaCharge: outside });
      }
      const next = { inside: String(inside), outside: String(outside) };
      setZoneCharges(next); setDeliveryCharge(next[deliveryZone]); setChargeEditOpen(false);
    } catch (e) { setChargeError((e as Error).message || (lang === "bn" ? "সেভ করা যায়নি।" : "Could not save.")); }
    finally { setChargeSaving(false); }
  };
  const [discount, setDiscount] = useState("0");
  const [showDiscount, setShowDiscount] = useState(false);
  const [advancePayment, setAdvancePayment] = useState("0");
  const [channel, setChannel] =
    useState<(typeof channels)[number]>("📘 Facebook");
  const [noteOpen, setNoteOpen] = useState(false); const [advanceMethod, setAdvanceMethod] = useState<Wallet>("BKASH"); const [advanceRef, setAdvanceRef] = useState(""); const [advanceOpen, setAdvanceOpen] = useState(false); const [advDraft, setAdvDraft] = useState({ amount: "", method: "BKASH" as Wallet, ref: "" }); const [channelEditing, setChannelEditing] = useState(false); const [addressEditing, setAddressEditing] = useState(false); const [orderNote, setOrderNote] = useState("");
  const payableTotal = Math.max(
    orderTotal + (Number(deliveryCharge) || 0) - (Number(discount) || 0),
    0,
  );
  const remainingBalance = Math.max(
    payableTotal - (Number(advancePayment) || 0),
    0,
  );
  // Advance popup (same wallets as POS, no card): the money is recorded only when the order is saved.
  const openAdvance = () => { setAdvDraft({ amount: Number(advancePayment) > 0 ? advancePayment : "", method: advanceMethod, ref: advanceRef }); setAdvanceOpen(true); };
  const advNeedsRef = advDraft.method !== "CASH";
  const advError = (() => { const v = Number(advDraft.amount); if (!advDraft.amount) return ""; if (!Number.isFinite(v) || v < 0) return lang === "bn" ? "সঠিক টাকার পরিমাণ দিন।" : "Enter a valid amount."; if (v > payableTotal) return lang === "bn" ? `মোট ${taka(payableTotal)}-এর বেশি হতে পারবে না।` : `Cannot be more than ${taka(payableTotal)}.`; if (v > 0 && advNeedsRef && !/^[a-z0-9]{1,100}$/i.test(advDraft.ref.trim())) return lang === "bn" ? "ট্রানজেকশন আইডি (TxID) লিখুন — শুধু ইংরেজি অক্ষর ও সংখ্যা।" : "Enter the transaction ID (letters and digits)."; return ""; })();
  const confirmAdvance = () => { if (advError) return; setAdvancePayment(advDraft.amount || "0"); setAdvanceMethod(advDraft.method); setAdvanceRef(advDraft.method === "CASH" ? "" : advDraft.ref.trim()); setAdvanceOpen(false); };
  const submitOrder = async () => {
    if (submitting) return;
    if (!orderBranchId) { setSubmitError("Choose a branch before creating this order."); return; }
    if (!cart.length) { setSubmitError("Add at least one product before saving the order."); return; }
    if (!customer?.phone?.trim()) { setSubmitError("A customer phone number is required."); return; }
    if (!customer.address?.trim()) { setSubmitError("A delivery address is required."); return; }
    const invalidItem = cart.find(item => !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0 || item.quantity < 1);
    if (invalidItem) { setSubmitError(`Check the price and quantity for ${invalidItem.productName}.`); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const channelCode = ({
        "📘 Facebook": "FACEBOOK", "💬 WhatsApp": "WHATSAPP", "📷 Instagram": "INSTAGRAM",
        "📞 Phone": "PHONE", "🏪 Shop": "SHOP", "🌐 MyWebsite": "MYWEBSITE", Other: "OTHER",
      } as const)[channel];
      const advance = Math.min(Math.max(Number(advancePayment) || 0, 0), payableTotal);
      const order = await auth.api<{ id: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          channel: channelCode,
          customerPhone: customer.phone.trim(),
          customerName: customer.name.trim(),
          customerAddress: customer.address.trim(),
          branchId: orderBranchId,
          isDraft: true,
          items: cart.map(item => ({ variantId: item.variantId, qty: item.quantity, unitPrice: Number(item.unitPrice) || 0 })),
          discountType: Number(discount) > 0 ? "FIXED" : undefined,
          discountValue: Number(discount) > 0 ? Number(discount) : undefined,
          deliveryChargeCustomer: Number(deliveryCharge) || 0,
          advancePaid: advance,
          advancePaymentMethod: advance > 0 ? advanceMethod : undefined,
          advancePaymentReference: advance > 0 && advanceMethod !== "CASH" ? advanceRef : undefined,
          note: noteOpen && orderNote.trim() ? orderNote.trim() : undefined,
        }),
      });
      router.replace({ pathname: "/orders/[id]", params: { id: order.id } });
    } catch (error) {
      setSubmitError((error as Error).message || "Could not save the order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (showSteps) return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="Back to orders" onPress={()=>router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={21} color={colors.heading}/></Pressable><View style={styles.titleCopy}><PageTitle style={styles.title}>New Online Order</PageTitle></View></View>
    <ProcessGuide title={lang==="bn"?"অর্ডারের ধাপ":"Order Steps"} steps={[
      {title:lang==="bn"?"অর্ডার তৈরি করুন":"Create order",description:lang==="bn"?"পণ্য যোগ করুন, পরিমাণ লিখুন এবং গ্রাহকের তথ্য দিয়ে অর্ডার তৈরি করুন।":"Add products, enter quantities and customer details, then create the order.",icon:"cart-outline",done:false,action:{label:lang==="bn"?"এই ধাপ শুরু করুন":"Start this step",onPress:()=>setShowSteps(false)}},
      {title:lang==="bn"?"অর্ডার নিশ্চিত করুন":"Confirm order",description:lang==="bn"?"নিশ্চিত করার পর প্যাক করার আগে পরিমাণ পরিবর্তন বা পণ্য সরানো যাবে। পরিমাণ বাড়াতে পর্যাপ্ত স্টক থাকতে হবে।":"After confirmation, you can revise quantities or remove products before packing. Quantity increases require available stock.",icon:"checkmark-circle-outline",done:false},
      {title:lang==="bn"?"কুরিয়ারে হস্তান্তর করুন":"Handover to courier",description:lang==="bn"?"কুরিয়ার নির্বাচন করুন এবং ডেলিভারির তথ্য দিয়ে পণ্য হস্তান্তর করুন।":"Select the courier, enter delivery details and hand over the products.",icon:"cube-outline",done:false},
      {title:lang==="bn"?"ডেলিভারি সম্পন্ন করুন":"Complete delivery",description:lang==="bn"?"গ্রাহক পণ্য বুঝে পেলে ডেলিভারি সম্পন্ন হিসেবে চিহ্নিত করুন।":"Mark the order delivered after the customer receives the products.",icon:"flag-outline",done:false},
      {title:lang==="bn"?"কুরিয়ার থেকে টাকা বুঝে নিন":"Receive courier payment",description:lang==="bn"?"COD অর্ডারে কুরিয়ার থেকে টাকা পাওয়ার পর পেমেন্ট রেকর্ড করুন।":"For COD orders, record payment after the courier sends you the money. Fully prepaid orders skip this step.",icon:"wallet-outline",done:false},
    ]}/>
  </ScrollView>;

  if (branchesLoading) return <View style={styles.branchState}><ActivityIndicator color={colors.primary}/><Text style={styles.branchHint}>Loading branches…</Text></View>;
  if (branchesError || !branches.length) return <ScrollView style={styles.screen} contentContainerStyle={styles.branchContent}>
    <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="Back to orders" onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={21} color={colors.heading}/></Pressable><Text style={styles.title}>New Online Order</Text></View>
    <Text style={styles.branchHint}>{branchesError || "No active branch is available for this order."}</Text>
    {branchesError ? <Pressable onPress={() => setBranchReload(value => value + 1)} style={styles.branchRetry}><Text style={styles.branchRetryText}>Try again</Text></Pressable> : null}
  </ScrollView>;
  if (branches.length > 1 && !orderBranchId) return <ScrollView style={styles.screen} contentContainerStyle={styles.branchContent}>
    <View style={styles.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="Back to orders" onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={21} color={colors.heading}/></Pressable><View style={styles.titleCopy}><PageTitle style={styles.title}>New Online Order</PageTitle></View></View>
    <View style={styles.branchIntro}><Text style={styles.branchQuestion}>Which branch is this order for?</Text><Text style={styles.branchHint}>Products and stock will be shown for this branch — even if you switch branches later, this order stays pinned to your choice here.</Text></View>
    <View style={styles.branchOptions}>{branches.map(branch => <Pressable key={branch.id} accessibilityRole="button" onPress={() => setOrderBranchId(branch.id)} style={[styles.branchOption, branch.id === auth.session?.branchId && styles.branchOptionCurrent]}><Text style={styles.branchName}>{branch.name}</Text>{branch.id === auth.session?.branchId && <Text style={styles.branchCurrentLabel}>Currently viewing branch</Text>}</Pressable>)}</View>
  </ScrollView>;

  return (
    <>
    <KeyboardAwareScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      enableOnAndroid
      extraScrollHeight={24}
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
          <PageTitle style={styles.title}>New Online Order</PageTitle>
          <Text style={styles.subtitle}>
            {lang === "bn" ? "পণ্য, কাস্টমারের তথ্য ও পেমেন্ট যোগ করুন" : "Add products, customer details, and payment"}
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={()=>setShowSteps(true)} style={{alignSelf:"flex-start",paddingVertical:8}}><Text style={{color:colors.primaryDark,fontWeight:"600"}}>{lang==="bn"?"← অর্ডারের ধাপ":"← Order Steps"}</Text></Pressable>
      <View style={styles.pinnedBranch}><Text style={styles.pinnedBranchLabel}>{lang === "bn" ? "যে শাখার অর্ডার" : "Order for branch"}</Text><Text style={styles.pinnedBranchName}>{branches.find(branch => branch.id === orderBranchId)?.name ?? ""}</Text></View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <StepTitle n={1} done={productAdded} title={lang === "bn" ? "পণ্য" : "Products"} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Product"
            onPress={() => setProductPickerOpen(true)}
            style={styles.addButton}
          >
            <Ionicons name="add" size={17} color={colors.primaryDark} />
            <Text style={styles.addText}>
              Add Product
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
                        <Text style={styles.stockText}>{lang === "bn" ? "স্টকে আছে" : "Available in stock"}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.productControls}>
                    <View style={styles.controlColumn}>
                      <Text style={styles.controlLabel}>
                        {lang === "bn" ? "দাম (প্রতি পিস ৳)" : "Price (৳ per piece)"}
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
                      ৳{Number(unitPrice || 0).toLocaleString()} × {quantity}{" "}{lang === "bn" ? "পিস" : quantity === 1 ? "piece" : "pieces"} =
                    </Text>
                    <Text style={styles.productTotalText}>
                      {lang === "bn" ? "মোট" : "Total"} ৳{orderTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyProducts}>
            <Ionicons name="cube-outline" size={27} color={colors.muted} />
            <Text style={styles.emptyText}>No product added yet</Text>
          </View>
        )}
      </View>

      {productAdded && (
        <View
          style={[styles.section, customer && styles.selectedCustomerSection]}
        >
          <View style={styles.sectionHeader}>
            <StepTitle n={2} done={customerAdded} title={lang === "bn" ? "কাস্টমার" : "Customer"} />
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
          <OrderCustomerPicker
            visible={customerOpen}
            onClose={() => setCustomerOpen(false)}
            onSelect={(selected) => { setCustomer(selected); setCustomerOpen(false); setSubmitError(""); }}
          />
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
                <Text style={styles.deliveryAddressLabel}>{lang === "bn" ? "ডেলিভারি ঠিকানা" : "Delivery address"}</Text>
                {addressEditing || !customer.address?.trim() ? <TextInput
                  accessibilityLabel="Delivery address"
                  autoFocus={addressEditing}
                  placeholder={lang === "bn" ? "কাস্টমারের ঠিকানা লিখুন" : "Customer address"}
                  placeholderTextColor={colors.muted}
                  value={customer.address ?? ""}
                  onChangeText={(address) =>
                    setCustomer({ ...customer, address })
                  }
                  onBlur={() => setAddressEditing(false)}
                  style={styles.deliveryAddressInput}
                /> : <Pressable accessibilityLabel="Edit delivery address" onPress={() => setAddressEditing(true)} style={styles.addressView}>
                  <Text style={styles.addressViewText}>{customer.address}</Text>
                  <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                </Pressable>}
              </View>
            </View>
          )}
        </View>
      )}

      {customerAdded && (
        <View style={styles.channelSection}>
          <View style={styles.channelHeader}>
            <StepTitle n={3} done={!!channel} title={lang === "bn" ? "চ্যানেল" : "Channel"} />
            {!channelEditing && <View style={styles.channelCurrent}>
              <Text style={styles.channelCurrentText}>{channel}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Change channel" hitSlop={8} onPress={() => setChannelEditing(true)} style={styles.channelChange}>
                <Ionicons name="create-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.channelChangeText}>{lang === "bn" ? "পরিবর্তন" : "Change"}</Text>
              </Pressable>
            </View>}
          </View>
          {channelEditing && <View style={styles.channelOptions}>
            {channels.map((option) => {
              const selected = channel === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { setChannel(option); setChannelEditing(false); }}
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
          </View>}
        </View>
      )}

      {customerAdded && (
        <View style={styles.orderDetailSection}>
          <View style={styles.orderDetailHeader}>
            <StepTitle n={4} done title={lang === "bn" ? "কুরিয়ার সার্ভিস" : "Courier service"} />
            <Pressable
              accessibilityLabel="Change delivery charges"
              onPress={() => { setChargeDraft({ ...zoneCharges }); setChargeError(""); setChargeEditOpen(true); }}
              style={styles.manageCourierButton}
            >
              <Ionicons name="settings-outline" size={18} color={colors.secondary} />
            </Pressable>
          </View>
          <View style={styles.zoneRadios}>
            {([["inside", lang === "bn" ? "ঢাকার ভেতরে" : "Inside Dhaka", zoneCharges.inside, colors.success], ["outside", lang === "bn" ? "ঢাকার বাইরে" : "Outside Dhaka", zoneCharges.outside, colors.primary]] as const).map(([zone, title, charge, accent]) => {
              const on = deliveryZone === zone;
              return <Pressable key={zone} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { setDeliveryZone(zone); setDeliveryCharge(charge); }} style={styles.zoneRadio}>
                <View style={[styles.radioOuter, on && { borderColor: accent }]}>{on && <View style={[styles.radioInner, { backgroundColor: accent }]} />}</View>
                <Text style={[styles.zoneText, on && { color: colors.heading, fontWeight: "700" }]}>{title}</Text>
                <Text style={[styles.zoneCharge, { color: on ? accent : colors.muted }]}>৳{charge}</Text>
              </Pressable>;
            })}
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
          <StepTitle n={5} done={payableTotal > 0} title={lang === "bn" ? "পেমেন্ট" : "Payment"} />
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{lang === "bn" ? `পণ্যের দাম (${cart.length}টি পণ্য)` : `Products (${cart.length})`}</Text>
              <Text style={styles.paymentValue}>{taka(orderTotal)}</Text>
            </View>
            <AmountRow label={lang === "bn" ? "ডেলিভারি চার্জ" : "Delivery charge"} value={deliveryCharge} onChange={setDeliveryCharge} />
            <AmountRow label={lang === "bn" ? "ছাড়" : "Discount"} value={discount} onChange={setDiscount} minus addLabel={lang === "bn" ? "+ ছাড় দিন" : "+ Add discount"} />
            <View style={styles.paymentTotalRow}>
              <Text style={styles.paymentTotalLabel}>{lang === "bn" ? "মোট" : "Total"}</Text>
              <Text style={styles.paymentTotalValue}>{taka(payableTotal)}</Text>
            </View>
            {Number(advancePayment) > 0 ? <Pressable accessibilityLabel="Edit advance" onPress={openAdvance} style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{lang === "bn" ? "অগ্রিম নেওয়া হয়েছে" : "Advance received"}</Text>
              <Text style={styles.paymentValue}>− {taka(Number(advancePayment))} <PlainText style={styles.advanceWallet}>({WALLETS.find(w => w[0] === advanceMethod)?.[1]})</PlainText></Text>
              <Ionicons name="create-outline" size={16} color={colors.primaryDark} style={styles.editIcon} />
            </Pressable> : <Pressable onPress={openAdvance} style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{lang === "bn" ? "অগ্রিম নেওয়া হয়েছে" : "Advance received"}</Text>
              <Text style={styles.discountAction}>{lang === "bn" ? "+ অগ্রিম যোগ করুন" : "+ Add advance"}</Text>
            </Pressable>}
            <View style={[styles.collectBox, remainingBalance <= 0 && styles.collectBoxPaid]}>
              <Text style={[styles.collectLabel, remainingBalance <= 0 && styles.collectPaidText]}>{remainingBalance <= 0 ? (lang === "bn" ? "পুরো টাকা পরিশোধিত · কুরিয়ার কিছু নেবে না" : "Fully paid · courier collects nothing") : (lang === "bn" ? "কুরিয়ার নেবে (Cash On Delivery)" : "Courier collects (Cash On Delivery)")}</Text>
              {remainingBalance > 0 && <Text style={styles.collectValue}>{taka(remainingBalance)}</Text>}
            </View>
          </View>
        </View>
      )}

      {customerAdded && (
        <View style={noteOpen ? styles.noteSection : styles.noteLinkWrap}>
          {!noteOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add note"
              onPress={() => setNoteOpen(true)}
              style={styles.noteLink}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.noteLinkText}>{lang === "bn" ? "নোট যোগ করুন (ঐচ্ছিক)" : "Add note (optional)"}</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>{lang === "bn" ? "অর্ডারের নোট" : "Order note"}</Text>
                <Pressable
                  accessibilityLabel="Remove note"
                  onPress={() => setNoteOpen(false)}
                >
                  <Ionicons name="close" size={20} color={colors.primaryDark} />
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Order note"
                placeholder={lang === "bn" ? "ডেলিভারি বা অর্ডারের জন্য কোনো নির্দেশনা লিখুন..." : "Add delivery or order instructions..."}
                placeholderTextColor={colors.muted}
                multiline
                value={orderNote}
                onChangeText={setOrderNote}
                style={[styles.noteInput,!orderNote&&{fontSize:12}]}
              />
            </>
          )}
        </View>
      )}

      {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}
    </KeyboardAwareScrollView>
    <PopupSheet visible={advanceOpen} onClose={() => setAdvanceOpen(false)} title={lang === "bn" ? "অগ্রিম টাকা" : "Advance payment"} fitContent>
      <View style={styles.chargeSheet}>
        <Text style={styles.chargeLabel}>{lang === "bn" ? "কত টাকা অগ্রিম?" : "How much?"}</Text>
        <View style={styles.chargeInputWrap}><Text style={styles.chargeTaka}>৳</Text><TextInput autoFocus value={advDraft.amount} onChangeText={v => setAdvDraft(d => ({ ...d, amount: decimalInput(v) }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.chargeInput, { flex: 1, width: undefined, textAlign: "left" }]} accessibilityLabel="Advance amount" /></View>
        <Text style={styles.chargeHint}>{lang === "bn" ? `সর্বোচ্চ ${taka(payableTotal)}` : `Maximum ${taka(payableTotal)}`}</Text>
        <Text style={styles.chargeLabel}>{lang === "bn" ? "কিভাবে পেয়েছেন?" : "Received by"}</Text>
        <View style={styles.walletRow}>{WALLETS.map(([w, name, dot]) => <Pressable key={w} onPress={() => setAdvDraft(d => ({ ...d, method: w }))} style={[styles.walletChip, advDraft.method === w && styles.walletChipOn]}><View style={[styles.walletDot, { backgroundColor: dot }]} /><PlainText style={[styles.walletText, advDraft.method === w && styles.walletTextOn]}>{name}</PlainText></Pressable>)}</View>
        {advNeedsRef && <><Text style={styles.chargeLabel}>{lang === "bn" ? "ট্রানজেকশন আইডি (TxID)" : "Transaction ID (TxID)"}</Text>
          <TextInput value={advDraft.ref} onChangeText={v => setAdvDraft(d => ({ ...d, ref: v.replace(/[^a-z0-9]/gi, "") }))} autoCapitalize="characters" autoCorrect={false} maxLength={100} placeholder={lang === "bn" ? "যেমন: 8K7D2LQ4XZ" : "e.g. 8K7D2LQ4XZ"} placeholderTextColor={colors.muted} style={[styles.chargeInput, { width: "100%", textAlign: "left" }]} /></>}
        {!!advError && <Text style={styles.submitError}>{advError}</Text>}
        <Pressable accessibilityRole="button" disabled={!!advError} onPress={confirmAdvance} style={[styles.bottomButton, !!advError && styles.disabledButton]}><Text style={styles.confirmText}>{lang === "bn" ? "নিশ্চিত করুন" : "Confirm"}</Text></Pressable>
      </View>
    </PopupSheet>
    <PopupSheet visible={chargeEditOpen} onClose={() => { if (!chargeSaving) setChargeEditOpen(false); }} title={lang === "bn" ? "ডেলিভারি চার্জ পরিবর্তন" : "Change delivery charges"} fitContent>
      <View style={styles.chargeSheet}>
        {!!defaultCourier && <Text style={styles.chargeHint}>{lang === "bn" ? `${defaultCourier.name}-এর চার্জ। সেভ করলে পরের সব অর্ডারেও এই চার্জ বসবে।` : `Charges for ${defaultCourier.name}. Saving also updates future orders.`}</Text>}
        {(["inside", "outside"] as const).map(zone => <View key={zone} style={styles.chargeRow}>
          <Text style={styles.chargeLabel}>{zone === "inside" ? (lang === "bn" ? "ঢাকার ভেতরে" : "Inside Dhaka") : (lang === "bn" ? "ঢাকার বাইরে" : "Outside Dhaka")}</Text>
          <View style={styles.chargeInputWrap}><Text style={styles.chargeTaka}>৳</Text><TextInput value={chargeDraft[zone]} onChangeText={v => setChargeDraft(d => ({ ...d, [zone]: decimalInput(v) }))} keyboardType="decimal-pad" selectTextOnFocus style={styles.chargeInput} accessibilityLabel={zone} /></View>
        </View>)}
        {!!chargeError && <Text style={styles.submitError}>{chargeError}</Text>}
        <Pressable accessibilityRole="button" disabled={chargeSaving} onPress={() => void saveZoneCharges()} style={[styles.bottomButton, chargeSaving && styles.disabledButton]}>
          {chargeSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>{lang === "bn" ? "সেভ করুন" : "Save"}</Text>}
        </Pressable>
      </View>
    </PopupSheet>
    {customerAdded && <View style={styles.bottomBar}>
      <View style={styles.bottomTotal}>
        <Text style={styles.bottomTotalLabel}>{remainingBalance > 0 ? (lang === "bn" ? "কুরিয়ার নেবে" : "Courier collects") : (lang === "bn" ? "মোট (পরিশোধিত)" : "Total (paid)")}</Text>
        <Text style={styles.bottomTotalValue}>{taka(remainingBalance > 0 ? remainingBalance : payableTotal)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Create Order" disabled={submitting} onPress={() => void submitOrder()} style={[styles.bottomButton, submitting && styles.disabledButton]}>
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>{lang === "bn" ? "অর্ডার সেভ করুন" : "Save order"}</Text>}
      </Pressable>
    </View>}
    <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        branchId={orderBranchId ?? undefined}
        showSellingPrice={true}
        showAverageCost={false}
        showRecentlyPurchased={false}
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
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F5F5F4" },
  content: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", backgroundColor: "#F5F5F4", padding: 16, paddingBottom: 110, gap: 14 },
  branchContent: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", padding: 16, paddingBottom: 32, gap: 18, backgroundColor: colors.white },
  branchState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.white },
  branchIntro: { gap: 8, paddingTop: 8 },
  branchQuestion: { color: colors.heading, fontSize: 20, fontWeight: "700" },
  branchHint: { color: colors.secondary, fontSize: 13, lineHeight: 20 },
  branchOptions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  branchOption: { width: "48%", minHeight: 82, justifyContent: "center", gap: 5, borderWidth: 2, borderColor: colors.divider, borderRadius: 15, backgroundColor: colors.cardSecondary, padding: 14 },
  branchOptionCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  branchName: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  branchCurrentLabel: { color: colors.primaryDark, fontSize: 10, fontWeight: "600" },
  branchRetry: { alignSelf: "flex-start", minHeight: 42, justifyContent: "center", borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 16 },
  branchRetryText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  pinnedBranch: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 12, backgroundColor: colors.heading, paddingHorizontal: 14 },
  pinnedBranchLabel: { color: colors.white, opacity: 0.72, fontSize: 11, fontWeight: "600" },
  pinnedBranchName: { color: colors.white, fontSize: 13, fontWeight: "700" },
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
  selectedCustomerSection: {},
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
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider,
  },
  totalEquation: { color: colors.secondary, fontSize: 12 },
  productTotalText: { color: colors.heading, fontSize: 15, fontWeight: "700" },
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
    minHeight: "85%",
    height: "88%",
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
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalHeaderTitle: { flex: 1 },
  headerNewCustomerButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight, paddingHorizontal: 9 },
  headerNewCustomerText: { color: colors.primaryDark, fontSize: 11, fontWeight: "600" },
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
  customerResults: { flex: 1, minHeight: 0 },
  customerResultList: { gap: 7, paddingBottom: 10 },
  customerLoader: { paddingVertical: 12 },
  customerError: { color: colors.dangerText, fontSize: 12, paddingVertical: 4 },
  submitError: { color: colors.dangerText, fontSize: 13, textAlign: "center", paddingHorizontal: 16, paddingBottom: 8 },
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
  addressView: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 2 },
  addressViewText: { flex: 1, color: colors.heading, fontSize: 14, lineHeight: 20 },
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
    padding: 15,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    backgroundColor: colors.white,
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
    gap: 0,
  },
  zoneRadios: { flexDirection: "row", flexWrap: "wrap", columnGap: 22, rowGap: 6, paddingVertical: 4 },
  zoneRadio: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  zoneText: { color: colors.secondary, fontSize: 14 },
  zoneCharge: { fontSize: 14, fontWeight: "700" },
  paymentRow: {
    minHeight: 26,
    paddingVertical: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  paymentLabel: { flex: 1, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  paymentValue: { color: colors.heading, fontSize: 14, fontWeight: "600", lineHeight: 18 },
  editIcon: { marginLeft: -4 },
  collectBox: { marginTop: 6, borderRadius: 10, backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  collectBoxPaid: { backgroundColor: colors.successBackground },
  collectLabel: { flex: 1, color: colors.primaryDark, fontSize: 14, fontWeight: "700" },
  collectPaidText: { color: colors.successText },
  collectValue: { color: colors.primaryDark, fontSize: 20, fontWeight: "800" },
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
    paddingTop: 8,
    marginTop: 4,
  },
  paymentTotalLabel: { color: colors.heading, fontSize: 15, fontWeight: "700" },
  paymentTotalValue: { color: colors.heading, fontSize: 17, fontWeight: "800" },
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
    padding: 15,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    backgroundColor: colors.white,
    gap: 10,
  },
  channelSectionTitle: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  channelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  channelCurrent: { flexDirection: "row", alignItems: "center", gap: 10 },
  channelCurrentText: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  channelChange: { flexDirection: "row", alignItems: "center", gap: 4 },
  channelChangeText: { color: colors.primaryDark, fontSize: 13, fontWeight: "600" },
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
    padding: 15,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    backgroundColor: colors.white,
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
  advanceWallet: { color: colors.secondary, fontSize: 12, fontWeight: "400" },
  walletRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.white },
  walletChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  walletDot: { width: 10, height: 10, borderRadius: 5 },
  walletText: { fontSize: 13, color: colors.secondary, fontWeight: "600" },
  walletTextOn: { color: colors.primaryDark },
  chargeSheet: { gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  chargeHint: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  chargeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chargeLabel: { flex: 1, color: colors.heading, fontSize: 14, fontWeight: "600" },
  chargeInputWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  chargeTaka: { color: colors.heading, fontSize: 16, fontWeight: "700" },
  chargeInput: { width: 110, minHeight: 42, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, paddingHorizontal: 10, fontSize: 16, fontWeight: "700", color: colors.heading, textAlign: "right" },
  stepTitle: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  stepBadgeDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepBadgeText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  stepTitleText: { color: colors.heading, fontSize: 15, fontWeight: "700" },
  noteLinkWrap: { paddingHorizontal: 4 },
  noteLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6 },
  noteLinkText: { color: colors.primaryDark, fontSize: 14, fontWeight: "600" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.divider, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 }, elevation: 12 },
  bottomTotal: { flex: 1, minWidth: 0 },
  bottomTotalLabel: { color: colors.secondary, fontSize: 12 },
  bottomTotalValue: { color: colors.heading, fontSize: 20, fontWeight: "800" },
  bottomButton: { minHeight: 48, minWidth: 150, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
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
