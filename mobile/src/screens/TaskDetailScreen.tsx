import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { Entry, TaskItem, statusLabel, taskTime } from "../tasks/model";
import { Button, Field, s } from "../tasks/ui";
import TaskForm from "../tasks/TaskForm";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const auth = useAuth(), api = useRef(auth.api); api.current = auth.api;
  const [task, setTask] = useState<TaskItem | null>(null), [entries, setEntries] = useState<Entry[]>([]), [total, setTotal] = useState(0);
  const [page, setPage] = useState(1), [reload, setReload] = useState(0), [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(""), [note, setNote] = useState(""), [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const busy = useRef(false);
  useEffect(() => { setComment(""); setNote(""); setConfirm(""); setEditing(false); setPage(1); }, [id, auth.session?.businessId]);
  useFocusEffect(useCallback(() => {
    let live = true; setLoading(true); setTask(null); setEntries([]); setError("");
    Promise.all([api.current<TaskItem>(`/tasks/${id}`), api.current<{ items: Entry[]; total: number }>(`/tasks/${id}/entries?page=${page}`)])
      .then(([t, e]) => { if (live) { setTask(t); setEntries(e.items); setTotal(e.total); } })
      .catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, auth.session?.businessId, page, reload]));
  async function mutate(action: string) {
    if (!task || busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const isComment = action === "COMMENT";
      await api.current<TaskItem>(`/tasks/${id}/${isComment ? "comments" : "status"}`, { method: "POST", body: JSON.stringify(isComment ? { message: comment, rowVer: task.rowVer } : { status: action, note, rowVer: task.rowVer }) });
      if (isComment) { setComment(""); setPage(Math.ceil((total + 1) / 50)); }
      setNote(""); setConfirm(""); setReload(x => x + 1);
    } catch (e) { setError((e as Error).message); } finally { busy.current = false; setSaving(false); }
  }
  return <ScrollView style={s.screen} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={s.row}><Button title="← Tasks" onPress={() => router.push("/more/tasks")} /><Button title="Refresh" disabled={saving} onPress={() => setReload(x => x + 1)} /></View>
    {loading && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {task && <><View style={s.card}><Text style={s.heading}>{task.title}</Text><View style={s.row}><Text style={s.badge}>{statusLabel(task.status)}</Text><Text style={s.badge}>{task.priority === "URGENT" ? "Urgent" : "Normal"}</Text>{task.overdue && <Text style={s.urgent}>Overdue</Text>}</View>
      <Text style={s.body}>{task.description || "No description"}</Text><Text style={s.meta}>Created by {task.creator} · {taskTime(task.createdAt)}</Text><Text style={s.body}>Assigned to {task.assignee}</Text><Text style={s.body}>Due: {taskTime(task.dueAt)}</Text><Text style={s.meta}>All times Asia/Dhaka</Text>
      {task.completedAt && <Text style={s.meta}>Completed by {task.completedBy} · {taskTime(task.completedAt)}</Text>}
      <View style={s.row}>{task.canEdit && <><Button title="Edit / Reassign" disabled={saving} onPress={() => setEditing(true)} /><Button title="Cancel task" disabled={saving} onPress={() => setConfirm("CANCELLED")} /></>}
      {task.canChangeStatus && <>{task.status !== "TODO" && <Button title="To Do" disabled={saving} onPress={() => void mutate("TODO")} />}{task.status !== "IN_PROGRESS" && <Button title="Start progress" disabled={saving} onPress={() => void mutate("IN_PROGRESS")} />}<Button title="Mark Done" selected disabled={saving} onPress={() => setConfirm("DONE")} /></>}
      {task.canReopen && <Button title="Reopen task" disabled={saving} onPress={() => void mutate("REOPEN")} />}</View>
      {!!confirm && <View style={s.gap}>{confirm === "DONE" ? <Field label="Completion note (optional)" value={note} onChange={setNote} multiline maxLength={5000} /> : <Text style={s.body}>Cancel this task? Its comments and history will be preserved.</Text>}<View style={s.row}><Button title={saving ? "Saving…" : confirm === "DONE" ? "Confirm Done" : "Confirm cancellation"} selected disabled={saving} onPress={() => void mutate(confirm)} /><Button title="Back" disabled={saving} onPress={() => setConfirm("")} /></View></View>}
    </View>
    <Text style={s.label}>Progress Notes / Comments & Activity</Text>
    {entries.map(e => <View key={e.id} style={s.card}><View style={s.row}><Text style={s.label}>{e.author}</Text><Text style={s.meta}>{e.kind === "COMMENT" ? "Comment" : e.kind.replaceAll("_", " ")}</Text></View><Text style={s.meta}>{taskTime(e.createdAt)}</Text><Text selectable style={s.body}>{e.message}</Text></View>)}
    {total > 50 && <View style={s.row}><Button title="Earlier" disabled={page <= 1} onPress={() => setPage(x => x - 1)} /><Text style={s.meta}>Page {page}</Text><Button title="Later" disabled={page * 50 >= total} onPress={() => setPage(x => x + 1)} /><Button title="Latest" disabled={page * 50 >= total} onPress={() => setPage(Math.ceil(total / 50))} /></View>}
    {task.canComment && <View style={s.card}><Field label="Progress update" placeholder="Write a progress update…" value={comment} onChange={setComment} multiline maxLength={5000} /><Button title={saving ? "Saving…" : "Post Comment"} selected disabled={saving || !comment.trim()} onPress={() => void mutate("COMMENT")} /></View>}
    {editing && <TaskForm key={auth.session?.businessId} task={task} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setReload(x => x + 1); }} />}</>}
  </ScrollView>;
}
