import { useAuth } from "../../src/auth/AuthContext";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../src/i18n/LocalizedText";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { colors } from "../../src/theme";
import SalesRecordScreen from "../../src/screens/SalesRecordScreen";
import DeliveriesScreen from "../../src/screens/DeliveriesScreen";

export default function DueScreen() {
  const [tab, setTab] = useState<"customer" | "courier">("customer");
  const { t } = useLanguage();
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const [available, setAvailable] = useState({customer:false,courier:false});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const refresh = useCallback(()=>setReload(value=>value+1),[]);
  useFocusEffect(useCallback(()=>{
    let active = true;
    setLoading(true); setError("");
    Promise.all([
      api.current<{dueAmount:number}[]>("/orders?dueOnly=true"),
      api.current<{pendingOrderCount:number;totalCodReceivable:number}[]>("/remittances/summary")
    ]).then(([customers,couriers])=>{
      if(!active)return;
      const next = {customer:customers.some(item=>item.dueAmount>0),courier:couriers.some(item=>item.pendingOrderCount>0&&item.totalCodReceivable>0)};
      setAvailable(next);
      setTab(current=>next[current]||!(next.customer||next.courier)?current:next.customer?"customer":"courier");
    }).catch(reason=>{if(active)setError((reason as Error).message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[reload,auth.session?.businessId,auth.session?.branchId]));
  const visibleTabs = ["customer","courier"] as const;
  return <View style={s.screen}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Go back")} onPress={()=>router.canGoBack()?router.back():router.replace("/sale")}><Ionicons name="chevron-back" size={24} color={colors.heading}/></Pressable>
      <Text style={s.title}>{t("dueMenu")}</Text>
    </View>
    {loading?<ActivityIndicator style={{margin:24}} color={colors.primary}/>:error?<View style={{padding:24,gap:12}}><Text>{error}</Text><Pressable onPress={refresh}><Text>{t("Retry")}</Text></Pressable></View>:<>
    <View style={s.tabs}>{visibleTabs.map(value=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:tab===value}} onPress={()=>setTab(value)} style={[s.tab,tab===value&&s.selected]}><Text style={[s.label,tab===value&&s.selectedLabel]}>{t(`dueTabs.${value}`)}</Text></Pressable>)}</View>
    <Text style={s.hint}>{t(`dueTabs.${tab}Hint`)}</Text>
    {tab==="customer"?<SalesRecordScreen dueOnly embedded onDueChanged={refresh}/>:<DeliveriesScreen courierDueOnly onDueChanged={refresh}/>}
    </>}
  </View>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},header:{flexDirection:"row",alignItems:"center",gap:10,padding:14,backgroundColor:colors.white},title:{fontSize:18,fontWeight:"700",color:colors.heading},
  tabs:{flexDirection:"row",gap:8,paddingHorizontal:12,paddingTop:12},tab:{flex:1,minHeight:46,padding:10,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:10,backgroundColor:colors.white},selected:{backgroundColor:colors.primaryLight,borderColor:colors.primary},label:{fontSize:14,fontWeight:"600",color:colors.secondary,textAlign:"center"},selectedLabel:{color:colors.primaryDark},hint:{padding:12,fontSize:12,lineHeight:18,color:colors.secondary}
});
