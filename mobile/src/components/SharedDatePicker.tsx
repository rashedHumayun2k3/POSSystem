import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";
import { reportToday } from "./reportDate";
import { clampDate, dateParts, isDateValue, type SharedDatePickerProps } from "./sharedDate";

type Option = { value: number; label: string };
const rowHeight = 44;
function DateWheel({ label, options, value, onChange }: { label: string; options: Option[]; value: number; onChange: (value: number) => void }) {
  const scroll = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const index = Math.max(0, options.findIndex(option => option.value === value));
  const initialOffset=useRef({x:0,y:index*rowHeight});
  useEffect(() => {
    if (!dragging.current) scroll.current?.scrollTo({ y: index * rowHeight, animated: false });
  }, [index, options.length]);
  return <View style={s.wheelColumn}><Text style={s.wheelLabel}>{label}</Text><View style={s.wheel}>
    <View pointerEvents="none" style={s.selectedBand}/>
    <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator={false} snapToInterval={rowHeight} decelerationRate="fast" bounces={false} contentContainerStyle={s.wheelContent} contentOffset={initialOffset.current}
      onScrollBeginDrag={()=>{dragging.current=true}}
      onScroll={event=>{const position=Math.max(0,Math.min(options.length-1,Math.round(event.nativeEvent.contentOffset.y/rowHeight)));if(options[position]&&options[position].value!==value)onChange(options[position].value)}} scrollEventThrottle={16}
      onMomentumScrollEnd={()=>{dragging.current=false}}
      onScrollEndDrag={event=>{if(!event.nativeEvent.velocity?.y)dragging.current=false}}
      accessibilityLabel={label} accessibilityRole="adjustable" accessibilityValue={{text:options[index]?.label}}
      accessibilityActions={[{name:"increment"},{name:"decrement"}]}
      onAccessibilityAction={event=>{const next=index+(event.nativeEvent.actionName==="increment"?1:-1);if(options[next])onChange(options[next].value)}}>
      {options.map(option=><Pressable key={option.value} accessibilityRole="button" accessibilityState={{selected:option.value===value}} onPress={()=>{dragging.current=false;onChange(option.value);scroll.current?.scrollTo({y:options.findIndex(item=>item.value===option.value)*rowHeight,animated:true})}} style={s.wheelRow}><Text style={[s.wheelText,option.value===value?s.selectedText:s.fadedText]}>{option.label}</Text></Pressable>)}
    </ScrollView>
  </View></View>;
}

export default function SharedDatePicker({value,onChange,label,minimumDate,maximumDate,earliestYear=1900,clearable=false,disabled=false}:SharedDatePickerProps) {
  const {t,lang}=useLanguage();
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(isDateValue(value)?value:reportToday());
  const currentYear=Number(reportToday().slice(0,4));
  const minimum=minimumDate??`${earliestYear}-01-01`,maximum=maximumDate??`${currentYear+10}-12-31`;
  const min=dateParts(minimum),max=dateParts(maximum),parts=dateParts(draft);
  const locale=lang==="bn"?"bn-BD":"en-GB";
  const update=(change:Partial<typeof parts>)=>setDraft(current=>{const next={...dateParts(current),...change};return clampDate(next.year,next.month,next.day,minimum,maximum)});
  const monthStart=parts.year===min.year?min.month:1;
  const dayStart=parts.year===min.year&&parts.month===min.month?min.day:1;
  const monthLimit=parts.year===max.year?max.month:12;
  const dayLimit=Math.min(new Date(Date.UTC(parts.year,parts.month,0)).getUTCDate(),parts.year===max.year&&parts.month===max.month?max.day:31);
  const days=Array.from({length:Math.max(0,dayLimit-dayStart+1)},(_,i)=>({value:i+dayStart,label:(i+dayStart).toLocaleString(locale)}));
  const months=Array.from({length:Math.max(0,monthLimit-monthStart+1)},(_,i)=>({value:i+monthStart,label:new Date(2020,i+monthStart-1,1).toLocaleDateString(locale,{month:"long"})}));
  const years=Array.from({length:Math.max(0,max.year-min.year+1)},(_,i)=>({value:min.year+i,label:(min.year+i).toLocaleString(locale,{useGrouping:false})}));
  return <><Pressable accessibilityRole="button" accessibilityLabel={label??t("sharedDate.open")} disabled={disabled} accessibilityState={{expanded:open,disabled}} onPress={()=>{const next=dateParts(isDateValue(value)?value:reportToday());setDraft(clampDate(next.year,next.month,next.day,minimum,maximum));setOpen(true)}} style={[s.field,disabled&&{opacity:.5}]}><Ionicons name="calendar-outline" size={20} color={colors.primaryDark}/><Text style={s.fieldText}>{isDateValue(value)?new Date(`${value}T12:00:00`).toLocaleDateString(locale,{day:"numeric",month:"long",year:"numeric"}):label??t("sharedDate.open")}</Text><Ionicons name="chevron-down" size={16} color={colors.primaryDark}/></Pressable>
    <PopupSheet visible={open} onClose={()=>setOpen(false)} title={label??t("sharedDate.title")} fitContent>
      <View style={s.content}><View style={s.wheels}>
        <DateWheel label={t("sharedDate.day")} value={parts.day} options={days} onChange={day=>update({day})}/>
        <DateWheel label={t("sharedDate.month")} value={parts.month} options={months} onChange={month=>update({month})}/>
        <DateWheel label={t("sharedDate.year")} value={parts.year} options={years} onChange={year=>update({year})}/>
      </View><View style={s.actions}><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={s.cancel}><Text style={s.cancelText}>{t("sharedDate.cancel")}</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>{const chosen=dateParts(draft);onChange(clampDate(chosen.year,chosen.month,chosen.day,minimum,maximum));setOpen(false)}} style={s.confirm}><Text style={s.confirmText}>{t("sharedDate.confirm")}</Text></Pressable></View>{clearable&&!!value&&<Pressable accessibilityRole="button" onPress={()=>{onChange("");setOpen(false)}} style={s.cancel}><Text style={s.cancelText}>{t("sharedDate.clear")}</Text></Pressable>}</View>
    </PopupSheet></>;
}
const s=StyleSheet.create({field:{minHeight:44,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:colors.border,borderRadius:9,paddingHorizontal:12,backgroundColor:colors.white},fieldText:{flex:1,fontSize:14,fontWeight:"600",color:colors.heading},content:{padding:14,gap:14},wheels:{flexDirection:"row",gap:6},wheelColumn:{flex:1,minWidth:0,gap:8},wheelLabel:{textAlign:"center",fontSize:12,color:colors.secondary,fontWeight:"600"},wheel:{height:rowHeight*5,overflow:"hidden"},wheelContent:{paddingVertical:rowHeight*2},wheelRow:{height:rowHeight,alignItems:"center",justifyContent:"center"},wheelText:{fontSize:16},selectedText:{color:colors.primaryDark,fontWeight:"800"},fadedText:{color:colors.muted},selectedBand:{position:"absolute",top:rowHeight*2,left:0,right:0,height:rowHeight,backgroundColor:colors.primaryLight,borderRadius:8,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border},actions:{flexDirection:"row",gap:10},cancel:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:9,borderWidth:1,borderColor:colors.border},cancelText:{color:colors.secondary,fontWeight:"600"},confirm:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",backgroundColor:colors.primary,borderRadius:9},confirmText:{color:colors.white,fontWeight:"700"}});
