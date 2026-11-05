import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

export type PurchaseExpenseReference = { source?: string; tripId?: string | null; poNumber?: string | null; lotId?: string | null; lotNo?: string | null; payerName?: string | null; paidAt?: string | null };
export default function PurchaseExpenseInfo({ expense }: { expense: PurchaseExpenseReference }) {
  const { lang } = useLanguage();
  if (expense.source !== "PURCHASE_PAYMENT" || !expense.tripId) return null;
  return <View style={{gap:4,marginTop:5}}>
    <Text style={{fontSize:11,color:colors.secondary}}>{lang === "bn" ? "পরিশোধ করেছেন" : "Paid by"}: {expense.payerName || (lang === "bn" ? "নাম পাওয়া যায়নি" : "Name unavailable")}{expense.paidAt ? ` · ${new Date(expense.paidAt).toLocaleString()}` : ""}</Text>
    <Pressable accessibilityRole="link" onPress={() => router.push({pathname:"/more/purchases/[id]",params:{id:expense.tripId!,...(expense.lotId ? {lotId:expense.lotId} : {})}})} style={{paddingVertical:8}}>
      <Text style={{fontSize:12,fontWeight:"700",color:colors.primaryDark}}>{expense.poNumber} {expense.lotNo ? `· ${expense.lotNo}` : ""} →</Text>
    </Pressable>
  </View>;
}
