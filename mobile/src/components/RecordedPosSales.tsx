import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,View} from "react-native";
import {useAuth} from "../auth/AuthContext";
import {useLanguage} from "../i18n/LanguageContext";
import {Text} from "../i18n/LocalizedText";
import {colors} from "../theme";

type Item={productId:string;name:string;qty:number;amount:number};
type Sale={id:string;orderNo:string;customerName:string;createdAt:string;items:Item[];paymentMethods:string[];paymentStatus:string;dueAmount:number};
type Report={date:string;saleCount:number;qty:number;amount:number;products:Item[];sales:Sale[]};
const money=(n:number)=>`৳${n.toLocaleString("en-BD",{maximumFractionDigits:2})}`;
export default function RecordedPosSales({date,refresh}:{date:string;refresh:number}){
  const auth=useAuth(),api=useRef(auth.api);api.current=auth.api;
  const {t,lang}=useLanguage();
  const [result,setResult]=useState<{key:string;data?:Report;error?:string}|null>(null);
  const [retry,setRetry]=useState(0),[details,setDetails]=useState(false);
  const key=`${auth.session?.businessId}:${auth.session?.branchId}:${date}:${refresh}:${retry}`;
  useEffect(()=>{let active=true;setDetails(false);api.current<Report>(`/orders/pos-recorded?date=${encodeURIComponent(date)}`).then(data=>{if(active)setResult({key,data})}).catch(error=>{if(active)setResult({key,error:error.message||"Could not load recorded sales."})});return()=>{active=false}},[key,date]);
  const current=result?.key===key?result:null;
  const payment=(value:string)=>t(({CASH:"salesReportLabels.cash",CARD:"salesReportLabels.card",BKASH:"salesReportLabels.bkash",NAGAD:"salesReportLabels.nagad"} as Record<string,string>)[value]??value);
  return <View style={s.card}><Text style={s.title}>{t("recordedPos.title")} — {new Date(`${date}T12:00:00`).toLocaleDateString(lang==="bn"?"bn-BD":"en-GB",{day:"numeric",month:"long",year:"numeric"})}</Text>
    {!current?<ActivityIndicator color={colors.primary}/>:current.error?<View style={s.gap}><Text style={s.error}>{t("recordedPos.failed")}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}><Text style={s.link}>{t("recordedPos.retry")}</Text></Pressable></View>:current.data&&<>
      <Text style={s.meta}>{t("recordedPos.summary",{sales:current.data.saleCount,qty:current.data.qty})} · {money(current.data.amount)}</Text>
      {!current.data.products.length?<Text style={s.meta}>{t("recordedPos.empty")}</Text>:<><View style={s.row}><Text style={[s.name,s.heading]}>{t("salesReportLabels.name")}</Text><Text style={[s.qty,s.heading]}>{t("salesReportLabels.quantity")}</Text><Text style={[s.amount,s.heading]}>{t("salesReportLabels.amount")}</Text></View>{current.data.products.map(item=><View key={item.productId} style={s.row}><Text style={s.name}>{item.name}</Text><Text style={s.qty}>{item.qty}</Text><Text style={s.amount}>{money(item.amount)}</Text></View>)}
      <View style={s.row}><Text style={[s.name,s.heading]}>{t("recordedPos.totalAmount")}</Text><Text style={[s.amount,s.heading]}>{money(current.data.amount)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(v=>!v)} style={{paddingVertical:8}}><Text style={s.link}>{t(details?"recordedPos.hide":"recordedPos.details")}</Text></Pressable>
      {details&&current.data.sales.map(sale=><View key={sale.id} style={s.sale}><View style={s.row}><Text style={[s.name,s.heading]}>{sale.orderNo}</Text><Text style={s.amount}>{money(sale.items.reduce((sum,i)=>sum+i.amount,0))}</Text></View><Text style={s.meta}>{sale.customerName} · {sale.paymentMethods.map(payment).join(", ")||t("posDue.label")}</Text>{sale.dueAmount>0&&<><Text style={s.error}>{t("posDue.remaining")}: {money(sale.dueAmount)}</Text><Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/orders/[id]",params:{id:sale.id}})}><Text style={s.link}>{t("posDue.collect")}</Text></Pressable></>}<Text style={s.meta}>{t("recordedPos.entered")} {new Date(sale.createdAt).toLocaleString(lang==="bn"?"bn-BD":"en-GB")}</Text>{sale.items.map((item,index)=><Text key={`${item.productId}-${index}`} style={s.meta}>{item.name} · {item.qty} · {money(item.amount)}</Text>)}</View>)}
      </>}
    </>}
  </View>;
}
const s=StyleSheet.create({card:{padding:12,gap:8,backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,borderRadius:12},title:{fontSize:14,fontWeight:"800",color:colors.heading},row:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:7,borderBottomWidth:1,borderBottomColor:colors.divider},name:{flex:1,minWidth:0,fontSize:12,color:colors.heading},qty:{width:64,textAlign:"right",fontSize:12,color:colors.heading},amount:{width:96,textAlign:"right",fontSize:12,color:colors.primaryDark},heading:{fontWeight:"700"},meta:{fontSize:11,lineHeight:17,color:colors.secondary},link:{fontSize:12,fontWeight:"700",color:colors.primaryDark},error:{fontSize:12,color:colors.dangerText},gap:{gap:8},sale:{gap:4,paddingTop:7,borderTopWidth:1,borderTopColor:colors.border}});
