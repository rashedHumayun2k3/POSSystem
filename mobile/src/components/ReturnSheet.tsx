import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text as PlainText, TextInput, View, useWindowDimensions } from "react-native";
import PopupSheet from "./PopupSheet";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { decimalInput } from "../utils/numericInput";

export type ReturnItem = { id: string; productName: string; variantLabel?: string; qty: number; unitPrice?: number };
type Payment = { method: string; amount: number };
type Reason = "DEFECTIVE" | "DAMAGED_DELIVERY" | "WRONG_SIZE_COLOR" | "CHANGED_MIND" | "OTHER";
type Money = "REFUND" | "EXCHANGE" | "DUE_ADJUST" | "KEEP";
type Wallet = "CASH" | "BKASH" | "NAGAD";

export type ReturnBody = {
  items: { orderItemId: string; qty: number; inspection: "SELLABLE" | "DAMAGED" }[];
  resolutionType: string; reason?: string; note?: string; refundAmount?: number; refundMethod?: string;
};

type Props = {
  visible: boolean; onClose: () => void; busy: boolean; error?: string; lang: string;
  /** COURIER = parcel came back undelivered; CUSTOMER = customer brings goods back. */
  mode: "COURIER" | "CUSTOMER";
  items: ReturnItem[]; payments: Payment[]; due: number;
  onSubmit: (body: ReturnBody) => void;
};

const REASONS: [Reason, string, string][] = [
  ["DEFECTIVE", "ত্রুটিযুক্ত / ভাঙা", "Defective / broken"],
  ["DAMAGED_DELIVERY", "ডেলিভারিতে নষ্ট", "Damaged in delivery"],
  ["WRONG_SIZE_COLOR", "ভুল সাইজ / রং", "Wrong size / color"],
  ["CHANGED_MIND", "মত বদলেছে", "Changed mind"],
  ["OTHER", "অন্যান্য", "Other"],
];
const damagedReason = (r: Reason | "") => r === "DEFECTIVE" || r === "DAMAGED_DELIVERY";
const WALLETS: [Wallet, string, string][] = [["CASH", "Cash", colors.success], ["BKASH", "bKash", "#E2136E"], ["NAGAD", "Nagad", "#F7941D"]];
const taka = (n: number) => `৳${Number(n.toFixed(2)).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function ReturnSheet({ visible, onClose, busy, error, lang, mode, items, payments, due, onSubmit }: Props) {
  const bn = lang === "bn";
  const phone = useWindowDimensions().width < 600;
  const say = (b: string, e: string) => (bn ? b : e);
  // per item: [good, damaged]
  const [counts, setCounts] = useState<Record<string, [number, number]>>({});
  const [reason, setReason] = useState<Reason | "">("");
  const [money, setMoney] = useState<Money>("KEEP");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [wallet, setWallet] = useState<Wallet>("CASH");
  const [note, setNote] = useState("");

  // Money really received (cash/bKash/Nagad/card), net of earlier refunds.
  const cashPaid = Math.max(0, payments.filter(p => p.method !== "RETURN_ADJUST").reduce((n, p) => n + p.amount, 0));
  const lastWallet = ([...payments].reverse().find(p => p.amount > 0 && ["CASH", "BKASH", "NAGAD"].includes(p.method))?.method ?? "CASH") as Wallet;
  const options: [Money, string, string][] = [
    ...(cashPaid > 0 ? [["REFUND", "টাকা ফেরত", "Refund"] as [Money, string, string]] : []),
    ...(mode === "CUSTOMER" ? [["EXCHANGE", "এক্সচেঞ্জ", "Exchange"] as [Money, string, string]] : []),
    ...(mode === "CUSTOMER" && due > 0 ? [["DUE_ADJUST", "বাকিতে সমন্বয়", "Reduce due"] as [Money, string, string]] : []),
    ...(mode === "COURIER" && cashPaid > 0 ? [["KEEP", "অগ্রিম রেখে দিন", "Keep advance"] as [Money, string, string]] : []),
  ];

  useEffect(() => {
    if (!visible) return;
    setCounts(Object.fromEntries(items.map(i => [i.id, [items.length === 1 ? i.qty : 0, 0]])));
    setReason(""); setNote(""); setAmount(""); setAmountTouched(false); setWallet(lastWallet);
    setMoney(mode === "CUSTOMER" && due > 0 && cashPaid <= 0 ? "DUE_ADJUST" : cashPaid > 0 ? "REFUND" : mode === "CUSTOMER" ? "EXCHANGE" : "KEEP");
  }, [visible]);

  const totalGood = Object.values(counts).reduce((n, c) => n + c[0], 0);
  const totalDamaged = Object.values(counts).reduce((n, c) => n + c[1], 0);
  const returnedValue = items.reduce((n, i) => n + ((counts[i.id]?.[0] ?? 0) + (counts[i.id]?.[1] ?? 0)) * (i.unitPrice ?? 0), 0);
  const cap = money === "REFUND" ? cashPaid : money === "DUE_ADJUST" ? due : 0;
  const needsAmount = money === "REFUND" || money === "DUE_ADJUST";

  // Amount follows quantity × price until the cashier edits it; always capped.
  useEffect(() => { if (!amountTouched) setAmount(needsAmount ? String(Math.min(cap, returnedValue)) : ""); }, [returnedValue, money, cap, amountTouched]);

  const pickReason = (r: Reason) => {
    setReason(r);
    // Move everything to the side that matches the reason, keeping each product's total.
    setCounts(c => Object.fromEntries(Object.entries(c).map(([k, [g, d]]) => [k, damagedReason(r) ? [0, g + d] : [g + d, 0]])));
  };
  const change = (id: string, side: 0 | 1, delta: number) => setCounts(c => {
    const item = items.find(i => i.id === id)!; const cur = c[id] ?? [0, 0];
    const next: [number, number] = [...cur] as [number, number];
    next[side] = Math.max(0, Math.min(item.qty - cur[side === 0 ? 1 : 0], cur[side] + delta));
    return { ...c, [id]: next };
  });

  const value = Number(amount || 0);
  const amountError = needsAmount && (!Number.isFinite(value) || value <= 0 || value > cap) ? say(`0-এর বেশি এবং সর্বোচ্চ ${taka(cap)} দিন`, `Enter more than 0 and at most ${taka(cap)}`) : "";
  const noteError = reason === "OTHER" && !note.trim() ? say("'অন্যান্য' হলে কারণটি লিখুন", "Write the reason for 'Other'") : "";
  const missing = totalGood + totalDamaged === 0 ? say("কোন পণ্য কয়টি ফেরত আসছে দিন", "Choose what is coming back")
    : !reason ? say("ফেরতের কারণ বেছে নিন", "Choose a reason") : amountError || noteError;

  const stockPart = [totalGood ? say(`${totalGood} স্টকে`, `${totalGood} to stock`) : "", totalDamaged ? say(`${totalDamaged} নষ্ট`, `${totalDamaged} damaged`) : ""].filter(Boolean).join(", ");
  const walletName = WALLETS.find(w => w[0] === wallet)![1];
  const moneyPart = money === "REFUND" ? say(`${taka(value)} ${walletName}-এ ফেরত`, `Refund ${taka(value)} by ${walletName}`)
    : money === "DUE_ADJUST" ? say(`বাকি থেকে ${taka(value)} কমবে`, `Due reduced by ${taka(value)}`)
    : money === "EXCHANGE" ? say("এক্সচেঞ্জ", "Exchange") : "";
  const summary = [moneyPart, stockPart].filter(Boolean).join(" · ");

  const submit = () => {
    if (missing || busy) return;
    const rows: ReturnBody["items"] = [];
    for (const i of items) { const [g, d] = counts[i.id] ?? [0, 0]; if (g) rows.push({ orderItemId: i.id, qty: g, inspection: "SELLABLE" }); if (d) rows.push({ orderItemId: i.id, qty: d, inspection: "DAMAGED" }); }
    onSubmit({
      items: rows, reason: reason || undefined, note: note.trim() || undefined,
      resolutionType: money === "REFUND" ? "REFUND" : money === "DUE_ADJUST" ? "DUE_ADJUST" : money === "EXCHANGE" ? "EXCHANGE_DIFFERENT" : mode === "COURIER" ? "COURIER_RETURN" : "REPLACE_SAME",
      refundAmount: needsAmount ? value : undefined, refundMethod: money === "REFUND" ? wallet : undefined,
    });
  };

  return <PopupSheet visible={visible} onClose={() => { if (!busy) onClose(); }} title={say("ফেরত / টাকা ফেরত", "Return / Refund")}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.content}>
      {/* 1. What is coming back */}
      <View style={st.section}><Text style={st.label}>{say("কোন পণ্য, কয়টি ফেরত আসছে?", "Which products, how many?")}</Text>
      {items.map(i => { const [g, d] = counts[i.id] ?? [0, 0]; return <View key={i.id} style={st.card}>
        <View style={st.itemHead}><Text style={st.product}>{i.productName}</Text><Text style={st.muted}>{say("অর্ডার ছিল", "Ordered")}: {i.qty}{i.unitPrice ? ` · ${taka(i.unitPrice)}` : ""}</Text></View>
        <View style={[st.counters, phone && st.countersStacked]}>
          <Counter full={phone} title={say("ভালো (স্টকে)", "Good (to stock)")} value={g} color={colors.successText} onMinus={() => change(i.id, 0, -1)} onPlus={() => change(i.id, 0, 1)} />
          <Counter full={phone} title={say("নষ্ট", "Damaged")} value={d} color={colors.dangerText} onMinus={() => change(i.id, 1, -1)} onPlus={() => change(i.id, 1, 1)} />
        </View>
      </View>; })}</View>

      {/* 2. Why */}
      <View style={st.section}><Text style={st.label}>{say("কেন ফেরত আসছে?", "Why is it coming back?")}</Text>
      <View style={st.chips}>{REASONS.map(([r, b, e]) => <Pressable key={r} onPress={() => pickReason(r)} style={[st.chip, reason === r && st.chipOn]}><Text style={[st.chipText, reason === r && st.chipTextOn]}>{say(b, e)}</Text></Pressable>)}</View></View>

      {/* 3. Money */}
      {options.length > 0 && <View style={st.section}>
        <Text style={st.label}>{say("টাকার কী হবে?", "What about the money?")}</Text>
        <View style={st.chips}>{options.map(([m, b, e]) => <Pressable key={m} onPress={() => { setMoney(m); setAmountTouched(false); }} style={[st.chip, money === m && st.chipOn]}><Text style={[st.chipText, money === m && st.chipTextOn]}>{say(b, e)}</Text></Pressable>)}</View>
        {needsAmount && <>
          <View style={st.amountRow}><Text style={st.taka}>৳</Text><TextInput value={amount} onChangeText={v => { setAmountTouched(true); setAmount(decimalInput(v)); }} keyboardType="decimal-pad" style={st.amountInput} accessibilityLabel={say("টাকার পরিমাণ", "Amount")} /></View><Text style={st.muted}>{say("সর্বোচ্চ", "Maximum")} {taka(cap)}</Text>
          {money === "REFUND" && <View style={st.chips}>{WALLETS.map(([w, name, dot]) => <Pressable key={w} onPress={() => setWallet(w)} style={[st.chip, st.walletChip, wallet === w && st.chipOn]}><View style={[st.dot, { backgroundColor: dot }]} /><PlainText style={[st.chipText, wallet === w && st.chipTextOn]}>{name}</PlainText></Pressable>)}</View>}
        </>}
        {money === "EXCHANGE" && <Text style={st.hint}>{say("ফেরত নেওয়ার পর নতুন পণ্যটি POS থেকে বিক্রি করুন। দামের পার্থক্য সেখানে নিন বা ফেরত দিন।", "After this, sell the new item from POS and settle the price difference there.")}</Text>}
        {money === "DUE_ADJUST" && <Text style={st.hint}>{say("কোনো টাকা দেওয়া-নেওয়া হবে না, কাস্টমারের বাকি কমবে।", "No cash moves; the customer's due goes down.")}</Text>}
      </View>}

      {/* 4. Note */}
      <View style={st.section}><Text style={st.label}>{say("নোট", "Note")}{reason === "OTHER" ? " *" : ""}</Text>
      <TextInput value={note} onChangeText={setNote} multiline placeholder={reason === "OTHER" ? say("কারণটি লিখুন", "Write the reason") : say("কারণ / কাস্টমারের অভিযোগ (ঐচ্ছিক)", "Reason / customer complaint (optional)")} placeholderTextColor={colors.muted} style={[st.note, !note && { fontSize: 12 }]} /></View>

      {!!error && <Text style={st.error}>{error}</Text>}
      {!!missing && <Text style={st.guide}>{missing}</Text>}
      <Pressable accessibilityRole="button" disabled={!!missing || busy} onPress={submit} style={[st.primary, (!!missing || busy) && st.disabled]}>
        {busy ? <ActivityIndicator color={colors.white} /> : <>
          <Text style={st.primaryText}>{say("ফেরত নিশ্চিত করুন", "Confirm return")}</Text>
          {!!summary && <Text style={st.primarySub}>{summary}</Text>}
        </>}
      </Pressable>
    </ScrollView>
  </PopupSheet>;
}

function Counter({ title, value, color, onMinus, onPlus, full }: { title: string; value: number; color: string; onMinus: () => void; onPlus: () => void; full?: boolean }) {
  return <View style={[st.counter, full && st.counterFull]}>
    <Text style={[st.counterTitle, { color }]}>{title}</Text>
    <View style={st.counterRow}>
      <Pressable accessibilityLabel={`${title} −`} onPress={onMinus} style={st.step}><Text style={st.stepText}>−</Text></Pressable>
      <Text style={st.count}>{value}</Text>
      <Pressable accessibilityLabel={`${title} +`} onPress={onPlus} style={st.step}><Text style={st.stepText}>+</Text></Pressable>
    </View>
  </View>;
}

const st = StyleSheet.create({
  content: { gap: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22 },
  section: { gap: 8 },
  guide: { color: colors.secondary, fontSize: 12, textAlign: "center" },
  label: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: colors.white },
  itemHead: { gap: 2 },
  product: { color: colors.heading, fontSize: 14, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 12 },
  counters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  countersStacked: { flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" },
  counterFull: { flex: 0, flexBasis: "auto", width: "100%", minWidth: 0 },
  counter: { flex: 1, minWidth: 130, borderRadius: 10, backgroundColor: colors.cardSecondary, paddingVertical: 8, paddingHorizontal: 10, gap: 6 },
  counterTitle: { fontSize: 12, fontWeight: "700" },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  stepText: { fontSize: 18, fontWeight: "700", color: colors.heading },
  count: { fontSize: 18, fontWeight: "800", color: colors.heading, minWidth: 30, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, color: colors.secondary, fontWeight: "600" },
  chipTextOn: { color: colors.primaryDark },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taka: { fontSize: 18, fontWeight: "700", color: colors.heading },
  amountInput: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 18, fontWeight: "700", color: colors.heading, backgroundColor: colors.white },
  hint: { color: colors.secondary, fontSize: 12, lineHeight: 17, backgroundColor: colors.cardSecondary, borderRadius: 8, padding: 8 },
  note: { minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.heading, textAlignVertical: "top", backgroundColor: colors.white },
  error: { color: colors.dangerText, fontSize: 12 },
  primary: { minHeight: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 14 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  primarySub: { color: colors.white, fontSize: 12, marginTop: 2, textAlign: "center" },
  disabled: { opacity: 0.45 },
});
