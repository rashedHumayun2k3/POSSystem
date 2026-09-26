import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

type Step = "shop" | "business" | "catalog";
type ShopType = "BIG_SUPERSHOP" | "SMALL_SHOWROOM" | "HAWKER_SHOP";
type BusinessType = "CLOTHING_FASHION" | "COSMETICS_BEAUTY" | "ELECTRONICS_GADGETS" | "SHOES_FOOTWEAR" | "BAGS_ACCESSORIES" | "TOYS_BABY" | "HOME_KITCHEN" | "BOOKS_STATIONERY" | "OTHER";
type CreatedCategory = { id?: string; name: string };

const shops: { value: ShopType; title: string; description: string; icon: keyof typeof Ionicons.glyphMap; channels: string[] }[] = [
  { value: "BIG_SUPERSHOP", title: "Large shop / supershop", description: "Counter sales, inventory and online orders", icon: "business-outline", channels: ["POS", "ONLINE"] },
  { value: "SMALL_SHOWROOM", title: "Small shop / showroom", description: "Simple shop sales with online orders", icon: "storefront-outline", channels: ["HAWKER", "ONLINE"] },
  { value: "HAWKER_SHOP", title: "Mobile or hawker shop", description: "Fast selling from anywhere", icon: "basket-outline", channels: ["HAWKER", "ONLINE"] },
];

const businesses: { value: BusinessType; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "CLOTHING_FASHION", title: "Clothing & fashion", icon: "shirt-outline" },
  { value: "COSMETICS_BEAUTY", title: "Cosmetics & beauty", icon: "sparkles-outline" },
  { value: "ELECTRONICS_GADGETS", title: "Electronics & gadgets", icon: "phone-portrait-outline" },
  { value: "SHOES_FOOTWEAR", title: "Shoes & footwear", icon: "footsteps-outline" },
  { value: "BAGS_ACCESSORIES", title: "Bags & accessories", icon: "bag-handle-outline" },
  { value: "TOYS_BABY", title: "Toys & baby", icon: "happy-outline" },
  { value: "HOME_KITCHEN", title: "Home & kitchen", icon: "home-outline" },
  { value: "BOOKS_STATIONERY", title: "Books & stationery", icon: "book-outline" },
  { value: "OTHER", title: "Other business", icon: "grid-outline" },
];

export default function OnboardingScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("shop");
  const [shop, setShop] = useState<ShopType | null>(null);
  const [selected, setSelected] = useState<BusinessType[]>([]);
  const [categories, setCategories] = useState<CreatedCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const saveShop = async () => {
    if (!shop) return;
    const choice = shops.find(item => item.value === shop)!;
    setBusy(true); setError("");
    try {
      await auth.api("/onboarding/sales-channels", { method: "POST", body: JSON.stringify({ salesChannels: choice.channels, shopType: shop }) });
      await auth.updateCurrentBusinessSalesChannels(choice.channels, shop);
      setStep("business");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const saveBusiness = async () => {
    if (!selected.length) return;
    setBusy(true); setError("");
    try {
      const result = await auth.api<{ categories?: CreatedCategory[] }>("/onboarding/business-type", { method: "POST", body: JSON.stringify({ businessTypes: selected }) });
      setCategories(result.categories ?? []);
      setStep("catalog");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const finish = async (openCatalog: boolean) => {
    setBusy(true);
    await auth.completeCurrentBusinessOnboarding(selected);
    if (openCatalog) router.replace("/more/catalog-templates");
    else router.replace("/");
  };

  const toggle = (value: BusinessType) => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const index = step === "shop" ? 0 : step === "business" ? 1 : 2;

  return <View style={s.screen}>
    <View style={s.top}><View style={s.logo}><Ionicons name="storefront" size={25} color={colors.white} /></View><View style={s.topCopy}><Text style={s.eyebrow}>SHOP SETUP</Text><Text style={s.heading}>Let’s prepare your business</Text><Text style={s.subtitle}>A few quick choices will personalize your workspace.</Text></View></View>
    <View style={s.progress}>{[0,1,2].map(item => <View key={item} style={[s.progressBar, item <= index && s.progressOn]} />)}</View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {step === "shop" && <><SectionTitle step="Step 1 of 3" title="How do you sell?" subtitle="Choose the setup that best matches your shop."/><View style={s.list}>{shops.map(item => <Choice key={item.value} active={shop === item.value} icon={item.icon} title={item.title} description={item.description} onPress={() => { setShop(item.value); setError(""); }} />)}</View><Primary disabled={!shop || busy} busy={busy} label="Continue" onPress={saveShop}/></>}
      {step === "business" && <><SectionTitle step="Step 2 of 3" title="What do you sell?" subtitle="Select every category that applies. We’ll prepare a useful starter catalog."/><View style={s.grid}>{businesses.map(item => { const active=selected.includes(item.value); return <Pressable key={item.value} onPress={() => toggle(item.value)} disabled={busy} style={({pressed})=>[s.tile,active&&s.tileOn,pressed&&s.pressed]}><View style={[s.tileIcon,active&&s.tileIconOn]}><Ionicons name={item.icon} size={22} color={active?colors.primaryDark:colors.secondary}/></View>{active&&<View style={s.check}><Ionicons name="checkmark" size={13} color={colors.white}/></View>}<Text style={[s.tileText,active&&s.tileTextOn]}>{item.title}</Text></Pressable>})}</View><Primary disabled={!selected.length || busy} busy={busy} label="Create my catalog" onPress={saveBusiness}/></>}
      {step === "catalog" && <><SectionTitle step="Step 3 of 3" title="Your starter catalog is ready" subtitle="We created categories based on your business. You can add suggested products now or start using the dashboard."/><View style={s.ready}><View style={s.readyIcon}><Ionicons name="checkmark-circle" size={30} color={colors.success} /></View><Text style={s.readyTitle}>{categories.length ? `${categories.length} categories prepared` : "Business setup completed"}</Text>{categories.length>0&&<View style={s.chips}>{categories.slice(0,8).map((item,index)=><View key={item.id??`${item.name}-${index}`} style={s.chip}><Text style={s.chipText}>{item.name}</Text></View>)}</View>}</View><Primary disabled={busy} busy={busy} label="Add products now" icon="cube-outline" onPress={() => finish(true)}/><Pressable disabled={busy} onPress={() => finish(false)} style={s.secondary}><Text style={s.secondaryText}>Go to dashboard</Text></Pressable></>}
      {!!error&&<View style={s.error}><Ionicons name="alert-circle-outline" size={18} color={colors.danger}/><Text style={s.errorText}>{error}</Text></View>}
    </ScrollView>
  </View>;
}

function SectionTitle({step,title,subtitle}:{step:string;title:string;subtitle:string}){return <View style={s.section}><Text style={s.step}>{step}</Text><Text style={s.title}>{title}</Text><Text style={s.description}>{subtitle}</Text></View>}
function Choice({active,icon,title,description,onPress}:{active:boolean;icon:keyof typeof Ionicons.glyphMap;title:string;description:string;onPress:()=>void}){return <Pressable onPress={onPress} style={({pressed})=>[s.choice,active&&s.choiceOn,pressed&&s.pressed]}><View style={[s.choiceIcon,active&&s.choiceIconOn]}><Ionicons name={icon} size={23} color={active?colors.primaryDark:colors.secondary}/></View><View style={s.flex}><Text style={[s.choiceTitle,active&&s.choiceTitleOn]}>{title}</Text><Text style={s.choiceDescription}>{description}</Text></View><View style={[s.radio,active&&s.radioOn]}>{active&&<View style={s.radioDot}/>}</View></Pressable>}
function Primary({disabled,busy,label,icon,onPress}:{disabled:boolean;busy:boolean;label:string;icon?:keyof typeof Ionicons.glyphMap;onPress:()=>void|Promise<void>}){return <Pressable disabled={disabled} onPress={()=>void onPress()} style={({pressed})=>[s.primary,disabled&&s.disabled,pressed&&!disabled&&s.primaryPressed]}>{busy?<ActivityIndicator color={colors.white}/>:<>{icon&&<Ionicons name={icon} size={19} color={colors.white}/>}<Text style={s.primaryText}>{label}</Text><Ionicons name="arrow-forward" size={18} color={colors.white}/></>}</Pressable>}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.white},top:{paddingHorizontal:20,paddingTop:20,paddingBottom:16,flexDirection:"row",gap:13,alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.divider},logo:{width:48,height:48,borderRadius:15,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},topCopy:{flex:1},eyebrow:{fontSize:10,letterSpacing:1.4,color:colors.primaryDark},heading:{fontSize:20,color:colors.heading,marginTop:2},subtitle:{fontSize:12,color:colors.secondary,marginTop:3,lineHeight:17},progress:{flexDirection:"row",gap:6,paddingHorizontal:20,paddingTop:14},progressBar:{height:4,flex:1,borderRadius:4,backgroundColor:colors.disabled},progressOn:{backgroundColor:colors.primary},content:{padding:20,paddingBottom:44,maxWidth:680,width:"100%",alignSelf:"center"},section:{marginBottom:18},step:{fontSize:11,color:colors.primaryDark,letterSpacing:.6},title:{fontSize:24,color:colors.heading,marginTop:5},description:{fontSize:14,color:colors.secondary,lineHeight:21,marginTop:6},list:{gap:11},choice:{minHeight:84,borderWidth:1,borderColor:colors.divider,borderRadius:18,padding:14,flexDirection:"row",alignItems:"center",gap:13,backgroundColor:colors.card},choiceOn:{borderColor:colors.activeBorder,backgroundColor:colors.cardSecondary},choiceIcon:{width:46,height:46,borderRadius:14,backgroundColor:colors.disabled,alignItems:"center",justifyContent:"center"},choiceIconOn:{backgroundColor:colors.primaryLight},flex:{flex:1},choiceTitle:{fontSize:15,color:colors.heading},choiceTitleOn:{color:colors.primaryDark},choiceDescription:{fontSize:12,color:colors.secondary,marginTop:4,lineHeight:17},radio:{width:21,height:21,borderRadius:11,borderWidth:1.5,borderColor:colors.muted,alignItems:"center",justifyContent:"center"},radioOn:{borderColor:colors.primary},radioDot:{width:11,height:11,borderRadius:6,backgroundColor:colors.primary},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},tile:{width:"48%",minHeight:116,borderWidth:1,borderColor:colors.divider,borderRadius:17,padding:14,backgroundColor:colors.card,position:"relative"},tileOn:{borderColor:colors.activeBorder,backgroundColor:colors.cardSecondary},tileIcon:{width:40,height:40,borderRadius:12,backgroundColor:colors.disabled,alignItems:"center",justifyContent:"center",marginBottom:11},tileIconOn:{backgroundColor:colors.primaryLight},tileText:{fontSize:13,color:colors.heading,lineHeight:18},tileTextOn:{color:colors.primaryDark},check:{position:"absolute",right:10,top:10,width:20,height:20,borderRadius:10,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},primary:{height:54,borderRadius:16,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:9,marginTop:22},primaryPressed:{backgroundColor:colors.primaryDark},primaryText:{fontSize:15,color:colors.white},disabled:{opacity:.45},pressed:{opacity:.82},error:{marginTop:14,padding:12,borderRadius:12,backgroundColor:colors.dangerBackground,flexDirection:"row",gap:8,alignItems:"center"},errorText:{fontSize:13,color:colors.dangerText,flex:1},ready:{borderWidth:1,borderColor:colors.border,borderRadius:20,padding:18,backgroundColor:colors.cardSecondary,alignItems:"center"},readyIcon:{width:55,height:55,borderRadius:18,backgroundColor:colors.successBackground,alignItems:"center",justifyContent:"center"},readyTitle:{fontSize:17,color:colors.heading,marginTop:12},chips:{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:7,marginTop:14},chip:{paddingHorizontal:10,paddingVertical:6,borderRadius:12,backgroundColor:colors.white,borderWidth:1,borderColor:colors.border},chipText:{fontSize:12,color:colors.secondary},secondary:{height:50,alignItems:"center",justifyContent:"center",marginTop:7},secondaryText:{fontSize:14,color:colors.secondary},
});
