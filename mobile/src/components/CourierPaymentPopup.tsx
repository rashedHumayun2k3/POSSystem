import LocalDateTimeInput from "./LocalDateTimeInput";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";

export default function CourierPaymentPopup({orderId,courierId,collection,deliveryCost,onClose,onSaved}:{orderId:string;courierId:string;collection:number;deliveryCost:number;onClose:()=>void;onSaved:()=>void}) {
 const {api}=useAuth();const {lang}=useLanguage();const bn=lang==="bn";
 const [deductions,setDeductions]=useState(String(Math.min(deliveryCost,collection)));
 const [method,setMethod]=useState("BANK");const [reference,setReference]=useState("");const [note,setNote]=useState("");
 const [receivedAt,setReceivedAt]=useState(()=>{const d=new Date();const pad=(v:number)=>String(v).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;});
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const fee=Number(deductions);const net=Math.round((collection-fee)*100)/100;
 const valid=deductions.trim()!==""&&Number.isFinite(fee)&&fee>=0&&fee<=collection&&Math.abs(fee*100-Math.round(fee*100))<0.00001;
 const save=async()=>{if(busy)return;setError("");const timestamp=new Date(receivedAt.replace(" ","T"));if(!valid||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(receivedAt)||!Number.isFinite(timestamp.getTime()))return setError(bn?"সঠিক পরিমাণ ও তারিখ দিন।":"Enter valid amounts and date/time.");if(timestamp.getTime()>Date.now())return setError(bn?"ভবিষ্যতের তারিখ বা সময় দেওয়া যাবে না।":"Received date and time cannot be in the future.");setBusy(true);try{await api("/remittances",{method:"POST",body:JSON.stringify({courierId,orderIds:[orderId],amount:net,method,reference:reference.trim()||null,remittedAt:timestamp.toISOString(),note:note.trim()||null})});onSaved();}catch(e){setError(e instanceof Error?e.message:"Could not record payment.");}finally{setBusy(false);}};
 const input={minHeight:42,borderWidth:1,borderColor:colors.divider,borderRadius:8,paddingHorizontal:10,color:colors.heading};
 return <PopupSheet fitContent visible onClose={()=>{if(!busy)onClose();}} title={bn?"কুরিয়ার থেকে টাকা গ্রহণ":"Receive Courier Payment"}><ScrollView style={{flexGrow:0,flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:10}}>
 <Text>{bn?"কুরিয়ারের আদায়কৃত টাকা":"Courier collection"}: ৳{collection.toLocaleString()}</Text>
 <Text>{bn?"মোট কর্তন (ডেলিভারি, COD ও অন্যান্য চার্জ)":"Total deductions (delivery, COD and other charges)"}</Text><TextInput accessibilityLabel="Total deductions" editable={!busy} value={deductions} onChangeText={setDeductions} keyboardType="decimal-pad" style={input}/>
 <View style={{padding:12,borderRadius:8,backgroundColor:colors.successBackground}}><Text style={{color:colors.successText,fontWeight:"700"}}>{bn?"প্রাপ্ত নিট টাকা":"Net amount received"}: ৳{valid?net.toLocaleString():"—"}</Text></View>
 <Text>{bn?"পেমেন্ট মাধ্যম":"Payment method"}</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>{["BANK","BKASH","NAGAD","ROCKET","CASH"].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:method===value}} disabled={busy} onPress={()=>setMethod(value)} style={{padding:9,borderRadius:7,borderWidth:1,borderColor:method===value?colors.primary:colors.divider,backgroundColor:method===value?colors.primaryLight:colors.disabled}}><Text>{value}</Text></Pressable>)}</View>
 <View style={{flexDirection:"row",gap:10}}><View style={{flex:1,minWidth:0,gap:6}}><Text>{bn?"প্রাপ্তির তারিখ ও সময় (স্থানীয়)":"Received date and time (local)"}</Text><LocalDateTimeInput disabled={busy} value={receivedAt} onChange={setReceivedAt}/></View>
 <View style={{flex:1,minWidth:0,gap:6}}><Text>{bn?"লেনদেন রেফারেন্স (ঐচ্ছিক)":"Transaction reference (optional)"}</Text><TextInput accessibilityLabel="Transaction reference" editable={!busy} value={reference} onChangeText={setReference} style={input}/></View></View>
 <Text>{bn?"নোট (ঐচ্ছিক)":"Note (optional)"}</Text><TextInput editable={!busy} value={note} onChangeText={setNote} style={input}/>
 <Text style={{fontSize:12,color:colors.secondary}}>{bn?"সম্পূর্ণ পাওনা নিষ্পত্তি এবং নিট টাকা হাতে পাওয়ার পরই নিশ্চিত করুন।":"Confirm only after receiving the net amount and settling the full courier collection."}</Text>
 {!!error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}
 <View style={{flexDirection:"row",gap:8}}><Pressable disabled={busy} onPress={onClose} style={{flex:1,padding:12,alignItems:"center",borderWidth:1,borderColor:colors.border,borderRadius:8}}><Text>{bn?"বাতিল":"Cancel"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy||!valid} onPress={()=>void save()} style={{flex:1,padding:12,alignItems:"center",borderRadius:8,backgroundColor:colors.primary,opacity:busy||!valid?0.5:1}}><Text style={{color:colors.white}}>{busy?(bn?"সংরক্ষণ হচ্ছে…":"Saving…"):(bn?"টাকা গ্রহণ নিশ্চিত করুন":"Confirm Receipt")}</Text></Pressable></View>
 </ScrollView></PopupSheet>;
}
