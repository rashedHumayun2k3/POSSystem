import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import type { ShippingCompany } from "../types/purchases";
import PopupSheet from "./PopupSheet";

type Method = "AIR" | "SEA";

export default function LotCourierPicker({ visible, selectedId, selectedMethod, onClose, onSave }: {
  visible: boolean; selectedId?: string | null; selectedMethod?: Method | null; onClose: () => void;
  onSave: (company: ShippingCompany, method: Method) => Promise<void>;
}) {
  const auth = useAuth();
  const { lang } = useLanguage();
  const [rows, setRows] = useState<ShippingCompany[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("AIR");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [localAddress, setLocalAddress] = useState(""); const [chinaAddress, setChinaAddress] = useState(""); const [airRate, setAirRate] = useState(""); const [seaRate, setSeaRate] = useState("");

  const load = async () => setRows((await auth.api<ShippingCompany[]>("/shipping-companies")).filter(company => company.isActive));
  useEffect(() => {
    if (!visible) return;
    let live = true; setSelected(selectedId ?? null); setMethod(selectedMethod ?? "AIR"); setError(""); setLoading(true);
    auth.api<ShippingCompany[]>("/shipping-companies").then(data => { if (live) setRows(data.filter(company => company.isActive)); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visible, selectedId, selectedMethod]);

  const availableMethods = (company: ShippingCompany) => company.rates.filter(rate => rate.chargeBasis === "PER_KG").map(rate => rate.shippingMethod);
  const choose = (company: ShippingCompany) => { setSelected(company.id); const methods = availableMethods(company); setMethod(methods.includes("AIR") ? "AIR" : methods[0] ?? "AIR"); };
  const save = async () => { const company = rows.find(row => row.id === selected); if (!company || busy) return; setBusy(true); setError(""); try { await onSave(company, method); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Could not assign shipping company."); } finally { setBusy(false); } };
  const create = async () => {
    if (!name.trim()) return setError("Enter a shipping company name.");
    const air = airRate.trim() ? Number(airRate) : null; const sea = seaRate.trim() ? Number(seaRate) : null;
    if (air === null && sea === null) return setError("Enter at least one Air or Sea rate per Kg.");
    if ((air !== null && (!Number.isFinite(air) || air < 0)) || (sea !== null && (!Number.isFinite(sea) || sea < 0))) return setError("Enter valid non-negative rates.");
    setBusy(true); setError("");
    try {
      const company = await auth.api<ShippingCompany>("/shipping-companies", { method: "POST", body: JSON.stringify({ name: name.trim(), airRatePerKg: air, seaRatePerKg: sea, phone: phone.trim() || null, localAddress: localAddress.trim() || null, chinaAddress: chinaAddress.trim() || null, notes: null }) });
      await load(); setSelected(company.id); setMethod(company.rates[0]?.shippingMethod ?? "AIR"); setAdding(false); setName(""); setPhone(""); setLocalAddress(""); setChinaAddress(""); setAirRate(""); setSeaRate("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add shipping company."); } finally { setBusy(false); }
  };

  return <>
    <PopupSheet visible={visible && !adding} onClose={() => { if (!busy) onClose(); }} title={lang === "bn" ? "ইমপোর্ট / এক্সপোর্ট শিপিং কোম্পানি" : "Import / Export Shipping Company"} headerAction={<Pressable disabled={busy} onPress={() => { setError(""); setAdding(true); }}><Text style={{color:colors.primaryDark,fontWeight:"600"}}>{lang === "bn" ? "+ শিপিং কোম্পানি যোগ করুন" : "+ Add Shipping Company"}</Text></Pressable>}>
      <ScrollView contentContainerStyle={{padding:16,gap:10}}>{loading ? <ActivityIndicator color={colors.primary}/> : rows.map(company => { const methods = availableMethods(company); const selectedCompany = selected === company.id; return <View key={company.id} style={{borderRadius:10,borderWidth:1,borderColor:selectedCompany?colors.primary:colors.divider,backgroundColor:selectedCompany?colors.primaryLight:colors.card,overflow:"hidden"}}><Pressable disabled={busy || !methods.length} onPress={() => choose(company)} style={{flexDirection:"row",alignItems:"center",gap:10,padding:12}}><Ionicons name={selectedCompany?"radio-button-on":"radio-button-off"} size={20} color={selectedCompany?colors.primary:colors.muted}/><View style={{flex:1,gap:2}}><Text style={{color:colors.heading,fontWeight:"600"}}>{company.name}</Text>{!!company.phone&&<Text style={{color:colors.secondary,fontSize:12}}>{company.phone}</Text>}<Text style={{color:colors.muted,fontSize:11}}>{methods.length ? company.rates.filter(rate => methods.includes(rate.shippingMethod)).map(rate => `${rate.shippingMethod}: ৳${rate.rateAmount}/Kg`).join(" · ") : "No Air/Sea rate configured"}</Text></View></Pressable>{selectedCompany && <View accessibilityRole="radiogroup" style={{flexDirection:"row",alignItems:"center",gap:16,paddingHorizontal:12,paddingBottom:12}}>{methods.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{checked:method===option}} onPress={() => setMethod(option)} style={{flexDirection:"row",alignItems:"center",gap:5,paddingVertical:3}}><Ionicons name={method===option?"radio-button-on":"radio-button-off"} size={18} color={method===option?colors.primary:colors.muted}/><Text style={{color:method===option?colors.primaryDark:colors.secondary,fontSize:12,fontWeight:"600"}}>{option === "AIR" ? "Air" : "Sea"}</Text></Pressable>)}</View>}</View>; })}{!loading&&!rows.length&&!error&&<Text>No import/export shipping companies yet. Add one to continue.</Text>}{!!error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}<Pressable disabled={busy||loading||!selected} onPress={() => void save()} style={{padding:12,alignItems:"center",backgroundColor:colors.primary,borderRadius:8,opacity:busy||loading||!selected?0.5:1}}><Text style={{color:colors.white,fontWeight:"700"}}>{busy?"Saving…":"Assign Shipping Company"}</Text></Pressable></ScrollView>
    </PopupSheet>
    <PopupSheet visible={visible && adding} onClose={() => { if (!busy) setAdding(false); }} title="Add Shipping Company">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:12}}>
        <Input label="Company name *" value={name} set={setName}/><Input label="Phone (optional)" value={phone} set={setPhone}/><Input label="Local address (optional)" value={localAddress} set={setLocalAddress}/><Input label="Origin / China address (optional)" value={chinaAddress} set={setChinaAddress}/><Input label="Air rate per Kg (BDT)" value={airRate} set={setAirRate} numeric/><Input label="Sea rate per Kg (BDT)" value={seaRate} set={setSeaRate} numeric/>{!!error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}<Pressable disabled={busy} onPress={() => void create()} style={{padding:12,alignItems:"center",backgroundColor:colors.primary,borderRadius:8,opacity:busy?0.5:1}}><Text style={{color:colors.white,fontWeight:"700"}}>{busy?"Saving…":"Save Shipping Company"}</Text></Pressable>
      </ScrollView>
    </PopupSheet>
  </>;
}

function Input({label,value,set,numeric=false}:{label:string;value:string;set:(value:string)=>void;numeric?:boolean}) {
  return <View style={{gap:5}}><Text style={{color:colors.secondary,fontSize:11,fontWeight:"700"}}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType={numeric?"decimal-pad":"default"} placeholderTextColor={colors.muted} style={{minHeight:46,borderWidth:1,borderColor:colors.border,borderRadius:9,paddingHorizontal:12,color:colors.heading,backgroundColor:colors.white}}/></View>;
}
