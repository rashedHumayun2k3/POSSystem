import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../i18n/LocalizedText";
import { useAuth } from "../auth/AuthContext";
import { useModalChrome } from "./ModalChromeContext";
import { colors } from "../theme";

export type OrderCustomer = { id: string; name: string; phone: string; address?: string | null };

type Props = { visible: boolean; onClose: () => void; onSelect: (customer: OrderCustomer) => void };
const digits = (value: string) => value.replace(/\D/g, "");

export default function OrderCustomerPicker({ visible, onClose, onSelect }: Props) {
  const auth = useAuth();
  const api = useRef(auth.api); api.current = auth.api;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setBottomNavHidden } = useModalChrome();
  const desktop = width >= 768;
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<OrderCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [phoneMatches, setPhoneMatches] = useState<OrderCustomer[]>([]);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const phoneInput = useRef<TextInput>(null);
  const searchInput = useRef<TextInput>(null);

  useEffect(() => {
    setBottomNavHidden(visible && !desktop);
    return () => setBottomNavHidden(false);
  }, [visible, desktop, setBottomNavHidden]);

  useEffect(() => {
    if (!visible || desktop) return;
    const timer = setTimeout(() => (adding ? phoneInput.current : searchInput.current)?.focus(), 220);
    return () => clearTimeout(timer);
  }, [visible, adding, desktop]);

  useEffect(() => {
    if (!visible || adding) return;
    let active = true;
    const query = search.trim();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const rows = await api.current<OrderCustomer[]>(`/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        if (active) setCustomers(Array.isArray(rows) ? rows.slice(0, 20) : []);
      } catch (e) { if (active) { setCustomers([]); setError((e as Error).message || "Could not load customers."); } }
      finally { if (active) setLoading(false); }
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, adding, search, auth.session?.businessId]);

  useEffect(() => {
    if (!visible || !adding || digits(phone).length < 7) { setPhoneMatches([]); setCheckingPhone(false); return; }
    let active = true;
    const query = phone.trim();
    setCheckingPhone(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await api.current<OrderCustomer[]>(`/customers?q=${encodeURIComponent(query)}`);
        const normalized = digits(query);
        if (active) setPhoneMatches((rows || []).filter(customer => digits(customer.phone) === normalized));
      } catch { if (active) setPhoneMatches([]); }
      finally { if (active) setCheckingPhone(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, adding, phone, auth.session?.businessId]);

  const reset = () => { setSearch(""); setAdding(false); setName(""); setPhone(""); setAddress(""); setCustomers([]); setPhoneMatches([]); setError(""); };
  const close = () => { reset(); onClose(); };
  const choose = (customer: OrderCustomer) => { reset(); onSelect(customer); };
  const canUseNew = !!name.trim() && !!phone.trim() && !!address.trim() && !checkingPhone && phoneMatches.length === 0;

  return <Modal visible={visible} transparent animationType={desktop ? "fade" : "slide"} onShow={() => { if (!desktop) setTimeout(() => (adding ? phoneInput.current : searchInput.current)?.focus(), 250); }} onRequestClose={close}>
    <KeyboardAvoidingView style={s.keyboard} behavior="padding" enabled={!desktop && Platform.OS === "ios"}>
      <View style={[s.overlay, !desktop && s.mobileOverlay]}>
        <SafeAreaView style={[s.sheet, desktop ? s.desktopSheet : s.mobileSheet]}>
          {!desktop && <View style={s.handle} />}
          <View style={s.header}>
            <Text style={s.title}>{adding ? "New Customer" : "Select Customer"}</Text>
            {!adding && <Pressable onPress={() => { setAdding(true); setPhone(search.trim()); }} style={s.newButton}><Ionicons name="person-add-outline" size={16} color={colors.primaryDark}/><Text style={s.newButtonText}>New Customer</Text></Pressable>}
            {adding && <Pressable onPress={() => { setAdding(false); setPhoneMatches([]); }}><Text style={s.backText}>Back</Text></Pressable>}
            <Pressable accessibilityLabel="Close customer picker" onPress={close} hitSlop={8}><Ionicons name="close" size={23} color={colors.secondary}/></Pressable>
          </View>
          {!adding ? <>
            <View style={s.searchBox}><Ionicons name="search-outline" size={18} color={colors.muted}/><TextInput ref={searchInput} accessibilityLabel="Search customers" value={search} onChangeText={setSearch} placeholder="Search by phone or name" placeholderTextColor={colors.muted} style={s.search} returnKeyType="search"/>{!!search&&<Pressable onPress={()=>setSearch("")}><Ionicons name="close-circle" size={18} color={colors.muted}/></Pressable>}</View>
            <ScrollView style={s.list} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} contentContainerStyle={s.listContent}>
              {loading ? <ActivityIndicator color={colors.primary} style={s.loader}/> : error ? <Text style={s.error}>{error}</Text> : customers.length ? customers.map(customer=><Pressable key={customer.id} onPress={()=>choose(customer)} style={s.customerRow}><View style={s.avatar}><Ionicons name="person-outline" size={18} color={colors.primaryDark}/></View><View style={s.customerCopy}><Text style={s.customerName}>{customer.name}</Text><Text style={s.meta}>{customer.phone}</Text>{!!customer.address&&<Text numberOfLines={1} style={s.meta}>{customer.address}</Text>}</View><Ionicons name="chevron-forward" size={17} color={colors.muted}/></Pressable>) : <Text style={s.empty}>{search.trim()?"No matching customers found.":"No customers found yet."}</Text>}
            </ScrollView>
          </> : <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <Text style={s.formHint}>Enter the customer details. The customer will be saved when the order or sale is completed.</Text>
            <Field label="PHONE NUMBER"><TextInput ref={phoneInput} accessibilityLabel="Phone number" value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={s.input}/></Field>
            {!!phoneMatches.length && <View style={s.duplicate}><Text style={s.duplicateText}>This mobile number already belongs to {phoneMatches[0].name}. Select that customer to avoid a duplicate.</Text><Pressable onPress={()=>choose(phoneMatches[0])} style={s.useExisting}><Text style={s.useExistingText}>Use existing customer</Text></Pressable></View>}
            {checkingPhone && <Text style={s.meta}>Checking phone number…</Text>}
            <Field label="CUSTOMER NAME"><TextInput accessibilityLabel="Customer name" value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={colors.muted} style={s.input}/></Field>
            <Field label="DELIVERY ADDRESS"><TextInput accessibilityLabel="Customer address" value={address} onChangeText={setAddress} placeholder="Customer address" placeholderTextColor={colors.muted} multiline style={[s.input,s.addressInput]}/></Field>
            {!!error&&<Text style={s.error}>{error}</Text>}
            <Pressable disabled={!canUseNew} onPress={()=>choose({id:"new",name:name.trim(),phone:phone.trim(),address:address.trim()})} style={[s.saveButton,!canUseNew&&s.disabled]}><Text style={s.saveText}>Use new customer</Text></Pressable>
          </ScrollView>}
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <View style={s.field}><Text style={s.label}>{label}</Text>{children}</View>; }

const s = StyleSheet.create({
  keyboard:{flex:1},overlay:{flex:1,alignItems:"center",justifyContent:"center",padding:18,backgroundColor:colors.overlay},mobileOverlay:{alignItems:"stretch",justifyContent:"flex-end",padding:0},sheet:{width:"100%",overflow:"hidden",backgroundColor:colors.white,borderRadius:18},desktopSheet:{maxWidth:540,maxHeight:"88%",padding:16},mobileSheet:{width:"100%",minHeight:"85%",height:"90%",maxHeight:"90%",maxWidth:"100%",borderTopLeftRadius:18,borderTopRightRadius:18,borderBottomLeftRadius:0,borderBottomRightRadius:0,paddingHorizontal:16},handle:{width:40,height:4,alignSelf:"center",marginTop:8,borderRadius:2,backgroundColor:colors.divider},header:{minHeight:54,flexDirection:"row",alignItems:"center",gap:9,borderBottomWidth:1,borderBottomColor:colors.divider},title:{flex:1,color:colors.heading,fontSize:17,fontWeight:"700"},newButton:{minHeight:34,flexDirection:"row",alignItems:"center",gap:5,borderRadius:9,borderWidth:1,borderColor:colors.secondaryBorder,backgroundColor:colors.primaryLight,paddingHorizontal:9},newButtonText:{color:colors.primaryDark,fontSize:11,fontWeight:"700"},backText:{color:colors.primaryDark,fontSize:12,fontWeight:"600"},searchBox:{minHeight:46,flexDirection:"row",alignItems:"center",gap:8,marginTop:12,borderWidth:1,borderColor:colors.border,borderRadius:11,backgroundColor:colors.cardSecondary,paddingHorizontal:11},search:{flex:1,minWidth:0,minHeight:42,color:colors.heading,fontSize:14},list:{flexShrink:1,marginTop:8},listContent:{gap:2,paddingBottom:12},customerRow:{minHeight:62,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:8},avatar:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:colors.primaryLight},customerCopy:{flex:1,minWidth:0,gap:2},customerName:{color:colors.heading,fontSize:13,fontWeight:"700"},meta:{color:colors.secondary,fontSize:11},empty:{color:colors.muted,textAlign:"center",padding:28},loader:{padding:28},error:{color:colors.dangerText,fontSize:12,padding:12},form:{gap:12,paddingVertical:14,paddingBottom:24},formHint:{color:colors.secondary,fontSize:12,lineHeight:18},field:{gap:5},label:{color:colors.muted,fontSize:10,fontWeight:"700",letterSpacing:.5},input:{minHeight:46,borderWidth:1,borderColor:colors.border,borderRadius:10,paddingHorizontal:12,color:colors.heading,fontSize:14,backgroundColor:colors.white},addressInput:{minHeight:76,paddingTop:11,textAlignVertical:"top"},duplicate:{gap:8,borderWidth:1,borderColor:colors.warning,backgroundColor:colors.warningBackground,borderRadius:10,padding:10},duplicateText:{color:colors.warningText,fontSize:12,lineHeight:17},useExisting:{alignSelf:"flex-start",paddingVertical:5},useExistingText:{color:colors.primaryDark,fontSize:12,fontWeight:"700"},saveButton:{minHeight:46,alignItems:"center",justifyContent:"center",borderRadius:11,backgroundColor:colors.primary},saveText:{color:colors.white,fontSize:13,fontWeight:"700"},disabled:{opacity:.45},
});
