import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { TaskItem, statusLabel, taskTime } from "./model";

export function Button({ title, onPress, disabled = false, selected = false, green = false, compact = false }: { title: string; onPress: () => void; disabled?: boolean; selected?: boolean; green?: boolean; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[s.button, green && { backgroundColor: colors.successBackground, borderWidth: 1, borderColor: colors.success }, compact && { minHeight: 32, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 }, green && compact && { backgroundColor: colors.successText, borderColor: colors.successText }, selected && s.selected, disabled && { opacity: .5 }]}><Text style={[s.buttonText, green && { color: colors.successText }, green && compact && { color: colors.white }, selected && { color: colors.white }]}>{title}</Text></Pressable>;
}
export function Field({ label, value, onChange, multiline = false, maxLength = 200, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string }) {
  return <View style={s.gap}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={colors.muted} style={[s.input, multiline && { minHeight: 100, textAlignVertical: "top" }]} /></View>;
}
export function TaskRow({ task, onPress, compact = false, desktop = false }: { task: TaskItem; onPress: () => void; compact?: boolean; desktop?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.card, task.status === "DONE" && { backgroundColor: colors.successBackground, borderColor: "#86EFAC" }, task.status === "TODO" && { backgroundColor: colors.dangerBackground, borderColor: "#FCA5A5" }, (desktop || compact) && s.desktop, compact && { flexWrap: "wrap", padding: 10 }]}>
    <View style={s.grow}><Text style={s.label}>{task.title}</Text><View style={s.row}><Text style={s.badge}>{statusLabel(task.status)}</Text>{!compact && task.priority === "NORMAL" && <Text style={s.meta}>Normal</Text>}{task.priority === "URGENT" && <Text style={s.urgent}>Urgent</Text>}{task.overdue && <Text style={s.urgent}>Overdue</Text>}</View></View>
    {!compact && <View style={s.grow}><Text style={s.meta}>Assigned: {task.assignee}</Text><Text style={s.meta}>Created by: {task.creator}</Text></View>}
    <View style={s.grow}>{compact && <Text style={s.meta}>Assigned: {task.assignee}</Text>}<Text style={s.meta}>{taskTime(task.dueAt)}</Text>{!compact && <Text style={s.meta}>Activity: {taskTime(task.updatedAt)}</Text>}</View>
    {!compact && <Text style={s.link}>{task.canEdit ? "View / Edit" : "View task"} →</Text>}
  </Pressable>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, gap: 14, paddingBottom: 50 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, gap: { gap: 8 }, grow: { flex: 1, minWidth: 140, gap: 5 },
  heading: { fontSize: 22, fontWeight: "700", color: colors.heading }, label: { fontSize: 15, fontWeight: "600", color: colors.heading },
  meta: { fontSize: 12, color: colors.secondary }, body: { fontSize: 14, lineHeight: 21, color: colors.heading },
  card: { padding: 14, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.divider, gap: 10 }, desktop: { flexDirection: "row", alignItems: "center" },
  button: { minHeight: 42, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 9, backgroundColor: colors.primaryLight },
  selected: { backgroundColor: colors.primary }, buttonText: { color: colors.primaryDark, fontWeight: "600", fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white, borderRadius: 9, padding: 12, fontSize: 15, color: colors.heading },
  error: { color: colors.dangerText, padding: 12, backgroundColor: colors.dangerBackground, borderRadius: 8 },
  badge: { backgroundColor: colors.infoBackground, color: colors.infoText, padding: 5, borderRadius: 5, fontSize: 12 },
  urgent: { backgroundColor: colors.dangerBackground, color: colors.dangerText, padding: 5, borderRadius: 5, fontSize: 12 }, link: { color: colors.primaryDark, fontWeight: "600" },
});
