import {useRef} from "react";
import {useLanguage} from "../i18n/LanguageContext";
import {colors} from "../theme";
import {isDateValue,type SharedDatePickerProps} from "./sharedDate";
import {reportToday} from "./reportDate";

export default function SharedDatePicker({value,onChange,label,minimumDate,maximumDate,earliestYear=1900,clearable=false,disabled=false}:SharedDatePickerProps){
  const {t,lang}=useLanguage(),input=useRef<HTMLInputElement>(null);
  const min=minimumDate??`${earliestYear}-01-01`,max=maximumDate??`${Number(reportToday().slice(0,4))+10}-12-31`;
  return <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,width:"100%"}}>
    <input ref={input} type="date" lang={lang==="bn"?"bn-BD":"en-GB"} aria-label={label??t("sharedDate.open")} value={isDateValue(value)?value:""} min={min} max={max} disabled={disabled} required={!clearable} onClick={()=>{try{input.current?.showPicker()}catch{/* The browser still supports keyboard/native input. */}}} onChange={event=>{const next=event.target.value;if((!next&&clearable)||(isDateValue(next)&&next>=min&&next<=max))onChange(next)}} style={{boxSizing:"border-box",minHeight:44,width:"100%",minWidth:0,flex:1,border:`1px solid ${colors.border}`,borderRadius:9,padding:"8px 10px",background:colors.white,color:colors.heading,font:"inherit",fontSize:14,opacity:disabled?0.5:1,cursor:disabled?"default":"pointer"}}/>
    {clearable&&!!value&&<button type="button" disabled={disabled} aria-label={t("sharedDate.clear")} onClick={()=>onChange("")} style={{border:0,background:"transparent",color:colors.primaryDark,cursor:"pointer",minWidth:36,minHeight:44}}>×</button>}
  </div>;
}
