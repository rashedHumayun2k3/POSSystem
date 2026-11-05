import { useCallback, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { Text } from "../i18n/LocalizedText";
import { eligible, taskTime } from "../tasks/model";
import { Button, s } from "../tasks/ui";
import TaskNotificationsScreen from "../screens/TaskNotificationsScreen";
import { useOrderNotifications } from "./NotificationProvider";
import type { OrderNotificationList } from "./model";

export default function NotificationsScreen() {
  const auth = useAuth(); const api = useRef(auth.api); api.current = auth.api;
  const { lang } = useLanguage(); const bn = lang === "bn";
  const { status, retry, revision, error: pushError } = useOrderNotifications();
  const [tab, setTab] = useState<"orders" | "tasks">("orders");
  const [data, setData] = useState<OrderNotificationList | null>(null);
  const [page, setPage] = useState(1); const [reload, setReload] = useState(0); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    if (tab !== "orders") return;
    let live = true; setData(null); setError("");
    const load = () => api.current<OrderNotificationList>(`/notifications/orders?page=${page}`).then(value => { if (live) { setData(value); setError(""); } })
      .catch(() => { if (live) setError(bn ? "নোটিফিকেশন লোড করা যায়নি। আবার চেষ্টা করুন।" : "Could not load notifications. Please retry."); });
    void load(); const timer = setInterval(load, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [tab, page, reload, revision, auth.session?.businessId, auth.session?.branchId, bn]));
  async function open(id: string) {
    try { const result = await api.current<{ orderId: string }>(`/notifications/orders/${id}/read`, { method: "POST" }); router.push(`/orders/${result.orderId}`); }
    catch { setError(bn ? "অর্ডারটি খোলা যায়নি।" : "Could not open this order."); }
  }
  const messages = {
    unsupported: bn ? "এই ডিভাইসে পুশ নোটিফিকেশন চালু নেই।" : "Push notifications are unavailable on this device.",
    unconfigured: bn ? "এই অ্যাপে পুশ নোটিফিকেশন এখনো প্রস্তুত নয়।" : "Push notifications are not configured in this build yet.",
    denied: bn ? "ফোনের সেটিংস থেকে নোটিফিকেশনের অনুমতি দিন।" : "Allow notifications in your phone settings.",
    registering: bn ? "নোটিফিকেশন চালু হচ্ছে…" : "Enabling notifications…",
    enabled: bn ? "নতুন অর্ডারের নোটিফিকেশন চালু আছে।" : "New-order push notifications are enabled.",
    error: bn ? "পুশ নোটিফিকেশন চালু করা যায়নি। আবার চেষ্টা করুন।" : "Could not enable push notifications. Please retry.",
  };
  return <View style={{ flex: 1 }}>
    <View style={[s.row, { padding: 12 }]}><Button title={bn ? "অর্ডার" : "Orders"} onPress={() => setTab("orders")} />
      {eligible(auth.session?.user.role) && <Button title={bn ? "কাজ" : "Tasks"} onPress={() => setTab("tasks")} />}</View>
    {tab === "tasks" ? <TaskNotificationsScreen /> : <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.heading}>{bn ? "অর্ডারের নোটিফিকেশন" : "Order notifications"}</Text>
      {Platform.OS !== "web" && <View style={s.card}><Text style={s.meta}>{messages[status]}</Text>
        {status === "denied" ? <Button title={bn ? "ফোনের সেটিংস" : "Phone settings"} onPress={() => void Linking.openSettings()} /> :
          status === "error" && <Button title={bn ? "আবার চেষ্টা করুন" : "Retry"} onPress={retry} />}</View>}
      {!!pushError && <Text style={s.error}>{pushError}</Text>}
      <Text style={s.meta}>{data ? (bn ? `${data.unread.toLocaleString("bn-BD")}টি অপঠিত` : `${data.unread} unread`) : (bn ? "লোড হচ্ছে…" : "Loading…")}</Text>
      {!!error && <Text style={s.error}>{error}</Text>}
      <Button title={bn ? "রিফ্রেশ" : "Refresh"} onPress={() => setReload(n => n + 1)} />
      {data?.items.map(n => <Pressable accessibilityRole="button" key={n.id} style={s.card} onPress={() => void open(n.id)}>
        <Text style={s.label}>{!n.readAt ? "● " : ""}{bn ? `নতুন অনলাইন অর্ডার ${n.orderNo}` : `New online order ${n.orderNo}`}</Text>
        <Text style={s.meta}>{taskTime(n.createdAt)}</Text></Pressable>)}
      {data && !data.items.length && <Text style={s.meta}>{bn ? "এখনো কোনো অর্ডারের নোটিফিকেশন নেই।" : "No order notifications yet."}</Text>}
      <View style={s.row}><Button title={bn ? "আগের" : "Previous"} disabled={page === 1} onPress={() => setPage(n => n - 1)} />
        <Button title={bn ? "পরের" : "Next"} disabled={!data || page * 25 >= data.total} onPress={() => setPage(n => n + 1)} /></View>
    </ScrollView>}
  </View>;
}
