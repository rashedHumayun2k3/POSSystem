import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import UserAvatar from "./UserAvatar";
import type { Partner } from "../types/partners";

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function Picker({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}) {
  return <Modal transparent visible animationType="fade" onRequestClose={close}>
    <View style={s.overlay}>
      <Pressable accessibilityLabel="Close picker" onPress={close} style={StyleSheet.absoluteFill}/>
      <View accessibilityViewIsModal style={s.popup}>
        <View style={s.row}><Text style={s.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close picker" onPress={close} style={s.icon}><Ionicons name="close" size={22} color={colors.heading}/></Pressable></View>
        {children}
      </View>
    </View>
  </Modal>;
}
export function CapitalPaymentDate({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}) {
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(new Date());
  const today=localDate(new Date());
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:open}} onPress={()=>{const parsed=new Date(`${value}T12:00:00`);setMonth(Number.isNaN(parsed.getTime())?new Date():parsed);setOpen(true)}} style={s.field}>
      <Ionicons name="calendar-outline" size={21} color={colors.primaryDark}/><Text style={s.value}>{value}</Text><Ionicons name="chevron-down" size={18} color={colors.primaryDark}/>
    </Pressable>
    {open&&<Picker title={label} close={()=>setOpen(false)}>
      <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} style={s.icon}><Ionicons name="chevron-back" size={20} color={colors.primaryDark}/></Pressable><Text style={s.month}>{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={localDate(first).slice(0,7)>=today.slice(0,7)} onPress={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} style={s.icon}><Ionicons name="chevron-forward" size={20} color={localDate(first).slice(0,7)>=today.slice(0,7)?colors.muted:colors.primaryDark}/></Pressable></View>
      <View style={s.grid}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><Text key={day} style={s.weekday}>{day}</Text>)}
        {Array.from({length:first.getDay()+days},(_,index)=>{const day=index-first.getDay()+1;if(day<1)return <View key={index} style={s.day}/>;const date=localDate(new Date(month.getFullYear(),month.getMonth(),day));return <Pressable key={index} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{selected:date===value,disabled:date>today}} disabled={date>today} onPress={()=>{onChange(date);setOpen(false)}} style={[s.day,date===value&&s.selected]}><Text style={[s.dayText,date>today&&s.disabled]}>{day}</Text></Pressable>})}
      </View>
    </Picker>}
  </>;
}
export function CapitalPayeeSelect({value,onChange,payees,loading,label,placeholder,empty}:{value:string;onChange:(value:string)=>void;payees:Partner[];loading:boolean;label:string;placeholder:string;empty:string}) {
  const [open,setOpen]=useState(false);
  const selected=payees.find(p=>p.name===value);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:open,disabled:loading}} disabled={loading} onPress={()=>setOpen(true)} style={s.field}>
      {selected&&<UserAvatar name={selected.name} photoUrl={selected.photoUrl} size={30}/>}
      <Text style={[s.value,!value&&s.disabled]}>{loading?"Loading…":value||placeholder}</Text><Ionicons name="chevron-down" size={18} color={colors.primaryDark}/>
    </Pressable>
    {open&&<Picker title={label} close={()=>setOpen(false)}><ScrollView style={s.options} keyboardShouldPersistTaps="handled">
      {payees.length?payees.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityState={{selected:p.name===value}} onPress={()=>{onChange(p.name);setOpen(false)}} style={[s.option,p.name===value&&s.selected]}><UserAvatar name={p.name} photoUrl={p.photoUrl} size={34}/><Text style={s.value}>{p.name}</Text>{p.name===value&&<Ionicons name="checkmark" size={20} color={colors.primaryDark}/>}</Pressable>):<Text style={s.empty}>{empty}</Text>}
    </ScrollView></Picker>}
  </>;
}
const s=StyleSheet.create({
  field:{minHeight:48,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:colors.border,borderRadius:10,paddingHorizontal:12,paddingVertical:8,backgroundColor:colors.white},
  value:{flex:1,minWidth:0,fontSize:14,lineHeight:22,color:colors.heading},disabled:{color:colors.muted},
  overlay:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:colors.overlay,padding:16},popup:{width:"100%",maxWidth:420,maxHeight:"80%",borderRadius:16,backgroundColor:colors.white,padding:14,gap:10},
  row:{flexDirection:"row",alignItems:"center",gap:8},title:{flex:1,fontSize:16,fontWeight:"700",color:colors.heading},icon:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  month:{flex:1,textAlign:"center",fontSize:15,fontWeight:"600",color:colors.heading},grid:{flexDirection:"row",flexWrap:"wrap"},weekday:{width:"14.285714%",textAlign:"center",fontSize:11,color:colors.secondary,paddingVertical:10},day:{width:"14.285714%",minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:8},dayText:{fontSize:15,color:colors.heading},selected:{backgroundColor:colors.primaryLight},
  options:{maxHeight:320},option:{minHeight:56,flexDirection:"row",alignItems:"center",gap:10,padding:10,borderRadius:9},empty:{padding:16,color:colors.secondary,fontSize:14}
});
