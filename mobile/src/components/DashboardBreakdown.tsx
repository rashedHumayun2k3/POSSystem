import {StyleSheet,Text,View} from "react-native";
import {colors} from "../theme";
import {dashboardCardStyles as shared} from "./DashboardCardChrome";
export type BreakdownRow={name:string;value:number;unit?:string;detail?:string;quantity?:number;days?:number;count?:number;color?:string};
const palette=[colors.primary,colors.info,colors.success,colors.warning,"#8B5CF6","#BE185D",colors.neutralIcon];
export const breakdownColor=(name:string,index:number)=>({Cash:"#15803D",bKash:"#BE185D",Nagad:"#C2410C",Card:"#1D4ED8",Delivered:colors.success,Returned:colors.danger,Cancelled:colors.neutralIcon,Healthy:colors.success,"Low stock":colors.warning,"Out of stock":colors.danger} as Record<string,string>)[name]??palette[index%palette.length];
export default function DashboardBreakdown({rows,bn,label,percent=false,graph=false,total,rank=false,detailKind}:{rows:BreakdownRow[];bn:boolean;label?:(name:string)=>string;percent?:boolean;graph?:boolean;total?:number;rank?:boolean;detailKind?:"suppliers"}){
 const locale=bn?"bn-BD-u-nu-latn":"en-BD",num=(v:number)=>v.toLocaleString(locale,{maximumFractionDigits:2});
 const sum=rows.reduce((n,r)=>n+r.value,0),denominator=total??sum;
 const color=(r:BreakdownRow,i:number)=>r.color??breakdownColor(r.name,i);
 const showGraph=graph&&sum>0&&denominator>0&&rows.every(r=>r.value>=0);
 return <View style={s.list}>
  {showGraph&&<View style={s.track} accessible accessibilityRole="image" accessibilityLabel={rows.map(r=>`${label?.(r.name)??r.name}: ${num(r.value/denominator*100)}%`).join(', ')}>{rows.map((r,i)=><View key={`${r.name}-${i}`} style={{height:8,width:`${Math.max(0,Math.min(100,r.value/denominator*100))}%`,backgroundColor:color(r,i)}}/>)}{denominator>sum&&<View style={{flex:1,backgroundColor:colors.divider}}/>}</View>}
  {rows.length?rows.map((r,i)=><View key={`${r.name}-${i}`} style={s.row}>
   {!rank&&<View style={[shared.dot,{backgroundColor:color(r,i)}]}/>}
   <View style={s.name}><Text style={shared.label}>{rank?`${num(i+1)}. `:""}{label?.(r.name)??r.name}{r.detail&&<Text style={[shared.caption,{fontWeight:"400"}]}> {r.detail}</Text>}</Text></View>
   <Text style={s.center}>{r.quantity!=null?`${num(r.quantity)} ${bn?"বিক্রি":"sold"}`:r.days!=null?`${num(r.days)} ${bn?"দিন":"days"}`:percent?(denominator>0&&r.value>=0?`${num(r.value/denominator*100)}%`:"—"):detailKind==="suppliers"?(bn?"তারিখ নেই":"No due date"):""}</Text>
   <Text style={[s.value,r.value<0&&{color:colors.dangerText}]}>{r.value<0?"−":""}{r.unit==="count"?"":"৳"}{num(Math.abs(r.value))}</Text>
  </View>):<Text style={shared.caption}>{bn?"এই সময়ে কোনো তথ্য নেই":"Nothing in this range"}</Text>}
 </View>;
}
const s=StyleSheet.create({list:{gap:4},track:{height:8,borderRadius:4,overflow:"hidden",flexDirection:"row",backgroundColor:colors.disabled,marginBottom:6},row:{flexDirection:"row",alignItems:"center",gap:6,minHeight:32},name:{flex:1,minWidth:0},center:{width:65,textAlign:"center",fontSize:13,lineHeight:19,color:"#5B6676"},value:{width:88,textAlign:"right",fontSize:13,lineHeight:19,fontWeight:"600",fontVariant:["tabular-nums"],color:colors.heading}});
