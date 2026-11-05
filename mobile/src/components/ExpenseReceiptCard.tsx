import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { MEDIA_URL, useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import type { Expense } from "../types/expenses";
import type { PurchaseDetail } from "../types/purchases";
import type { PurchasePayment } from "./PurchasePaymentSource";

export default function ExpenseReceiptCard({expense,onChange}:{expense:Expense;onChange:(url:string|null)=>void}) {
 const {api,session}=useAuth();const apiRef=useRef(api);apiRef.current=api;const {lang}=useLanguage();const bn=lang==="bn";
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const isPurchase=expense.source==="PURCHASE_PAYMENT";
 const [costId,setCostId]=useState<string|null>(expense.purchaseCostId||null),[resolvedUrl,setResolvedUrl]=useState<string|null>(expense.photoUrl),[resolving,setResolving]=useState(false);
 useEffect(()=>{setCostId(expense.purchaseCostId||null);setResolvedUrl(expense.photoUrl)},[expense.id,expense.purchaseCostId,expense.photoUrl]);
 useEffect(()=>{if(!isPurchase||!expense.tripId||expense.purchaseCostId)return;let active=true;setResolving(true);Promise.all([apiRef.current<PurchasePayment[]>(`/purchase-trips/${expense.tripId}/payments`),apiRef.current<PurchaseDetail>(`/purchase-trips/${expense.tripId}`)]).then(([payments,trip])=>{if(!active)return;const payment=payments.find(p=>p.id===expense.id);const cost=trip.costs.find(c=>c.id===payment?.costKey);if(cost){setCostId(cost.id);setResolvedUrl(cost.photoUrl)}else setError(bn?"এই পেমেন্টের সাথে কোনো PO খরচ পাওয়া যায়নি।":"No PO cost is linked to this payment.")}).catch(e=>{if(active)setError((e as Error).message)}).finally(()=>{if(active)setResolving(false)});return()=>{active=false}},[isPurchase,expense.id,expense.tripId,expense.purchaseCostId,session?.businessId,session?.branchId]);
 const canEdit=isPurchase?session?.user.role==="OWNER":session?.user.role==="OWNER"||session?.user.id===expense.createdBy;
 const endpoint=isPurchase?`/purchase-trips/${expense.tripId}/costs/${costId}/document`:`/expenses/${expense.id}/document`;
 const href=resolvedUrl?resolvedUrl.startsWith("/uploads/")?`${MEDIA_URL}${resolvedUrl}`:/^https?:\/\//i.test(resolvedUrl)?resolvedUrl:null:null;
 const isImage=!!resolvedUrl&&/\.(jpe?g|png|webp)(?:\?.*)?$/i.test(resolvedUrl);
 const save=async(url:string|null)=>{await api(endpoint,{method:"PATCH",body:JSON.stringify({photoUrl:url})});setResolvedUrl(url);onChange(url)};
 const upload=async()=>{if(busy||resolving||isPurchase&&!costId)return;setError("");try{
  const picked=await DocumentPicker.getDocumentAsync({type:["image/jpeg","image/png","image/webp","application/pdf"],copyToCacheDirectory:true,multiple:false});
  if(picked.canceled)return;const file=picked.assets[0];
  if(file.size!=null&&file.size>5*1024*1024)throw new Error(bn?"ফাইল ৫ এমবি বা তার কম হতে হবে।":"File must be 5 MB or smaller.");
  const form=new FormData();if(Platform.OS==="web"&&file.file)form.append("file",file.file,file.name);else form.append("file",{uri:file.uri,name:file.name,type:file.mimeType||"application/octet-stream"} as never);
  setBusy(true);const response=await fetch(`${MEDIA_URL}/api/v1/media/upload`,{method:"POST",headers:{Authorization:`Bearer ${session?.accessToken||""}`,"X-Business-Id":session?.businessId||""},body:form});
  const body=await response.json().catch(()=>({}));if(!response.ok||!body.url)throw new Error(body.message||"Could not upload document.");
  await save(body.url);
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const remove=async()=>{if(busy)return;setBusy(true);setError("");try{await save(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 return <View style={s.card}>
  <View style={s.heading}><View style={s.icon}><Ionicons name="document-attach-outline" size={19} color={colors.primaryDark}/></View><View style={s.grow}><Text style={s.title}>{bn?"রসিদ ও ডকুমেন্ট":"Receipt & documents"}</Text><Text style={s.hint}>{bn?"এই খরচের প্রমাণ এখানে রাখুন":"Keep proof of this expense here"}</Text></View></View>
  {href?<><View style={s.file}><Ionicons name={isImage?"image-outline":"document-text-outline"} size={23} color={colors.primaryDark}/><View style={s.grow}><Text style={s.fileTitle}>{bn?"সংযুক্ত ডকুমেন্ট":"Attached document"}</Text><Text style={s.hint}>{isImage?"Image":"PDF"}</Text></View><Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(href).catch(e=>setError((e as Error).message))} style={s.open}><Text style={s.openText}>{bn?"দেখুন":"View"}</Text><Ionicons name="open-outline" size={15} color={colors.primaryDark}/></Pressable></View>{isImage&&<Pressable accessibilityRole="link" accessibilityLabel={bn?"সংযুক্ত ছবি বড় করে দেখুন":"Open attached image"} onPress={()=>void Linking.openURL(href).catch(e=>setError((e as Error).message))} style={s.preview}><Image source={{uri:href}} resizeMode="contain" style={s.previewImage}/><Text style={s.previewHint}>{bn?"বড় করে দেখতে ছবিতে চাপুন":"Tap image to view full size"}</Text></Pressable>}</>:<View style={s.empty}><Ionicons name="cloud-upload-outline" size={27} color={colors.primaryDark}/><Text style={s.emptyTitle}>{bn?"এখনো কোনো ডকুমেন্ট নেই":"No document attached yet"}</Text><Text style={s.hint}>JPG · PNG · WebP · PDF · {bn?"সর্বোচ্চ ৫ এমবি":"Up to 5 MB"}</Text></View>}
  {canEdit&&<View style={s.actions}><Pressable accessibilityRole="button" disabled={busy||resolving||isPurchase&&!costId} onPress={()=>void upload()} style={[s.upload,(busy||resolving||isPurchase&&!costId)&&s.disabled]}>{busy||resolving?<ActivityIndicator size="small" color={colors.white}/>:<Ionicons name={href?"refresh-outline":"add-outline"} size={18} color={colors.white}/>}<Text style={s.uploadText}>{resolving?(bn?"খরচ খোঁজা হচ্ছে…":"Finding PO cost…"):href?(bn?"পরিবর্তন করুন":"Replace document"):(bn?"ডকুমেন্ট আপলোড করুন":"Upload document")}</Text></Pressable>{href&&<Pressable accessibilityRole="button" disabled={busy||resolving} onPress={()=>void remove()} style={s.remove}><Text style={s.removeText}>{bn?"সরান":"Remove"}</Text></Pressable>}</View>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 </View>;
}
const s=StyleSheet.create({card:{padding:17,borderRadius:17,backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider,gap:14},heading:{flexDirection:"row",alignItems:"center",gap:10},icon:{width:34,height:34,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:colors.primaryLight},grow:{flex:1,minWidth:0},title:{fontSize:14,fontWeight:"800",color:colors.heading},hint:{fontSize:11,color:colors.secondary,marginTop:3},empty:{alignItems:"center",justifyContent:"center",paddingVertical:19,gap:5,borderRadius:12,borderWidth:1,borderStyle:"dashed",borderColor:colors.secondaryBorder,backgroundColor:colors.cardSecondary},emptyTitle:{fontSize:12,fontWeight:"700",color:colors.heading},file:{flexDirection:"row",alignItems:"center",gap:11,padding:12,borderRadius:12,backgroundColor:colors.cardSecondary},fileTitle:{fontSize:12,fontWeight:"700",color:colors.heading},open:{flexDirection:"row",alignItems:"center",gap:5,padding:8},openText:{fontSize:12,fontWeight:"700",color:colors.primaryDark},preview:{borderWidth:1,borderColor:colors.divider,borderRadius:12,overflow:"hidden",backgroundColor:colors.cardSecondary},previewImage:{width:"100%",height:240},previewHint:{fontSize:11,color:colors.secondary,textAlign:"center",paddingVertical:8},actions:{flexDirection:"row",alignItems:"center",gap:8},upload:{minHeight:44,flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:11,backgroundColor:colors.primaryDark},uploadText:{fontSize:12,fontWeight:"800",color:colors.white},remove:{minHeight:44,justifyContent:"center",paddingHorizontal:12},removeText:{fontSize:12,fontWeight:"700",color:colors.dangerText},disabled:{opacity:.55},error:{fontSize:12,color:colors.dangerText}});
