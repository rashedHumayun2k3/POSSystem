import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import { CashPaymentInputs, cashMethods, cashMethodLabel, parseCashPayments } from "../utils/expenseCashPayments";

export default function ExpenseCashPaymentFields({ value, onChange, amount, disabled = false }: {
  value: CashPaymentInputs; onChange: (value: CashPaymentInputs) => void; amount: number; disabled?: boolean;
}) {
  const { lang } = useLanguage(); const bn = lang === "bn";
  const result = parseCashPayments(value, amount, bn);
  const money = (n: number) => `৳${n.toLocaleString(bn ? "bn-BD" : "en-BD", { maximumFractionDigits: 2 })}`;
  return <View style={styles.container}>
    <Text style={styles.hint}>{bn ? "এক বা একাধিক উৎস বেছে নিয়ে টাকার পরিমাণ দিন।" : "Select one or more sources and enter the amounts."}</Text>
    {cashMethods.map(key => {
      const checked = value[key] !== undefined; const label = cashMethodLabel(key, bn);
      return <View key={key} style={styles.row}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled}
          style={styles.option} onPress={() => { const next = { ...value }; if (checked) delete next[key]; else next[key] = ""; onChange(next); }}>
          <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={colors.primary}/><Text style={styles.label}>{label}</Text>
        </Pressable>
        {checked && <TextInput accessibilityLabel={`${label} ${bn ? "টাকার পরিমাণ" : "amount"}`} editable={!disabled} keyboardType="decimal-pad"
          value={value[key]} onChangeText={text => onChange({ ...value, [key]: text })} placeholder="0.00" placeholderTextColor={colors.muted} style={styles.input}/>}
      </View>;
    })}
    <Text style={styles.total}>{bn ? "মোট পেমেন্ট" : "Total payment"}: {money(result.total)} / {money(amount)}</Text>
    {result.total !== amount && <Text style={styles.hint}>{bn ? (result.total > amount ? "অতিরিক্ত" : "বাকি") : (result.total > amount ? "Over allocated" : "Remaining")}: {money(Math.abs(amount - result.total))}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 0 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 0 },
  option: { flexDirection: "row", alignItems: "center", gap: 6, flexGrow: 1, minHeight: 32 },
  label: { fontSize: 12, color: colors.heading, fontWeight: "600" },
  hint: { fontSize: 12, color: colors.secondary }, total: { fontSize: 12, color: colors.heading, fontWeight: "700" },
  input: { width: 130, minHeight: 32, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, color: colors.heading, backgroundColor: colors.white },
});
