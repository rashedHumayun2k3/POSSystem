import {Pressable,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import SharedDatePicker from "./SharedDatePicker";
import {reportToday,shiftReportDate} from "./reportDate";
import {colors} from "../theme";
import {useLanguage} from "../i18n/LanguageContext";
export default function ReportDateField({value,onChange}:{value:string;onChange:(date:string)=>void}){
  const {t}=useLanguage(),today=reportToday();
  const arrow=(step:number)=>{
    const disabled=!value||(step>0&&value>=today)||(step<0&&value<="1900-01-01");
    return <Pressable accessibilityRole="button" accessibilityLabel={t(step<0?"reportCalendar.previousDate":"reportCalendar.nextDate")} disabled={disabled} onPress={()=>onChange(shiftReportDate(value,step))} style={{width:30,height:36,alignItems:"center",justifyContent:"center",backgroundColor:colors.primaryLight,borderRadius:7,opacity:disabled?0.4:1}}><Ionicons name={step<0?"chevron-back":"chevron-forward"} size={16} color={colors.primaryDark}/></Pressable>;
  };
  return <View style={{flexDirection:"row",alignItems:"center",gap:5}}>{arrow(-1)}<View style={{flex:1,minWidth:0}}><SharedDatePicker value={value} onChange={onChange} maximumDate={today}/></View>{arrow(1)}</View>;
}
