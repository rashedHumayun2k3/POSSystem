import { colors } from "../theme";

// Same list contract and queue rules as frontend/src/components/orders/OrderManagement.tsx.
export type Order = {
  id: string; orderNo: string; channel: string; customerName: string;
  customerPhone: string; customerAddress?: string;
  orderStatus: "OPEN" | "COMPLETED" | "CANCELLED";
  fulfillmentStatus: "UNFULFILLED" | "PACKED" | "IN_TRANSIT" | "DELIVERED" | "RETURNED";
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "REFUNDED";
  isDraft: boolean; isRevised: boolean; totalAmount: number; dueAmount: number;
  businessDate: string; handlingUserName?: string; trackingNo?: string;
  items: { productName: string; variantSku: string; qty: number; availableStock: number }[];
};
export const queues = [
  { key: "ALL", label: "All", color: colors.heading, bg: colors.card, hint: "Orders grouped by status, newest first in each section" },
  { key: "UNFULFILLED", label: "New", color: colors.primaryDark, bg: colors.cardSecondary, hint: "Review and confirm new orders" },
  { key: "PROCESSING", label: "Processing", color: colors.primary, bg: colors.primaryLight, hint: "Confirmed orders ready to prepare and hand over" },
  { key: "WAITING_COURIER", label: "Waiting for Courier", color: colors.warningText, bg: colors.warningBackground, hint: "Packed orders ready for courier handover" },
  { key: "PENDING", label: "In Transit", color: colors.infoText, bg: colors.infoBackground, hint: "Track shipments and confirm delivery" },
  { key: "DELIVERED", label: "Delivered", color: colors.successText, bg: colors.successBackground, hint: "Completed deliveries and payment follow-up" },
  { key: "RETURNED", label: "Returned", color: colors.primaryDark, bg: colors.cardSecondary, hint: "Review returned orders" },
  { key: "CANCELLED", label: "Cancelled", color: colors.neutralIcon, bg: colors.disabled, hint: "Cancelled order history" },
  { key: "ISSUES", label: "Issues", color: colors.dangerText, bg: colors.dangerBackground, hint: "Resolve stock shortages before confirming orders" },
] as const;
export type Queue = typeof queues[number]["key"];
export const emptyFilters = { from: "", to: "", customer: "", product: "", channel: "" };
export type Filters = typeof emptyFilters;
export const channels = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "MYWEBSITE", "PHONE", "OTHER"];
export const channelLabel = (value: string) => value === "MYWEBSITE" ? "Website" : value.charAt(0) + value.slice(1).toLowerCase();
export const money = (amount: number) => `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
export const hasStockIssue = (order: Order) => order.isDraft && order.orderStatus !== "CANCELLED" && order.items.some(item => item.availableStock < item.qty);
export function queueFor(order: Order): Queue {
  if (order.orderStatus === "CANCELLED") return "CANCELLED";
  if (order.isDraft) return "UNFULFILLED";
  if (order.fulfillmentStatus === "UNFULFILLED") return "PROCESSING";
  if (order.fulfillmentStatus === "PACKED") return "WAITING_COURIER";
  if (order.fulfillmentStatus === "IN_TRANSIT") return "PENDING";
  return order.fulfillmentStatus;
}
export function matchesQueue(order: Order, queue: Queue) {
  return queue === "ALL" || (queue === "ISSUES" ? hasStockIssue(order) : queueFor(order) === queue);
}
export function filterOrders(orders: Order[], search: string, filters: Filters) {
  const includes = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase());
  return orders.filter(order => {
    const customer = `${order.customerName} ${order.customerPhone}`;
    const products = order.items.map(item => `${item.productName} ${item.variantSku}`).join(" ");
    return includes(`${order.orderNo} ${customer} ${products}`, search)
      && includes(customer, filters.customer) && includes(products, filters.product)
      && (!filters.channel || order.channel === filters.channel)
      && (!filters.from || order.businessDate >= filters.from)
      && (!filters.to || order.businessDate <= filters.to);
  }).sort((a, b) => b.businessDate.localeCompare(a.businessDate) || b.orderNo.localeCompare(a.orderNo));
}
export function groupOrders(orders: Order[], queue: Queue) {
  const sections = queue === "ALL" ? queues.filter(item => item.key !== "ALL" && item.key !== "ISSUES") : queues.filter(item => item.key === queue);
  return sections.flatMap(section => {
    const grouped = new Map<string, Order[]>();
    for (const order of orders.filter(item => matchesQueue(item, section.key))) {
      grouped.set(order.businessDate, [...(grouped.get(order.businessDate) ?? []), order]);
    }
    return [...grouped.entries()].map(([date, items], index) => ({ key: `${section.key}-${date}`, date, items, title: queue === "ALL" && index === 0 ? `${section.label} orders` : undefined }));
  });
}
export function validDate(value: string) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

