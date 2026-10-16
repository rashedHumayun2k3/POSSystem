import {useRef,useState} from "react";
import {Pressable,Text,TextInput,View} from "react-native";
import {useAuth} from "../auth/AuthContext";
import {ConfirmDialog} from "./ConfirmDialog";
import {colors} from "../theme";

type Props={isAccountingPeriodClosed?:boolean;id:string;installment?:boolean;amount:number;updatedAt:string;createdBy:string;status:string;onSaved:()=>void};
export default function FinancialCorrectionActions({id,installment=false,amount,updatedAt,createdBy,status,isAccountingPeriodClosed,onSaved}:Props){
 const auth=useAuth();const [mode,setMode]=useState<"edit"|"confirm"|"delete"|null>(null),[value,setValue]=useState(String(amount)),[error,setError]=useState(""),[busy,setBusy]=useState(false);const saving=useRef(false);
 const allowed=installment?(auth.session?.user.role==="OWNER"||auth.session?.user.id===createdBy):auth.session?.user.id===createdBy;
 if(!allowed||status==="CANCELLED"||isAccountingPeriodClosed!==false)return null;
 const money=(n:number)=>`৳${n.toLocaleString("en-BD",{maximumFractionDigits:2})}`;
 const close=()=>{if(!saving.current){setMode(null);setError("")}};
 const save=async()=>{if(saving.current)return;saving.current=true;setBusy(true);setError("");try{await auth.api(`/${installment?"capital-injections":"expenses"}/${id}/correction`,{method:"POST",body:JSON.stringify({amount:mode==="delete"?null:Number(value),cancel:mode==="delete",expectedUpdatedAt:updatedAt})});setMode(null);onSaved()}catch(e){setError((e as Error).message)}finally{saving.current=false;setBusy(false)}};
 const confirm=()=>{if(mode==="edit"){if(!/^\d+(\.\d{1,2})?$/.test(value.trim())||Number(value)<=0){setError("Enter a positive amount with at most two decimal places.");return}setError("");setMode("confirm")}else void save()};
 return <View style={{gap:8}}><View style={{flexDirection:"row",gap:16,paddingTop:8}}><Pressable accessibilityRole="button" onPress={e=>{e.stopPropagation();setValue(String(amount));setError("");setMode("edit")}}><Text style={{color:colors.primaryDark,fontWeight:"700"}}>Edit amount</Text></Pressable><Pressable accessibilityRole="button" onPress={e=>{e.stopPropagation();setError("");setMode("delete")}}><Text style={{color:colors.danger,fontWeight:"700"}}>Delete</Text></Pressable></View>
 <ConfirmDialog visible={mode!==null} title={mode==="edit"?"Edit amount":mode==="delete"?"Delete this record?":"Confirm amount change"} busy={busy} destructive={mode==="delete"} confirmLabel={mode==="edit"?"Continue":mode==="delete"?"Delete":"Save changes"} onCancel={close} onConfirm={confirm}
 message={mode==="edit"?"Enter the corrected amount.":mode==="delete"?"This will cancel this record and any linked expense or installment, reverse its balance impact, and keep its history.":`Change ${money(amount)} to ${money(Number(value))}? Any linked expense and installment will be updated together. Previous approvals will be reset and your business approval rules will apply.`}>
 {mode==="edit"&&<TextInput accessibilityLabel="Corrected amount" keyboardType="decimal-pad" value={value} onChangeText={setValue} editable={!busy} style={{borderWidth:1,borderColor:colors.border,borderRadius:8,padding:12,color:colors.heading}}/>}
 {!!error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}
 </ConfirmDialog></View>
}
