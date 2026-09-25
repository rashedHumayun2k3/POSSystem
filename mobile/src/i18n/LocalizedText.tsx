import type { ReactNode } from "react";
import { Text as NativeText, type TextProps } from "react-native";
import { useLanguage } from "./LanguageContext";

function translateChildren(value:ReactNode,t:(value:string)=>string):ReactNode{
  if(typeof value==="string"){
    const leading=value.match(/^\s*/)?.[0]??"",trailing=value.match(/\s*$/)?.[0]??"",content=value.trim();
    return content?`${leading}${t(content)}${trailing}`:value;
  }
  if(Array.isArray(value))return value.map((child,index)=><TextFragment key={index} value={child} t={t}/>);
  return value;
}
function TextFragment({value,t}:{value:ReactNode;t:(value:string)=>string}){return <>{translateChildren(value,t)}</>}
export function Text({children,...props}:TextProps){const {t}=useLanguage();return <NativeText {...props}>{translateChildren(children,t)}</NativeText>}
