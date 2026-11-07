import {Pressable,ScrollView,StyleSheet,View} from "react-native";
import {Text} from "../i18n/LocalizedText";
import {colors} from "../theme";

type Props<T extends string>={items:ReadonlyArray<{value:T;label:string}>;selected:T;onChange:(value:T)=>void};
export default function ReportPeriodTabs<T extends string>({items,selected,onChange}:Props<T>){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}} contentContainerStyle={s.content}><View style={s.group}>{items.map(item=><Pressable key={item.value} accessibilityRole="button" accessibilityState={{selected:selected===item.value}} onPress={()=>onChange(item.value)} style={[s.button,selected===item.value&&s.active]}><Text style={[s.text,selected===item.value&&s.activeText]}>{item.label}</Text></Pressable>)}</View></ScrollView>;
}
const s=StyleSheet.create({content:{alignItems:"center",gap:10,paddingHorizontal:12,paddingVertical:9},group:{flexDirection:"row",borderRadius:11,backgroundColor:colors.disabled,padding:3},button:{minHeight:31,alignItems:"center",justifyContent:"center",borderRadius:8,paddingHorizontal:11},active:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.border},text:{fontSize:10,fontWeight:"700",color:colors.muted},activeText:{color:colors.primaryDark}});
