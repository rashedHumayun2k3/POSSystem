import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../src/auth/AuthContext";
import { useLanguage } from "../../../src/i18n/LanguageContext";
import { Text } from "../../../src/i18n/LocalizedText";
import { colors } from "../../../src/theme";
import type { Expense } from "../../../src/types/expenses";
export default function ExpenseDetail() {
 const {id,productId}=useLocalSearchParams<{id:string;productId?:string}>();const auth=useAuth();const api=useRef(auth.api);api.current=auth.api;const {lang}=useLanguage();const bn=lang==="bn";
 const [expense,setExpense]=useState<Expense|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setExpense(null);setError("");api.current<Expense>(productId ? `/products/${productId}/expenses/${id}` : `/expenses/${id}`).then(e=>{if(active)setExpense(e)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id,productId,retry,auth.session?.businessId,auth.session?.branchId]);
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><ScrollView contentContainerStyle={{padding:16,gap:14}}><Pressable onPress={()=>router.back()}><Text style={{color:colors.primaryDark}}>{bn?"← ফিরে যান":"← Go back"}</Text></Pressable><Text style={{fontSize:20,fontWeight:"700"}}>{bn?"খরচের বিস্তারিত":"Expense details"}</Text>{error?<><Text style={{color:colors.danger}}>{error}</Text><Pressable onPress={()=>setRetry(n=>n+1)}><Text>{bn?"আবার চেষ্টা করুন":"Try again"}</Text></Pressable></>:!expense?<ActivityIndicator/>:<View style={{padding:16,gap:12,backgroundColor:colors.white,borderRadius:12}}><Text style={{fontSize:17,fontWeight:"700"}}>{expense.title||expense.subType}</Text><Text>৳{expense.amount.toLocaleString()}</Text><Text>{expense.categoryName} · {expense.subType}</Text><Text>{new Date(expense.expenseDate).toLocaleDateString(bn?"bn-BD":"en-GB")}</Text><Text>{bn?"অবস্থা":"Status"}: {expense.status}</Text>{!!expense.note&&<Text>{expense.note}</Text>}<Text>{bn?"তৈরি করেছেন":"Created by"}: {expense.createdByName}</Text></View>}</ScrollView></SafeAreaView>;
}
