import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import en from "./en.json";
import bn from "./bn.json";

export type Lang = "en" | "bn";
type Dictionary = Record<string, unknown>;
type LanguageValue = { lang: Lang; ready: boolean; setLang: (lang: Lang) => void; toggleLang: () => void; t: (keyOrEnglish: string, params?: Record<string, string | number>) => string };
const LanguageContext=createContext<LanguageValue>({lang:"en",ready:false,setLang:()=>{},toggleLang:()=>{},t:value=>value});
const storageKey="lavlokshan.language";

function valueAt(source:Dictionary,key:string){return key.split(".").reduce<unknown>((value,part)=>value&&typeof value==="object"?(value as Dictionary)[part]:undefined,source)}
function buildEnglishIndex(english:Dictionary,bangla:Dictionary,result=new Map<string,string>()){
  Object.entries(english).forEach(([key,value])=>{const translated=bangla[key];if(typeof value==="string"&&typeof translated==="string")result.set(value,translated);else if(value&&translated&&typeof value==="object"&&typeof translated==="object")buildEnglishIndex(value as Dictionary,translated as Dictionary,result)});return result;
}
const englishToBangla=buildEnglishIndex(en as Dictionary,bn as Dictionary);

export function LanguageProvider({children}:{children:ReactNode}){
  const [lang,setLangState]=useState<Lang>("en");const [ready,setReady]=useState(false);
  useEffect(()=>{void (async()=>{try{const saved=Platform.OS==="web"&&typeof localStorage!=="undefined"?localStorage.getItem(storageKey):await SecureStore.getItemAsync(storageKey);if(saved==="en"||saved==="bn")setLangState(saved)}finally{setReady(true)}})()},[]);
  const setLang=(value:Lang)=>{setLangState(value);if(Platform.OS==="web"&&typeof localStorage!=="undefined")localStorage.setItem(storageKey,value);else void SecureStore.setItemAsync(storageKey,value)};
  const context=useMemo<LanguageValue>(()=>({lang,ready,setLang,toggleLang:()=>setLang(lang==="en"?"bn":"en"),t:(keyOrEnglish,params)=>{let value=valueAt((lang==="bn"?bn:en) as Dictionary,keyOrEnglish);if(typeof value!=="string")value=lang==="bn"?englishToBangla.get(keyOrEnglish):keyOrEnglish;if(typeof value!=="string")value=keyOrEnglish;return params?Object.entries(params).reduce((text,[key,item])=>text.replaceAll(`{${key}}`,String(item)),value as string):value as string}}),[lang,ready]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}
export const useLanguage=()=>useContext(LanguageContext);
