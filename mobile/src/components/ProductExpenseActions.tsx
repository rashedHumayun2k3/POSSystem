import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import type { Expense } from "../types/expenses";
import type { LinkedExpense } from "./ProductExpensePicker";
import FinancialCorrectionActions from "./FinancialCorrectionActions";
export default function ProductExpenseActions({ expense, onSaved }: { expense: LinkedExpense; onSaved: () => void }) {
 const auth=useAuth();const api=useRef(auth.api);api.current=auth.api;const {lang}=useLanguage();const bn=lang==="bn";
 const [details,setDetails]=useState<Expense|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 const complete=!!expense.createdBy&&!!expense.updatedAt&&typeof expense.isAccountingPeriodClosed==="boolean";
 useEffect(()=>{setDetails(null);setError("");if(complete)return;let active=true;api.current<Expense>(`/expenses/${expense.id}`).then(value=>{if(active)setDetails(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[expense.id,expense.updatedAt,complete,retry,auth.session?.businessId,auth.session?.branchId]);
 const record=complete?expense:details;
 if(error)return <View style={{gap:6}}><Text style={{color:colors.danger,fontSize:12}}>{error}</Text><Pressable onPress={()=>setRetry(n=>n+1)}><Text>{bn?"এডিটের তথ্য আবার লোড করুন":"Retry loading edit controls"}</Text></Pressable></View>;
 if(!record)return <ActivityIndicator size="small" color={colors.primary}/>;
 if(record.isAccountingPeriodClosed===true)return <Text style={{color:colors.muted,fontSize:12}}>{bn?"এই খরচের হিসাবের সময়কাল বন্ধ হয়েছে, তাই পরিবর্তন করা যাবে না।":"Editing is unavailable because this expense’s accounting period is closed."}</Text>;
 if(record.createdBy!==auth.session?.user.id)return <Text style={{color:colors.muted,fontSize:12}}>{bn?"যিনি খরচটি তৈরি করেছেন, শুধু তিনিই এডিট বা ডিলিট করতে পারবেন।":"Only the person who created this expense can edit or delete it."}</Text>;
 if(record.isAccountingPeriodClosed!==false)return <Text style={{color:colors.muted,fontSize:12}}>{bn?"এডিটের অনুমতি যাচাই করা যাচ্ছে না। ব্যাকএন্ড রিস্টার্ট করে আবার চেষ্টা করুন।":"Editing eligibility could not be verified. Restart the backend and try again."}</Text>;
 return <FinancialCorrectionActions cashPayments={record.cashPayments} iconsOnly iconLabels id={record.id} amount={record.amount} title={record.title} updatedAt={record.updatedAt} createdBy={record.createdBy} status={record.status} isAccountingPeriodClosed={record.isAccountingPeriodClosed} onSaved={onSaved}/>;
}
