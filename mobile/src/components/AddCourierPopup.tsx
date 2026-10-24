import { useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme";
import PopupSheet from "./PopupSheet";
export type Courier = { id: string; name: string; phone?: string; insideDhakaCharge?: number; outsideDhakaCharge?: number; returnCharge?: number; codFeeType?: "PCT" | "FLAT"; codFeeValue?: number; isDefault?: boolean; trackingUrlTemplate?: string; isActive?: boolean };
export default function AddCourierPopup({visible,onClose,onCreated}:{visible:boolean;onClose:()=>void;onCreated:(courier:Courier)=>void}) {
 const auth=useAuth(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [newCourier, setNewCourier] = useState({ name: "", phone: "", inside: "60", outside: "120", returnCharge: "0", codFeeType: "PCT" as "PCT" | "FLAT", codFeeValue: "0", trackingUrlTemplate: "", isDefault: false });
  const createCourier = async () => {
    if (!newCourier.name.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const created = await auth.api<Courier>("/couriers", { method: "POST", body: JSON.stringify({
        name: newCourier.name.trim(), phone: newCourier.phone.trim() || undefined,
        insideDhakaCharge: Number.parseFloat(newCourier.inside) || 0,
        outsideDhakaCharge: Number.parseFloat(newCourier.outside) || 0,
        returnCharge: Number.parseFloat(newCourier.returnCharge) || 0,
        codFeeType: newCourier.codFeeType, codFeeValue: Number.parseFloat(newCourier.codFeeValue) || 0,
        isDefault: newCourier.isDefault, trackingUrlTemplate: newCourier.trackingUrlTemplate.trim() || undefined,
      }) });
      onCreated(created);
      setNewCourier({ name: "", phone: "", inside: "60", outside: "120", returnCharge: "0", codFeeType: "PCT", codFeeValue: "0", trackingUrlTemplate: "", isDefault: false });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add courier service."); }
    finally { setBusy(false); }
  };

return (<PopupSheet visible={visible} onClose={onClose} title="Add Courier Service"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}><TextInput value={newCourier.name} onChangeText={value=>setNewCourier(form=>({...form,name:value}))} placeholder="Courier name *" style={s.input}/><Text style={s.fieldLabel}>Phone (optional)</Text><TextInput value={newCourier.phone} onChangeText={value=>setNewCourier(form=>({...form,phone:value}))} keyboardType="phone-pad" style={s.input}/><View style={s.actionRow}><View style={s.actionHalf}><Text style={s.fieldLabel}>Inside Dhaka (৳)</Text><TextInput value={newCourier.inside} onChangeText={value=>setNewCourier(form=>({...form,inside:value}))} keyboardType="decimal-pad" style={s.input}/></View><View style={s.actionHalf}><Text style={s.fieldLabel}>Outside Dhaka (৳)</Text><TextInput value={newCourier.outside} onChangeText={value=>setNewCourier(form=>({...form,outside:value}))} keyboardType="decimal-pad" style={s.input}/></View></View><Text style={s.fieldLabel}>Return charge (৳)</Text><TextInput value={newCourier.returnCharge} onChangeText={value=>setNewCourier(form=>({...form,returnCharge:value}))} keyboardType="decimal-pad" style={s.input}/><Text style={s.fieldLabel}>COD fee (courier's cut from collected cash)</Text><View style={s.actionRow}><View style={s.actionRow}><Pressable onPress={()=>setNewCourier(form=>({...form,codFeeType:"PCT"}))} style={[s.feeType,newCourier.codFeeType==="PCT"&&s.feeTypeOn]}><Text style={[s.feeTypeText,newCourier.codFeeType==="PCT"&&s.feeTypeTextOn]}>%</Text></Pressable><Pressable onPress={()=>setNewCourier(form=>({...form,codFeeType:"FLAT"}))} style={[s.feeType,newCourier.codFeeType==="FLAT"&&s.feeTypeOn]}><Text style={[s.feeTypeText,newCourier.codFeeType==="FLAT"&&s.feeTypeTextOn]}>৳</Text></Pressable></View><TextInput value={newCourier.codFeeValue} onChangeText={value=>setNewCourier(form=>({...form,codFeeValue:value}))} keyboardType="decimal-pad" placeholder={newCourier.codFeeType==="PCT"?"e.g. 1 for 1%":"e.g. 10"} style={[s.input,s.actionHalf]}/></View><Text style={s.fieldLabel}>Tracking URL — use {'{id}'} for consignment no.</Text><TextInput value={newCourier.trackingUrlTemplate} onChangeText={value=>setNewCourier(form=>({...form,trackingUrlTemplate:value}))} style={s.input}/><Pressable onPress={()=>setNewCourier(form=>({...form,isDefault:!form.isDefault}))} style={[s.defaultCourier,newCourier.isDefault&&s.defaultCourierOn]}><Ionicons name={newCourier.isDefault?"star":"star-outline"} size={17} color={newCourier.isDefault?colors.primaryDark:colors.secondary}/><Text style={[s.selectText,newCourier.isDefault&&s.selectedCourier]}>Set as default courier</Text></Pressable>{!!error&&<Text style={s.inlineError}>{error}</Text>}<Pressable disabled={busy||!newCourier.name.trim()} onPress={()=>void createCourier()} style={[s.primary,s.fullWidth,(busy||!newCourier.name.trim())&&s.disabled]}><Text style={s.primaryText}>{busy?"Saving…":"Save Courier"}</Text></Pressable></ScrollView></PopupSheet>);
}
const s=StyleSheet.create({
 sheetContent:{padding:16,gap:10},input:{borderWidth:1,borderColor:colors.divider,borderRadius:8,padding:11,color:colors.heading},fieldLabel:{fontSize:12,color:colors.secondary},actionRow:{flexDirection:"row",gap:10,alignItems:"center"},actionHalf:{flex:1},feeType:{padding:10,borderRadius:8,backgroundColor:colors.disabled},feeTypeOn:{backgroundColor:colors.primaryLight},feeTypeText:{color:colors.secondary},feeTypeTextOn:{color:colors.primaryDark},defaultCourier:{flexDirection:"row",alignItems:"center",gap:8,padding:10},defaultCourierOn:{backgroundColor:colors.primaryLight},selectText:{color:colors.secondary},selectedCourier:{color:colors.primaryDark},inlineError:{color:colors.danger},primary:{backgroundColor:colors.primary,padding:12,borderRadius:8,alignItems:"center"},fullWidth:{width:"100%"},disabled:{opacity:0.5},primaryText:{color:colors.white,fontWeight:"700"}
});
