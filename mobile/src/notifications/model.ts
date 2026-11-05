export const orderNotificationRoles = ["OWNER", "MANAGER", "PARTNER", "STAFF", "WAREHOUSE"];
export type OrderNotification = { id: string; orderId: string; orderNo: string; businessId: string; branchId: string | null; createdAt: string; readAt: string | null };
export type OrderNotificationList = { unread: number; total: number; items: OrderNotification[] };
type OrderPush = { type: "NEW_ORDER"; notificationId: string; orderId: string; businessId: string; branchId: string | null; recipientId: string };
const guid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function parseOrderNotification(value: unknown): OrderPush | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.type !== "NEW_ORDER" || !guid(data.notificationId) || !guid(data.orderId) || !guid(data.businessId) || !guid(data.recipientId) ||
      (data.branchId != null && !guid(data.branchId))) return null;
  return { type: "NEW_ORDER", notificationId: data.notificationId, orderId: data.orderId, businessId: data.businessId, recipientId: data.recipientId, branchId: data.branchId as string | null ?? null };
}
