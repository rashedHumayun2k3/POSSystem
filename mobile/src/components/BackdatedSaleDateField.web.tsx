import {useWindowDimensions} from "react-native";
import SharedDatePicker from "./SharedDatePicker";
import {reportToday} from "./reportDate";
export default function BackdatedSaleDateField(props:{value:string;onChange:(date:string)=>void}){
  const mobile=useWindowDimensions().width<768;
  return <div style={{width:mobile?"100%":260,maxWidth:"100%",alignSelf:"flex-start"}}><SharedDatePicker {...props} earliestYear={2000} maximumDate={reportToday()}/></div>;
}
