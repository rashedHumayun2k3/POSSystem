import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import type { PurchaseCost } from "../types/purchases";
import PurchasePaymentSource, { type PurchasePayment } from "./PurchasePaymentSource";
import { purchaseCostStyles as s } from "./purchaseCostStyles";
import { useAuth } from "../auth/AuthContext";

export default function LotCosts({ lotId, lotNo, tripId, poNumber, costs, payments, allowPay, canDelete, onDelete, onPaid, onUpdated }: {
 lotId: string; lotNo: string; tripId: string; poNumber: string; costs: PurchaseCost[]; payments: PurchasePayment[] | null;
 allowPay: boolean; canDelete: (cost: PurchaseCost) => boolean; onDelete: (cost: PurchaseCost) => void; onPaid: (payment: PurchasePayment) => void; onUpdated:()=>void;
}) {
 const { t,lang } = useLanguage();
 const { api } = useAuth();
 const [editing,setEditing]=useState<string|null>(null),[amount,setAmount]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const lotCosts = costs.filter(cost => cost.shipmentId === lotId);
 const money = (amount: number) => `৳${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
 const saveAmount=async(cost:PurchaseCost)=>{const value=Number(amount);if(saving||amount.trim()===""||!Number.isFinite(value)||value<0)return;setSaving(true);setError("");try{await api(`/purchase-trips/${tripId}/costs/${cost.id}/amount`,{method:"PATCH",body:JSON.stringify({amount:value})});setEditing(null);onUpdated()}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 return <View>
  <Text style={[s.groupAmount,{paddingHorizontal:10,paddingVertical:7}]}>{lang==="bn"?"লটের মোট খরচ":"Total Lot Cost"}: {money(lotCosts.reduce((sum, cost) => sum + cost.amount, 0))}</Text>
  {!lotCosts.length && <Text style={s.empty}>{lang==="bn"?"এই লটে এখনো কোনো খরচ যোগ করা হয়নি।":"No costs added to this lot yet."}</Text>}
  {lotCosts.map(cost => {
   const payment = payments?.find(p => p.costKey === cost.id);
   const title = cost.costType === "CHINA_LOCAL" ? "China Local" : cost.costType === "COURIER" ? "Courier" : cost.costType.replaceAll("_", " ");
   return <View key={cost.id} style={[s.lotCostItem, { paddingHorizontal: 7, paddingVertical: 5 }, payment && s.paidEntry]}>
    <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name="receipt-outline" size={16} color={colors.neutralIcon}/><Text style={[s.title,{flex:1}]}>{title}</Text><Text style={s.amount}>{money(cost.amount)}</Text></View>
    {editing===cost.id&&<View style={{gap:6,marginTop:7,padding:8,borderRadius:8,backgroundColor:colors.cardSecondary}}><Text style={s.note}>Edit cost amount only (BDT)</Text><TextInput autoFocus value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:8,paddingHorizontal:10,color:colors.heading,backgroundColor:colors.white}}/>{!!error&&<Text style={{color:colors.dangerText,fontSize:11}}>{error}</Text>}<View style={{flexDirection:"row",justifyContent:"flex-end",gap:6}}><Pressable disabled={saving} onPress={()=>{setEditing(null);setError("")}} style={s.retry}><Text style={s.note}>Cancel</Text></Pressable><Pressable disabled={saving||amount.trim()===""||!Number.isFinite(Number(amount))||Number(amount)<0} onPress={()=>void saveAmount(cost)} style={[s.retry,{backgroundColor:colors.primary}]}>{saving?<ActivityIndicator size="small" color={colors.white}/>:<Text style={{color:colors.white,fontWeight:"700",fontSize:11}}>Save</Text>}</Pressable></View></View>}
    <View style={{flexDirection:"row",alignItems:"flex-end",gap:6,marginTop:2}}>
     <View style={{flex:1,minWidth:100}}>
      {!!cost.note && <Text style={[s.note,{marginTop:0}]}>{cost.note}</Text>}
      {payments === null ? <Text style={s.note}>Payment status unavailable</Text> : payment ? <><Text style={[s.status,s.paidText,{alignSelf:"flex-start",marginTop:3}]}>{t("poCostPayment.paid")}</Text><Text style={s.note}>{t(payment.fundingSource === "BUSINESS" ? "poPayment.business" : "poPayment.personal")} · {new Date(payment.paidAt).toLocaleString()}</Text></> : <View style={[s.unpaidBadge,{marginTop:3}]}><Text style={s.unpaidText}>{cost.amount > 0 ? "Payment Not done" : "No payment required"}</Text></View>}
     </View>
     <View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:3,marginLeft:"auto",flexShrink:0}}>
      {payments !== null && !payment && allowPay && cost.amount > 0 && <PurchasePaymentSource compact tripId={tripId} costKey={cost.id} poNumber={poNumber} itemTitle={title} amount={cost.amount} onPaid={onPaid}/>}
      {payments !== null && !payment && canDelete(cost) && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={()=>{setEditing(cost.id);setAmount(String(cost.amount));setError("")}} style={{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:6,backgroundColor:colors.white}}><Ionicons name="pencil-outline" color={colors.primaryDark} size={16}/></Pressable>}
      {payments !== null && !payment && canDelete(cost) && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${title}`} onPress={()=>onDelete(cost)} style={{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:6,backgroundColor:colors.white}}><Ionicons name="trash-outline" color={colors.danger} size={16}/></Pressable>}
     </View>
    </View>
   </View>;

  })}
 </View>;
}
