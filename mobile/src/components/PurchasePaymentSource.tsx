import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "./BottomSheet";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";

export type PurchasePayment = { id: string; tripId: string; costKey: string; purchaseItemId?: string | null; amount: number; fundingSource: "BUSINESS" | "PERSONAL"; paidAt: string };
const requestId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === "x" ? r : (r&3)|8).toString(16); });
type Source = "BUSINESS" | "PERSONAL";
type Funding = { initialized: boolean; balance: number | null; partnerId: string | null; partnerName: string | null; canInitialize: boolean };
export default function PurchasePaymentSource({ tripId, costKey, poNumber, itemTitle, amount, onPaid, compact = false, purchaseItemId, triggerLabel, danger = false }: { tripId: string; costKey: string; poNumber: string; itemTitle: string; amount: number; onPaid: (payment: PurchasePayment) => void; compact?: boolean; purchaseItemId?: string; triggerLabel?:string; danger?:boolean }) {
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const [funding, setFunding] = useState<Funding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const request = useRef(requestId());
  const close = () => { if (!savingRef.current) setOpen(false); };
  const pay = async () => {
    if (!source || savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      const result = await api.current<PurchasePayment>(`/purchase-trips/${tripId}/payments`, { method: "POST", body: JSON.stringify({costKey, purchaseItemId, expectedAmount: amount, fundingSource: source, requestId: request.current}) });
      onPaid(result); setOpen(false);
    } catch (e) { setSaveError((e as Error).message); }
    finally { savingRef.current = false; setSaving(false); }
  };
  useEffect(() => {
    if (!open) return;
    let active = true;
    setFunding(null); setLoading(true); setError(false);
    void api.current<Funding>("/expenses/funding").then(value => { if (active) setFunding(value); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, retry, auth.session?.businessId, auth.session?.branchId, auth.session?.user.id]);
  const money = (amount: number) => `৳${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const options: { value: Source; label: string; hint: string; icon: "business-outline" | "person-outline" }[] = [
    { value: "BUSINESS", label: "poPayment.business", hint: "poPayment.businessHint", icon: "business-outline" },
    { value: "PERSONAL", label: "poPayment.personal", hint: "poPayment.personalHint", icon: "person-outline" },
  ];
  const form = <View style={{ gap: 10 }}>
      <Text style={s.po}>{poNumber}</Text>
      <View style={s.summary}>
        <Text style={s.label}>{t(itemTitle)}</Text>
        <View style={s.summaryRow}><Text style={s.hint}>{t("poCostPayment.amount")}</Text><Text style={s.total}>{money(amount)}</Text></View>
      </View>
      <Text style={s.heading}>{t("poPayment.question")}</Text>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={t(option.label)} accessibilityState={{ checked: source === option.value, disabled: saving }} disabled={saving} onPress={() => { if(source !== option.value) request.current = requestId(); setSource(option.value); setSaveError(""); }} style={[s.option, source === option.value && s.selected]}>
        <Ionicons name={option.icon} size={24} color={colors.primaryDark}/>
        <View style={s.copy}><Text style={s.label}>{t(option.label)}</Text><Text style={s.hint}>{t(option.hint)}</Text>
          {option.value === "BUSINESS" && <View style={s.balanceRow}><Text style={s.hint}>{t("poPaymentAmounts.available")}</Text>{loading ? <ActivityIndicator size="small" color={colors.primary}/> : <Text style={s.balance}>{!funding ? t("expenseOpening.unavailable") : !funding.initialized ? t("expenseOpening.notSet") : funding.balance == null ? t("expenseOpening.private") : money(funding.balance)}</Text>}</View>}
          {option.value === "PERSONAL" && <Text style={s.balance}>{funding?.partnerName || auth.session?.user.name}</Text>}
        </View>
        <Ionicons name={source === option.value ? "radio-button-on" : "radio-button-off"} size={22} color={colors.primary}/>
      </Pressable>)}
      {error && <View><Text accessibilityRole="alert" style={s.hint}>{t("poPaymentAmounts.failed")}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={s.retry}><Text style={s.balance}>{t("common.retry")}</Text></Pressable></View>}
      <Text style={s.hint}>{t("poCostPayment.confirmHint")}</Text>
      {!!saveError && <Text accessibilityRole="alert" style={{color: colors.dangerText}}>{saveError}</Text>}
      <Pressable accessibilityRole="button" disabled={!source || saving} onPress={() => void pay()} style={[s.add, (!source || saving) && {opacity: 0.5}]}>{saving ? <ActivityIndicator color={colors.white}/> : <Text style={s.addText}>{t("poCostPayment.confirm")}</Text>}</Pressable>
    </View>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={triggerLabel??t("poPayment.add")} onPress={() => setOpen(true)} style={[s.add, compact && s.compactAdd, danger&&s.dangerAdd]}>
      <Ionicons name="add" size={compact ? 16 : 20} color={danger?colors.white:compact?colors.primaryDark:colors.white}/><Text numberOfLines={1} style={[s.addText, compact && {color: colors.primaryDark, fontSize: 12},danger&&{color:colors.white}]}>{triggerLabel??t("poPayment.add")}</Text>
    </Pressable>
    <BottomSheet visible={open} close={close} title={t("poPayment.add")} mobile={width < 768}>{form}</BottomSheet>
  </>;
}
const s = StyleSheet.create({
  compactAdd: { alignSelf: "flex-start", minWidth: 125, minHeight: 40, flexShrink: 0, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.secondaryBorder },
  dangerAdd:{minWidth:0,backgroundColor:colors.danger,borderColor:colors.danger},
  summary: { padding: 14, borderRadius: 12, gap: 10, backgroundColor: colors.primaryLight },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  total: { fontSize: 22, fontWeight: "800", color: colors.primaryDark },
  balanceRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  balance: { fontSize: 14, fontWeight: "700", color: colors.primaryDark },
  retry: { minHeight: 44, justifyContent: "center" },
  add: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 11, backgroundColor: colors.primary, paddingHorizontal: 14 },
  addText: { fontSize: 14, fontWeight: "700", color: colors.white },
  po: { color: colors.secondary, fontSize: 13 }, heading: { color: colors.heading, fontSize: 17, fontWeight: "700", marginVertical: 6 },
  option: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 13, padding: 14, backgroundColor: colors.white },
  selected: { borderColor: colors.primary, backgroundColor: colors.primaryLight }, copy: { flex: 1, gap: 5 },
  label: { color: colors.heading, fontSize: 15, fontWeight: "700" }, hint: { color: colors.secondary, fontSize: 12, lineHeight: 20 },
});
