import SharedDatePicker from "./SharedDatePicker";
import {reportToday} from "./reportDate";
export default function BackdatedSaleDateField(props:{value:string;onChange:(date:string)=>void}){
  return <div style={{width:260,maxWidth:"100%",alignSelf:"flex-start"}}><SharedDatePicker {...props} earliestYear={2000} maximumDate={reportToday()}/></div>;
}
