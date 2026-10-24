import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";

export type ProcessStep = {
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  done: boolean;
  completedAt?: string;
  action?: { label: string; onPress: () => void; disabled?: boolean };
};

export default function ProcessGuide({title,steps,notice}:{title:string;steps:ProcessStep[];notice?:string}) {
  const {lang}=useLanguage();
  const progress=steps.length ? Math.round(steps.filter(step=>step.done).length/steps.length*100) : 0;
  return <View style={s.guide}>
    <View style={s.guideIntro}>
      <Text style={s.subtitle}>{title}</Text>
      <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
        <View accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{min:0,max:100,now:progress}} style={{flex:1,height:6,borderRadius:3,backgroundColor:colors.divider,overflow:"hidden"}}><View style={{width:`${progress}%`,height:"100%",borderRadius:3,backgroundColor:colors.primary}}/></View>
        <Text style={s.muted}>{progress}% {lang==="bn"?"সম্পন্ন":"complete"}</Text>
      </View>
      {!!notice&&<Text accessibilityRole="alert" style={{color:colors.warningText,fontSize:12,lineHeight:19}}>{notice}</Text>}
    </View>
    {steps.map((step,index)=><View key={index} style={[s.guideStep,step.done&&s.guideStepDone]}>
      <View style={[s.guideNumber,step.done&&s.guideNumberDone]}>{step.done?<Ionicons name="checkmark" size={16} color={colors.white}/>:<Text style={s.guideNumberText}>{index+1}</Text>}</View>
      <View style={s.guideIcon}><Ionicons name={step.icon} size={20} color={step.done?colors.successText:colors.primaryDark}/></View>
      <View style={s.flex}>
        <Text style={s.guideTitle}>{lang==="bn"?"ধাপ":"Step"} {index+1}: {step.title}</Text>
        <Text style={s.guideText}>{step.description}</Text>
        {step.done&&!!step.completedAt&&<Text style={s.muted}>{step.completedAt}</Text>}
        {!!step.action&&<Pressable accessibilityRole="button" accessibilityState={{disabled:!!step.action.disabled}} disabled={step.action.disabled} onPress={step.action.onPress} style={[s.guideStart,step.action.disabled&&{opacity:0.5}]}><Text style={s.guideStartText}>{step.action.label}</Text><Ionicons name="arrow-forward" size={15} color={colors.white}/></Pressable>}
      </View>
    </View>)}
  </View>;
}
const s=StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, guide: { width: "100%", maxWidth: 850, alignSelf: "center", gap: 10 }, guideIntro: { gap: 8, paddingVertical: 6 }, guideStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderWidth: 1, borderColor: colors.divider, borderRadius: 12, backgroundColor: colors.white }, guideStepDone:{borderColor:colors.successText,backgroundColor:colors.successBackground}, guideNumber: { width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary }, guideNumberDone:{backgroundColor:colors.successText}, guideNumberText: { color: colors.white, fontSize: 12, fontWeight: "800" }, guideIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight }, guideTitle: { color: colors.heading, fontSize: 14, fontWeight: "700", lineHeight: 20 }, guideText: { color: colors.secondary, fontSize: 12, lineHeight: 19, marginTop: 3 }, guideStart:{alignSelf:"flex-start",marginTop:9,minHeight:34,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:12,borderRadius:8,backgroundColor:colors.primary},guideStartText:{color:colors.white,fontSize:11,fontWeight:"700"},
  subtitle:{fontSize:15,fontWeight:"700",color:colors.heading},muted:{color:colors.secondary,fontSize:12,lineHeight:19},
});
