import {useEffect,useState} from "react";
import {router} from "expo-router";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,TextInput,View} from "react-native";
import {Text} from "../i18n/LocalizedText";
import {useAuth} from "../auth/AuthContext";
import {colors} from "../theme";
import ReportDateField from "../components/ReportDateField";
import {ConfirmDialog} from "../components/ConfirmDialog";

type PendingExpense={id:string;subType:string;amount:number;expenseDate:string;note:string|null;fundingSource:string|null};
type Preview={periodStart:string|null;periodEnd:string;openingBalance:number;approvedCash:number;businessExpenses:number;closingBalance:number;pendingInjections:number;pendingExpenses:number;pendingExpenseItems:PendingExpense[]};
type Closing={id:string;periodStart:string;periodEnd:string;openingBalancePaisa:number;approvedCashPaisa:number;businessExpensePaisa:number;closingBalancePaisa:number;closedAt:string;note:string|null};
const money=(value:number)=>`৳${value.toLocaleString("en-BD",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const displayDate=(value:string)=>{const [year,month,day]=value.slice(0,10).split("-").map(Number);return new Date(year,month-1,day).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})};
const previousClosingDate=(value:string)=>{const [year,month,day]=value.slice(0,10).split("-").map(Number);const date=new Date(year,month-1,day);date.setDate(date.getDate()-1);return displayDate(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`)};
const yesterday=()=>{const date=new Date();date.setDate(date.getDate()-1);return date.toISOString().slice(0,10)};

export default function FundClosingScreen(){
 const auth=useAuth();const owner=auth.session?.user.role==="OWNER";
 const [through,setThrough]=useState(yesterday());const [note,setNote]=useState("");const [preview,setPreview]=useState<Preview|null>(null);
 const [history,setHistory]=useState<Closing[]>([]);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
 const [confirm,setConfirm]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const [selectedClosing,setSelectedClosing]=useState<Closing|null>(null);
 const [showPending,setShowPending]=useState(false);const [rejectId,setRejectId]=useState<string|null>(null);const [rejectReason,setRejectReason]=useState("");
 const load=async()=>{if(!owner)return;setLoading(true);setError("");try{setHistory(await auth.api<Closing[]>("/expenses/funding/closings"))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{void load()},[auth.session?.businessId,owner]);
 const review=async()=>{setLoading(true);setError("");setPreview(null);try{setPreview(await auth.api<Preview>(`/expenses/funding/closings/preview?through=${encodeURIComponent(through)}`))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 const decideExpense=async(id:string,decision:"approve"|"reject")=>{if(saving||decision==="reject"&&!rejectReason.trim())return;setSaving(true);setError("");try{await auth.api(`/expenses/${id}/${decision}`,{method:"POST",body:JSON.stringify(decision==="approve"?{note:null}:{reason:rejectReason.trim()})});setRejectId(null);setRejectReason("");setPreview(await auth.api<Preview>(`/expenses/funding/closings/preview?through=${encodeURIComponent(through)}`))}catch(e){setError((e as Error).message)}finally{setSaving(false)}};
 const close=async()=>{if(!preview||saving)return;setSaving(true);setError("");try{await auth.api("/expenses/funding/closings",{method:"POST",body:JSON.stringify({through,note:note.trim()||null})});setConfirm(false);setPreview(null);setSuccess("Period closed. Its investment and expense funds are locked.");await load()}catch(e){setConfirm(false);setError((e as Error).message)}finally{setSaving(false)}};
 return <ScrollView style={s.screen} contentContainerStyle={s.content}>
  <Pressable onPress={()=>router.replace("/more/settings/partners")}><Text style={s.link}>‹ Back to Business Partner</Text></Pressable>
  <Text style={s.title}>Close Accounting Period</Text>
  <Text style={s.info}>Closes investment and expense funds only. Choose a completed date and review every amount before closing.</Text>
  {!owner?<Text style={s.error}>Only the owner can close a period.</Text>:<>
   <View style={s.card}><Text style={s.label}>Closing date</Text><ReportDateField value={through} onChange={date=>{setThrough(date);setPreview(null)}}/>
    <TextInput accessibilityLabel="Closing note" value={note} onChangeText={setNote} placeholder="Note (optional)" style={s.input}/>
    {!preview&&<Pressable disabled={loading||saving} onPress={()=>void review()} style={s.button}><Text style={s.buttonText}>Review period</Text></Pressable>}</View>
   {loading&&<ActivityIndicator color={colors.primary}/>}{!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!success&&<Text style={s.success}>{success}</Text>}
   {preview&&<View style={s.card}><View><Text style={s.heading}>Review closing balance</Text><Text style={s.range}>{preview.periodStart?previousClosingDate(preview.periodStart):"From the beginning"} – {displayDate(preview.periodEnd)}</Text></View>
    <Row label="Previous closing balance" value={money(preview.openingBalance)}/><Row label="Approved cash installments" value={money(preview.approvedCash)}/>
    <Row label="Business-paid expenses" value={money(preview.businessExpenses)}/><View style={s.divider}/><View style={s.row}><Text style={s.totalLabel}>Closing available funds</Text><Text style={s.totalValue}>{money(preview.closingBalance)}</Text></View>
    <Text style={s.info}>Pending installments: {preview.pendingInjections} · Pending expenses: {preview.pendingExpenses}</Text>
    {(preview.pendingInjections>0||preview.pendingExpenses>0)&&<View style={s.blockers}>
     <Text style={s.error}>Closing is blocked because these transactions are dated on or before {through}. Approve or reject each one below; the balance will refresh automatically.</Text>
     {preview.pendingExpenses>0&&<><Pressable onPress={()=>setShowPending(value=>!value)}><Text style={s.link}>{showPending?"Hide":"Review"} {preview.pendingExpenses} pending expense{preview.pendingExpenses===1?"":"s"} {showPending?"↑":"↓"}</Text></Pressable>
      {showPending&&preview.pendingExpenseItems.map(expense=><View key={expense.id} style={s.pendingCard}>
       <View style={s.row}><Text style={s.label}>{expense.subType}</Text><Text style={s.value}>{money(expense.amount)}</Text></View>
       <Text style={s.info}>{expense.expenseDate.slice(0,10)}{expense.fundingSource?` · ${expense.fundingSource==="PERSONAL"?"Paid personally":"Business Capital"}`:""}</Text>
       {!!expense.note&&<Text style={s.info}>{expense.note}</Text>}
       {rejectId===expense.id?<><TextInput accessibilityLabel="Reason for rejecting expense" value={rejectReason} onChangeText={setRejectReason} placeholder="Reason for rejection" style={s.input}/><View style={s.actions}><Pressable onPress={()=>setRejectId(null)} style={s.action}><Text style={s.link}>Cancel</Text></Pressable><Pressable disabled={!rejectReason.trim()||saving} onPress={()=>void decideExpense(expense.id,"reject")} style={s.action}><Text style={s.error}>Confirm reject</Text></Pressable></View></>:
       <View style={s.actions}><Pressable disabled={saving} onPress={()=>void decideExpense(expense.id,"approve")} style={s.action}><Text style={s.link}>Approve</Text></Pressable><Pressable disabled={saving} onPress={()=>{setRejectId(expense.id);setRejectReason("")}} style={s.action}><Text style={s.error}>Reject</Text></Pressable></View>}
      </View>)}
     </>}
     {preview.pendingInjections>0&&<Pressable onPress={()=>router.push("/more/settings/partners")}><Text style={s.link}>Review {preview.pendingInjections} pending installment{preview.pendingInjections===1?"":"s"} →</Text></Pressable>}
    </View>}
    <Pressable disabled={preview.pendingInjections>0||preview.pendingExpenses>0||saving} onPress={()=>setConfirm(true)} style={[s.button,(preview.pendingInjections>0||preview.pendingExpenses>0||saving)&&s.disabled]}><Text style={s.buttonText}>Close period through {displayDate(preview.periodEnd)}</Text></Pressable>
   </View>}
   <Text style={s.heading}>Closing history</Text>
   {!history.length?<Text style={s.info}>No closed periods yet.</Text>:history.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View closing summary through ${displayDate(item.periodEnd)}`} onPress={()=>setSelectedClosing(item)} style={s.card}>
    <Text style={s.label}>Through {displayDate(item.periodEnd)}</Text><Row label="Closing balance" value={money(item.closingBalancePaisa/100)}/>
    <Text style={s.info}>Closed {new Date(item.closedAt).toLocaleString()} · View summary →</Text></Pressable>)}
  </>}
  <ConfirmDialog visible={confirm} title="Close this period?" message="Investment and expense fund transactions dated through this day will be locked. Corrections must be entered in an open period." confirmLabel="Close period" busy={saving} onConfirm={()=>void close()} onCancel={()=>setConfirm(false)}/>
  <ConfirmDialog visible={!!selectedClosing} title="Closing summary" message="" hideCancel confirmLabel="Close" onConfirm={()=>setSelectedClosing(null)} onCancel={()=>setSelectedClosing(null)}>
   {selectedClosing&&<View style={s.summaryDetails}>
    <Text style={s.range}>{selectedClosing.periodStart.startsWith("0001-")?"From the beginning":displayDate(selectedClosing.periodStart)} – {displayDate(selectedClosing.periodEnd)}</Text>
    <Row label="Previous closing balance" value={money(selectedClosing.openingBalancePaisa/100)}/>
    <Row label="Approved cash installments" value={money(selectedClosing.approvedCashPaisa/100)}/>
    <Row label="Business-paid expenses" value={money(selectedClosing.businessExpensePaisa/100)}/>
    <View style={s.divider}/>
    <View style={s.row}><Text style={s.totalLabel}>Closing available funds</Text><Text style={[s.totalValue,selectedClosing.closingBalancePaisa<0&&s.negativeValue]}>{money(selectedClosing.closingBalancePaisa/100)}</Text></View>
    {selectedClosing.closingBalancePaisa<0&&<Text style={s.error}>Fund shortfall at closing</Text>}
    {!!selectedClosing.note&&<Text style={s.info}>Note: {selectedClosing.note}</Text>}
    <Text style={s.info}>Closed {new Date(selectedClosing.closedAt).toLocaleString()}</Text>
   </View>}
  </ConfirmDialog>
 </ScrollView>
}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><Text style={s.info}>{label}</Text><Text style={s.value}>{value}</Text></View>}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:20,gap:14,maxWidth:760,width:"100%",alignSelf:"center"},title:{fontSize:23,fontWeight:"800",color:colors.heading},heading:{fontSize:17,fontWeight:"800",color:colors.heading},range:{fontSize:12,fontWeight:"700",color:colors.secondary,marginTop:4},info:{fontSize:13,lineHeight:19,color:colors.secondary},card:{padding:16,gap:13,borderRadius:14,backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider},summaryDetails:{gap:12},blockers:{gap:10,padding:12,borderRadius:9,backgroundColor:colors.dangerBackground},pendingCard:{gap:7,padding:12,borderRadius:9,borderWidth:1,borderColor:colors.divider,backgroundColor:colors.white},actions:{flexDirection:"row",gap:8},action:{paddingHorizontal:12,paddingVertical:8,borderRadius:8,borderWidth:1,borderColor:colors.divider},label:{fontSize:13,fontWeight:"700",color:colors.heading},row:{flexDirection:"row",justifyContent:"space-between",gap:10},divider:{height:1,backgroundColor:colors.divider,marginVertical:2},totalLabel:{fontSize:14,fontWeight:"800",color:colors.heading},totalValue:{fontSize:17,fontWeight:"800",color:colors.successText},negativeValue:{color:colors.dangerText},value:{fontSize:14,fontWeight:"800",color:colors.primaryDark},input:{minHeight:44,borderWidth:1,borderColor:colors.border,borderRadius:9,paddingHorizontal:12,color:colors.heading},button:{minHeight:46,backgroundColor:colors.primary,borderRadius:10,alignItems:"center",justifyContent:"center"},disabled:{opacity:.45},buttonText:{color:colors.white,fontWeight:"800"},error:{fontSize:13,color:colors.dangerText},success:{fontSize:13,color:colors.successText},link:{fontSize:14,fontWeight:"700",color:colors.primaryDark}});
