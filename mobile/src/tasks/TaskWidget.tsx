import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { eligible, TaskList, TaskPermissions } from "./model";
import { Button, s, TaskRow } from "./ui";
import TaskForm from "./TaskForm";
import { colors } from "../theme";

export default function TaskWidget() {
  const auth = useAuth(), api = useRef(auth.api); api.current = auth.api;
  const [data, setData] = useState<TaskList | null>(null), [error, setError] = useState("");
  const [adding, setAdding] = useState(false), [reload, setReload] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const allowed = eligible(auth.session?.user.role);
  useFocusEffect(useCallback(() => {
    if (!allowed || !expanded) return;
    let live = true; setData(null); setError("");
    const load = async () => {
      try {
        const permissions = await api.current<TaskPermissions>("/tasks/permissions");
        if (!live) return;
        const x = await api.current<TaskList>(`/tasks?view=${permissions.canViewAll ? "all" : "mine"}&page=${page}&pageSize=25`);
        if (live) { setData(x); setError(""); }
      } catch (e) { if (live) { setData(null); setError((e as Error).message); } }
    };
    void load(); const timer = setInterval(load, 10000); return () => { live = false; clearInterval(timer); };
  }, [allowed, expanded, auth.session?.businessId, reload, page]));
  if (!allowed) return null;
  return <View style={[s.card, widget.panel]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Tasks" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={[s.row, widget.header]}>
      <Ionicons name="checkbox-outline" size={20} color={colors.successText} /><Text style={widget.title}>Tasks</Text><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.successText} />
    </Pressable>
    {expanded && <View style={s.gap}>
    <View style={[s.row, widget.actions]}><Button green compact title="View All" onPress={() => router.push({ pathname: "/more/tasks", params: { view: data?.permissions.canViewAll ? "all" : "mine" } })} />{data?.permissions.canCreate && <Button green compact title="+ Add Task" onPress={() => setAdding(true)} />}</View>
    {!!error && <Text style={s.error}>{error}</Text>}{!data && !error && <Text style={s.meta}>Loading tasks…</Text>}
    {data && <><Text style={s.meta}>{data.counts.pending} pending · {data.counts.overdue} overdue</Text>{data.items.map(t => <TaskRow key={t.id} task={t} compact onPress={() => router.push(`/more/tasks/${t.id}`)} />)}{!data.items.length && <Text style={s.meta}>No active tasks in this view.</Text>}{data.total > data.pageSize && <View style={s.row}><Button green title="Previous" disabled={page <= 1} onPress={() => setPage(x => x - 1)} /><Text style={s.meta}>Page {page}</Text><Button green title="Next" disabled={page * data.pageSize >= data.total} onPress={() => setPage(x => x + 1)} /></View>}</>}
    </View>}
    {adding && <TaskForm key={auth.session?.businessId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setReload(x => x + 1); }} />}
  </View>;
}

const widget = StyleSheet.create({
  panel: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  actions: { justifyContent: "flex-end", gap: 8 },
  header: { minHeight: 24, gap: 12 },
  title: { flex: 1, color: colors.successText, fontSize: 14, fontWeight: "600" },
});
