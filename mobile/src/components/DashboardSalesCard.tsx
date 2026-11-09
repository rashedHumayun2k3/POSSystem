import {Platform, StyleSheet, Text, useWindowDimensions, View} from "react-native";
import Svg, {Circle, Polyline} from "react-native-svg";
import {useLanguage} from "../i18n/LanguageContext";

export type SalesOverview = {todaySales:number;todayProfit:number|null;todayOrders:number;yesterdaySales:number;changePercent:number|null;sevenDaySales:number;days:{label:string;value:number}[]};

export default function DashboardSalesCard({data,canSeeCosts}:{data:SalesOverview;canSeeCosts:boolean}) {
  const {width}=useWindowDimensions();const desktop=Platform.OS==="web"&&width>=768;
  const {lang}=useLanguage();const bn=lang==="bn";const locale=bn?"bn-BD":"en-BD";
  const money=(n:number)=>`৳${n.toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const weekday=(date:string,long=false)=>new Date(`${date}T12:00:00`).toLocaleDateString(locale,{weekday:long?"long":"short"});
  const first=data.days[0],last=data.days[data.days.length-1];
  const highest=data.days.reduce<{label:string;value:number}|null>((best,day)=>!best||day.value>best.value?day:best,null);
  const values=data.days.map(d=>d.value),min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1;
  const points=values.map((v,i)=>({x:5+i*150/Math.max(1,values.length-1),y:55-(v-min)/span*45}));
  const end=points[points.length-1];
  const chartLabel=bn?`গত ৭ দিনের বিক্রয়${highest&&highest.value>0?`, সর্বোচ্চ ${weekday(highest.label,true)}`:""}`:`Sales last 7 days${highest&&highest.value>0?`, highest ${weekday(highest.label,true)}`:""}`;
  const percent=data.changePercent;
  const comparison=percent==null?(bn?"গতকাল বিক্রয় ছিল না":"No sales yesterday"):
    `${percent>0?"▲":percent<0?"▼":"—"} ${Math.abs(percent).toLocaleString(locale,{maximumFractionDigits:1})}% ${bn?"গতকালের তুলনায়":"vs yesterday"}`;
  return <View style={[s.card,{width:desktop?"48.7%":"100%"}]}>
    <View style={s.top}><Text style={s.label}>{bn?"আজকের বিক্রয়":"Today's sales"}</Text><View style={s.badge}><Text style={s.comparison}>{comparison}</Text></View></View>
    <Text style={s.sales} adjustsFontSizeToFit numberOfLines={1}>{money(data.todaySales)}</Text>
    <View style={s.middle}>
      <View style={s.metrics}>{canSeeCosts&&data.todayProfit!=null&&<View style={s.metric}><Text style={s.label}>{bn?"লাভ":"Profit"}</Text><Text style={s.value}>{money(data.todayProfit)}</Text></View>}<View style={s.metric}><Text style={s.label}>{bn?"অর্ডার":"Orders"}</Text><Text style={s.value}>{data.todayOrders.toLocaleString(locale)}</Text></View></View>
      <View accessible accessibilityRole="image" accessibilityLabel={chartLabel} style={s.sparkline}><Svg width="100%" height={52} viewBox="0 0 160 65"><Polyline points={points.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke="#0F766E" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>{end&&<Circle cx={end.x} cy={end.y} r={3.5} fill="#0F766E"/>}</Svg></View>
    </View>
    <Text style={s.footer}>{bn?"গত ৭ দিন":"Last 7 days"} {money(data.sevenDaySales)}{first&&last?` · ${weekday(first.label)}–${weekday(last.label)}`:""}</Text>
    <Text style={s.caption}>{chartLabel}</Text>
  </View>;
}
const s=StyleSheet.create({
  card:{alignSelf:"flex-start",backgroundColor:"#FAFCFD",borderWidth:1,borderColor:"#DCE5EC",borderRadius:16,padding:14,gap:5},
  top:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5},
  label:{fontSize:12,color:"#64748B"},badge:{backgroundColor:"#E8F1F2",paddingHorizontal:8,paddingVertical:4,borderRadius:12},
  comparison:{fontSize:10,fontWeight:"600",color:"#345D61"},sales:{fontSize:29,fontWeight:"800",color:"#172B4D",lineHeight:36},
  middle:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8},metrics:{flexDirection:"row",flexWrap:"wrap",columnGap:18,rowGap:4,flexGrow:1},
  metric:{gap:2},value:{fontSize:16,fontWeight:"700",color:"#243B53"},sparkline:{minWidth:90,flexBasis:110,flexGrow:1,maxWidth:180},
  footer:{fontSize:11,color:"#526579",marginTop:2},caption:{fontSize:10,color:"#718096"},
});
