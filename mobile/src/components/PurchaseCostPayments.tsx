import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PurchasePaymentSource, { type PurchasePayment } from "./PurchasePaymentSource";
import type { PurchaseCost } from "../types/purchases";
const productsKey = "00000000-0000-0000-0000-000000000000";
const labels: Record<string,string> = { TRANSPORT:"Transport", LABOR:"Labor", CUSTOMS:"Customs", SHIPPING_INTL:"poCostPayment.shipping", CURRENCY_LOSS:"Currency Loss", AGENT_FEE:"Agent Fee", PAYMENT_FEE:"Payment Fee", OTHER:"Other" };
export default function PurchaseCostPayments({tripId,poNumber,productAmount,hasProducts,costs,allowPay,canDelete,onDelete,onPaid,onApprove,approving}:{tripId:string;poNumber:string;productAmount:number;hasProducts:boolean;costs:PurchaseCost[];allowPay:boolean;canDelete:(cost:PurchaseCost)=>boolean;onDelete:(cost:PurchaseCost)=>void;onPaid:()=>void;onApprove?:()=>void;approving?:boolean}) {
 const {api,session}=useAuth(); const apiRef=useRef(api);apiRef.current=api;
 const {t}=useLanguage(); const [payments,setPayments]=useState<PurchasePayment[]>([]); const [loading,setLoading]=useState(true); const [failed,setFailed]=useState(false); const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setFailed(false);setPayments([]);void apiRef.current<PurchasePayment[]>(`/purchase-trips/${tripId}/payments`).then(data=>{if(active)setPayments(data)}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tripId,session?.businessId,session?.branchId,reload]);
 const rows=[...(hasProducts?[{key:productsKey,title:"poCostPayment.products",amount:productAmount,note:"",cost:null as PurchaseCost|null}]:[]),...costs.map(cost=>({key:cost.id,title:labels[cost.costType]??cost.costType,amount:cost.amount,note:cost.note,cost}))];
 return <View style={s.list}>
  <Text style={s.heading}>{t("poCostPayment.heading")}</Text>
  {loading&&<ActivityIndicator color={colors.primary}/>}
  {failed&&<View><Text accessibilityRole="alert" style={s.error}>{t("poCostPayment.loadFailed")}</Text><Pressable accessibilityRole="button" onPress={()=>setReload(x=>x+1)} style={s.retry}><Text>{t("common.retry")}</Text></Pressable></View>}
  {rows.map(row=>{const payment=payments.find(p=>p.costKey===row.key);return <View key={row.key} style={[s.card,payment&&s.paid]}>
   <View style={s.row}><View style={s.grow}><Text style={[s.title,payment&&s.paidText]}>{t(row.title)}</Text><Text style={[s.status,payment&&s.paidText]}>{payment?t("poCostPayment.paid"):loading||failed?t("poCostPayment.unknown"):t("poCostPayment.unpaid")}</Text></View><Text style={s.amount}>৳{row.amount.toLocaleString(undefined,{maximumFractionDigits:2})}</Text>
   {!loading&&!failed&&!payment&&row.cost&&canDelete(row.cost)&&<Pressable accessibilityRole="button" accessibilityLabel="Delete cost" onPress={()=>onDelete(row.cost!)} style={s.retry}><Ionicons name="trash-outline" color={colors.danger} size={20}/></Pressable>}</View>
   {!!row.note&&<Text style={s.note}>{row.note}</Text>}
   {payment&&<Text style={s.note}>{t(payment.fundingSource==="BUSINESS"?"poPayment.business":"poPayment.personal")} · {new Date(payment.paidAt).toLocaleString()}</Text>}
   {!loading&&!failed&&!payment&&allowPay&&row.amount>0&&<PurchasePaymentSource tripId={tripId} costKey={row.key} poNumber={poNumber} itemTitle={row.title} amount={row.amount} onPaid={result=>{setPayments(current=>[...current.filter(p=>p.costKey!==row.key),result]);onPaid()}}/>}
  </View>})}
  {!loading&&!failed&&rows.length>0&&rows.every(row=>row.amount<=0||payments.some(p=>p.costKey===row.key&&p.amount===row.amount))&&onApprove&&<Pressable accessibilityRole="button" disabled={approving} onPress={onApprove} style={{minHeight:46,borderRadius:11,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"}}>{approving?<ActivityIndicator color={colors.white}/>:<Text style={{color:colors.white,fontWeight:"700"}}>Approve Purchase</Text>}</Pressable>}
 </View>;
}
const s=StyleSheet.create({list:{gap:12},heading:{fontSize:16,fontWeight:"700",color:colors.heading},card:{padding:14,gap:10,borderRadius:13,borderWidth:1,borderColor:colors.divider,backgroundColor:colors.white},paid:{backgroundColor:colors.successBackground,borderColor:colors.success},paidText:{color:colors.successText},row:{flexDirection:"row",alignItems:"center",gap:10},grow:{flex:1},title:{fontSize:15,fontWeight:"700",color:colors.heading},status:{fontSize:12,color:colors.secondary,marginTop:5},amount:{fontSize:16,fontWeight:"700",color:colors.heading},note:{fontSize:12,lineHeight:20,color:colors.secondary},error:{color:colors.dangerText},retry:{minHeight:44,justifyContent:"center",paddingHorizontal:8}});
