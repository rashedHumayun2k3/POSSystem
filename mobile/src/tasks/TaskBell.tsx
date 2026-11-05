import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { Text } from "../i18n/LocalizedText";
import { colors } from "../theme";
import { eligible, NotificationList } from "./model";
import { orderNotificationRoles, type OrderNotificationList } from "../notifications/model";
import { useOrderNotifications } from "../notifications/NotificationProvider";

export default function TaskBell() {
  const auth = useAuth(), api = useRef(auth.api); api.current = auth.api; const path = usePathname();
  const { revision } = useOrderNotifications();
  const [unread, setUnread] = useState(0); const allowed = orderNotificationRoles.includes(auth.session?.user.role ?? "");
  useEffect(() => {
    setUnread(0); if (!allowed) return;
    let live = true;
    const load = () => Promise.all([
      api.current<OrderNotificationList>("/notifications/orders").then(x => x.unread).catch(() => 0),
      eligible(auth.session?.user.role) ? api.current<NotificationList>("/tasks/notifications").then(x => x.unread).catch(() => 0) : Promise.resolve(0),
    ]).then(counts => { if (live) setUnread(counts.reduce((sum, n) => sum + n, 0)); });
    void load(); const timer = setInterval(load, 10000); return () => { live = false; clearInterval(timer); };
  }, [allowed, auth.session?.businessId, auth.session?.branchId, auth.session?.user.role, path, revision]);
  if (!allowed) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${unread} unread`} onPress={() => router.push("/notifications")} style={{ padding: 3 }}><Ionicons name="notifications-outline" size={24} color={colors.secondary} />{unread > 0 && <View style={{ position: "absolute", right: -6, top: -5, borderRadius: 9, backgroundColor: colors.danger, paddingHorizontal: 4 }}><Text style={{ color: colors.white, fontSize: 10 }}>{unread > 99 ? "99+" : unread}</Text></View>}</Pressable>;
}
