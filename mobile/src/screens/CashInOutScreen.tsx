import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { amountInput } from "../utils/cashBook";
import { CapitalPaymentDate } from "../components/CapitalInjectionInputs";
import CashTransactions from "../components/CashTransactions";

// Cash In = the same capital injection as the partner screen, with the common fields up front.
type InMethod = "CASH" | "BANK" | "CHEQUE" | "MOBILE_BANKING";
const inMethods: InMethod[] = ["CASH", "BANK", "CHEQUE", "MOBILE_BANKING"];
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blankIn = () => ({ date: localToday(), method: "CASH" as InMethod, reference: "", bankName: "", bankAccount: "", cheque: "", lockIn: "12", proof: "", more: false });

type Partner = { id: string; name: string };
type Wallet = "CASH" | "BKASH" | "NAGAD" | "CARD";
type Form = { walletPaisa: Record<Wallet, number>; partners: Partner[] };
type Withdrawal = { id: string; partnerName: string; source: Wallet; amountPaisa: number; note?: string | null; requestedAt: string };
const wallets: Wallet[] = ["CASH", "BKASH", "NAGAD", "CARD"];
const walletLabel: Record<Wallet, string> = { CASH: "Cash in Hand", BKASH: "bKash", NAGAD: "Nagad", CARD: "Card" };
const newId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });
const IN = colors.primary, OUT = colors.danger;

// Owner screen: টাকা জমা = partner cash investment (existing capital flow); উত্তোলন = partner withdrawal.
export default function CashInOutScreen() {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const { t } = useLanguage();
  const [tab, setTab] = useState<"IN" | "OUT">("IN");
  const [form, setForm] = useState<Form | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [source, setSource] = useState<Wallet>("CASH");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [reload, setReload] = useState(0);
  const [cashIn, setCashIn] = useState(blankIn);
  // Cash In can be entered for any active partner (one partner often keeps the books).
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [inPartnerId, setInPartnerId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const setIn = (change: Partial<ReturnType<typeof blankIn>>) => setCashIn(v => ({ ...v, ...change }));
  const requestId = useRef(newId()); const lastPayload = useRef("");

  useEffect(() => {
    let active = true; setError("");
    Promise.all([api.current<Form>("/partner-withdrawals/form"), api.current<Withdrawal[]>("/partner-withdrawals"), api.current<(Partner & { status: string })[]>("/partners")])
      .then(([f, h, all]) => {
        if (!active) return; setForm(f); setHistory(h); setPartnerId(f.partners[0]?.id ?? null);
        const list = all.filter(p => p.status === "ACTIVE").map(p => ({ id: p.id, name: p.name }));
        setAllPartners(list); setInPartnerId(id => id && list.some(p => p.id === id) ? id : f.partners[0]?.id ?? list[0]?.id ?? null);
      })
      .catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [reload, auth.session?.businessId]);

  const money = (paisa: number) => `৳${(paisa / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const partner = form?.partners.find(p => p.id === partnerId);
  const inPartner = allPartners.find(p => p.id === inPartnerId);
  const target = tab === "IN" ? inPartner : partner;
  const paisa = Math.round(Number(amount || 0) * 100);
  const available = form ? Math.max(0, form.walletPaisa[source] ?? 0) : 0;
  const tooMuch = tab === "OUT" && paisa > available;
  const canSave = !!target && paisa > 0 && !tooMuch && !saving && !uploading;

  const uploadProof = async () => {
    if (uploading) return; setError("");
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: .8 }); if (picked.canceled) return;
      setUploading(true);
      const asset = picked.assets[0], body = new FormData();
      if (Platform.OS === "web" && asset.file) body.append("file", asset.file, asset.fileName || "proof.jpg");
      else body.append("file", { uri: asset.uri, name: asset.fileName || "proof.jpg", type: asset.mimeType || "image/jpeg" } as never);
      const response = await fetch(`${MEDIA_URL}/api/v1/media/upload`, { method: "POST", body,
        headers: { Authorization: `Bearer ${auth.session?.accessToken}`, ...(auth.session?.businessId ? { "X-Business-Id": auth.session.businessId } : {}) } });
      const result = await response.json(); if (!response.ok || !result.url) throw new Error(result.message || t("profile.uploadFailed"));
      setIn({ proof: result.url });
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); }
  };
  const proofUri = cashIn.proof && (/^https?:\/\//i.test(cashIn.proof) ? cashIn.proof : `${MEDIA_URL}${cashIn.proof}`);
  const switchTab = (next: "IN" | "OUT") => { setTab(next); setError(""); setDone(""); };

  const save = async () => {
    if (!canSave || !target) return;
    setSaving(true); setError(""); setDone("");
    try {
      if (tab === "IN") {
        const v = cashIn, opt = (s: string) => s.trim() || undefined;
        const result = await api.current<{ status: string }>(`/partners/${target.id}/capital-injections`, { method: "POST", body: JSON.stringify({
          submitForApproval: true, amountPaisa: paisa, injectedAt: v.date || undefined, lockInMonths: Number(v.lockIn) || 0, paymentMethod: v.method, paidTo: "To Business",
          bankName: v.method === "BANK" ? opt(v.bankName) : undefined, bankAccountNumber: v.method === "BANK" ? opt(v.bankAccount) : undefined,
          chequeNumber: v.method === "CHEQUE" ? opt(v.cheque) : undefined, paymentReference: v.method === "CASH" ? undefined : opt(v.reference),
          proofImageUrl: opt(v.proof), note: opt(note) }) });
        setDone(t(result.status === "APPROVED" ? "Money added to cash." : "Saved. Waiting for partner approval."));
        setCashIn(blankIn());
      } else {
        const payload = { partnerId: target.id, source, amountPaisa: paisa, note: note.trim() || null };
        const fingerprint = JSON.stringify(payload);
        if (lastPayload.current && lastPayload.current !== fingerprint) requestId.current = newId();
        lastPayload.current = fingerprint;
        await api.current("/partner-withdrawals", { method: "POST", body: JSON.stringify({ ...payload, requestId: requestId.current }) });
        requestId.current = newId(); lastPayload.current = "";
        setDone(t("Withdrawal saved."));
      }
      setAmount(""); setNote(""); setReload(v => v + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const chip = (on: boolean, label: string, onPress: () => void, hint?: string, key?: string) =>
    <Pressable key={key ?? label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>{!!hint && <Text style={[s.chipHint, on && s.chipTextOn]}>{hint}</Text>}
    </Pressable>;

  return <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.h1}>Cash In / Out</Text>
    <View style={s.tabs}>
      {(["IN", "OUT"] as const).map(k => <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: tab === k }} onPress={() => switchTab(k)}
        style={[s.tab, tab === k && { backgroundColor: k === "IN" ? IN : OUT }]}>
        <Text style={[s.tabText, tab === k && s.tabTextOn]}>{k === "IN" ? "Put Cash In" : "Take Cash Out"}</Text>
      </Pressable>)}
    </View>

    {!form ? <View style={s.card}>{error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}</View> : <View style={s.card}>
      {!target && (tab === "OUT" || !allPartners.length) ? <Text style={s.hint}>{tab === "OUT" ? "Your login is not linked to a business partner (More → Settings → Business Partner)." : "Add a business partner first (More → Settings → Business Partner)."}</Text> : <>
        {tab === "IN" ? <>
          <Text style={s.label}>Installment for</Text>
          <View style={s.row}>{allPartners.map(p => chip(p.id === inPartnerId, p.name, () => setInPartnerId(p.id), undefined, p.id))}</View>
          <Text style={s.hint}>{`${t("Entry by")}: ${auth.session?.user?.name ?? ""}`}</Text>
        </> : <>
          <Text style={s.label}>Cash Out By</Text>
          <Text style={s.partnerName}>{partner?.name}</Text>
        </>}
        {tab === "OUT" && <>
          <Text style={s.label}>Wallet</Text>
          <View style={s.row}>{wallets.map(w => chip(source === w, t(walletLabel[w]), () => setSource(w), money(form.walletPaisa[w] ?? 0), w))}</View>
        </>}
        <Text style={s.label}>Amount</Text>
        <View style={[s.amountBox, tooMuch && { borderColor: OUT }]}>
          <Text style={s.taka}>৳</Text>
          <TextInput accessibilityLabel={t("Amount")} value={amount} onChangeText={v => setAmount(p => amountInput(v, p))} keyboardType="decimal-pad" inputMode="decimal"
            placeholder="0" placeholderTextColor={colors.muted} style={s.amountInput} />
        </View>
        {tab === "OUT" && <Text style={[s.hint, tooMuch && s.error]}>{`${t("Can withdraw")}: ${money(available)}`}</Text>}
        {tab === "IN" && <>
          <Text style={s.label}>{t("partners.injectionPaidDate")}</Text>
          <CapitalPaymentDate label={t("partners.injectionPaidDate")} value={cashIn.date} onChange={date => setIn({ date })} />
          <Text style={s.label}>{t("partners.injectionPaymentMethod")}</Text>
          <View style={s.row}>{inMethods.map(m => chip(cashIn.method === m, t(`partners.paymentMethod${m}`), () => setIn({ method: m }), undefined, m))}</View>
          {cashIn.method === "BANK" && <>
            <TextInput value={cashIn.bankName} onChangeText={bankName => setIn({ bankName })} placeholder={t("partners.injectionBankName")} placeholderTextColor={colors.muted} style={s.note} />
            <TextInput value={cashIn.bankAccount} onChangeText={bankAccount => setIn({ bankAccount })} placeholder={t("partners.injectionBankAccount")} placeholderTextColor={colors.muted} style={s.note} />
          </>}
          {cashIn.method === "CHEQUE" && <TextInput value={cashIn.cheque} onChangeText={cheque => setIn({ cheque })} placeholder={t("partners.injectionChequeNumber")} placeholderTextColor={colors.muted} style={s.note} />}
          {cashIn.method !== "CASH" && <TextInput value={cashIn.reference} onChangeText={reference => setIn({ reference })} placeholder={t("partners.injectionReference")} placeholderTextColor={colors.muted} style={s.note} />}
          <Pressable accessibilityRole="button" onPress={() => setIn({ more: !cashIn.more })} style={s.moreToggle}>
            <Text style={s.moreText}>{cashIn.more ? "− Fewer options" : "+ More options"}</Text>
          </Pressable>
        </>}
        {(tab === "OUT" || cashIn.more) && <>
          {tab === "IN" && <>
            <Text style={s.label}>{t("partners.injectionLockInMonths")}</Text>
            <TextInput value={cashIn.lockIn} onChangeText={lockIn => setIn({ lockIn: lockIn.replace(/\D/g, "") })} keyboardType="number-pad" style={s.note} />
            <Text style={s.label}>{t("partners.injectionProof")}</Text>
            {proofUri ? <View style={s.proofRow}>
              <Image source={{ uri: proofUri }} style={s.proofImage} />
              <Pressable accessibilityRole="button" onPress={() => setIn({ proof: "" })}><Text style={s.removeText}>Remove photo</Text></Pressable>
            </View> : <Pressable accessibilityRole="button" disabled={uploading} onPress={() => void uploadProof()} style={s.uploadButton}>
              {uploading ? <ActivityIndicator color={colors.primary} /> : <Text style={s.moreText}>Upload photo</Text>}
            </Pressable>}
          </>}
          <Text style={s.label}>Note (optional)</Text>
          <TextInput value={note} onChangeText={setNote} maxLength={300} placeholder={t(tab === "OUT" ? "e.g. Family expense, change money" : "Note (optional)")} placeholderTextColor={colors.muted} style={s.note} />
        </>}
        {!!error && <Text style={s.error}>{error}</Text>}
        {!!done && <Text style={s.done}>{done}</Text>}
        <Pressable accessibilityRole="button" disabled={!canSave} onPress={() => void save()} style={[s.save, { backgroundColor: tab === "IN" ? IN : OUT }, !canSave && s.disabled]}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={s.saveText}>{`${t(tab === "IN" ? "Confirm cash in" : "Confirm cash out")}${paisa > 0 ? ` ${money(paisa)}` : ""}`}</Text>}
        </Pressable>
      </>}
    </View>}

    <CashTransactions reload={reload} />
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F7F9" },
  content: { padding: 16, paddingBottom: 40, gap: 14, width: "100%", maxWidth: 640, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  h1: { fontSize: 20, fontWeight: "700", color: "#111827" },
  partnerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  h2: { fontSize: 15, fontWeight: "600", color: "#111827" },
  tabs: { flexDirection: "row", gap: 6, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: "#E5E7EB", padding: 4 },
  tab: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  tabText: { fontSize: 14, fontWeight: "700", color: "#6B7280" }, tabTextOn: { color: colors.white },
  card: { gap: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: colors.white, padding: 16 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: .4, textTransform: "uppercase", color: "#6B7280", marginTop: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: "#111827" }, chipTextOn: { color: colors.white },
  chipHint: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  amountBox: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 13, paddingHorizontal: 14 },
  taka: { fontSize: 24, fontWeight: "800", color: "#6B7280" },
  amountInput: { flex: 1, fontSize: 26, fontWeight: "800", color: "#111827", paddingVertical: 8, outlineStyle: "none" } as never,
  note: { minHeight: 46, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 11, paddingHorizontal: 12, fontSize: 13, color: "#111827" },
  hint: { fontSize: 12, color: "#6B7280" },
  proofRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  proofImage: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#F3F4F6" },
  removeText: { fontSize: 13, fontWeight: "700", color: OUT },
  uploadButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, borderRadius: 11 },
  moreToggle: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center" },
  moreText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  error: { fontSize: 12, color: OUT, fontWeight: "600" },
  done: { fontSize: 13, color: IN, fontWeight: "700" },
  save: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 13, marginTop: 4 },
  saveText: { fontSize: 15, fontWeight: "800", color: colors.white },
  disabled: { opacity: .45 },
});
