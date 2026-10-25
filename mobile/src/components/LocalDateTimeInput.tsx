import { View } from "react-native";
import { DateTimeField } from "./DateTimeField";

export default function LocalDateTimeInput({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
 return <View pointerEvents={disabled?"none":"auto"} style={{opacity:disabled?0.5:1}}><DateTimeField value={value.replace(" ","T")} onChange={next=>onChange(next.replace("T"," ")+":00")}/></View>;
}
