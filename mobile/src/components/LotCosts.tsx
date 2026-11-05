import { useState } from "react";
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import type { PurchaseCost } from "../types/purchases";
import PurchasePaymentSource, { type PurchasePayment } from "./PurchasePaymentSource";
import { purchaseCostStyles as s } from "./purchaseCostStyles";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";

export default function LotCosts({ lotId, lotNo, tripId, poNumber, costs, payments, allowPay, canDelete, onDelete, onPaid, onUpdated }: {
 lotId: string; lotNo: string; tripId: string; poNumber: string; costs: PurchaseCost[]; payments: PurchasePayment[] | null;
 allowPay: boolean; canDelete: (cost: PurchaseCost) => boolean; onDelete: (cost: PurchaseCost) => void; onPaid: (payment: PurchasePayment) => void; onUpdated:()=>void;
}) {
 const { t,lang } = useLanguage();
 const { api,session } = useAuth();
 const [editing,setEditing]=useState<string|null>(null),[amount,setAmount]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const [selectedCost,setSelectedCost]=useState<PurchaseCost|null>(null),[uploading,setUploading]=useState(false),[documentError,setDocumentError]=useState("");
 const lotCosts = costs.filter(cost => cost.shipmentId === lotId);
 const money = (amount: number) => `৳${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
 const saveAmount=async(cost:PurchaseCost)=>{const value=Number(amount);if(saving||amount.trim()===""||!Number.isFinite(value)||value<0)return;setSaving(true);setError("");try{await api(`/purchase-trips/${tripId}/costs/${cost.id}/amount`,{method:"PATCH",body:JSON.stringify({amount:value})});setEditing(null);onUpdated()}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const saveDocument=async(photoUrl:string|null)=>{if(!selectedCost)return;await api(`/purchase-trips/${tripId}/costs/${selectedCost.id}/document`,{method:"PATCH",body:JSON.stringify({photoUrl})});onUpdated();setSelectedCost({...selectedCost,photoUrl});};
 const uploadDocument=async()=>{if(!selectedCost||uploading)return;setDocumentError("");try{const result=await DocumentPicker.getDocumentAsync({type:["image/jpeg","image/png","image/webp","application/pdf"],copyToCacheDirectory:true,multiple:false});if(result.canceled)return;const file=result.assets[0];if(file.size!=null&&file.size>5*1024*1024)throw new Error("File must be 5MB or smaller.");const form=new FormData();if(Platform.OS==="web"&&file.file)form.append("file",file.file,file.name);else form.append("file",{uri:file.uri,name:file.name,type:file.mimeType||"application/octet-stream"} as never);setUploading(true);const response=await fetch(`${MEDIA_URL}/api/v1/media/upload`,{method:"POST",headers:{Authorization:`Bearer ${session?.accessToken||""}`,"X-Business-Id":session?.businessId||""},body:form});const body=await response.json().catch(()=>({}));if(!response.ok||!body.url)throw new Error(body.message||"Could not upload document.");await saveDocument(body.url);}catch(e){setDocumentError((e as Error).message)}finally{setUploading(false)}};
 return <View>
  <Text style={[s.groupAmount,{paddingHorizontal:10,paddingVertical:7}]}>{lang==="bn"?"লটের মোট খরচ":"Total Lot Cost"}: {money(lotCosts.reduce((sum, cost) => sum + cost.amount, 0))}</Text>
  {!lotCosts.length && <Text style={s.empty}>{lang==="bn"?"এই লটে এখনো কোনো খরচ যোগ করা হয়নি।":"No costs added to this lot yet."}</Text>}
  {lotCosts.map(cost => {
   const payment = payments?.find(p => p.costKey === cost.id);
   const remaining = Math.max(0, Math.round(cost.amount*100) - (payments ?? []).filter(p=>p.costKey===cost.id).reduce((sum,p)=>sum+Math.round(p.amount*100),0))/100;
   const title = cost.costType === "CHINA_LOCAL" ? "China Local" : cost.costType === "COURIER" ? "Courier" : cost.costType.replaceAll("_", " ");
   return <Pressable key={cost.id} accessibilityRole="button" onPress={()=>setSelectedCost(cost)} style={[s.lotCostItem, { paddingHorizontal: 7, paddingVertical: 5 }, payment && remaining === 0 && s.paidEntry, payments !== null && remaining > 0 && s.unpaidEntry]}>
    <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name="receipt-outline" size={16} color={colors.neutralIcon}/><Text style={[s.title,{flex:1}]}>{title}</Text><Text style={s.amount}>{money(cost.amount)}</Text></View>
    {editing===cost.id&&<View style={{gap:6,marginTop:7,padding:8,borderRadius:8,backgroundColor:colors.cardSecondary}}><Text style={s.note}>Edit cost amount only (BDT)</Text><TextInput autoFocus value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{minHeight:42,borderWidth:1,borderColor:colors.border,borderRadius:8,paddingHorizontal:10,color:colors.heading,backgroundColor:colors.white}}/>{!!error&&<Text style={{color:colors.dangerText,fontSize:11}}>{error}</Text>}<View style={{flexDirection:"row",justifyContent:"flex-end",gap:6}}><Pressable disabled={saving} onPress={()=>{setEditing(null);setError("")}} style={s.retry}><Text style={s.note}>Cancel</Text></Pressable><Pressable disabled={saving||amount.trim()===""||!Number.isFinite(Number(amount))||Number(amount)<0} onPress={()=>void saveAmount(cost)} style={[s.retry,{backgroundColor:colors.primary}]}>{saving?<ActivityIndicator size="small" color={colors.white}/>:<Text style={{color:colors.white,fontWeight:"700",fontSize:11}}>Save</Text>}</Pressable></View></View>}
    <View style={{flexDirection:"row",alignItems:"flex-end",gap:6,marginTop:2}}>
     <View style={{flex:1,minWidth:100}}>
      {payments !== null && remaining > 0 && <Text style={s.unpaidText}>{lang==="bn"?"বাকি":"Due"}: {money(remaining)}</Text>}{!!cost.note && <Text style={[s.note,{marginTop:0}]}>{cost.note}</Text>}
      {payments === null ? <Text style={s.note}>Payment status unavailable</Text> : payment ? <><Text style={[s.status,remaining > 0 ? s.unpaidText : s.paidText,{alignSelf:"flex-start",marginTop:3}]}>{remaining > 0 ? (lang === "bn" ? "আংশিক পরিশোধিত" : "Partially paid") : t("poCostPayment.paid")}</Text><Text style={s.note}>{payment.fundingSource === "PERSONAL" ? (payment.payerName || (lang === "bn" ? "পরিশোধকারীর নাম পাওয়া যায়নি" : "Payer name unavailable")) : `${t("poPayment.business")}${payment.payerName ? ` · ${payment.payerName}` : ""}`} · {new Date(payment.paidAt).toLocaleString()}</Text></> : <View style={[s.unpaidBadge,{marginTop:3}]}><Text style={s.unpaidText}>{cost.amount > 0 ? "Payment Not done" : "No payment required"}</Text></View>}
     </View>
     <View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:3,marginLeft:"auto",flexShrink:0}}>
      {payments !== null && !payment && allowPay && cost.amount > 0 && <PurchasePaymentSource compact tripId={tripId} costKey={cost.id} poNumber={poNumber} itemTitle={title} amount={cost.amount} onPaid={onPaid}/>}
      {payments !== null && !payment && canDelete(cost) && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={()=>{setEditing(cost.id);setAmount(String(cost.amount));setError("")}} style={{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:6,backgroundColor:colors.white}}><Ionicons name="pencil-outline" color={colors.primaryDark} size={16}/></Pressable>}
      {payments !== null && !payment && canDelete(cost) && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${title}`} onPress={()=>onDelete(cost)} style={{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:6,backgroundColor:colors.white}}><Ionicons name="trash-outline" color={colors.danger} size={16}/></Pressable>}
     </View>
    </View>
   </Pressable>;

  })}
  <Modal visible={!!selectedCost} transparent animationType="fade" onRequestClose={()=>setSelectedCost(null)}><View style={{flex:1,backgroundColor:"rgba(15,23,42,0.45)",justifyContent:"center",padding:16}}><ScrollView style={{width:"100%",maxWidth:560,maxHeight:"90%",alignSelf:"center",backgroundColor:colors.white,borderRadius:18}} contentContainerStyle={{padding:20,gap:12}}>{selectedCost&&<>
   <View style={{flexDirection:"row",alignItems:"center",gap:10}}><View style={{flex:1}}><Text style={{fontSize:20,fontWeight:"800",color:colors.heading}}>{selectedCost.costType.replaceAll("_"," ")}</Text><Text style={s.note}>{poNumber} · {lotNo}</Text></View><Pressable onPress={()=>setSelectedCost(null)}><Ionicons name="close-circle-outline" size={24} color={colors.secondary}/></Pressable></View>
   <Text style={s.amount}>৳{selectedCost.amount.toLocaleString(undefined,{maximumFractionDigits:2})}</Text>{!!selectedCost.note&&<Text style={s.note}>{selectedCost.note}</Text>}{!!selectedCost.paidBy&&<Text style={s.note}>Paid by: {selectedCost.paidBy}</Text>}
   <Text style={{fontSize:14,fontWeight:"700",color:colors.heading}}>Payment history</Text>{payments===null?<Text style={s.note}>Payment status unavailable</Text>:(payments.filter(p=>p.costKey===selectedCost.id).length?payments.filter(p=>p.costKey===selectedCost.id).map(p=><View key={p.id} style={{padding:10,backgroundColor:colors.cardSecondary,borderRadius:10,gap:3}}><Text style={{fontWeight:"700",color:colors.heading}}>৳{p.amount.toLocaleString(undefined,{maximumFractionDigits:2})} · {p.fundingSource}</Text><Text style={s.note}>{p.payerName||"Payer name unavailable"} · {new Date(p.paidAt).toLocaleString()}</Text></View>):<Text style={s.note}>No payments recorded yet.</Text>)}
   {!!selectedCost.photoUrl&&<>{selectedCost.photoUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp)(\?|$)/)?<Image source={{uri:selectedCost.photoUrl.startsWith("/")?MEDIA_URL+selectedCost.photoUrl:selectedCost.photoUrl}} resizeMode="contain" style={{height:150,borderRadius:8}}/>:null}<View style={{flexDirection:"row",gap:12}}><Pressable onPress={()=>void Linking.openURL(selectedCost.photoUrl!.startsWith("/")?MEDIA_URL+selectedCost.photoUrl!:selectedCost.photoUrl!)}><Text style={{color:colors.primaryDark,fontWeight:"700"}}>Open attached document</Text></Pressable><Pressable onPress={()=>void saveDocument(null).catch(e=>setDocumentError((e as Error).message))}><Text style={{color:colors.dangerText}}>Remove</Text></Pressable></View></>}
   {allowPay&&<Pressable disabled={uploading} onPress={()=>void uploadDocument()} style={{minHeight:44,justifyContent:"center",alignItems:"center",borderRadius:10,backgroundColor:colors.primaryLight}}>{uploading?<ActivityIndicator color={colors.primary}/>:<Text style={{fontWeight:"700",color:colors.primaryDark}}>{selectedCost.photoUrl?"Replace document":"Upload receipt or document"}</Text>}</Pressable>}{!!documentError&&<Text accessibilityRole="alert" style={s.error}>{documentError}</Text>}
  </>}</ScrollView></View></Modal>
 </View>;
}
