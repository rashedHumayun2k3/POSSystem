import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PurchasePaymentSource, { type PurchasePayment } from "./PurchasePaymentSource";
import type { PurchaseCost, PurchaseLot, PurchaseItem } from "../types/purchases";
import LotCosts from "./LotCosts";
import { purchaseCostStyles as s } from "./purchaseCostStyles";
import { productPayment } from "../lib/purchasePayments";
const labels: Record<string,string> = { CHINA_LOCAL:"China Local", COURIER:"Courier", TRANSPORT:"Transport", LABOR:"Labor", CUSTOMS:"Customs", SHIPPING_INTL:"poCostPayment.shipping", CURRENCY_LOSS:"Currency Loss", AGENT_FEE:"Agent Fee", PAYMENT_FEE:"Payment Fee", OTHER:"Other" };
export default function PurchaseCostPayments({tripId,poNumber,items,costs,allowPay,canDelete,onDelete,onPaid,onApprove,approving,lots=[],headerActions,onBack}:{tripId:string;poNumber:string;items:PurchaseItem[];costs:PurchaseCost[];allowPay:boolean;canDelete:(cost:PurchaseCost)=>boolean;onDelete:(cost:PurchaseCost)=>void;onPaid:()=>void;onApprove?:()=>void;approving?:boolean;lots?:PurchaseLot[];headerActions?:ReactNode;onBack?:()=>void}) {
 const narrow = useWindowDimensions().width < 900;
 const {api,session}=useAuth(); const apiRef=useRef(api);apiRef.current=api;
 const {t}=useLanguage(); const [payments,setPayments]=useState<PurchasePayment[]>([]); const [loading,setLoading]=useState(true); const [failed,setFailed]=useState(false); const [reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setFailed(false);setPayments([]);void apiRef.current<PurchasePayment[]>(`/purchase-trips/${tripId}/payments`).then(data=>{if(active)setPayments(data)}).catch(()=>{if(active)setFailed(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[tripId,session?.businessId,session?.branchId,reload]);
 const rows=[...items.map(item=>({key:item.id,title:item.productName,amount:item.totalCost,note:item.variantSku,cost:null as PurchaseCost|null,item:item as PurchaseItem|null})),...costs.map(cost=>({key:cost.id,title:labels[cost.costType]??cost.costType,amount:cost.amount,note:cost.note,cost,item:null as PurchaseItem|null}))];
 const lotIds = [...new Set([...lots.map(lot=>lot.id), ...costs.flatMap(cost=>cost.shipmentId ? [cost.shipmentId] : [])])];
 const groups = [
   { key: "po", title: "PO Costs", subtitle: "Products and common purchase expenses", rows: rows.filter(row=>!row.cost?.shipmentId) },
   ...lotIds.map(lotId=>({ key: lotId, title: `${lots.find(lot=>lot.id===lotId)?.lotNo ?? "Historical lot"} Costs`, subtitle: "Expenses for this shipment lot", rows: rows.filter(row=>row.cost?.shipmentId===lotId) })),
 ].filter(group=>group.rows.length>0);
 const getPayment = (row: typeof rows[number]) => row.item ? productPayment(row.item, items, payments) : payments.find(p=>p.costKey===row.key);
 const productCost = items.reduce((sum,item)=>sum+item.totalCost,0);
 const productPaid = items.reduce((sum,item)=>sum+(productPayment(item,items,payments)?.amount??0),0);
 const pendingProducts = items.filter(item=>item.totalCost>0&&!productPayment(item,items,payments)).length;
 const canApprove = !loading&&!failed&&items.length>0&&rows.filter(row=>!row.cost?.shipmentId&&!row.cost?.isPostCompletion).every(row=>row.amount<=0||getPayment(row)?.amount===row.amount);
 return <View style={s.list}>
  <View style={s.sectionHeader}><Text style={s.heading}>Costs & Payments</Text>{headerActions}</View>
  {loading&&<ActivityIndicator color={colors.primary}/>}
  {failed&&<View><Text accessibilityRole="alert" style={s.error}>{t("poCostPayment.loadFailed")}</Text><Pressable accessibilityRole="button" onPress={()=>setReload(x=>x+1)} style={s.retry}><Text>{t("common.retry")}</Text></Pressable></View>}
  {!loading&&!failed&&items.length>0&&<View style={s.paymentSummary}><Text style={s.title}>Product cost: ৳{productCost.toLocaleString()} · Paid: ৳{productPaid.toLocaleString()} · Due: ৳{(productCost-productPaid).toLocaleString()}</Text><Text style={s.note}>{pendingProducts === 0 ? "All product payments complete" : `${pendingProducts} product payment${pendingProducts === 1 ? "" : "s"} pending`}</Text></View>}
  <View style={s.ledger}>
  {!narrow && rows.length > 0 && <View style={s.tableHead}><Text style={[s.columnLabel,s.grow]}>Cost / payment details</Text><Text style={[s.columnLabel,s.amountColumn]}>Amount (BDT)</Text><Text style={[s.columnLabel,s.actionColumn]}>Action</Text></View>}
  {groups.map(group=>group.key !== "po" ? <LotCosts key={group.key} lotId={group.key} lotNo={lots.find(lot=>lot.id===group.key)?.lotNo ?? "Historical lot"} tripId={tripId} poNumber={poNumber} costs={costs} payments={loading || failed ? null : payments} allowPay={allowPay} canDelete={canDelete} onDelete={onDelete} onPaid={payment=>{setPayments(current=>[...current.filter(p=>p.costKey!==payment.costKey),payment]);onPaid();}} /> : <View key={group.key}>
   <View style={s.groupHeading}><View style={s.grow}><Text style={s.groupTitle}>{group.title}</Text><Text style={s.groupNote}>{group.subtitle}</Text></View><Text style={s.groupAmount}>৳{group.rows.reduce((total,row)=>total+row.amount,0).toLocaleString(undefined,{maximumFractionDigits:2})}</Text></View>
   {group.rows.map(row=>{const payment=getPayment(row);return <View key={row.key} style={[s.entry,narrow&&s.mobileEntry,payment&&s.paidEntry,!loading&&!failed&&!payment&&row.item!==null&&row.amount>0&&s.unpaidEntry]}>
   <View style={s.grow}><View style={s.titleRow}><Ionicons name={row.cost ? "receipt-outline" : "cube-outline"} size={17} color={colors.neutralIcon}/><Text style={s.title}>{t(row.title)}</Text>{(payment || loading || failed) && <Text style={[s.status,payment&&s.paidText]}>{payment?t("poCostPayment.paid"):t("poCostPayment.unknown")}</Text>}</View>
   {row.cost?.shipmentId&&<Text style={s.note}>Lot: {lots.find(l=>l.id===row.cost?.shipmentId)?.lotNo??"Shipment"}</Text>}
   {!!row.note&&<Text style={s.note}>{row.note}</Text>}
   {payment ? <View style={s.paymentDetails}><Ionicons name="checkmark-circle-outline" size={14} color={colors.successText}/><Text style={s.note}>৳{payment.amount.toLocaleString(undefined,{maximumFractionDigits:2})} · {t(payment.fundingSource==="BUSINESS"?"poPayment.business":"poPayment.personal")} · {new Date(payment.paidAt).toLocaleString()}</Text></View> : !loading&&!failed&&<View style={s.unpaidBadge}><Text style={s.unpaidText}>{row.amount > 0 ? "Payment Not done" : "No payment required"}</Text></View>}
   </View>
   <View style={[s.moneyActions,narrow&&s.mobileMoneyActions]}><Text style={[s.amount,!narrow&&s.amountColumn]}>৳{row.amount.toLocaleString(undefined,{maximumFractionDigits:2})}</Text><View style={[s.actions,!narrow&&s.actionColumn]}>
   <View style={s.paymentSlot}>{!loading&&!failed&&!payment&&row.item&&row.amount>0&&onBack&&<Pressable accessibilityRole="button" onPress={onBack} style={s.retry}><Text style={s.backText}>Pay in Products</Text></Pressable>}{!loading&&!failed&&!payment&&row.cost&&allowPay&&row.amount>0&&<PurchasePaymentSource compact tripId={tripId} costKey={row.key} poNumber={poNumber} itemTitle={row.title} amount={row.amount} onPaid={result=>{setPayments(current=>[...current.filter(p=>p.costKey!==row.key),result]);onPaid()}}/>}</View>
   <View style={s.deleteSlot}>{!loading&&!failed&&!payment&&row.cost&&canDelete(row.cost)&&<Pressable accessibilityRole="button" accessibilityLabel="Delete cost" onPress={()=>onDelete(row.cost!)} style={s.retry}><Ionicons name="trash-outline" color={colors.danger} size={18}/></Pressable>}</View>
   </View></View>
  </View>})}
  </View>)}
  {rows.length===0&&<Text style={s.empty}>Add products or costs to record payments.</Text>}
  </View>
  <View style={s.footer}>
   {onBack&&<Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Ionicons name="arrow-back" size={18} color={colors.primaryDark}/><Text style={s.backText}>Back to Products</Text></Pressable>}
   {onApprove&&<Pressable accessibilityRole="button" disabled={approving || !canApprove} onPress={onApprove} style={[s.approve,(approving || !canApprove)&&{opacity:0.5}]}>{approving?<ActivityIndicator color={colors.white}/>:<Text style={{color:colors.white,fontWeight:"700"}}>Submit for Approval</Text>}<Ionicons name="arrow-forward" size={18} color={colors.white}/></Pressable>}
  </View>
 </View>;
}
