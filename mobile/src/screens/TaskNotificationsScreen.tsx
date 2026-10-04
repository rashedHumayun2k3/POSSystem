import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { NotificationList, taskTime } from "../tasks/model";
import { Button, s } from "../tasks/ui";

export default function TaskNotificationsScreen() {
  const auth = useAuth(), api = useRef(auth.api); api.current = auth.api;
  const [data, setData] = useState<NotificationList | null>(null), [error, setError] = useState(""), [page, setPage] = useState(1), [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => { let live = true; setData(null); setError(""); const load = () => api.current<NotificationList>(`/tasks/notifications?page=${page}`).then(x => { if (live) setData(x); }).catch(e => { if (live) { setData(null); setError(e.message); } }); void load(); const timer = setInterval(load, 10000); return () => { live = false; clearInterval(timer); }; }, [page, reload, auth.session?.businessId]));
  async function open(id: string) { try { const result = await api.current<{ taskId: string }>(`/tasks/notifications/${id}/read`, { method: "POST" }); router.push(`/more/tasks/${result.taskId}`); } catch (e) { setError((e as Error).message); } }
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.heading}>Notifications</Text><Text style={s.meta}>{data ? `${data.unread} unread` : "Loading…"}</Text>{!!error && <Text style={s.error}>{error}</Text>}<Button title="Refresh" onPress={() => setReload(x => x + 1)} />{data?.items.map(n => <Pressable accessibilityRole="button" key={n.id} style={s.card} onPress={() => void open(n.id)}><Text style={s.label}>{!n.readAt ? "● " : ""}{n.message}</Text><Text style={s.meta}>{taskTime(n.createdAt)}</Text></Pressable>)}{data && !data.items.length && <Text style={s.meta}>No task notifications.</Text>}<View style={s.row}><Button title="Previous" disabled={page === 1} onPress={() => setPage(x => x - 1)} /><Button title="Next" disabled={!data || page * 25 >= data.total} onPress={() => setPage(x => x + 1)} /></View></ScrollView>;
}
