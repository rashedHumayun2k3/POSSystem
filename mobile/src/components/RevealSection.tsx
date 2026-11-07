import type {ReactNode} from "react";
import {Pressable,StyleSheet} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {Text} from "../i18n/LocalizedText";
import {colors} from "../theme";

// Show secondary information only on request. Once revealed, no Hide action is added.
export default function RevealSection({label,shown,onShow,children}:{label:string;shown:boolean;onShow:()=>void;children:ReactNode}){
  if(shown)return <>{children}</>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:false}} onPress={onShow} style={({pressed})=>[s.button,pressed&&{opacity:.8}]}><Text style={s.label}>{label}</Text><Ionicons name="chevron-forward" size={18} color={colors.primaryDark}/></Pressable>;
}
const s=StyleSheet.create({button:{width:"100%",minHeight:46,paddingHorizontal:14,paddingVertical:10,borderWidth:1,borderColor:colors.border,borderRadius:10,backgroundColor:colors.primaryLight,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},label:{flex:1,fontSize:13,fontWeight:"700",color:colors.primaryDark}});
