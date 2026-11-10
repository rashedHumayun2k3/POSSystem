import DashboardBreakdown from "./DashboardBreakdown";
import {DashboardCardHeader,useDashboardAmountStyle,dashboardCardStyles as shared} from "./DashboardCardChrome";
import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from "react-native";
import {colors} from "../theme";
import {router} from "expo-router";
import {useAuth} from "../auth/AuthContext";
import {useLanguage} from "../i18n/LanguageContext";

type Period="TODAY"|"YESTERDAY"|"7D"|"MONTH";
type SalesSection={previousSales?:number;sales:number;profit:number|null;orders:number;itemsSold:number;averageBill:number;margin:number|null;changePercent:number|null;chart:{label:string;value:number}[];channels:{channel:string;orders:number;sales:number;share:number}[]};
export default function DashboardSalesCard({canSeeCosts}:{canSeeCosts:boolean}) {
  const amountStyle=useDashboardAmountStyle();
 const auth=useAuth(),api=useRef(auth.api);api.current=auth.api;
  const {lang}=useLanguage(),bn=lang==="bn",locale=bn?"bn-BD-u-nu-latn":"en-BD";
  const [period,setPeriod]=useState<Period>("TODAY"),[retry,setRetry]=useState(0);
  const [result,setResult]=useState<{period:Period;data:SalesSection}|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;setResult(null);setError("");
    api.current<SalesSection>(`/reports/dashboard/sales-section?period=${period}`).then(data=>{if(active)setResult({period,data});}).catch(()=>{if(active)setError(bn?"বিক্রয়ের তথ্য লোড করা যায়নি":"Could not load sales");});
    return()=>{active=false;};
  },[period,retry,bn]);
  const [open,setOpen]=useState(false);
  const data=result?.period===period?result.data:null;
  const number=(n:number)=>n.toLocaleString(locale,{maximumFractionDigits:2});
  const money=(n:number)=>`${n<0?"−":""}৳${number(Math.abs(n))}`;
  const tabs:{id:Period;label:string}[]=[{id:"TODAY",label:bn?"আজ":"Today"},{id:"YESTERDAY",label:bn?"গতকাল":"Yesterday"},{id:"7D",label:bn?"৭ দিন":"7 days"},{id:"MONTH",label:bn?"এই মাস":"This month"}];
  const comparison=period==="TODAY"?(bn?"গতকালের তুলনায়":"vs yesterday"):period==="YESTERDAY"?(bn?"আগের দিনের তুলনায়":"vs previous day"):period==="7D"?(bn?"আগের ৭ দিনের তুলনায়":"vs previous 7 days"):(bn?"আগের সমান সময়ের তুলনায়":"vs preceding equal period");
  const axis=(label:string)=>label.includes(":")?label:new Date(`${label}T12:00:00`).toLocaleDateString(locale,{month:"short",day:"numeric"});
  const hasChartSales=!!data?.chart.some(point=>point.value!==0);
  const max=Math.max(1,...(data?.chart.map(p=>Math.abs(p.value))??[]));
  return <View style={[shared.card,open?shared.open:shared.collapsed]}>
    <DashboardCardHeader title={bn?"বিক্রয়":"Sales"} context={tabs.find(t=>t.id===period)?.label} open={open} bn={bn} onPress={()=>setOpen(v=>!v)}/>
    {open&&<View style={shared.filters}>{tabs.map(tab=><Pressable key={tab.id} accessibilityRole="button" accessibilityState={{selected:period===tab.id}} onPress={()=>setPeriod(tab.id)} style={[shared.filter,period===tab.id&&shared.filterActive]}><Text style={[shared.secondary,period===tab.id&&shared.link]}>{tab.label}</Text></Pressable>)}</View>}
    {error?<View style={shared.state}><Text style={shared.secondary}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(n=>n+1)}><Text style={shared.link}>{bn?"আবার চেষ্টা করুন":"Try again"}</Text></Pressable></View>:!data?<View style={shared.state}><ActivityIndicator color={colors.primaryDark}/></View>:<>
      <View style={[shared.summary,!open&&shared.collapsedSummary]}><Text style={[shared.amount,amountStyle,!open&&shared.collapsedAmount,data.sales<0&&{color:colors.dangerText}]}>{money(data.sales)}</Text><Text style={s.summaryLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}><Text style={{color:data.previousSales!=null&&data.sales<data.previousSales?colors.dangerText:data.changePercent!=null&&data.changePercent>0?colors.successText:colors.secondary}}>{data.changePercent==null?(bn?"আগের সময়ে বিক্রয় ছিল না":"No sales in comparison period"):`${data.changePercent>0?"▲":data.changePercent<0?"▼":"—"} ${number(Math.abs(data.changePercent))}% ${comparison}`}</Text><Text style={shared.caption}> | {number(data.orders)} {bn?"অর্ডার":"orders"}{canSeeCosts&&data.profit!=null?` · ${bn?"লাভ":"profit"} ${money(data.profit)}`:""}</Text></Text></View>
      {open&&<View style={shared.detail}>
      {hasChartSales&&<View><View style={s.chart}>{data.chart.map(point=><View key={point.label} accessible accessibilityLabel={`${axis(point.label)}: ${money(point.value)}`} style={[s.bar,{height:Math.max(2,Math.abs(point.value)/max*64),backgroundColor:point.value<0?colors.danger:colors.primary}]}/>)}</View><View style={s.axis}><Text style={shared.caption}>{data.chart[0]?axis(data.chart[0].label):""}</Text><Text style={shared.caption}>{data.chart.length?axis(data.chart[data.chart.length-1].label):""}</Text></View></View>}
      <View style={s.salesMetrics}>{[{label:bn?"গড় বিল":"Avg bill",value:money(data.averageBill)},{label:bn?"বিক্রীত পণ্য":"Items sold",value:number(data.itemsSold)},...(canSeeCosts?[{label:bn?"মার্জিন":"Margin",value:data.margin==null?"—":`${number(data.margin)}%`}]:[])].map(metric=><View key={metric.label} style={s.salesMetric}><Text style={shared.secondary}>{metric.label}</Text><Text style={shared.metricValue}>{metric.value}</Text></View>)}</View>
      <View style={s.channels}><Text style={shared.sectionTitle}>{bn?"চ্যানেল অনুযায়ী বিক্রয়":"Sales by channel"}</Text><DashboardBreakdown bn={bn} percent graph rows={data.channels.map(c=>({name:c.channel==="ONLINE"?(bn?"অনলাইন":"Online"):(bn?"পিওএস / অফলাইন":"POS / Offline"),value:c.sales,detail:`${number(c.orders)} ${bn?"অর্ডার":"orders"}`,color:c.channel==="ONLINE"?"#BE185D":colors.info}))}/></View>
      </View>}
    </>}
    {open&&<Pressable accessibilityRole="link" onPress={()=>router.push("/orders")} style={shared.footer}><Text style={shared.link}>{bn?"সব বিক্রয় দেখুন":"View all sales"} →</Text></Pressable>}
  </View>;
}
const s=StyleSheet.create({
 summaryLine:{fontSize:13,lineHeight:19,color:"#5B6676"},
 salesMetrics:{flexDirection:"row",gap:8},salesMetric:{flex:1,minWidth:0,gap:3,paddingVertical:4},
 chart:{height:72,flexDirection:"row",alignItems:"flex-end",gap:3},bar:{flex:1,borderTopLeftRadius:2,borderTopRightRadius:2},
 axis:{flexDirection:"row",justifyContent:"space-between",marginTop:5},
 channels:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:8,gap:6},
 track:{height:8,flexDirection:"row",overflow:"hidden",borderRadius:4,backgroundColor:colors.disabled},
});
