import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { parseOrderNotification, orderNotificationRoles } from "./model";

type PushState = "unsupported" | "unconfigured" | "denied" | "registering" | "enabled" | "error";
const Context = createContext<{ status: PushState; retry: () => void; revision: number; error: string }>({ status: "unsupported", retry: () => {}, revision: 0, error: "" });
export const useOrderNotifications = () => useContext(Context);

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const auth = useAuth(); const { lang } = useLanguage(); const navigation = useRootNavigationState();
  const current = useRef(auth); current.current = auth;
  const [status, setStatus] = useState<PushState>("unsupported");
  const [revision, setRevision] = useState(0); const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ReturnType<typeof parseOrderNotification>>(null);
  const [openRevision, setOpenRevision] = useState(0);
  const opening = useRef(false);
  const session = auth.session;
  const retry = useCallback(() => setRetryCount(n => n + 1), []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({ handleNotification: async notification => {
      const data = parseOrderNotification(notification.request.content.data);
      const active = current.current.session;
      const allowed = !!data && !!active && data.recipientId === active.user.id && data.businessId === active.businessId &&
        (!active.branchId || data.branchId === active.branchId);
      return { shouldShowBanner: allowed, shouldShowList: allowed, shouldPlaySound: allowed, shouldSetBadge: false };
    } });
    const receive = Notifications.addNotificationReceivedListener(() => setRevision(n => n + 1));
    const tapped = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER)
        setPending(parseOrderNotification(response.notification.request.content.data));
    };
    const response = Notifications.addNotificationResponseReceivedListener(tapped);
    void Notifications.getLastNotificationResponseAsync().then(value => { if (value) tapped(value); }).catch(() => {});
    const rotation = Notifications.addPushTokenListener(retry);
    return () => { receive.remove(); response.remove(); rotation.remove(); Notifications.setNotificationHandler(null); };
  }, [retry]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const listener = AppState.addEventListener("change", state => { if (state === "active") { retry(); setRevision(n => n + 1); } });
    return () => listener.remove();
  }, [retry]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!session) { setStatus("unsupported"); void Notifications.dismissAllNotificationsAsync().catch(() => {}); return; }
    if (!session.businessId || !orderNotificationRoles.includes(session.user.role ?? "")) return;
    let active = true;
    const register = async () => {
      if (!Device.isDevice) { setStatus("unsupported"); return; }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) { setStatus("unconfigured"); return; }
      setStatus("registering"); setError("");
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("new-orders", {
        name: lang === "bn" ? "নতুন অর্ডার" : "New orders", importance: Notifications.AndroidImportance.HIGH,
        sound: "default", vibrationPattern: [0, 250, 250, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (!active) return;
      if (!permission.granted) { setStatus("denied"); return; }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!active || current.current.session !== session) return;
      await current.current.api("/notifications/device", { method: "PUT", body: JSON.stringify({ token, refreshToken: session.refreshToken, language: lang }) });
      if (active) setStatus("enabled");
    };
    void register().catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [session?.user.id, session?.businessId, session?.branchId, session?.refreshToken, lang, retryCount]);

  useEffect(() => {
    if (!pending || !auth.ready || !session || opening.current) return;
    if (pending.recipientId !== session.user.id || !session.businesses.some(b => b.id === pending.businessId)) {
      setPending(null); void Notifications.clearLastNotificationResponseAsync().catch(() => {}); return;
    }
    opening.current = true;
    let switchedScope = false;
    const open = async () => {
      if (session.businessId !== pending.businessId) {
        const branches = await auth.chooseBusiness(pending.businessId);
        if (pending.branchId) {
          const branch = branches.find(b => b.id === pending.branchId);
          if (!branch) throw new Error("Branch access denied.");
          await current.current.chooseBranch(branch);
        }
        switchedScope = true; return;
      }
      if (pending.branchId && session.branchId !== pending.branchId) {
        const branches = await auth.api<import("../auth/AuthContext").Branch[]>("/branches/mine");
        const branch = branches.find(b => b.id === pending.branchId);
        if (!branch) throw new Error("Branch access denied.");
        await auth.chooseBranch(branch); switchedScope = true; return;
      }
      if (!navigation?.key) return;
      const result = await auth.api<{ orderId: string }>(`/notifications/orders/${pending.notificationId}/read`, { method: "POST" });
      if (current.current.session?.user.id !== session.user.id || current.current.session?.businessId !== pending.businessId) return;
      setPending(null); setRevision(n => n + 1);
      await Notifications.clearLastNotificationResponseAsync();
      router.push(`/orders/${result.orderId}`);
    };
    void open().catch(() => { setPending(null); setError(lang === "bn" ? "অর্ডারটি খোলা যায়নি। নোটিফিকেশন তালিকা থেকে আবার চেষ্টা করুন।" : "Could not open this order. Try again from notifications."); })
      .finally(() => { opening.current = false; if (switchedScope) setOpenRevision(n => n + 1); });
  }, [pending, auth.ready, session?.user.id, session?.businessId, session?.branchId, navigation?.key, lang, openRevision]);

  return <Context.Provider value={{ status, retry, revision, error }}>{children}</Context.Provider>;
}
