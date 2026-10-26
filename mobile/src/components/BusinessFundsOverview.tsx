import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";

export default function BusinessFundsOverview({reload=0}:{reload?:number}) {
 const auth=useAuth(),{lang,t}=useLanguage(),{width}=useWindowDimensions(),api=useRef(auth.api);api.current=auth.api;
 const [values,setValues]=useState<(number|null)[]>([null,null,null]),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[info,setInfo]=useState<string|null>(null);
 useEffect(()=>{let active=true;setLoading(true);setFailed(false);setValues([null,null,null]);Promise.allSettled([
 api.current<{capitalBalancePaisa:number}[]>("/partners"),api.current<{totalExpense:number}>("/expenses/summary"),api.current<{balance:number|null}>("/expenses/funding")
 ]).then(([partners,expenses,funds])=>{if(!active)return;setValues([partners.status==="fulfilled"?partners.value.reduce((sum,p)=>sum+p.capitalBalancePaisa,0)/100:null,expenses.status==="fulfilled"?expenses.value.totalExpense:null,funds.status==="fulfilled"?funds.value.balance:null]);setFailed([partners,expenses,funds].some(r=>r.status==="rejected"));setLoading(false);});return()=>{active=false;};},[reload,retry,auth.session?.businessId,auth.session?.branchId]);
 const cards=[{label:lang==="bn"?"অনুমোদিত বিনিয়োগ":"Approved Investment",icon:"people-outline" as const,hint:t("partnerSummary.totalHint")},{label:lang==="bn"?"অনুমোদিত খরচ":"Approved Expenses",icon:"receipt-outline" as const,hint:t("partnerSummary.expenseHint")},{label:lang==="bn"?"ব্যবহারযোগ্য তহবিল":"Available Funds",icon:"wallet-outline" as const,hint:t("partnerSummary.availableHint")}];
 return <View style={{gap:10,padding:16,borderBottomWidth:1,borderBottomColor:colors.divider}}><Text style={{fontSize:16,fontWeight:"700",color:colors.heading}}>{lang==="bn"?"বর্তমান ব্যবসায়িক তহবিল":"Current Business Funds"}</Text><Text style={{fontSize:12,color:colors.secondary}}>{lang==="bn"?"সর্বকালের হিসাব · নিচের তারিখ ফিল্টারে পরিবর্তন হবে না":"All-time balances · Not affected by the date filters below"}</Text>
 <View style={{flexDirection:width<600?"column":"row",gap:10}}>{cards.map((card,index)=><View key={card.label} style={{flex:width<600?undefined:1,minWidth:0,padding:14,gap:9,borderWidth:1,borderColor:index===2?colors.success:colors.divider,borderRadius:12,backgroundColor:index===2?colors.successBackground:colors.white}}><View style={{flexDirection:"row",alignItems:"center",gap:7}}><Ionicons name={card.icon} size={18} color={index===2?colors.successText:colors.primaryDark}/><Text style={{flex:1,fontSize:12,color:colors.secondary}}>{card.label}</Text><Pressable accessibilityRole="button" accessibilityLabel={card.label+" information"} hitSlop={8} onPress={()=>setInfo(card.hint)}><Ionicons name="information-circle-outline" size={17} color={colors.secondary}/></Pressable></View>{loading?<ActivityIndicator color={colors.primary}/>:<Text style={{fontSize:21,fontWeight:"700",color:index===2&&values[index]!==null&&values[index]!<0?colors.dangerText:index===2?colors.successText:colors.heading}}>{values[index]===null?"—":`৳${values[index]!.toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2})}`}</Text>}</View>)}</View>
 {failed&&<Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}><Text style={{fontSize:12,color:colors.dangerText}}>{lang==="bn"?"কিছু হিসাব লোড হয়নি। আবার চেষ্টা করুন":"Some balances could not load. Tap to retry."}</Text></Pressable>}
 <PopupSheet fitContent visible={info!==null} title={lang==="bn"?"হিসাবের বিবরণ":"Balance information"} onClose={()=>setInfo(null)}><Text style={{padding:16,fontSize:13,lineHeight:20,color:colors.secondary}}>{info}</Text></PopupSheet></View>;
}
