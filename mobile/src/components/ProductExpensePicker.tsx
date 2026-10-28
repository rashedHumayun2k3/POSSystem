import { useState } from "react";
import { Pressable, Text as NativeText } from "react-native";
import PopupSheet from "./PopupSheet";
import NewExpenseScreen from "../screens/NewExpenseScreen";
import { useLanguage } from "../i18n/LanguageContext";
import { colors } from "../theme";
export type LinkedExpense = { createdBy: string; updatedAt: string; isAccountingPeriodClosed: boolean; id: string; title: string | null; subType: string; amount: number; expenseDate: string; status: string; note: string | null };
export default function ProductExpensePicker({ productId, saved }: { productId: string; saved: () => void }) {
 const { lang } = useLanguage(); const bn = lang === "bn";
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 return <><Pressable accessibilityRole="button" onPress={()=>setOpen(true)} style={{padding:12,backgroundColor:colors.primaryLight,borderRadius:8,alignSelf:"flex-end"}}><NativeText style={{color:colors.primaryDark,fontWeight:"700"}}>{bn?"+ খরচ যুক্ত করুন":"+ Add Cost"}</NativeText></Pressable>
 <PopupSheet visible={open} title={bn?"পণ্যের জন্য খরচ যোগ করুন":"Add product expense"} onClose={()=>{if(!busy)setOpen(false)}}>
 {open&&<NewExpenseScreen productId={productId} onClose={()=>setOpen(false)} onSavingChange={setBusy} onSaved={()=>{setOpen(false);saved()}}/>}
 </PopupSheet></>;
}
