import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import SharedDatePicker from "./SharedDatePicker";
import {localDateValue} from "./sharedDate";
import { colors } from "../theme";

type Parts = { day: string; month: string; year: string; hour: string; minute: string; period: "AM" | "PM" };
type Props = { value: string; onChange: (value: string) => void; includeTime?: boolean; minimumDate?: Date; maximumDate?: Date; earliestYear?: number };
type Choice = { label: string; value: string };

const range = (start: number, end: number, pad = false): Choice[] => Array.from({ length: end - start + 1 }, (_, index) => { const value = String(start + index); return { value, label: pad ? value.padStart(2, "0") : value }; });
const emptyParts = (): Parts => ({ day: "", month: "", year: "", hour: "", minute: "", period: "AM" });

function readValue(value: string): Parts {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return emptyParts();
  const hour24 = Number(match[4] ?? 0);
  return { day: String(Number(match[3])), month: String(Number(match[2])), year: match[1], hour: String(hour24 % 12 || 12), minute: match[5] ?? "00", period: hour24 >= 12 ? "PM" : "AM" };
}

function buildValue(parts: Parts, includeTime: boolean) {
  const day = Number(parts.day); const month = Number(parts.month); const year = Number(parts.year);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const dateValue = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!includeTime) return dateValue;
  const hour = Number(parts.hour); const minute = Number(parts.minute);
  if (!hour || Number.isNaN(minute)) return null;
  const hour24 = hour % 12 + (parts.period === "PM" ? 12 : 0);
  return `${dateValue}T${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function DateTimeField({ value, onChange, includeTime = true, minimumDate, maximumDate, earliestYear }: Props) {
  const [parts, setParts] = useState(() => readValue(value));
  useEffect(() => { setParts(readValue(value)); }, [value]);
  const update = (change: Partial<Parts>) => { const next = { ...parts, ...change }; setParts(next); const output = buildValue(next, includeTime); if (output) onChange(output); };
  const selectedDate = includeTime ? new Date(value) : new Date(`${value.slice(0, 10)}T00:01:00`);
  const beforeMinimum = !!minimumDate && !!value && (includeTime
    ? selectedDate.getTime() <= minimumDate.getTime()
    : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime()
      < new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()).getTime());
  const afterMaximum = !!maximumDate && !!value && (includeTime ? selectedDate.getTime() > maximumDate.getTime() : value.slice(0,10) > localDateValue(maximumDate));
  const invalid = beforeMinimum || afterMaximum;

  return <View><View style={[styles.row, !includeTime && styles.dateOnlyRow, invalid && styles.rowInvalid]}>
    <View style={{flex:1,minWidth:0}}><SharedDatePicker value={value.slice(0,10)} onChange={date=>{const next={...parts,...readValue(date),hour:parts.hour||"12",minute:parts.minute||"00",period:parts.period};setParts(next);const output=buildValue(next,includeTime);if(output)onChange(output)}} earliestYear={earliestYear??1900} minimumDate={minimumDate?localDateValue(minimumDate):undefined} maximumDate={maximumDate?localDateValue(maximumDate):undefined}/></View>
    </View>{includeTime && <View style={[styles.row,{marginTop:8}]}><SelectPart label="Hour" value={parts.hour} choices={range(1, 12, true)} onChange={hour => update({ hour })} /><Text style={styles.colon}>:</Text><SelectPart label="Min" value={parts.minute} choices={range(0, 59, true)} onChange={minute => update({ minute })} /><SelectPart label="AM/PM" value={parts.period} choices={[{ label: "AM", value: "AM" }, { label: "PM", value: "PM" }]} onChange={period => update({ period: period as "AM" | "PM" })} /></View>}
  {invalid && <Text style={styles.error}>{afterMaximum ? "Choose today or an earlier date." : includeTime ? "Choose a future date and time." : "Choose today or a future date."}</Text>}</View>;
}

function SelectPart({ label, value, choices, wide, natural, onChange }: { label: string; value: string; choices: Choice[]; wide?: boolean; natural?: boolean; onChange: (value: string) => void }) {
  const { t } = useLanguage();
  return <View style={[styles.select, wide && styles.selectWide, natural && styles.naturalSelect, natural && wide && styles.naturalSelectWide]}>
    <Picker accessibilityLabel={t(label)} selectedValue={value} onValueChange={selected => onChange(String(selected))} mode="dropdown" style={{width:"100%",height:38,color:colors.heading,fontSize:14,backgroundColor:colors.white,borderWidth:0} as any}>
      {!value&&<Picker.Item label={t(label)} value="" enabled={false}/>}
      {choices.map(choice=><Picker.Item key={choice.value} label={choice.label} value={choice.value}/>)}
    </Picker>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 }, dateOnlyRow: { justifyContent: "flex-start", gap: 8 }, rowInvalid: { borderRadius: 10, backgroundColor: colors.dangerBackground, padding: 3 },
  select: { flex: 1, minWidth: 0, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 0, overflow: "hidden" }, selectWide: { flex: 1.3 }, naturalSelect: { flexGrow: 0, flexShrink: 0, flexBasis: 76, width: 76, minWidth: 76, paddingHorizontal: 0 }, naturalSelectWide: { flexGrow: 0, flexShrink: 0, flexBasis: 94, width: 94, minWidth: 94 }, selectText: { color: colors.heading, fontSize: 14 }, placeholder: { color: colors.muted, fontSize: 12 }, divider: { width: 1, height: 27, backgroundColor: colors.divider, marginHorizontal: 1 }, colon: { color: colors.secondary, fontSize: 15, marginHorizontal: -2 }, error: { color: colors.danger, fontSize: 11, marginTop: 5 },
  overlay: { flex: 1, justifyContent: "flex-start", backgroundColor: "rgba(17,24,39,0.45)" }, menu: { width: 200, maxWidth: "100%", alignSelf: "center", maxHeight: "62%", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }, menuHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider }, menuTitle: { color: colors.heading, fontSize: 16 }, choice: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 6 }, choiceActive: { backgroundColor: colors.primaryLight }, choiceText: { color: colors.secondary, fontSize: 14 }, choiceTextActive: { color: colors.primary },
});
