import {useRef,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,TextInput,View} from "react-native";
import {Text} from "../i18n/LocalizedText";
import {useLanguage} from "../i18n/LanguageContext";
import {useAuth} from "../auth/AuthContext";
import PopupSheet from "./PopupSheet";
import {colors} from "../theme";
import {paymentRequestId} from "../utils/posPayment";
const methods=["CASH","CARD","BKASH","NAGAD"] as const;
export default function CollectDuePayment({orderId,due,customer,onSaved}:{orderId:string;due:number;customer:string;onSaved:()=>void}){
  const {api}=useAuth(),{t}=useLanguage();
  const [open,setOpen]=useState(false),[amount,setAmount]=useState(""),[method,setMethod]=useState<typeof methods[number]>("CASH"),[reference,setReference]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const attempt=useRef<{payload:string;id:string}|null>(null),saving=useRef(false);
  const value=Number(amount),validAmount=!!amount.trim()&&Number.isFinite(value)&&value>0&&value<=due&&Math.abs(value*100-Math.round(value*100))<0.000001;
  const transactionRequired=method==="BKASH"||method==="NAGAD";
  const validReference=!transactionRequired||/^[a-z0-9]{1,100}$/i.test(reference.trim());
  const paymentLabel=(name:typeof method)=>t(`salesReportLabels.${({CASH:"cash",CARD:"card",BKASH:"bkash",NAGAD:"nagad"} as const)[name]}`);
  const save=async()=>{
    if(saving.current)return;
    if(!validAmount){setError(t("posDue.invalidAmount"));return}
    if(!validReference){setError(t("posDue.referenceRequired"));return}
    const payload=JSON.stringify({method,amount:Math.round(value*100)/100,paymentReference:method==="CASH"?undefined:reference.trim()||undefined});
    if(attempt.current?.payload!==payload)attempt.current={payload,id:paymentRequestId()};
    saving.current=true;setBusy(true);setError("");
    try{await api(`/orders/${orderId}/payments`,{method:"POST",body:JSON.stringify({...JSON.parse(payload),paymentId:attempt.current.id})});setOpen(false);attempt.current=null;onSaved()}catch(e){setError((e as Error).message)}finally{saving.current=false;setBusy(false)}
  };
  return <><Pressable accessibilityRole="button" onPress={()=>{setAmount(String(due));setMethod("CASH");setReference("");setError("");setOpen(true)}} style={s.primary}><Text style={s.white}>{t("posDue.collect")}</Text></Pressable>
    <PopupSheet visible={open} onClose={()=>{if(!busy)setOpen(false)}} title={t("posDue.collect")} fitContent keyboardAware><ScrollView style={{flexGrow:0,flexShrink:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
      <Text style={s.name}>{customer}</Text><Text>{t("posDue.remaining")}: ৳{due.toLocaleString("en-BD",{maximumFractionDigits:2})}</Text>
      <Text>{t("posDue.amount")}</Text><TextInput accessibilityLabel={t("posDue.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!busy} style={s.input}/>
      {!!amount&&!validAmount&&<Text style={s.error}>{t("posDue.invalidAmount")}</Text>}
      <View style={s.methods}>{methods.map(name=><Pressable key={name} accessibilityRole="radio" accessibilityLabel={paymentLabel(name)} accessibilityState={{checked:method===name,disabled:busy}} disabled={busy} onPress={()=>{setMethod(name);setReference("")}} style={[s.method,method===name&&s.active]}><Text>{paymentLabel(name)}</Text></Pressable>)}</View>
      {method!=="CASH"&&<><Text>{t("posDue.reference")}</Text><TextInput accessibilityLabel={t("posDue.reference")} value={reference} onChangeText={setReference} editable={!busy} maxLength={100} autoCapitalize="none" autoCorrect={false} style={s.input}/></>}
      <Text style={s.hint}>{t("posDue.collectionHint")}</Text>{!!error&&<Text style={s.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy||!validAmount||!validReference} onPress={()=>void save()} style={[s.primary,(busy||!validAmount||!validReference)&&{opacity:.5}]}>{busy?<ActivityIndicator color={colors.white}/>:<Text style={s.white}>{t("posDue.savePayment")}</Text>}</Pressable>
    </ScrollView></PopupSheet></>;
}
const s=StyleSheet.create({primary:{minHeight:46,alignItems:"center",justifyContent:"center",borderRadius:10,backgroundColor:colors.primary,padding:12},white:{color:colors.white,fontWeight:"700"},form:{padding:16,gap:10},name:{fontSize:15,fontWeight:"700",color:colors.heading},input:{height:44,borderWidth:1,borderColor:colors.border,borderRadius:8,paddingHorizontal:10,color:colors.heading},methods:{flexDirection:"row",gap:6},method:{flex:1,alignItems:"center",paddingVertical:10,borderWidth:1,borderColor:colors.border,borderRadius:8},active:{backgroundColor:colors.primaryLight,borderColor:colors.primary},error:{color:colors.dangerText,fontSize:12},hint:{fontSize:12,color:colors.secondary}});
