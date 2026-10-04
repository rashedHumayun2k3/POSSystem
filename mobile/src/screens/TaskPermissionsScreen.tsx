import { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { Button, s } from "../tasks/ui";

type Member = { userId: string; name: string; role: string; canViewAllTasks: boolean; canCommentAllTasks: boolean; canManageAllTasks: boolean };
export default function TaskPermissionsScreen() {
  const auth = useAuth(); const [members, setMembers] = useState<Member[]>([]), [error, setError] = useState(""), [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const busy = useRef(false);
  useEffect(() => { let live = true; setMembers([]); auth.api<Member[]>("/tasks/permission-members").then(x => { if (live) setMembers(x); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [auth.session?.businessId]);
  async function save(m: Member) { if (busy.current) return; busy.current = true; setSaving(true); setError(""); setNotice(""); try { await auth.api(`/tasks/permission-members/${m.userId}`, { method: "PUT", body: JSON.stringify(m) }); setNotice(`Permissions saved for ${m.name}.`); } catch (e) { setError((e as Error).message); } finally { busy.current = false; setSaving(false); } }
  return <ScrollView style={s.screen} contentContainerStyle={s.content}><Text style={s.heading}>Task permissions</Text><Text style={s.body}>Owners manage all tasks. Managers and partners start with their own created and assigned tasks. Broader permissions apply only to this business.</Text>{!!error && <Text style={s.error}>{error}</Text>}{!!notice && <Text style={s.meta}>{notice}</Text>}
    {members.map(m => <View key={m.userId} style={s.card}><Text style={s.label}>{m.name} · {m.role}</Text>{m.role === "OWNER" ? <Text style={s.meta}>Full owner access</Text> : <>{([['canViewAllTasks', 'View all tasks'], ['canCommentAllTasks', 'Comment on accessible tasks'], ['canManageAllTasks', 'Manage all tasks (includes viewing)']] as const).map(([key, label]) => <View key={key} style={s.row}><Text style={s.grow}>{label}</Text><Switch accessibilityLabel={`${m.name}: ${label}`} disabled={saving} value={m[key]} onValueChange={value => setMembers(items => items.map(x => x.userId === m.userId ? { ...x, [key]: value } : x))} /></View>)}<Button title="Save permissions" disabled={saving} onPress={() => void save(m)} /></>}</View>)}
  </ScrollView>;
}
