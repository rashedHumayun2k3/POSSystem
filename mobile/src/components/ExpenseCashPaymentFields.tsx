import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import { CashPaymentInputs, cashMethods, cashMethodLabel, parseCashPayments, expenseAmountInput } from "../utils/expenseCashPayments";

export default function ExpenseCashPaymentFields({ value, onChange, amount, disabled = false, active = true }: {
  value: CashPaymentInputs; onChange: (value: CashPaymentInputs) => void; amount: number; disabled?: boolean; active?: boolean;
}) {
  const { lang } = useLanguage(); const bn = lang === "bn";
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const scope = `${auth.session?.businessId}:${auth.session?.branchId}:${auth.session?.user.id}`;
  const [retry, setRetry] = useState(0);
  const [balances, setBalances] = useState<{scope:string; rows:{name:string;value:number}[];asOf?:string}|null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [editingSource, setEditingSource] = useState<typeof cashMethods[number] | null>(null);
  useEffect(() => { if (!active) setEditingSource(null); }, [active]);
  useEffect(() => {
    let current = true; setBalances(null); setBalanceError(false);
    if (active) api.current<{rows:{name:string;value:number}[];asOf?:string}>("/reports/dashboard/money-section")
      .then(data => { if (current) setBalances({...data, scope}); })
      .catch(() => { if (current) setBalanceError(true); });
    return () => { current = false; };
  }, [active, scope, retry]);
  const currentBalances = active && balances?.scope === scope ? balances : null;
  const sourceNames = {cash:"Cash",bkash:"bKash",nagad:"Nagad"};
  const result = parseCashPayments(value, amount, bn);
  const money = (n: number) => `৳${n.toLocaleString(bn ? "bn-BD-u-nu-latn" : "en-BD", { maximumFractionDigits: 2 })}`;
  return <View style={styles.container}>
    <Text style={styles.balanceHeading}>{bn ? "উৎস অনুযায়ী রেকর্ড করা ব্যালেন্স" : "Recorded balance by source"}</Text>
    <Text style={styles.hint}>{bn ? "এক বা একাধিক উৎস বেছে নিয়ে টাকার পরিমাণ দিন।" : "Select one or more sources and enter the amounts."}</Text>
    {cashMethods.map(key => {
      const checked = value[key] !== undefined; const label = cashMethodLabel(key, bn);
      const balance = currentBalances?.rows.find(row => row.name === sourceNames[key])?.value;
      return <View key={key} style={styles.row}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled}
          style={styles.option} onPress={() => {
            const next = { ...value };
            if (checked) delete next[key];
            else next[key] = String(Math.max(0, Math.round(amount * 100) - Math.round(result.total * 100)) / 100);
            setEditingSource(null);
            onChange(next);
          }}>
          <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={colors.primary}/><View style={styles.sourceCopy}><Text style={styles.label}>{label}</Text>
          <Text style={styles.sourceBalance}>{bn ? "রেকর্ড অনুযায়ী ব্যালেন্স" : "Recorded balance"}: {balanceError ? "—" : balance === undefined ? (currentBalances ? "—" : (bn ? "লোড হচ্ছে…" : "Loading…")) : money(balance)}</Text></View>
        </Pressable>
        {checked && (editingSource === key ? <TextInput accessibilityLabel={`${label} ${bn ? "খরচের পরিমাণ" : "amount to spend"}`} editable={!disabled} keyboardType="decimal-pad" inputMode="decimal" autoCorrect={false} autoCapitalize="none" autoFocus selectTextOnFocus
          onBlur={() => setEditingSource(current => current === key ? null : current)} onSubmitEditing={() => setEditingSource(null)}
          value={value[key]} onChangeText={text => onChange({ ...value, [key]: expenseAmountInput(text,value[key]??"") })} placeholder={bn ? "খরচের পরিমাণ" : "Amount to spend"} placeholderTextColor={colors.muted} style={styles.input}/>
          : <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${money(Number(value[key]) || 0)}. ${bn ? "খরচের পরিমাণ পরিবর্তন করুন" : "Edit amount to spend"}`} disabled={disabled} onPress={() => setEditingSource(key)} style={styles.amountLabel}>
            <Text style={styles.amountText}>{money(Number(value[key]) || 0)}</Text><Ionicons name="pencil-outline" size={14} color={colors.primaryDark}/>
          </Pressable>)}
      </View>;
    })}
    <View style={styles.balanceStatus}>
      <Text style={styles.balance}>{balanceError ? (bn ? "ব্যালেন্স লোড করা যায়নি।" : "Balances could not be loaded.") : currentBalances?.asOf ? `${bn ? "সর্বশেষ আপডেট" : "Updated"}: ${new Date(currentBalances.asOf).toLocaleString(bn ? "bn-BD-u-nu-latn" : "en-BD")}` : ""}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={()=>setRetry(n=>n+1)} style={styles.refresh}><Text style={styles.refreshText}>{bn ? "রিফ্রেশ" : "Refresh"}</Text></Pressable>
    </View>
    <Text style={styles.balance}>{bn ? "ব্যক্তিগতভাবে গুনে নিশ্চিত করা ব্যালেন্স নয়; রেকর্ড না করা শুরুর টাকা অন্তর্ভুক্ত নেই।" : "Recorded balances do not include opening money that was never recorded; they are not verified drawer counts."}</Text>
    <Text style={styles.total}>{bn ? "মোট পেমেন্ট" : "Total payment"}: {money(result.total)} / {money(amount)}</Text>
    {result.total !== amount && <Text style={styles.hint}>{bn ? (result.total > amount ? "অতিরিক্ত" : "বাকি") : (result.total > amount ? "Over allocated" : "Remaining")}: {money(Math.abs(amount - result.total))}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 0 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 0 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, flexGrow: 1, minHeight: 44 },
  sourceCopy: { gap: 2, flexShrink: 1 },
  balanceHeading: { fontSize: 12, fontWeight: "700", color: colors.heading, marginBottom: 4 },
  sourceBalance: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: colors.primaryDark },
  balance: { fontSize: 10, lineHeight: 15, color: colors.secondary },
  balanceStatus: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 },
  refresh: { minHeight: 36, justifyContent: "center", paddingHorizontal: 6 },
  refreshText: { fontSize: 11, fontWeight: "600", color: colors.primaryDark },
  label: { fontSize: 12, color: colors.heading, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.secondary }, total: { fontSize: 12, color: colors.heading, fontWeight: "700" },
  input: { width: 130, minHeight: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, color: colors.heading, backgroundColor: colors.white },
  amountLabel: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  amountText: { fontSize: 13, fontWeight: "600", color: colors.primaryDark, fontVariant: ["tabular-nums"] },
});
