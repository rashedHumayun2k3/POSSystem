import DashboardExpenseCard, {ExpenseSummary} from "../components/DashboardExpenseCard";
import DashboardSalesCard, {SalesOverview} from "../components/DashboardSalesCard";
import {useLanguage} from "../i18n/LanguageContext";
import {Text} from "../i18n/LocalizedText";
import {Ionicons} from "@expo/vector-icons";
import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,View} from "react-native";
import {useAuth} from "../auth/AuthContext";
import {colors} from "../theme";

type Point={label:string;value:number};type Named={name:string;value:number};
type Collections={cash:number;bkash:number;nagad:number;card:number;due:number};
const palette=["#F97316","#16A34A","#F59E0B","#DC2626","#8B5CF6","#EC4899","#2563EB"];
const money=(n:number)=>`৳${Number(n||0).toLocaleString("en-BD",{maximumFractionDigits:2})}`;
export default function ReportDashboardScreen() {
  const {lang}=useLanguage(); const bn=lang==="bn"; const auth=useAuth();
  const [reload,setReload]=useState(0);
  const canSeeCosts=["OWNER","MANAGER"].includes(auth.session?.user.role||"");
  // Remount every independent loader on scope changes so previous-business data cannot linger.
  const scope=`${auth.session?.businessId}:${auth.session?.branchId}:${auth.session?.user.id}:${reload}`;
  return <ScrollView style={s.screen} refreshControl={<RefreshControl refreshing={false} onRefresh={()=>setReload(v=>v+1)} colors={[colors.primary]}/>} contentContainerStyle={s.content}>
    <View style={s.pageHeader}><View style={s.headerIcon}><Ionicons name="bar-chart-outline" size={22} color={colors.primaryDark}/></View><View><Text style={s.pageTitle}>Report Dashboard</Text><Text style={s.pageHint}>Business performance at a glance</Text></View></View>
    <View key={scope} style={{gap:12}}>
      <View style={s.kpis}>
        <DashboardPart<SalesOverview> endpoint="sales-overview" label={bn?"আজকের বিক্রয়":"Today's Sales"}>{value=><DashboardSalesCard data={value} canSeeCosts={canSeeCosts}/>}</DashboardPart>
        <DashboardPart<ExpenseSummary> endpoint="expense-summary" label={bn?"খরচের সারাংশ":"Cost summary"}>{value=><DashboardExpenseCard data={value}/>}</DashboardPart>
        <DashboardPart<number> endpoint="today-returns" label={bn?"আজকের রিটার্ন":"Today's Returns"}>{value=>value>0?<Kpi label={bn?"আজকের রিটার্ন":"Today's Returns"} value={String(value)} tone="red" icon="return-down-back-outline"/>:null}</DashboardPart>
        <DashboardPart<Named[]> endpoint="stock" label={bn?"মজুত":"Stock"}>{rows=><><Kpi label="Low Stock" value={String(rows.find(r=>r.name==="LOW")?.value??0)} sub="items" tone="amber" icon="alert-circle-outline"/><Kpi label="Out of Stock" value={String(rows.find(r=>r.name==="OUT")?.value??0)} sub="variants" tone="red" icon="close-circle-outline"/></>}</DashboardPart>
      </View>
      <View style={s.section}><Text style={s.sectionTitle}>{bn?"বিক্রয় থেকে আদায় — শুরু থেকে এখন পর্যন্ত":"Sales collections — All time"}</Text><Text style={s.pageHint}>{bn?"রিফান্ড বাদ দিয়ে আদায়। খরচ ও উত্তোলন বাদ দেওয়া হয়নি। বাকি টাকা এখনো পাওয়া যায়নি।":"Receipts after refunds, before expenses and withdrawals. Due is money not yet collected."}</Text><View style={s.kpis}>
        <DashboardPart<Collections> endpoint="collections-summary" label={bn?"আদায়":"Collections"}>{value=><>
          <Kpi label={bn?"হাতে নগদ":"Cash"} value={money(value.cash)} tone="green" icon="cash-outline"/>
          <Kpi label={bn?"বিকাশ":"bKash"} value={money(value.bkash)} tone="orange" icon="wallet-outline"/>
          <Kpi label={bn?"নগদ":"Nagad"} value={money(value.nagad)} tone="amber" icon="wallet-outline"/>
          <Kpi label={bn?"কার্ড":"Card"} value={money(value.card)} tone="green" icon="card-outline"/>
          <Kpi label={bn?"বাকি":"Due"} value={money(value.due)} tone="red" icon="time-outline"/>
        </>}</DashboardPart>
      </View></View>
      <DashboardPart<Point[]> endpoint="trend" label="Sales Trend — Last 30 Days">{rows=><Section title="Sales Trend — Last 30 Days"><ColumnChart data={rows} color={colors.primary} moneyValues/></Section>}</DashboardPart>
      <DashboardPart<Named[]> endpoint="top-products" label="Top 10 Products — Last 30 Days">{rows=>rows.length>0?<Section title="Top 10 Products — Last 30 Days"><HorizontalBars data={rows} color={colors.primary}/></Section>:null}</DashboardPart>
      <DashboardPart<Named[]> endpoint="payment-methods" label="Payment Methods — Last 30 Days">{rows=>rows.length>0?<Section title="Payment Methods — Last 30 Days"><Breakdown data={rows}/></Section>:null}</DashboardPart>
      <DashboardPart<Named[]> endpoint="categories" label="Sales by Category — Last 30 Days">{rows=>rows.length>0?<Section title="Sales by Category — Last 30 Days"><Breakdown data={rows}/></Section>:null}</DashboardPart>
    </View>
  </ScrollView>;
}
function DashboardPart<T>({endpoint,label,children}:{endpoint:string;label:string;children:(value:T)=>React.ReactNode}) {
  const auth=useAuth();const api=useRef(auth.api);api.current=auth.api;
  const {lang}=useLanguage();const [value,setValue]=useState<T|null>(null);const [error,setError]=useState("");const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setValue(null);setError("");
    api.current<T>(`/reports/dashboard/${endpoint}`).then(result=>{if(active)setValue(result)}).catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[endpoint,retry]);
  if(error)return <View style={s.panel}><Text>{label}</Text><Text style={s.refreshError}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(v=>v+1)} style={s.retry}><Text style={s.retryText}>{lang==="bn"?"আবার চেষ্টা করুন":"Try again"}</Text></Pressable></View>;
  if(value===null)return <View style={{padding:12,gap:6}}><ActivityIndicator color={colors.primary}/><Text style={s.pageHint}>{label}</Text></View>;
  return <>{children(value)}</>;
}
function Kpi({label,value,sub,tone,icon}:{label:string;value:string;sub?:string;tone:"orange"|"green"|"amber"|"red";icon:keyof typeof Ionicons.glyphMap}){const map={orange:{bg:colors.primaryLight,border:colors.border,text:colors.primaryDark},green:{bg:colors.successBackground,border:"#BBF7D0",text:colors.successText},amber:{bg:colors.warningBackground,border:"#FDE68A",text:colors.warningText},red:{bg:colors.dangerBackground,border:"#FECACA",text:colors.dangerText}}[tone];return <View style={[s.kpi,{backgroundColor:map.bg,borderColor:map.border}]}><View style={s.kpiTop}><Text style={[s.kpiLabel,{color:map.text}]}>{label}</Text><Ionicons name={icon} size={16} color={map.text}/></View><Text numberOfLines={1} adjustsFontSizeToFit style={[s.kpiValue,{color:map.text}]}>{value}</Text>{sub&&<Text style={s.kpiSub}>{sub}</Text>}</View>}
function Section({title,children}:{title:string;children:React.ReactNode}){return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text><View style={s.panel}>{children}</View></View>}
function ColumnChart({data,color,moneyValues,compact}:{data:Point[];color:string;moneyValues?:boolean;compact?:boolean}){const max=Math.max(...data.map(x=>x.value),1);if(!data.length)return <Text style={s.empty}>No data available</Text>;const visible=data.length>16?data.filter((_,i)=>i%Math.ceil(data.length/16)===0||i===data.length-1):data;return <View><View style={[s.chart,{height:compact?125:150}]}>{visible.map((p,i)=><View key={`${p.label}-${i}`} style={s.columnWrap}><Text numberOfLines={1} style={s.columnValue}>{p.value>0?(moneyValues?compactMoney(p.value):String(p.value)):""}</Text><View style={s.columnTrack}><View style={[s.column,{height:`${Math.max(p.value/max*100,p.value?4:0)}%`,backgroundColor:color}]}/></View><Text numberOfLines={1} style={s.axisLabel}>{p.label}</Text></View>)}</View><View style={s.chartLegend}><View style={[s.dot,{backgroundColor:color}]}/><Text style={s.legendText}>Sales</Text></View></View>}
function HorizontalBars({data,color}:{data:Named[];color:string}){const max=Math.max(...data.map(x=>x.value),1);return <View style={s.barList}>{data.map((x,i)=><View key={`${x.name}-${i}`} style={s.barItem}><View style={s.barHead}><Text numberOfLines={1} style={s.barName}>{i+1}. {x.name}</Text><Text style={s.barValue}>{money(x.value)}</Text></View><View style={s.barTrack}><View style={[s.barFill,{width:`${Math.max(x.value/max*100,2)}%`,backgroundColor:color}]}/></View></View>)}</View>}
function Breakdown({data}:{data:Named[]}){const total=data.reduce((n,x)=>n+x.value,0);return <View style={s.breakdown}><View style={s.segmentBar}>{data.map((x,i)=><View key={`${x.name}-${i}`} style={{height:"100%",width:`${total?x.value/total*100:0}%`,backgroundColor:palette[i%palette.length]}}/>)}</View>{data.map((x,i)=><View key={`${x.name}-${i}`} style={s.legendRow}><View style={[s.legendDot,{backgroundColor:palette[i%palette.length]}]}/><View style={s.legendCopy}><Text numberOfLines={1} style={s.legendName}>{x.name}</Text><Text style={s.legendPercent}>{total?`${(x.value/total*100).toFixed(1)}%`:"0%"}</Text></View><Text style={s.legendAmount}>{money(x.value)}</Text></View>)}</View>}
function compactMoney(n:number){if(Math.abs(n)>=1000000)return `৳${(n/1000000).toFixed(1)}m`;if(Math.abs(n)>=1000)return `৳${(n/1000).toFixed(0)}k`;return `৳${n.toFixed(0)}`}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{padding:15,paddingBottom:34,gap:12},pageHeader:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:1},headerIcon:{width:42,height:42,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:colors.primaryLight},pageTitle:{fontSize:17,fontWeight:"800",color:colors.heading},pageHint:{fontSize:10,color:colors.muted,marginTop:2},kpis:{flexDirection:"row",flexWrap:"wrap",gap:8},kpi:{width:"48.7%",minHeight:94,borderWidth:1,borderRadius:15,padding:11},kpiTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:6},kpiLabel:{flex:1,fontSize:9,fontWeight:"800",letterSpacing:.35,textTransform:"uppercase",opacity:.78},kpiValue:{fontSize:19,fontWeight:"800",marginTop:7},kpiSub:{fontSize:9,color:colors.muted,marginTop:2},section:{gap:7,marginTop:4},sectionTitle:{fontSize:11,fontWeight:"800",letterSpacing:.4,textTransform:"uppercase",color:colors.secondary},panel:{borderWidth:1,borderColor:colors.divider,borderRadius:15,backgroundColor:colors.white,padding:11},chart:{flexDirection:"row",alignItems:"flex-end",gap:3},columnWrap:{flex:1,height:"100%",alignItems:"center"},columnValue:{height:14,fontSize:6,color:colors.muted,textAlign:"center"},columnTrack:{flex:1,width:"72%",justifyContent:"flex-end",borderRadius:4,overflow:"hidden",backgroundColor:colors.disabled},column:{width:"100%",minHeight:0,borderTopLeftRadius:4,borderTopRightRadius:4},axisLabel:{width:"100%",height:17,fontSize:6,color:colors.muted,textAlign:"center",marginTop:3},chartLegend:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,marginTop:7},dot:{width:8,height:8,borderRadius:4},legendText:{fontSize:9,color:colors.secondary},empty:{fontSize:11,color:colors.muted,textAlign:"center",paddingVertical:25},barList:{gap:11},barItem:{gap:5},barHead:{flexDirection:"row",alignItems:"center",gap:8},barName:{flex:1,fontSize:10,fontWeight:"600",color:colors.heading},barValue:{fontSize:10,fontWeight:"700",color:colors.primaryDark},barTrack:{height:8,borderRadius:4,overflow:"hidden",backgroundColor:colors.disabled},barFill:{height:"100%",borderRadius:4},breakdown:{gap:9},segmentBar:{height:16,flexDirection:"row",borderRadius:8,overflow:"hidden",backgroundColor:colors.disabled,marginBottom:3},legendRow:{minHeight:34,flexDirection:"row",alignItems:"center",gap:8,borderBottomWidth:1,borderBottomColor:colors.divider},legendDot:{width:10,height:10,borderRadius:5},legendCopy:{flex:1,minWidth:0,flexDirection:"row",alignItems:"center",gap:6},legendName:{flexShrink:1,fontSize:10,color:colors.secondary},legendPercent:{fontSize:8,color:colors.muted},legendAmount:{fontSize:10,fontWeight:"700",color:colors.heading},state:{flex:1,minHeight:300,alignItems:"center",justifyContent:"center",gap:11,padding:25,backgroundColor:colors.background},errorIcon:{width:55,height:55,borderRadius:28,alignItems:"center",justifyContent:"center",backgroundColor:colors.dangerBackground},stateText:{fontSize:12,lineHeight:17,color:colors.secondary,textAlign:"center"},retry:{borderRadius:10,backgroundColor:colors.primary,paddingHorizontal:16,paddingVertical:9},retryText:{fontSize:11,fontWeight:"700",color:colors.white},refreshError:{fontSize:10,color:colors.dangerText,textAlign:"center"}});
