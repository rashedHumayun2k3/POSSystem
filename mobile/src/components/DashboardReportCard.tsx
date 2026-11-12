import DashboardBreakdown from "./DashboardBreakdown";
import {DashboardCardHeader,useDashboardAmountStyle,dashboardCardStyles as shared} from "./DashboardCardChrome";
import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {router,type Href} from "expo-router";
import {useAuth} from "../auth/AuthContext";
import {useLanguage} from "../i18n/LanguageContext";
import {colors} from "../theme";
export type DashboardPeriod="TODAY"|"YESTERDAY"|"7D"|"MONTH"|"ALL";
type Row={name:string;value:number;unit?:string;detail?:string;quantity?:number;days?:number;count?:number};
type Data={returnRate?:number|null;resolvedOrders?:number;asOf?:string;total:number;rows:Row[];metrics:Row[];recent:Row[]};
export type DashboardCardConfig={id:string;title:[string,string];summary:[string,string];hint?:[string,string];periods?:DashboardPeriod[];initial?:DashboardPeriod;unit?:"count";rowsTitle?:[string,string];recentTitle?:[string,string];link:Href;linkText:[string,string];breakdown?:boolean;ranking?:boolean};
const labels:Record<string,string>={"Cash":"হাতে নগদ","bKash":"বিকাশ","Nagad":"নগদ","Card":"কার্ড","Due (all time)":"বাকি (শুরু থেকে)","Sales":"বিক্রয়","Product and delivery cost":"পণ্য ও ডেলিভারি খরচ","Gross profit":"মোট লাভ","Approved expenses":"অনুমোদিত খরচ","Net operating profit":"পরিচালন লাভ","New":"নতুন","Packed":"প্যাক করা","With courier":"কুরিয়ারের কাছে","In transit 5+ days":"5 দিনের বেশি পথে","Delivered":"ডেলিভারি হয়েছে","Returned":"ফেরত এসেছে","Cancelled":"বাতিল","Total active products":"মোট সক্রিয় পণ্য","Healthy":"পর্যাপ্ত মজুত","Low stock":"কম মজুত","Out of stock":"মজুত নেই","To receive":"পাওনা","To pay":"দেনা","On hold":"অপেক্ষমাণ","Cancelled bills":"বাতিল বিল","Revised bills":"সংশোধিত বিল","Shipments on the way":"পথে থাকা চালান"};
const sourceColors:Record<string,{dot:string;background:string;border:string}>={
 Cash:{dot:"#15803D",background:"#F0FDF4",border:"#DCFCE7"},
 bKash:{dot:"#BE185D",background:"#FFF1F6",border:"#FCE7F3"},
 Nagad:{dot:"#C2410C",background:"#FFF7ED",border:"#FFEDD5"},
 Card:{dot:"#1D4ED8",background:"#EFF6FF",border:"#DBEAFE"},
};
const palette=[colors.primary,colors.info,colors.success,colors.warning,colors.neutralIcon];
export default function DashboardReportCard({config,canSeeCosts}:{config:DashboardCardConfig;canSeeCosts:boolean}){
 const amountStyle=useDashboardAmountStyle();
 const auth=useAuth(),api=useRef(auth.api);api.current=auth.api;
 const {lang}=useLanguage(),bn=lang==="bn",locale=bn?"bn-BD-u-nu-latn":"en-BD";
 const [open,setOpen]=useState(false),[period,setPeriod]=useState<DashboardPeriod>(config.initial??"MONTH"),[retry,setRetry]=useState(0),[byProfit,setByProfit]=useState(false);
 const [result,setResult]=useState<{period:DashboardPeriod;data:Data}|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;setResult(null);setError(false);
  api.current<Data>(`/reports/dashboard/${config.id}-section${config.id==="money"?"":`?period=${period}`}`).then(data=>{if(active)setResult({period,data});}).catch(()=>{if(active)setError(true);});
  return()=>{active=false;};
 },[config.id,period,retry]);
 const data=result?.period===period?result.data:null;
 const tr=(v:[string,string])=>v[bn?1:0],name=(v:string)=>bn?(labels[v]??v):v;
 const format=(v:number,unit?:string)=>`${v<0?"−":""}${unit==="count"?"":"৳"}${Math.abs(v).toLocaleString(locale,{maximumFractionDigits:2})}`;
 const periodLabel=(p:DashboardPeriod)=>({TODAY:bn?"আজ":"Today",YESTERDAY:bn?"গতকাল":"Yesterday","7D":bn?"7 দিন":"7 days",MONTH:bn?"এই মাস":"This month",ALL:bn?"সব সময়":"All time"})[p];
 const rows=data?(config.ranking&&byProfit?data.recent:data.rows):[];
 const rowList=(items:Row[],percent=false,detailKind?:"suppliers")=><DashboardBreakdown rows={items} bn={bn} label={name} percent={percent} graph={percent} total={config.id==="expense"?data?.total:undefined} rank={config.ranking} detailKind={detailKind}/>;
 return <View style={[shared.card,open?shared.open:shared.collapsed]}>
  <DashboardCardHeader title={tr(config.title)} context={config.periods||config.initial==="TODAY"?periodLabel(period):config.id==="capital"?(bn?"পুরো ব্যবসা":"Business-wide"):undefined} open={open} bn={bn} onPress={()=>{setOpen(v=>!v);if(config.id==="money"&&!open)setRetry(v=>v+1);}}/>
  {open&&config.periods&&<View style={shared.filters}>{config.periods.map(p=><Pressable key={p} accessibilityRole="button" accessibilityState={{selected:p===period}} onPress={()=>setPeriod(p)} style={[shared.filter,p===period&&shared.filterActive]}><Text style={[shared.secondary,p===period&&shared.link]}>{periodLabel(p)}</Text></Pressable>)}</View>}
  {error?<View style={shared.state}><Text style={shared.caption}>{bn?"তথ্য লোড করা যায়নি":"Could not load this section"}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)}><Text style={shared.link}>{bn?"আবার চেষ্টা করুন":"Try again"}</Text></Pressable></View>:!data?<View style={shared.state}><ActivityIndicator color={colors.primary}/></View>:<>
   <View style={[shared.summary,!open&&shared.collapsedSummary]}>
    <Text style={[shared.amount,amountStyle,!open&&shared.collapsedAmount,(config.id==="money"?(data.rows.find(r=>r.name==="Cash")?.value??0):data.total)<0&&{color:colors.dangerText}]}>{format(config.id==="money"?(data.rows.find(r=>r.name==="Cash")?.value??0):data.total,config.unit)}</Text>
    {config.id==="money"?<View style={s.walletSummary}><View style={s.sourceDots}>{["bKash","Nagad"].map(source=><View key={source} style={[shared.dot,{backgroundColor:sourceColors[source].dot}]}/>)}</View><Text style={shared.secondary}>{bn?"অন্যান্য উৎস":"Other sources"} · {format(data.rows.filter(r=>r.name==="bKash"||r.name==="Nagad").reduce((sum,r)=>sum+r.value,0))}</Text></View>:<>
     <Text style={shared.secondary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{tr(config.summary)}{!open&&` | ${data.metrics.length?data.metrics.slice(0,2).map(r=>`${name(r.name)} ${format(r.value,r.unit)}`).join(" · "):data.rows[0]?`${name(data.rows[0].name)} · ${format(data.rows[0].value,data.rows[0].unit)}`:bn?"কোনো তথ্য নেই":"No activity"}`}</Text>
    </>}
   </View>
   {config.id==="money"&&open&&<View style={shared.detail}>
    <View style={s.sourceHeading}><Text style={shared.sectionTitle}>{bn?"উৎস অনুযায়ী ব্যালেন্স":"Balance by source"}</Text><Text style={shared.caption}>{bn?"হিসাব অনুযায়ী":"Recorded"}</Text></View>
    {rowList(data.rows,true)}
    <View style={s.sourceTotal}><Text style={shared.secondary}>Card</Text><Text style={shared.caption}>{bn?"সেটেলমেন্ট রেকর্ড নেই":"Settlement not tracked"}</Text><Text style={shared.secondary}>—</Text></View>
    <View style={s.sourceTotal}><Text style={shared.secondary}>{bn?"নগদ ও ওয়ালেট মিলিয়ে":"Cash + wallets"}</Text><Text style={shared.value}>{format(data.total)}</Text></View>
    {data.asOf&&<Text style={shared.caption}>{bn?"সর্বশেষ আপডেট":"Updated"}: {new Date(data.asOf).toLocaleString(locale)}</Text>}
    {config.hint&&<Text style={shared.note}>{tr(config.hint)}</Text>}
    <View style={s.cashActions}>
     <Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)} style={s.cashAction}><Text style={shared.link}>{bn?"ব্যালেন্স রিফ্রেশ করুন":"Refresh balance"} ↻</Text></Pressable>
     <Pressable accessibilityRole="link" onPress={()=>router.push(config.link)} style={s.cashAction}><Text style={shared.link}>{tr(config.linkText)} →</Text></Pressable>
    </View>
   </View>}
   {open&&config.id!=="money"&&<View style={shared.detail}>
    {data.metrics.length>0&&<View style={shared.metrics}>{data.metrics.map((m,i)=><View key={`${m.name}-${i}`} style={[shared.metric,config.id==="orders"&&s.orderMetric]}><Text style={shared.caption}>{name(m.name)}</Text><Text style={shared.metricValue}>{format(m.value,m.unit)}</Text>{m.count!=null&&<Text style={shared.caption}>{bn?`${m.count.toLocaleString(locale)} জন ${m.name==="To receive"?"কাস্টমার":"সরবরাহকারী"}`:`${m.name==="To receive"?"from":"to"} ${m.count.toLocaleString(locale)} ${m.name==="To receive"?"customers":"suppliers"}`}</Text>}</View>)}</View>}
    {config.ranking&&canSeeCosts&&<View style={shared.filters}>{[false,true].map(profit=><Pressable key={String(profit)} accessibilityRole="button" accessibilityState={{selected:byProfit===profit}} onPress={()=>setByProfit(profit)} style={[shared.filter,byProfit===profit&&shared.filterActive]}><Text style={shared.secondary}>{profit?(bn?"লাভ অনুযায়ী":"By item profit"):(bn?"পরিমাণ অনুযায়ী":"By quantity")}</Text></Pressable>)}</View>}
    {config.ranking&&<Text style={shared.sectionTitle}>{bn?"সেরা 5":"Top 5"} · {byProfit?(bn?"পণ্যের লাভ":"Item profit"):(bn?"বিক্রয়ের পরিমাণ":"Sales amount")}</Text>}
    {config.rowsTitle&&<Text style={s.sub}>{tr(config.rowsTitle)}{config.id==="dues"?` (${data.rows.length})`:""}</Text>}
    {config.id!=="money"&&<View style={shared.list}>{rowList(rows,!!config.breakdown||config.id==="orders"||config.id==="capital")}</View>}
    {!config.ranking&&config.recentTitle&&(config.id!=="dues"||canSeeCosts)&&<><Text style={s.sub}>{tr(config.recentTitle)}{config.id==="dues"?` (${data.recent.length})`:""}</Text><View style={shared.list}>{rowList(data.recent,config.id==="products",config.id==="dues"?"suppliers":undefined)}</View></>}
    {config.id==="orders"&&<View style={s.returnRate}><View style={shared.rowCopy}><Text style={shared.label}>{bn?"রিটার্নের হার":"Return rate"}</Text><Text style={shared.caption}>{bn?`${(data.resolvedOrders??0).toLocaleString(locale)}টি নিষ্পত্তি হওয়া চালানের মধ্যে`:`Of ${(data.resolvedOrders??0).toLocaleString(locale)} resolved shipments`}</Text></View><Text style={shared.value}>{data.returnRate==null?"—":`${data.returnRate.toLocaleString(locale,{maximumFractionDigits:1})}%`}</Text></View>}
    {config.id!=="money"&&config.hint&&<Text style={shared.note}>{tr(config.hint)}</Text>}
    <Pressable accessibilityRole="link" onPress={()=>router.push(config.link)} style={shared.footer}><Text style={shared.link}>{tr(config.linkText)} →</Text></Pressable>
   </View>}
  </>}
 </View>;
}
const s=StyleSheet.create({
 orderMetric:{backgroundColor:colors.cardSecondary,borderColor:colors.border,borderWidth:1,borderRadius:10,paddingHorizontal:10,paddingVertical:8},
 cashActions:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:2,gap:0},
 cashAction:{minHeight:36,justifyContent:"center"},
 walletSummary:{flexDirection:"row",alignItems:"center",gap:7,flexWrap:"wrap"},sourceDots:{flexDirection:"row",gap:3},
 sourceHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},
 sourceTotal:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12,paddingVertical:6},
 returnRate:{flexDirection:"row",alignItems:"center",borderTopWidth:1,borderTopColor:colors.divider,paddingTop:8,gap:8},
 negative:{color:colors.dangerText},
 barTrack:{height:4,backgroundColor:colors.divider,borderRadius:2},bar:{height:4,borderRadius:2},
 sub:{...shared.sectionTitle,marginTop:4},
});
