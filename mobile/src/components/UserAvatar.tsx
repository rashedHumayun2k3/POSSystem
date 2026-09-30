import {useState,useEffect} from "react";
import {Image,View} from "react-native";
import {Text} from "../i18n/LocalizedText";
import {MEDIA_URL} from "../auth/AuthContext";
import {colors} from "../theme";
export default function UserAvatar({name,photoUrl,size=32}:{name:string;photoUrl?:string|null;size?:number}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[photoUrl]);
 const uri=photoUrl?(/^https?:\/\//i.test(photoUrl)?photoUrl:`${MEDIA_URL}/${photoUrl.replace(/^\//,"")}`):null;
 return uri&&!failed?<Image accessibilityLabel={name} source={{uri}} onError={()=>setFailed(true)} style={{width:size,height:size,borderRadius:size/2}}/>:<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:colors.primaryLight,alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:size*.4,color:colors.primaryDark}}>{name.trim().charAt(0).toUpperCase()||"?"}</Text></View>;
}
