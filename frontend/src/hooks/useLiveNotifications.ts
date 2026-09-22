"use client";

import { useEffect, useRef } from "react";
import * as signalR from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";

interface OrderCreatedPayload {
  orderId: string;
  orderNo: string;
  channel: string;
  customerName: string;
  itemCount: number;
  createdAt: string;
}

// First real consumer of Hubs/LiveHub.cs (backend) — the hub itself and its JoinBusiness/
// LeaveBusiness group-join RPCs already existed, but nothing ever broadcast to it and nothing
// on the frontend ever connected. This establishes both sides for the "OrderCreated" event.
export function useLiveNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentBusinessId = useAuthStore((s) => s.currentBusinessId);
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const joinedBusinessRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken || !process.env.NEXT_PUBLIC_HUB_URL) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(process.env.NEXT_PUBLIC_HUB_URL, { accessTokenFactory: () => accessToken })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connection.on("OrderCreated", (payload: OrderCreatedPayload) => {
      // Bell badge/list are query-driven (see AppHeader / notifications page), not a separate
      // counter — invalidating here just makes the badge bump instantly instead of waiting out
      // the 15s staleTime, on top of the browser tab that placed the toast either way.
      queryClient.invalidateQueries({ queryKey: ["notifications-online-orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      showToast(
        `New order ${payload.orderNo} from ${payload.customerName} (${payload.itemCount} item${payload.itemCount > 1 ? "s" : ""})`,
        "success"
      );
    });

    const join = async (businessId: string | null) => {
      if (!businessId) return;
      try {
        await connection.invoke("JoinBusiness", businessId);
        joinedBusinessRef.current = businessId;
      } catch {
        // Connection not ready yet — onreconnected below re-joins once it is.
      }
    };

    connection.onreconnected(() => {
      if (joinedBusinessRef.current) join(joinedBusinessRef.current);
    });

    connection.start().then(() => join(currentBusinessId)).catch(() => {});
    connectionRef.current = connection;

    return () => {
      connection.stop();
      connectionRef.current = null;
      joinedBusinessRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Business switch on an already-open connection — leave the old group, join the new one.
  useEffect(() => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    if (!currentBusinessId || joinedBusinessRef.current === currentBusinessId) return;

    (async () => {
      if (joinedBusinessRef.current) {
        await connection.invoke("LeaveBusiness", joinedBusinessRef.current).catch(() => {});
      }
      await connection.invoke("JoinBusiness", currentBusinessId).catch(() => {});
      joinedBusinessRef.current = currentBusinessId;
    })();
  }, [currentBusinessId]);
}
