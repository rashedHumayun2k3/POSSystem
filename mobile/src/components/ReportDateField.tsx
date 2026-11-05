import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { colors } from "../theme";
import { reportToday, shiftReportDate } from "./reportDate";

export default function ReportDateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = reportToday();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const arrow = (days: number) => <Pressable disabled={days > 0 && value >= today} accessibilityState={{disabled: days > 0 && value >= today}} accessibilityRole="button" accessibilityLabel={days < 0 ? "Previous date" : "Next date"} onPress={() => { if (days < 0 || value < reportToday()) onChange(shiftReportDate(value, days)); }} style={({ pressed }) => ({ opacity: days > 0 && value >= today ? 0.4 : 1, width: 32, height: 32, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.border : colors.primaryLight })}>
    <Ionicons name={days < 0 ? "chevron-back" : "chevron-forward"} size={17} color={colors.primaryDark}/>
  </Pressable>;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 5, minHeight: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 6 }}>
    {arrow(-1)}<Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
    <TextInput accessibilityLabel="Report date" value={draft} placeholder="YYYY-MM-DD" maxLength={10} style={{ flex: 1, minWidth: 0, height: 34, paddingHorizontal: 2, paddingVertical: 0, fontSize: 12, color: colors.heading }} onChangeText={date => {
      setDraft(date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parsed = new Date(`${date}T00:00:00Z`);
        if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date <= reportToday()) onChange(date);
      }
    }} />{arrow(1)}
  </View>;
}
