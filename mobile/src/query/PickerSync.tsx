import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { HUB_URL, useAuth } from "../auth/AuthContext";
import { applyPickerEvent, invalidatePickerResources } from "./cache";

export default function PickerSync() {
  const auth = useAuth();
  const authRef = useRef(auth); authRef.current = auth;
  const client = useQueryClient();
  const businessId = auth.session?.businessId;
  const userId = auth.session?.user.id;
  useEffect(() => {
    if (!businessId) return;
    let disposed = false;
    let starting = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const current = () => !disposed && authRef.current.session?.businessId === businessId;
    const refresh = () => { if (current()) invalidatePickerResources(client, businessId); };
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: async () => {
        if (!current()) throw new Error("Session changed");
        const token = await authRef.current.getLiveAccessToken();
        if (!current()) throw new Error("Session changed");
        return token;
      } })
      .withAutomaticReconnect([0, 2000, 5000, 15000, 30000])
      .configureLogging(LogLevel.Error).build();
    const join = async () => {
      if (!current()) return;
      await connection.invoke("JoinBusiness", businessId);
      refresh();
    };
    const schedule = () => {
      if (current() && focusManager.isFocused()) {
        clearTimeout(retry);
        retry = setTimeout(() => void start(), 15_000 + Math.random() * 5000);
      }
    };
    const start = async () => {
      if (!current() || !focusManager.isFocused() || starting || connection.state !== HubConnectionState.Disconnected) return;
      starting = true;
      try {
        await connection.start();
        if (!current() || !focusManager.isFocused()) { await connection.stop(); return; }
        await join();
      } catch {
        await connection.stop().catch(() => {});
        schedule();
      } finally {
        starting = false;
        if (current() && focusManager.isFocused() && connection.state === HubConnectionState.Disconnected) schedule();
      }
    };
    connection.on("PickerDataChanged", event => { if (current()) applyPickerEvent(client, businessId, event); });
    connection.on("OrderCreated", refresh);
    connection.onreconnected(() => join().catch(async () => { await connection.stop().catch(() => {}); schedule(); }));
    connection.onclose(schedule);
    const unsubscribe = focusManager.subscribe(focused => {
      if (focused) { refresh(); void start(); }
      else {
        clearTimeout(retry);
        void connection.stop().catch(() => {}).finally(() => { if (current() && focusManager.isFocused()) void start(); });
      }
    });
    void start();
    return () => { disposed = true; unsubscribe(); clearTimeout(retry); void connection.stop().catch(() => {}); };
  }, [businessId, userId, client]);
  return null;
}
