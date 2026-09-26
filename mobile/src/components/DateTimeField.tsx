import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

type Parts = { day: string; month: string; year: string; hour: string; minute: string; period: "AM" | "PM" };
type Props = { value: string; onChange: (value: string) => void; includeTime?: boolean; minimumDate?: Date };
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

export function DateTimeField({ value, onChange, includeTime = true, minimumDate }: Props) {
  const [parts, setParts] = useState(() => readValue(value));
  const currentYear = new Date().getFullYear();
  useEffect(() => { if (value) setParts(readValue(value)); }, [value]);
  const update = (change: Partial<Parts>) => setParts(current => { const next = { ...current, ...change }; const output = buildValue(next, includeTime); if (output) onChange(output); return next; });
  const selectedDate = includeTime ? new Date(value) : new Date(`${value.slice(0, 10)}T00:01:00`);
  const invalid = !!minimumDate && !!value && selectedDate.getTime() <= minimumDate.getTime();

  return <View><View style={[styles.row, !includeTime && styles.dateOnlyRow, invalid && styles.rowInvalid]}>
    <SelectPart label="Day" value={parts.day} choices={range(1, 31, true)} natural={!includeTime} onChange={day => update({ day })} />
    <SelectPart label="Month" value={parts.month} choices={range(1, 12, true)} natural={!includeTime} onChange={month => update({ month })} />
    <SelectPart label="Year" value={parts.year} wide natural={!includeTime} choices={range(currentYear, currentYear + 10)} onChange={year => update({ year })} />
    {includeTime && <><View style={styles.divider} /><SelectPart label="Hour" value={parts.hour} choices={range(1, 12, true)} onChange={hour => update({ hour })} /><Text style={styles.colon}>:</Text><SelectPart label="Min" value={parts.minute} choices={range(0, 59, true)} onChange={minute => update({ minute })} /><SelectPart label="AM/PM" value={parts.period} choices={[{ label: "AM", value: "AM" }, { label: "PM", value: "PM" }]} onChange={period => update({ period: period as "AM" | "PM" })} /></>}
  </View>{invalid && <Text style={styles.error}>Choose a future date and time.</Text>}</View>;
}

function SelectPart({ label, value, choices, wide, natural, onChange }: { label: string; value: string; choices: Choice[]; wide?: boolean; natural?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const display = useMemo(() => choices.find(choice => choice.value === value)?.label ?? label, [choices, value, label]);
  return <><Pressable accessibilityLabel={label} onPress={() => setOpen(true)} style={[styles.select, wide && styles.selectWide, natural && styles.naturalSelect, natural && wide && styles.naturalSelectWide]}><Text numberOfLines={1} style={[styles.selectText, !value && styles.placeholder]}>{display}</Text><Ionicons name="chevron-down" size={14} color={colors.muted} /></Pressable><Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.overlay}><SafeAreaView style={styles.menu}><View style={styles.menuHeader}><Text style={styles.menuTitle}>Select {label}</Text><Pressable onPress={() => setOpen(false)}><Ionicons name="close" size={23} color={colors.heading} /></Pressable></View><ScrollView>{choices.map(choice => <Pressable key={choice.value} onPress={() => { onChange(choice.value); setOpen(false); }} style={[styles.choice, choice.value === value && styles.choiceActive]}><Text style={[styles.choiceText, choice.value === value && styles.choiceTextActive]}>{choice.label}</Text>{choice.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}</Pressable>)}</ScrollView></SafeAreaView></View></Modal></>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 }, dateOnlyRow: { justifyContent: "flex-start", gap: 8 }, rowInvalid: { borderRadius: 10, backgroundColor: colors.dangerBackground, padding: 3 },
  select: { flex: 1, minWidth: 0, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.white, paddingHorizontal: 5 }, selectWide: { flex: 1.3 }, naturalSelect: { flex: 0, width: 76, paddingHorizontal: 8 }, naturalSelectWide: { flex: 0, width: 94 }, selectText: { color: colors.heading, fontSize: 14 }, placeholder: { color: colors.muted, fontSize: 12 }, divider: { width: 1, height: 27, backgroundColor: colors.divider, marginHorizontal: 1 }, colon: { color: colors.secondary, fontSize: 15, marginHorizontal: -2 }, error: { color: colors.danger, fontSize: 11, marginTop: 5 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.45)" }, menu: { maxHeight: "62%", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }, menuHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider }, menuTitle: { color: colors.heading, fontSize: 16 }, choice: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: 6 }, choiceActive: { backgroundColor: colors.primaryLight }, choiceText: { color: colors.secondary, fontSize: 14 }, choiceTextActive: { color: colors.primary },
});
