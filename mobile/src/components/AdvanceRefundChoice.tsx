import { Pressable, StyleSheet, Text as PlainText, TextInput, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { decimalInput } from "../utils/numericInput";

export type Wallet = "CASH" | "BKASH" | "NAGAD";
export type AdvanceChoice = { mode: "REFUND" | "KEEP"; amount: string; method: Wallet };
type Payment = { method: string; amount: number };

export const WALLETS: [Wallet, string, string][] = [["CASH", "Cash", colors.success], ["BKASH", "bKash", "#E2136E"], ["NAGAD", "Nagad", "#F7941D"]];
const taka = (n: number) => `৳${Number(n.toFixed(2)).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

/** Money actually received on an order (advances, payments) minus refunds already given. */
export const receivedOf = (payments: Payment[] = []) => Math.max(0, payments.filter(p => p.method !== "RETURN_ADJUST").reduce((n, p) => n + p.amount, 0));
/** The wallet the customer last paid with, so the refund goes back the same way. */
export const lastWalletOf = (payments: Payment[] = []): Wallet => ([...payments].reverse().find(p => p.amount > 0 && ["CASH", "BKASH", "NAGAD"].includes(p.method))?.method ?? "CASH") as Wallet;
export const defaultChoice = (payments: Payment[] = []): AdvanceChoice => ({ mode: "REFUND", amount: String(receivedOf(payments)), method: lastWalletOf(payments) });
export const choiceError = (c: AdvanceChoice, received: number, lang: string) => {
  if (c.mode === "KEEP") return "";
  const v = Number(c.amount);
  return !Number.isFinite(v) || v <= 0 || v > received ? (lang === "bn" ? `0-এর বেশি এবং সর্বোচ্চ ${taka(received)} দিন` : `Enter more than 0 and at most ${taka(received)}`) : "";
};

/** "What happens to the advance?" — used when cancelling or deleting an order that has money on it. */
export default function AdvanceRefundChoice({ payments, value, onChange, allowKeep, lang }: { payments: Payment[]; value: AdvanceChoice; onChange: (v: AdvanceChoice) => void; allowKeep: boolean; lang: string }) {
  const say = (b: string, e: string) => (lang === "bn" ? b : e);
  const received = receivedOf(payments);
  const paidWith = WALLETS.find(w => w[0] === lastWalletOf(payments))![1];
  const error = choiceError(value, received, lang);
  return <View style={st.box}>
    <Text style={st.title}>{say(`অগ্রিম ${taka(received)} (${paidWith}) নেওয়া হয়েছিল। টাকার কী হবে?`, `An advance of ${taka(received)} (${paidWith}) was received. What happens to it?`)}</Text>
    <View style={st.chips}>
      <Pressable onPress={() => onChange({ ...value, mode: "REFUND" })} style={[st.chip, value.mode === "REFUND" && st.chipOn]}><Text style={[st.chipText, value.mode === "REFUND" && st.chipTextOn]}>{say("টাকা ফেরত দিন", "Refund")}</Text></Pressable>
      {allowKeep && <Pressable onPress={() => onChange({ ...value, mode: "KEEP" })} style={[st.chip, value.mode === "KEEP" && st.chipOn]}><Text style={[st.chipText, value.mode === "KEEP" && st.chipTextOn]}>{say("টাকা রেখে দিন", "Keep it")}</Text></Pressable>}
    </View>
    {value.mode === "REFUND" ? <>
      <View style={st.amountRow}><PlainText style={st.taka}>৳</PlainText><TextInput value={value.amount} onChangeText={v => onChange({ ...value, amount: decimalInput(v) })} keyboardType="decimal-pad" selectTextOnFocus style={st.amount} accessibilityLabel={say("ফেরতের টাকা", "Refund amount")} /></View>
      <View style={st.chips}>{WALLETS.map(([w, name, dot]) => <Pressable key={w} onPress={() => onChange({ ...value, method: w })} style={[st.chip, st.walletChip, value.method === w && st.chipOn]}><View style={[st.dot, { backgroundColor: dot }]} /><PlainText style={[st.chipText, value.method === w && st.chipTextOn]}>{name}</PlainText></Pressable>)}</View>
      {!!error && <Text style={st.error}>{error}</Text>}
    </> : <Text style={st.hint}>{say("টাকা আপনার কাছেই থাকবে (বাতিলের চার্জ হিসেবে)।", "The money stays with you (as a cancellation charge).")}</Text>}
    {!allowKeep && <Text style={st.hint}>{say("টাকা রাখতে চাইলে ডিলিট না করে অর্ডারটি বাতিল করুন।", "To keep the money, cancel the order instead of deleting it.")}</Text>}
  </View>;
}

const st = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 12, backgroundColor: colors.white },
  title: { color: colors.heading, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, color: colors.secondary, fontWeight: "600" },
  chipTextOn: { color: colors.primaryDark },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taka: { fontSize: 18, fontWeight: "700", color: colors.heading },
  amount: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, paddingHorizontal: 12, fontSize: 17, fontWeight: "700", color: colors.heading },
  hint: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  error: { color: colors.dangerText, fontSize: 12 },
});
