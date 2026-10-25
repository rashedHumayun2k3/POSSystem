import { colors } from "../theme";

export default function LocalDateTimeInput({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
 const now=new Date();const localNow=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,19);
 return <input type="datetime-local" aria-label="Received date and time" disabled={disabled} max={localNow} step="1" value={value.replace(" ","T")} onChange={event=>{if(event.target.value&&event.target.validity.valid&&new Date(event.target.value).getTime()<=Date.now())onChange(event.target.value.replace("T"," ").padEnd(19,":00"));}} style={{boxSizing:"border-box",width:"100%",minWidth:0,minHeight:42,border:`1px solid ${colors.divider}`,borderRadius:8,padding:"8px",background:colors.white,color:colors.heading,fontFamily:"inherit",fontSize:13}}/>;
}
