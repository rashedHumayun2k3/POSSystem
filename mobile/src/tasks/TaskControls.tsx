import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";

export function TaskSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; disabled?: boolean }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}><Text style={t.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={t.select}>
      <Text style={t.body}>{options.find(o => o.value === value)?.label || "Select a person"}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.secondary} />
    </Pressable>
    {open && <View style={t.options}>{options.map(o => <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: value === o.value, disabled: o.disabled }} disabled={o.disabled} onPress={() => { onChange(o.value); setOpen(false); }} style={[t.option, value === o.value && t.chosen, o.disabled && { opacity: .45 }]}><Text style={t.body}>{o.label}</Text>{value === o.value && <Ionicons name="checkmark" size={18} color={colors.primary} />}</Pressable>)}</View>}
  </View>;
}
export function TaskAction({ title, onPress, primary, disabled }: { title: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[t.action, primary && { backgroundColor: colors.primary, borderColor: colors.primary }, disabled && { opacity: .45 }]}><Text style={[t.buttonText, primary && { color: colors.white }]}>{title}</Text></Pressable>;
}
const t = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: colors.heading }, body: { fontSize: 14, color: colors.heading },
  buttonText: { fontSize: 12, fontWeight: "700", color: colors.primaryDark },
  select: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  options: { backgroundColor: colors.white, borderRadius: 12, padding: 4 }, option: { padding: 12, minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 8 }, chosen: { backgroundColor: colors.primaryLight },
  action: { minHeight: 44, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border },
});
