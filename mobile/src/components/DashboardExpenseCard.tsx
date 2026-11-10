import {colors} from "../theme";
import {Ionicons} from "@expo/vector-icons";
import {Platform, StyleSheet, Text, useWindowDimensions, View} from "react-native";
import {useLanguage} from "../i18n/LanguageContext";

export type ExpenseSummary={todayCost:number;monthCost:number};

export default function DashboardExpenseCard({data}:{data:ExpenseSummary}) {
  const {lang}=useLanguage();const {width}=useWindowDimensions();const bn=lang==="bn";
  const money=(value:number)=>`৳${value.toLocaleString(bn?"bn-BD-u-nu-latn":"en-BD",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  return <View style={[s.card,{width:Platform.OS==="web"&&width>=768?"48.7%":"100%"}]}>
    <View style={s.header}><Text style={s.title}>{bn?"আজকের খরচ":"Today's Cost"}</Text><View style={s.icon}><Ionicons name="wallet-outline" size={18} color="#9A5B35"/></View></View>
    <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit>{money(data.todayCost)}</Text>
    <View style={s.month}><View style={s.monthLabel}><Text style={s.subtitle}>{bn?"এই মাসের খরচ":"This Month's Cost"}</Text><Text style={s.hint}>{bn?"মাসের শুরু থেকে আজ পর্যন্ত":"Month to date"}</Text></View><Text style={s.monthAmount}>{money(data.monthCost)}</Text></View>
  </View>;
}
const s=StyleSheet.create({
  card:{alignSelf:"flex-start",backgroundColor:colors.card,borderWidth:1,borderColor:colors.divider,borderRadius:16,padding:14,gap:5},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  title:{fontSize:13,fontWeight:"800",color:"#3E3026"},icon:{padding:6,borderRadius:9,backgroundColor:colors.primaryLight},
  amount:{fontSize:28,fontWeight:"800",color:"#603F2C",lineHeight:36},
  month:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,borderTopWidth:1,borderTopColor:colors.divider,paddingTop:10,marginTop:5},
  monthLabel:{gap:3},subtitle:{fontSize:12,fontWeight:"600",color:"#675747"},hint:{fontSize:10,color:"#897B6F"},monthAmount:{fontSize:17,fontWeight:"700",color:"#493B30"},
});
