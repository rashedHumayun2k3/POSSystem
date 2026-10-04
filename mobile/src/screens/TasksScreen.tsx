import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { Assignee, TaskItem, TaskList, statusLabel } from "../tasks/model";
import TaskForm from "../tasks/TaskForm";
import BottomSheet from "../components/BottomSheet";
import PageTitle from "../components/PageTitle";
import { TaskAction, TaskSelect } from "../tasks/TaskControls";
import { colors } from "../theme";

const defaults = { view: "created", status: "BOTH", priority: "", creator: "" };
export default function TasksScreen() {
  const auth = useAuth(), api = useRef(auth.api); api.current = auth.api;
  const params = useLocalSearchParams<{ new?: string }>(), { width } = useWindowDimensions();
  const [filters, setFilters] = useState(defaults), [draft, setDraft] = useState(defaults), [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState(""), [query, setQuery] = useState("");
  const [data, setData] = useState<TaskList | null>(null), [people, setPeople] = useState<Assignee[]>([]);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [adding, setAdding] = useState(params.new === "1"), [reload, setReload] = useState(0);
  const [menu, setMenu] = useState<TaskItem | null>(null), [editing, setEditing] = useState<TaskItem | null>(null), [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), mutation = useRef(false);
  const [completedTotal, setCompletedTotal] = useState(0), [completedPage, setCompletedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0), moreBusy = useRef(false);
  const [createdTask, setCreatedTask] = useState<TaskItem | null>(null);
  useEffect(() => { if (params.new === "1") setAdding(true); }, [params.new]);
  useEffect(() => { setFilters(defaults); setMenu(null); setEditing(null); setFilterOpen(false); setCreatedTask(null); }, [auth.session?.businessId]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); }, 300); return () => clearTimeout(timer); }, [search]);
  useFocusEffect(useCallback(() => {
    let live = true;
    generation.current += 1;
    moreBusy.current = false; setLoadingMore(false);
    setLoading(true); setData(null); setError(""); setCompletedPage(1); setCompletedTotal(0);
    async function fetchAll(status: string) {
      const first = await api.current<TaskList>(taskUrl(status, 1, 100));
      const items = [...first.items];
      for (let page = 2; (page - 1) * first.pageSize < first.total; page++) {
        if (!live) return first;
        const next = await api.current<TaskList>(taskUrl(status, page, first.pageSize));
        items.push(...next.items);
      }
      return { ...first, items };
    }
    async function load() {
      const both = filters.status === "BOTH";
      const [active, completed] = await Promise.all([
        filters.status === "DONE" ? Promise.resolve(null) : fetchAll(both ? "ACTIVE" : filters.status),
        both || filters.status === "DONE" ? api.current<TaskList>(taskUrl("DONE", 1, 10)) : Promise.resolve(null),
      ]);
      if (!live) return;
      const base = active ?? completed!;
      setData({ ...base, items: [...(active?.items ?? []), ...(completed?.items ?? [])], total: (active?.total ?? 0) + (completed?.total ?? 0) });
      setCompletedTotal(completed?.total ?? 0);
    }
    void load().catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    api.current<Assignee[]>("/tasks/assignees").then(x => { if (live) setPeople(x); }).catch(() => {});
    return () => { live = false; generation.current += 1; };
  }, [auth.session?.businessId, filters, query, reload]));
  function taskUrl(status: string, page: number, pageSize: number) {
    return `/tasks?view=${filters.view}&status=${status}&priority=${filters.priority}&search=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}${filters.creator ? `&creatorId=${encodeURIComponent(filters.creator)}` : ""}`;
  }
  async function loadMore() {
    if (moreBusy.current || loading) return;
    const currentGeneration = generation.current;
    moreBusy.current = true; setLoadingMore(true); setError("");
    try {
      const next = await api.current<TaskList>(taskUrl("DONE", completedPage + 1, 10));
      if (currentGeneration !== generation.current) return;
      setData(previous => previous && { ...previous, items: [...previous.items, ...next.items.filter(item => !previous.items.some(existing => existing.id === item.id))] });
      setCompletedPage(page => page + 1); setCompletedTotal(next.total);
    } catch (e) {
      if (currentGeneration === generation.current) setError((e as Error).message);
    } finally {
      if (currentGeneration === generation.current) { moreBusy.current = false; setLoadingMore(false); }
    }
  }
  async function complete(task: TaskItem) {
    if (mutation.current) return;
    mutation.current = true; setBusy(task.id); setError("");
    try {
      await api.current(`/tasks/${task.id}/status`, { method: "POST", body: JSON.stringify({ status: task.status === "DONE" ? "REOPEN" : "DONE", rowVer: task.rowVer }) });
      setMenu(null); setReload(x => x + 1);
    } catch (e) { setError((e as Error).message); } finally { mutation.current = false; setBusy(null); }
  }
  const activeFilters = Object.keys(defaults).filter(key => filters[key as keyof typeof defaults] !== defaults[key as keyof typeof defaults]).length;
  const closeForm = () => { setAdding(false); setEditing(null); router.setParams({ new: undefined }); };
  function savedTask(task: TaskItem) {
    if (!editing) {
      setFilters(defaults);
      setSearch("");
      setQuery("");
      setCreatedTask(task);
    }
    closeForm();
    setReload(x => x + 1);
  }
  return <View style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReload(x => x + 1)} tintColor={colors.primary} />}>
      <View style={styles.header}><View style={styles.grow}><PageTitle>Tasks</PageTitle><Text style={styles.subtitle}>{data ? `${data.total} tasks • ${data.counts.pending} pending in this view` : "Your tasks, one clear view"}</Text></View>
        {data?.permissions.canCreate && <TaskAction title="+ Add Task" primary onPress={() => setAdding(true)} />}
        {data?.permissions.canConfigure && <Pressable accessibilityRole="button" accessibilityLabel="Task settings" onPress={() => setSettings(true)} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={21} color={colors.secondary} /></Pressable>}
      </View>
      <View style={styles.toolbar}><View style={styles.search}><Ionicons name="search-outline" size={20} color={colors.muted} /><TextInput accessibilityLabel="Search tasks" placeholder="Search tasks…" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.searchInput} returnKeyType="search" />{!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch("")} style={styles.icon}><Ionicons name="close" size={18} color={colors.secondary} /></Pressable>}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Filter tasks${activeFilters ? `, ${activeFilters} applied` : ""}`} onPress={() => { setDraft(filters); setFilterOpen(true); }} style={[styles.filter, !!activeFilters && styles.selected]}><Ionicons name="options-outline" size={19} color={activeFilters ? colors.primaryDark : colors.secondary} /><Text style={[styles.filterText, !!activeFilters && { color: colors.primaryDark }]}>Filter{activeFilters ? ` · ${activeFilters}` : ""}</Text></Pressable>
      </View>
      <Text style={styles.subtitle}>{filters.view === "created" ? "Created by me" : filters.view === "mine" ? "Assigned to me" : "All tasks"} · {filters.status === "BOTH" ? "Active & completed" : statusLabel(filters.status)}</Text>
      {createdTask && <View style={[styles.card, createdTask.status === "TODO" && styles.newCard]}><Pressable accessibilityRole="button" accessibilityLabel={`Open created task ${createdTask.title}`} style={styles.cardBody} onPress={() => router.push(`/more/tasks/${createdTask.id}`)}><Text style={styles.subtitle}>Task created · View details</Text><Text style={styles.taskTitle}>{createdTask.title}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Dismiss task confirmation" style={styles.icon} onPress={() => setCreatedTask(null)}><Ionicons name="close" size={18} color={colors.secondary} /></Pressable></View>}
      {!!error && <View style={styles.empty}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TaskAction title="Retry" onPress={() => setReload(x => x + 1)} /></View>}
      {loading && <ActivityIndicator style={{ padding: 32 }} color={colors.primary} />}
      {data && !data.items.length && <View style={styles.empty}><Ionicons name="checkmark-done-outline" size={38} color={colors.muted} /><Text style={styles.sectionTitle}>A little breathing room</Text><Text style={styles.subtitle}>No tasks match this view. Add a task or adjust your filters.</Text></View>}
      {data && ["Not completed", "Cancelled", "Completed"].map(group => {
        const items = data.items.filter(task => group === "Completed" ? task.status === "DONE" : group === "Cancelled" ? task.status === "CANCELLED" : task.status === "TODO" || task.status === "IN_PROGRESS");
        if (!items.length) return null;
        return <View key={group} style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{group} <Text style={styles.count}>{group === "Completed" ? `${items.length} of ${completedTotal}` : items.length}</Text></Text></View>
          {items.map(task => <View key={task.id} style={[styles.card, task.status === "DONE" && styles.completedCard, task.status === "TODO" && styles.newCard]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={() => router.push(`/more/tasks/${task.id}`)} style={styles.cardBody}><Text style={[styles.taskTitle, task.status === "DONE" && styles.done]}>{task.title}</Text><View style={styles.assignee}><Ionicons name="person-outline" size={12} color={colors.muted} /><Text style={styles.subtitle}>{task.assignee}</Text></View><View style={styles.cardFooter}><View style={styles.due}><Ionicons name="calendar-outline" size={13} color={task.overdue ? colors.warningText : colors.muted} /><Text style={[styles.date, task.overdue && { color: colors.warningText }]}>{task.dueAt ? new Intl.DateTimeFormat("en-BD", { month: "short", day: "numeric", timeZone: "Asia/Dhaka" }).format(new Date(task.dueAt)) : "No due date"}{task.overdue ? " · Overdue" : ""}</Text></View><Text style={[styles.badge, task.priority === "URGENT" ? styles.high : styles.orangeBadge]}>{task.priority === "URGENT" ? "High" : "Normal"}</Text><Text style={[styles.badge, task.status === "TODO" && styles.orangeBadge, task.status === "IN_PROGRESS" && styles.inProgress, task.status === "DONE" && styles.completed]}>{statusLabel(task.status)}</Text></View></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${task.title}`} onPress={() => setMenu(task)} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={21} color={colors.secondary} /></Pressable>
          </View>)}
        </View>;
      })}
      {data && completedPage * 10 < completedTotal && <View style={styles.pagination}><TaskAction title={loadingMore ? "Loading…" : "+ Load more"} primary disabled={loadingMore} onPress={() => void loadMore()} /></View>}
    </ScrollView>
    {filterOpen && <BottomSheet visible mobile={width < 768} title="Filter tasks" close={() => setFilterOpen(false)} footer={<View style={styles.footer}><TaskAction title="Reset" onPress={() => setDraft(defaults)} /><TaskAction title="Apply Filter" primary onPress={() => { setFilters(draft); setFilterOpen(false); }} /></View>}><View style={styles.form}>
      <TaskSelect label="Task type" value={draft.view} onChange={view => setDraft({ ...draft, view })} options={[{ value: "all", label: "All Tasks", disabled: !data?.permissions.canViewAll }, { value: "created", label: "My Tasks (created by me)" }, { value: "mine", label: "Assigned to Me" }]} />
      <TaskSelect label="Status" value={draft.status} onChange={status => setDraft({ ...draft, status })} options={[{ value: "BOTH", label: "Active & completed" }, { value: "ACTIVE", label: "All active" }, ...["TODO", "IN_PROGRESS", "DONE", "CANCELLED"].map(value => ({ value, label: statusLabel(value) }))]} />
      <TaskSelect label="Priority" value={draft.priority} onChange={priority => setDraft({ ...draft, priority })} options={[{ value: "", label: "All" }, { value: "URGENT", label: "High" }, { value: "NORMAL", label: "Normal" }]} />
      <TaskSelect label="Created By" value={draft.creator} onChange={creator => setDraft({ ...draft, creator })} options={[{ value: "", label: "Everyone" }, ...people.map(p => ({ value: p.id, label: p.name }))]} />
    </View></BottomSheet>}
    {menu && <BottomSheet visible mobile={width < 768} title="Task actions" close={() => setMenu(null)}><Text style={styles.taskTitle}>{menu.title}</Text><TaskAction title="View details & activity" onPress={() => { router.push(`/more/tasks/${menu.id}`); setMenu(null); }} />{menu.canEdit && <TaskAction title="Edit task" onPress={() => { setEditing(menu); setMenu(null); }} />}{(menu.canChangeStatus || (menu.status === "DONE" && menu.canReopen)) && <TaskAction title={menu.status === "DONE" ? "Reopen task" : "Mark complete"} disabled={!!busy} onPress={() => void complete(menu)} />}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</BottomSheet>}
    {settings && <BottomSheet visible mobile={width < 768} title="Task settings" close={() => setSettings(false)}><TaskAction title="Manage permissions" onPress={() => { setSettings(false); router.push("/more/tasks/permissions"); }} /></BottomSheet>}
    {(editing || (adding && data?.permissions.canCreate)) && <TaskForm key={auth.session?.businessId} task={editing ?? undefined} onClose={closeForm} onSaved={savedTask} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 1000, alignSelf: "center", padding: 16, paddingBottom: 60, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 }, grow: { flex: 1, gap: 5 }, subtitle: { fontSize: 12, lineHeight: 18, color: colors.secondary },
  toolbar: { flexDirection: "row", gap: 10 }, search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingLeft: 14, minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, searchInput: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 14, color: colors.heading },
  filter: { minHeight: 44, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: colors.white, borderRadius: 11, paddingHorizontal: 12 }, filterText: { fontSize: 12, fontWeight: "700", color: colors.secondary }, selected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  section: { gap: 10 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.heading }, count: { fontSize: 12, fontWeight: "500", color: colors.muted }, seeAll: { minHeight: 44, flexDirection: "row", gap: 4, alignItems: "center" }, link: { fontSize: 12, color: colors.secondary },
  card: { flexDirection: "row", alignItems: "flex-start", borderRadius: 16, borderWidth: 1, borderColor: colors.divider, padding: 12, backgroundColor: colors.card },
  orangeBadge: { color: colors.white, backgroundColor: colors.primary },
  completedCard: { backgroundColor: colors.successBackground },
  newCard: { backgroundColor: colors.dangerBackground },
  inProgress: { color: colors.infoText, backgroundColor: colors.infoBackground },
  completed: { color: colors.successText, backgroundColor: colors.successBackground },
  cardBody: { flex: 1, paddingVertical: 10, gap: 7 }, taskTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: colors.heading }, done: { textDecorationLine: "line-through", color: colors.muted }, assignee: { flexDirection: "row", gap: 5, alignItems: "center" }, cardFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 5 }, due: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 95 }, date: { fontSize: 12, color: colors.secondary }, badge: { fontSize: 11, fontWeight: "600", color: colors.secondary, backgroundColor: colors.disabled, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }, high: { color: colors.dangerText, backgroundColor: colors.dangerBackground }, icon: { width: 36, minHeight: 44, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 }, error: { color: colors.dangerText, fontSize: 14 }, pagination: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }, footer: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, form: { gap: 22, padding: 5, paddingBottom: 12 },
});
