import SharedDatePicker from "./SharedDatePicker";
import {reportToday} from "./reportDate";
export default function BackdatedSaleDateField(props:{value:string;onChange:(date:string)=>void}){
  return <SharedDatePicker {...props} earliestYear={2000} maximumDate={reportToday()}/>;
}
