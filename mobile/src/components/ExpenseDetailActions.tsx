import {useRef,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useAuth} from "../auth/AuthContext";
import {useLanguage} from "../i18n/LanguageContext";
import {colors} from "../theme";
import type {Expense} from "../types/expenses";
import {expenseAmountInput} from "../utils/expenseCashPayments";
import PopupSheet from "./PopupSheet";
import SharedDatePicker from "./SharedDatePicker";

export default function ExpenseDetailActions({expense,onSaved,onDeleted}:{expense:Expense;onSaved:(expense:Expense)=>void;onDeleted:()=>void}){
 const {api,session}=useAuth();const {lang}=useLanguage();const bn=lang==="bn";
 const [mode,setMode]=useState<"edit"|"delete"|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const pending=useRef(false);
 const [amount,setAmount]=useState(""),[date,setDate]=useState(""),[note,setNote]=useState("");
 const reason=expense.source==="PURCHASE_PAYMENT"?(bn?"ক্রয় পেমেন্ট এই পৃষ্ঠা থেকে পরিবর্তন বা মুছে ফেলা যায় না।":"Purchase payments cannot be edited or deleted here.")
  :expense.fundingSource?(bn?"অর্থের উৎস রেকর্ড করা আছে। বর্তমান নিয়ম অনুযায়ী এই খরচ পরিবর্তন বা মুছে ফেলা যায় না।":"This expense has a recorded funding source. Current rules do not allow editing or deleting it.")
  :!expense.createdBy||!expense.categoryId?(bn?"এই রেকর্ডের পরিবর্তনের তথ্য এখানে পাওয়া যাচ্ছে না।":"Editing details are unavailable for this record.")
  :expense.createdBy!==session?.user.id?(bn?"শুধু যিনি খরচটি তৈরি করেছেন তিনি পরিবর্তন বা মুছে ফেলতে পারবেন।":"Only the creator can edit or delete this expense.")
  :expense.isAccountingPeriodClosed?(bn?"এই হিসাবের সময়কাল বন্ধ করা হয়েছে।":"This accounting period is closed."):"";
 const editReason=reason||(expense.pettyCashBoxId?(bn?"পেটি ক্যাশের খরচ পরিবর্তন করা যায় না।":"Petty-cash expenses cannot be edited."):!["PENDING","APPROVED"].includes(expense.status)?(bn?"শুধু অপেক্ষমাণ বা অনুমোদিত খরচ পরিবর্তন করা যায়।":"Only pending or approved expenses can be edited."):"");
 const deleteReason=reason||(expense.pettyCashBoxId&&expense.status==="APPROVED"?(bn?"অনুমোদিত পেটি ক্যাশের খরচ মুছে ফেলা যায় না।":"Approved petty-cash expenses cannot be deleted."):"");
 const close=()=>{if(!pending.current){setMode(null);setError("");}};
 const open=(next:"edit"|"delete")=>{setAmount(String(expense.amount));setDate(expense.expenseDate.slice(0,10));setNote(expense.note??"");setError("");setMode(next);};
 const submit=async()=>{
  if(pending.current||!mode||(mode==="edit"?editReason:deleteReason))return;
  if(mode==="edit"&&(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0)){setError(bn?"সঠিক খরচের পরিমাণ দিন।":"Enter a valid expense amount.");return;}
  pending.current=true;setBusy(true);setError("");
  try{
   if(mode==="delete"){
    await api(`/expenses/${expense.id}`,{method:"DELETE"});setMode(null);onDeleted();
   }else{
    const updated=await api<Expense>(`/expenses/${expense.id}`,{method:"PUT",body:JSON.stringify({categoryId:expense.categoryId,subType:expense.subType,amount:Number(amount),expenseDate:date,staffId:expense.staffId,isRecurring:expense.isRecurring,recurringDay:expense.recurringDay,allocateToTripId:expense.allocateToTripId,pettyCashBoxId:expense.pettyCashBoxId,photoUrl:expense.photoUrl,note:note.trim()||null})});
    onSaved(updated);setMode(null);
   }
  }catch(e){setError((e as Error).message);}finally{pending.current=false;setBusy(false);}
 };
 return <View style={s.container}>
  <View style={s.actions}>
   <Pressable accessibilityRole="button" accessibilityState={{disabled:!!editReason}} disabled={!!editReason} onPress={()=>open("edit")} style={[s.button,!!editReason&&s.disabled]}><Ionicons name="create-outline" size={18} color={colors.primaryDark}/><Text style={s.editText}>{bn?"পরিবর্তন করুন":"Edit"}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityState={{disabled:!!deleteReason}} disabled={!!deleteReason} onPress={()=>open("delete")} style={[s.button,!!deleteReason&&s.disabled]}><Ionicons name="trash-outline" size={18} color={colors.dangerText}/><Text style={s.deleteText}>{bn?"মুছে ফেলুন":"Delete"}</Text></Pressable>
  </View>
  {!!(reason||editReason||deleteReason)&&<Text style={s.hint}>{reason||[editReason,deleteReason].filter(Boolean).join(" ")}</Text>}
  <PopupSheet visible={mode!==null} onClose={close} title={mode==="delete"?(bn?"খরচ মুছে ফেলবেন?":"Delete expense?"):(bn?"খরচ পরিবর্তন করুন":"Edit expense")} fitContent keyboardAware>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
    <Text style={s.label}>{expense.title||expense.subType}</Text>
    {mode==="edit"?<>
     <Text style={s.label}>{bn?"খরচের পরিমাণ":"Amount"}</Text>
     <TextInput accessibilityLabel={bn?"খরচের পরিমাণ":"Amount"} editable={!busy} value={amount} onChangeText={text=>setAmount(previous=>expenseAmountInput(text,previous))} keyboardType="decimal-pad" inputMode="decimal" style={s.input}/>
     <Text style={s.label}>{bn?"তারিখ":"Date"}</Text><View pointerEvents={busy?"none":"auto"}><SharedDatePicker value={date} onChange={setDate}/></View>
     <Text style={s.label}>{bn?"নোট":"Note"}</Text><TextInput accessibilityLabel={bn?"নোট":"Note"} editable={!busy} value={note} onChangeText={setNote} multiline style={[s.input,s.note]}/>
    </>:<Text style={s.hint}>{bn?"এই খরচটি তালিকা ও রিপোর্ট থেকে সরানো হবে। আপনি কি নিশ্চিত?":"This expense will be removed from the list and reports. Are you sure?"}</Text>}
    {!!error&&<Text accessibilityRole="alert" style={s.deleteText}>{error}</Text>}
    <View style={s.actions}><Pressable accessibilityRole="button" disabled={busy} onPress={close} style={s.button}><Text style={s.label}>{bn?"ফিরে যান":"Cancel"}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} style={[s.button,s.confirm,mode==="delete"&&s.destructive,busy&&s.disabled]}>{busy?<ActivityIndicator color={colors.white}/>:<Text style={s.confirmText}>{mode==="delete"?(bn?"মুছে ফেলুন":"Delete"):(bn?"সেভ করুন":"Save changes")}</Text>}</Pressable></View>
   </ScrollView>
  </PopupSheet>
 </View>;
}
const s=StyleSheet.create({container:{gap:8},actions:{flexDirection:"row",gap:8},button:{flex:1,minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:10,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,paddingHorizontal:12},disabled:{opacity:.45},editText:{fontSize:13,fontWeight:"600",color:colors.primaryDark},deleteText:{fontSize:13,color:colors.dangerText},hint:{fontSize:12,lineHeight:18,color:colors.secondary},form:{gap:10,paddingBottom:16},label:{fontSize:13,fontWeight:"600",color:colors.heading},input:{minHeight:44,borderWidth:1,borderColor:colors.border,borderRadius:10,padding:10,color:colors.heading,backgroundColor:colors.card,fontSize:14},note:{minHeight:88,textAlignVertical:"top"},confirm:{backgroundColor:colors.primary,borderColor:colors.primary},destructive:{backgroundColor:colors.danger,borderColor:colors.danger},confirmText:{fontSize:13,fontWeight:"600",color:colors.white}});
