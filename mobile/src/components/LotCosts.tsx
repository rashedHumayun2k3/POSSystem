import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import type { PurchaseCost } from "../types/purchases";
import PurchasePaymentSource, { type PurchasePayment } from "./PurchasePaymentSource";
import { purchaseCostStyles as s } from "./purchaseCostStyles";

export default function LotCosts({ lotId, lotNo, tripId, poNumber, costs, payments, allowPay, canDelete, onDelete, onPaid }: {
 lotId: string; lotNo: string; tripId: string; poNumber: string; costs: PurchaseCost[]; payments: PurchasePayment[] | null;
 allowPay: boolean; canDelete: (cost: PurchaseCost) => boolean; onDelete: (cost: PurchaseCost) => void; onPaid: (payment: PurchasePayment) => void;
}) {
 const { t } = useLanguage();
 const lotCosts = costs.filter(cost => cost.shipmentId === lotId);
 const money = (amount: number) => `৳${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
 return <View>
  <View style={[s.groupHeading, { paddingVertical: 7, paddingHorizontal: 10 }]}><View style={s.grow}><Text style={s.groupTitle}>{lotNo} Costs</Text><Text style={[s.groupNote, { marginTop: 1 }]}>Total lot cost</Text></View><Text style={s.groupAmount}>{money(lotCosts.reduce((sum, cost) => sum + cost.amount, 0))}</Text></View>
  {!lotCosts.length && <Text style={s.empty}>No costs added to this lot yet.</Text>}
  {lotCosts.map(cost => {
   const payment = payments?.find(p => p.costKey === cost.id);
   const title = cost.costType === "CHINA_LOCAL" ? "China Local" : cost.costType === "COURIER" ? "Courier" : cost.costType.replaceAll("_", " ");
   return <View key={cost.id} style={[s.lotCostItem, { paddingHorizontal: 10, paddingVertical: 8 }, payment && s.paidEntry]}>
    <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name="receipt-outline" size={16} color={colors.neutralIcon}/><Text style={[s.title,{flex:1}]}>{title}</Text><Text style={s.amount}>{money(cost.amount)}</Text></View>
    <View style={{flexDirection:"row",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
     <View style={{flex:1,minWidth:100}}>
      {!!cost.note && <Text style={[s.note,{marginTop:0}]}>{cost.note}</Text>}
      {payments === null ? <Text style={s.note}>Payment status unavailable</Text> : payment ? <><Text style={[s.status,s.paidText,{alignSelf:"flex-start",marginTop:3}]}>{t("poCostPayment.paid")}</Text><Text style={s.note}>{t(payment.fundingSource === "BUSINESS" ? "poPayment.business" : "poPayment.personal")} · {new Date(payment.paidAt).toLocaleString()}</Text></> : <View style={[s.unpaidBadge,{marginTop:3}]}><Text style={s.unpaidText}>{cost.amount > 0 ? "Payment Not done" : "No payment required"}</Text></View>}
     </View>
     <View style={{flexDirection:"row",alignItems:"center",gap:4,marginLeft:"auto"}}>
      {payments !== null && !payment && allowPay && cost.amount > 0 && <PurchasePaymentSource compact tripId={tripId} costKey={cost.id} poNumber={poNumber} itemTitle={title} amount={cost.amount} onPaid={onPaid}/>}
      {payments !== null && !payment && canDelete(cost) && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${title}`} onPress={()=>onDelete(cost)} style={s.retry}><Ionicons name="trash-outline" color={colors.danger} size={18}/></Pressable>}
     </View>
    </View>
   </View>;

  })}
 </View>;
}
