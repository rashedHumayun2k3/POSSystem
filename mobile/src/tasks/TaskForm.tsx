import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { DateTimeField } from "../components/DateTimeField";
import { Assignee, dueField, TaskItem } from "./model";
import { Field, s } from "./ui";
import { TaskAction, TaskSelect } from "./TaskControls";

export default function TaskForm({ task, onClose, onSaved }: { task?: TaskItem; onClose: () => void; onSaved: (task: TaskItem) => void }) {
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const [title, setTitle] = useState(task?.title ?? ""), [description, setDescription] = useState(task?.description ?? "");
  const [assignee, setAssignee] = useState(task?.assigneeId ?? ""), [due, setDue] = useState(dueField(task?.dueAt ?? null));
  const [priority, setPriority] = useState(task?.priority ?? "NORMAL"), [people, setPeople] = useState<Assignee[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const businessId = auth.session?.businessId;
  useEffect(() => { let live = true; auth.api<Assignee[]>("/tasks/assignees").then(x => { if (live) setPeople(x); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [businessId]);
  async function save() {
    if (busy.current) return;
    if (!title.trim() || !assignee) { setError("Enter a title and choose an assignee."); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const result = await auth.api<TaskItem>(task ? `/tasks/${task.id}` : "/tasks", { method: task ? "PUT" : "POST", body: JSON.stringify({ title, description, assigneeId: assignee, dueAt: due ? `${due}:00+06:00` : null, priority, rowVer: task?.rowVer }) });
      onSaved(result);
    } catch (e) { setError((e as Error).message); } finally { busy.current = false; setSaving(false); }
  }
  return <BottomSheet visible mobile={width < 768} title={task ? "Edit Task" : "Add Task"} close={() => { if (!busy.current) onClose(); }} footer={<View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><TaskAction title="Cancel" disabled={saving} onPress={onClose} /><TaskAction title={saving ? "Saving…" : task ? "Save Changes" : "Create Task"} primary disabled={saving || loading || !people.length} onPress={() => void save()} /></View>}>
    <View style={{ gap: 22, padding: 5, paddingBottom: 12 }}>
      <Field label="Title *" placeholder="What needs to get done?" value={title} onChange={setTitle} />
      <Field label="Description" placeholder="Add a few details…" value={description} onChange={setDescription} multiline maxLength={10000} />
      {loading ? <ActivityIndicator /> : !people.length ? <Text style={s.error}>No eligible active assignees in this business.</Text> : <TaskSelect label="Assigned To *" value={assignee} onChange={setAssignee} options={people.map(p => ({ value: p.id, label: `${p.name}${p.id === auth.session?.user.id ? " (me)" : ""}` }))} />}
      <View style={{ gap: 8 }}><Text style={s.label}>Due Date</Text><Text style={s.meta}>Optional · Asia/Dhaka</Text><DateTimeField key={due ? "date" : "empty"} value={due} onChange={setDue} />{!!due && <TaskAction title="Clear due date" onPress={() => setDue("")} />}</View>
      <TaskSelect label="Priority" value={priority} onChange={setPriority} options={[{ value: "NORMAL", label: "Normal" }, { value: "URGENT", label: "High" }]} />
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </View>
  </BottomSheet>;
}
