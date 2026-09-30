import {useState} from "react";
import {ActivityIndicator,Platform,Pressable,ScrollView,StyleSheet,View,useWindowDimensions} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {Text} from "../i18n/LocalizedText";
import {useLanguage} from "../i18n/LanguageContext";
import {MEDIA_URL,useAuth} from "../auth/AuthContext";
import {colors} from "../theme";
import UserAvatar from "../components/UserAvatar";
import BottomSheet from "../components/BottomSheet";
export default function ProfileScreen(){
 const auth=useAuth(),{t,lang}=useLanguage(),mobile=useWindowDimensions().width<768;
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[logoutOpen,setLogoutOpen]=useState(false);
 const user=auth.session?.user;if(!user)return null;
 const canReport=["OWNER","MANAGER","STAFF"].includes(user.role??""),staff=user.role==="STAFF";
 const logout=async()=>{await auth.logout();router.replace("/")};
 const run=async(key:string,fn:()=>Promise<void>)=>{if(busy)return;setBusy(key);setError("");setNotice("");try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(null)}};
 const upload=()=>run("photo",async()=>{
   const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.8});if(picked.canceled)return;
   const asset=picked.assets[0],form=new FormData();
   if(Platform.OS==="web"&&asset.file)form.append("file",asset.file,asset.fileName||"profile.jpg");else form.append("file",{uri:asset.uri,name:asset.fileName||"profile.jpg",type:asset.mimeType||"image/jpeg"} as never);
   const response=await fetch(`${MEDIA_URL}/api/v1/media/upload`,{method:"POST",headers:{Authorization:`Bearer ${auth.session?.accessToken}`,...(auth.session?.businessId?{"X-Business-Id":auth.session.businessId}:{})},body:form});
   const body=await response.json();if(!response.ok||!body.url)throw new Error(body.message||t("profile.uploadFailed"));
   await auth.api("/users/me/photo",{method:"PATCH",body:JSON.stringify({photoUrl:body.url})});await auth.updateUserPhoto(body.url);
 });
 const sendReport=(thenLogout=false)=>run("report",async()=>{const result=await auth.api<{message:string}>("/reports/daily-closing/send",{method:"POST",headers:{"X-App-Lang":lang},body:JSON.stringify({lang})});setNotice(result.message||t(staff?"profile.dailyReport.sentFallbackStaff":"profile.dailyReport.sentFallbackOwner"));if(thenLogout)await logout()});
 const action=(label:string,press:()=>void,danger=false)=> <Pressable disabled={!!busy} onPress={press} style={[s.action,!!busy&&s.disabled]}><Text style={{color:danger?colors.danger:colors.primaryDark}}>{label}</Text></Pressable>;
 return <ScrollView contentContainerStyle={s.content}>
 <Text style={s.title}>{t("profile.title")}</Text><View style={s.picture}><Pressable disabled={!!busy} onPress={()=>void upload()} accessibilityRole="button" accessibilityLabel={t("profile.changePhoto")}><UserAvatar name={user.name} photoUrl={user.photoUrl} size={96}/><View style={s.camera}><Ionicons name="camera-outline" size={18} color={colors.white}/></View></Pressable>{busy==="photo"?<ActivityIndicator color={colors.primary}/>:action(t("profile.changePhoto"),()=>void upload())}</View>
 <View style={s.card}>{[[t("profile.name"),user.name],[t("profile.phone"),user.phone||"—"],[t("profile.role"),t(({OWNER:"settings.roleOwner",MANAGER:"settings.roleManager",STAFF:"settings.roleStaff",WAREHOUSE:"settings.roleWarehouse"} as Record<string,string>)[user.role??""]??user.role??"—")]].map(([label,value])=><View key={label} style={s.field}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>)}</View>
 {canReport&&<Pressable disabled={!!busy} onPress={()=>void sendReport()} style={[s.action,!!busy&&s.disabled]}><View style={s.row}>{busy==="report"?<ActivityIndicator color={colors.info}/>:<Ionicons name="mail-outline" size={24} color={colors.info}/>}<View style={s.copy}><Text style={s.value}>{t(busy==="report"?"profile.dailyReport.sendingTitle":"profile.dailyReport.button")}</Text><Text style={s.label}>{t(staff?"profile.dailyReport.staffSubtitle":"profile.dailyReport.ownerSubtitle")}</Text></View></View></Pressable>}
 {!!notice&&<Text accessibilityLiveRegion="polite" style={s.success}>{notice}</Text>}{!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
 {action(t("more.logout"),()=>{if(canReport)setLogoutOpen(true);else void run("logout",logout)},true)}
 <BottomSheet visible={logoutOpen} close={()=>{if(!busy)setLogoutOpen(false)}} title={t(staff?"profile.dailyReport.logoutStaffTitle":"profile.dailyReport.logoutOwnerTitle")} mobile={mobile}>
 <Text>{t(staff?"profile.dailyReport.logoutStaffBody":"profile.dailyReport.logoutOwnerBody")}</Text>{busy&&<ActivityIndicator color={colors.primary}/>}{action(t(staff?"profile.dailyReport.sendToOwner":"profile.dailyReport.sendToSelf"),()=>void sendReport(true))}{action(t("profile.dailyReport.logoutWithoutReport"),()=>void run("logout",logout),true)}{action(t("profile.dailyReport.stayInApp"),()=>setLogoutOpen(false))}{!!error&&<Text style={s.error}>{error}</Text>}
 </BottomSheet></ScrollView>;
}
const s=StyleSheet.create({content:{padding:20,gap:20},title:{fontSize:20,color:colors.heading},picture:{alignItems:"center",gap:10},camera:{position:"absolute",right:0,bottom:0,width:28,height:28,borderRadius:14,borderWidth:2,borderColor:colors.white,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},card:{borderRadius:16,overflow:"hidden",backgroundColor:colors.white,borderWidth:1,borderColor:colors.divider},field:{padding:14,gap:5,borderBottomWidth:1,borderBottomColor:colors.divider},label:{fontSize:12,color:colors.secondary},value:{fontSize:14,color:colors.heading},action:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:colors.divider,backgroundColor:colors.white,padding:14,justifyContent:"center"},row:{flexDirection:"row",alignItems:"center",gap:14},copy:{flex:1,gap:5},disabled:{opacity:.6},error:{color:colors.danger},success:{color:colors.successText}});
