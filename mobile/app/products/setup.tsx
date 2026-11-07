import DropdownText, { dropdownLabel } from "../../src/components/DropdownText";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { MEDIA_URL, useAuth } from "../../src/auth/AuthContext";
import { useLanguage } from "../../src/i18n/LanguageContext";
import { Text } from "../../src/i18n/LocalizedText";
import { colors } from "../../src/theme";
import BrandPicker, { type BrandResult } from "../../src/components/BrandPicker";
import type { EditableProduct } from "../../src/components/NewProductForm";

type Product = EditableProduct & { imageUrl: string | null; rowVer: string; status: string; variants: { id: string; isDefault: boolean; stock: number; avgLandedCost: number }[] };
type Branch = { id: string; name: string };
export default function ProductSetup() {
  const { id: param, stage } = useLocalSearchParams<{ id: string; stage?: string }>();
  const id = Array.isArray(param) ? param[0] : param;
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const { lang } = useLanguage(); const bn = lang === "bn";
  const say = (en: string, bangla: string) => bn ? bangla : en;
  const [product,setProduct] = useState<Product | null>(null);
  const [step,setStep] = useState(() => Math.max(0,Math.min(3,Number(stage) || 0))); const [busy,setBusy] = useState(false); const locked = useRef(false);
  const [error,setError] = useState(""); const [loading,setLoading] = useState(true); const [retry,setRetry] = useState(0);
  const [photo,setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null); const uploaded = useRef<string | null>(null);
  const [price,setPrice] = useState(""); const [brand,setBrand] = useState<BrandResult | null>(null); const [brandOpen,setBrandOpen] = useState(false);
  const [duration,setDuration] = useState(""); const [unit,setUnit] = useState("MONTHS");
  const [quantity,setQuantity] = useState(""); const [cost,setCost] = useState("");
  const [branches,setBranches] = useState<Branch[]>([]); const [branchId,setBranchId] = useState(auth.session?.branchId ?? "");
  const [outcomes,setOutcomes] = useState<Record<number,string>>({});
  const finish = () => router.replace({pathname:"/products/[id]",params:{id}});
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    if (!id) { setError("Product not found."); setLoading(false); return; }
    Promise.all([api.current<Product>(`/products/${id}`),api.current<{brandId:string|null;brandName:string|null}>(`/products/${id}/brand`),api.current<Branch[]>("/branches/mine")])
      .then(([p,b,list]) => { if (!active) return; setProduct(p); setPrice(p.sellingPrice > 0 ? String(p.sellingPrice) : ""); setDuration(p.warrantyDurationValue == null ? "" : String(p.warrantyDurationValue)); setUnit(p.warrantyDurationUnit ?? "MONTHS"); setBrand(b.brandId ? {id:b.brandId,name:b.brandName ?? ""} : null); setBranches(list); setBranchId(current => list.some(b => b.id === current) ? current : list.length === 1 ? list[0].id : ""); })
      .catch(e => { if(active) setError(e.message); }).finally(() => {if(active) setLoading(false);});
    return () => {active=false;};
  },[id,retry,auth.session?.businessId]);
  const next = (saved: boolean) => { setOutcomes(current=>({...current,[step]:saved ? "saved" : "skipped"})); setError(""); if(step===3) finish(); else {setStep(step+1);router.setParams({stage:String(step+1)});}  };
  const pickPhoto = async () => { try { const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:true,aspect:[1,1],quality:.9}); if(!result.canceled){setPhoto(result.assets[0]);uploaded.current=null;setError("");} } catch(e){setError((e as Error).message);} };
  const update = async (fields: object) => {
    const latest=await api.current<Product>(`/products/${id}`);
    const updated=await api.current<Product>(`/products/${id}`,{method:"PUT",body:JSON.stringify({...latest,...fields})}); setProduct(updated);
  };
  const save = async () => {
    if(locked.current || !product) return;
    setError(""); locked.current=true;setBusy(true);
    try {
      if(step===0){
        if(!photo && !product.imageUrl) throw new Error(say("Choose a photo or select Do later.","ছবি নির্বাচন করুন অথবা পরে করব বেছে নিন।"));
        if(photo){
          if(!uploaded.current){
            const image=await ImageManipulator.manipulateAsync(photo.uri,[{resize:{width:400}}],{compress:.8,format:ImageManipulator.SaveFormat.JPEG});
            const form=new FormData();
            if(Platform.OS==="web") form.append("file",new File([await (await fetch(image.uri)).blob()],"product.jpg",{type:"image/jpeg"}));
            else form.append("file",{uri:image.uri,name:"product.jpg",type:"image/jpeg"} as never);
            const response=await fetch(`${MEDIA_URL}/api/v1/media/upload`,{method:"POST",headers:{Authorization:`Bearer ${auth.session?.accessToken}`,"X-Business-Id":auth.session?.businessId ?? ""},body:form});
            const body=await response.json();if(!response.ok || !body.url) throw new Error(body.message || "Photo upload failed.");uploaded.current=body.url;
          }
          await update({imageUrl:uploaded.current});
        }
      }
      if(step===1){
        if(!/^\d+(\.\d{1,2})?$/.test(price.trim()) || Number(price)<=0 || Number(price)>999999999999.99) throw new Error(say("Enter a selling price greater than zero, with up to two decimal places.","শূন্যের বেশি বিক্রয়মূল্য দিন, দশমিকের পরে সর্বোচ্চ দুই ঘর।"));
        await update({sellingPrice:Number(price)});
      }
      if(step===2){
        if(duration.trim() && (!/^\d+$/.test(duration.trim()) || Number(duration)<=0 || Number(duration)>2147483647)) throw new Error(say("Enter a whole-number warranty duration greater than zero.","ওয়ারেন্টির মেয়াদ শূন্যের বেশি পূর্ণসংখ্যা দিন।"));
        if(brand) await api.current(`/products/${id}/brand`,{method:"PATCH",body:JSON.stringify({brandId:brand.id})});
        if(duration.trim()) await update({warrantyDurationValue:Number(duration),warrantyDurationUnit:unit});
      }
      if(step===3){
        if(!branchId) throw new Error(say("Select the branch receiving this stock.","স্টক কোন শাখায় যোগ হবে নির্বাচন করুন।"));
        if(!/^\d+(\.\d{1,3})?$/.test(quantity.trim()) || Number(quantity)<=0 || Number(quantity)>99999999999.999) throw new Error(say("Enter a quantity greater than zero (up to three decimal places).","শূন্যের বেশি পরিমাণ দিন (দশমিকের পরে সর্বোচ্চ তিন ঘর)।"));
        if(!/^\d+(\.\d{1,2})?$/.test(cost.trim()) || Number(cost)>999999999999.99) throw new Error(say("Enter purchase cost per unit; enter 0 only if the stock was free.","প্রতি ইউনিট ক্রয়মূল্য দিন; বিনামূল্যে হলে ০ দিন।"));
        const latest=await api.current<Product>(`/products/${id}`);
        const variant=latest.variants.find(v=>v.isDefault) ?? latest.variants[0];
        if(!variant) throw new Error("Product variant not found.");
        const history=await api.current<unknown[]>(`/products/variants/${variant.id}/stock-adjustments`);
        if(variant.stock>0 || variant.avgLandedCost>0 || history.length) throw new Error(say("Stock has already been recorded. Finish setup and manage stock from product details.","স্টক ইতিমধ্যে যোগ হয়েছে। সেটআপ শেষ করে পণ্যের বিস্তারিত থেকে স্টক পরিচালনা করুন।"));
        await api.current(`/products/variants/${variant.id}/existing-stock-cost`,{method:"POST",body:JSON.stringify({qty:Number(quantity),costPerUnit:Number(cost),branchId})});
      }
      next(true);
    } catch(e){setError((e as Error).message);} finally {locked.current=false;setBusy(false);}
  };
  const titles=[say("Product photo","পণ্যের ছবি"),say("Selling price","বিক্রয়মূল্য"),say("Brand & warranty","ব্র্যান্ড ও ওয়ারেন্টি"),say("Opening stock","প্রাথমিক স্টক")];
  const descriptions=[say("Help your team recognise this product at a glance.","ছবি দেখে সহজেই পণ্য চিনতে পারবেন।"),say("Set the selling price per unit. You can change it later.","প্রতি ইউনিট বিক্রয়মূল্য নির্ধারণ করুন। পরে পরিবর্তন করতে পারবেন।"),say("Both fields are optional. Fill in only what applies.","দুটিই ঐচ্ছিক। প্রযোজ্য তথ্যগুলো দিন।"),say("Record quantity and purchase cost together for the selected branch.","নির্বাচিত শাখার জন্য পরিমাণ ও ক্রয়মূল্য একসঙ্গে যোগ করুন।")];
  const input=(label:string,value:string,onChangeText:(v:string)=>void,keyboardType:"decimal-pad"|"number-pad"="decimal-pad")=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder="0" placeholderTextColor={colors.muted} style={s.input}/></View>;
  const preview=photo?.uri ?? (product?.imageUrl ? (/^https?:/i.test(product.imageUrl) ? product.imageUrl : `${MEDIA_URL}${product.imageUrl}`) : null);
  return <SafeAreaView style={s.root}><View style={s.shell}>
    <View style={s.header}><View style={{flex:1}}><Text style={s.eyebrow}>{say("PRODUCT CREATED","পণ্য তৈরি হয়েছে")}</Text><Text numberOfLines={1} style={s.product}>{product?.name ?? say("Product setup","পণ্যের সেটআপ")}</Text></View><Pressable accessibilityRole="button" disabled={busy} onPress={finish} style={s.linkButton}><Text style={s.link}>{say("Finish later","পরে শেষ করব")}</Text></Pressable></View>
    {loading ? <ActivityIndicator style={{margin:40}} color={colors.primary}/> : !product ? <View style={s.body}><Text style={s.error}>{error}</Text><Pressable onPress={()=>setRetry(v=>v+1)} style={s.primary}><Text style={s.primaryText}>{say("Try again","আবার চেষ্টা করুন")}</Text></Pressable></View> : auth.session?.user.role !== "OWNER" ? <View style={s.body}><Text>{say("The owner can complete product setup from product details.","মালিক পণ্যের বিস্তারিত থেকে সেটআপ শেষ করতে পারবেন।")}</Text></View> : <>
    <View style={s.progressArea}><Text style={s.muted}>{say(`Step ${step+1} of 4`,`ধাপ ${step+1} / ৪`)}</Text><View style={s.track}>{titles.map((title,index)=><View key={title} accessibilityLabel={`${title}: ${outcomes[index] ?? (index===step ? "current" : "pending")}`} style={[s.segment,index<=step && s.segmentActive]}/>)}</View></View>
    <KeyboardAwareScrollView enableOnAndroid keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
      <Text accessibilityRole="header" style={s.title}>{titles[step]}</Text><Text style={s.description}>{descriptions[step]}</Text>
      {step===0 && <Pressable accessibilityRole="button" accessibilityLabel={say("Choose product photo","পণ্যের ছবি নির্বাচন করুন")} disabled={busy} onPress={()=>void pickPhoto()} style={s.photo}>{preview ? <Image source={{uri:preview}} resizeMode="contain" style={s.preview}/> : <Ionicons name="camera-outline" size={44} color={colors.primary}/>}<Text style={s.link}>{preview ? say("Change photo","ছবি পরিবর্তন") : say("Choose photo","ছবি নির্বাচন")}</Text><Text style={s.muted}>{say("Optional · You can add more photos later","ঐচ্ছিক · পরে আরও ছবি যোগ করতে পারবেন")}</Text></Pressable>}
      {step===1 && input(say(`Selling price (৳ / ${product.unitCode})`,`বিক্রয়মূল্য (৳ / ${product.unitCode})`),price,setPrice)}
      {step===2 && <><Text style={s.label}>{say("Brand (optional)","ব্র্যান্ড (ঐচ্ছিক)")}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>setBrandOpen(true)} style={s.select}><DropdownText>{dropdownLabel(brand?.name,say("Choose brand","ব্র্যান্ড নির্বাচন করুন"))}</DropdownText><Ionicons name="chevron-down" size={18}/></Pressable><Text style={s.label}>{say("Warranty duration (optional)","ওয়ারেন্টির মেয়াদ (ঐচ্ছিক)")}</Text><View style={s.warrantyRow}><TextInput accessibilityLabel={say("Warranty duration","ওয়ারেন্টির মেয়াদ")} editable={!busy} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="0" style={[s.input,s.warrantyAmount]}/><View style={[s.units,{flexGrow:2,flexBasis:210}]}>{[["DAYS","Days","দিন"],["MONTHS","Months","মাস"],["YEARS","Years","বছর"]].map(([value,en,bangla])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:unit===value}} disabled={busy} onPress={()=>setUnit(value)} style={[s.unit,unit===value && s.selected]}><Text style={unit===value ? s.link : s.muted}>{say(en,bangla)}</Text></Pressable>)}</View></View></>}
      {step===3 && <><Text style={s.label}>{say("Branch","শাখা")}</Text><View style={s.units}>{branches.map(branch=><Pressable key={branch.id} accessibilityRole="radio" accessibilityState={{checked:branchId===branch.id}} disabled={busy} onPress={()=>setBranchId(branch.id)} style={[s.unit,branchId===branch.id && s.selected]}><Text>{branch.name}</Text></Pressable>)}</View>{input(say(`Opening quantity (${product.unitCode})`,`প্রাথমিক পরিমাণ (${product.unitCode})`),quantity,setQuantity)}{input(say(`Purchase cost (৳ / ${product.unitCode})`,`ক্রয়মূল্য (৳ / ${product.unitCode})`),cost,setCost)}{!!quantity && !!cost && Number.isFinite(Number(quantity)*Number(cost)) && <View style={s.summary}><Text>{say("Total opening cost","প্রাথমিক মোট ক্রয়মূল্য")}</Text><Text style={s.label}>৳{(Number(quantity)*Number(cost)).toLocaleString(bn ? "bn-BD" : "en-BD",{maximumFractionDigits:2})}</Text></View>}</>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </KeyboardAwareScrollView>
    <View style={s.footer}><Pressable accessibilityRole="button" disabled={busy} onPress={()=>next(false)} style={[s.secondary,busy && s.disabled]}><Text style={s.label}>{say("Do later","পরে করব")}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void save()} style={[s.primary,busy && s.disabled]}>{busy ? <ActivityIndicator color={colors.white}/> : <Text style={s.primaryText}>{step===3 ? say("Save & Finish","সেভ করে শেষ করুন") : say("Save & Next","সেভ করে পরের ধাপ")}</Text>}</Pressable></View>
    <BrandPicker open={brandOpen} onClose={()=>setBrandOpen(false)} selectedId={brand?.id} onSelect={value=>{setBrand(value);setBrandOpen(false);}}/>
    </>}
  </View></SafeAreaView>;
}
const s=StyleSheet.create({
  warrantyRow:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:8},warrantyAmount:{flexGrow:1,flexBasis:70,minWidth:70},
  root:{flex:1,backgroundColor:colors.background},shell:{flex:1,width:"100%",maxWidth:640,alignSelf:"center",backgroundColor:colors.white},header:{padding:20,flexDirection:"row",alignItems:"center",gap:12,borderBottomWidth:1,borderBottomColor:colors.divider},eyebrow:{fontSize:10,fontWeight:"700",letterSpacing:1,color:colors.successText},product:{fontSize:18,fontWeight:"700",color:colors.heading,marginTop:5},linkButton:{minHeight:44,justifyContent:"center"},link:{color:colors.primaryDark,fontWeight:"700",fontSize:13},progressArea:{paddingHorizontal:20,paddingTop:18,gap:9},track:{flexDirection:"row",gap:6},segment:{flex:1,height:5,borderRadius:4,backgroundColor:colors.divider},segmentActive:{backgroundColor:colors.primary},body:{padding:20,gap:16,paddingBottom:30},title:{fontSize:24,fontWeight:"700",color:colors.heading},description:{fontSize:14,lineHeight:21,color:colors.secondary},muted:{fontSize:12,lineHeight:18,color:colors.secondary},field:{gap:8},label:{fontSize:14,fontWeight:"600",color:colors.heading},input:{minHeight:52,borderWidth:1,borderColor:colors.divider,borderRadius:12,paddingHorizontal:14,fontSize:18,color:colors.heading,backgroundColor:colors.white},photo:{minHeight:200,borderWidth:1,borderStyle:"dashed",borderColor:colors.border,borderRadius:16,alignItems:"center",justifyContent:"center",padding:20,gap:14,backgroundColor:colors.cardSecondary},preview:{width:"100%",height:180},select:{minHeight:50,borderWidth:1,borderColor:colors.divider,borderRadius:12,padding:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},units:{flexDirection:"row",flexWrap:"wrap",gap:8},unit:{flexGrow:1,minHeight:44,borderWidth:1,borderColor:colors.divider,borderRadius:10,padding:10,alignItems:"center",justifyContent:"center"},selected:{borderColor:colors.primary,backgroundColor:colors.primaryLight},summary:{padding:14,borderRadius:12,backgroundColor:colors.cardSecondary,flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8},footer:{padding:16,borderTopWidth:1,borderTopColor:colors.divider,flexDirection:"row",gap:12},primary:{flex:1,minHeight:50,borderRadius:12,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",paddingHorizontal:12},primaryText:{color:colors.white,fontWeight:"700",fontSize:14},secondary:{minHeight:50,paddingHorizontal:16,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.divider,borderRadius:12},error:{color:colors.dangerText,backgroundColor:colors.dangerBackground,padding:12,borderRadius:10,fontSize:13,lineHeight:20},disabled:{opacity:.5},
});
