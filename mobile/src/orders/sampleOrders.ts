import type { Order } from "./model";
// Fictional preview data, never presented as live business orders.
const stages = ["NEW", "NEW", "NEW", "PROCESSING", "PACKED", "IN_TRANSIT", "DELIVERED", "RETURNED", "CANCELLED"] as const;
const names = ["Ayesha Rahman", "Tanvir Hasan", "Nusrat Jahan", "Imran Ahmed", "Farhana Islam", "Rafiq Ahmed"];
const products = ["Everyday cotton T-shirt", "Classic running shoes", "Canvas shoulder bag", "Sports water bottle"];
const date = (daysAgo: number) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
export const sampleOrders: Order[] = Array.from({ length: 30 }, (_, index) => {
  const stage = stages[index % stages.length];
  const total = [1250, 2890, 1650, 850][index % 4];
  const paid = stage === "DELIVERED";
  return {
    id: `sample-${index + 1}`, orderNo: `DEMO-${String(1030 - index).padStart(4, "0")}`,
    channel: ["FACEBOOK", "WHATSAPP", "INSTAGRAM", "MYWEBSITE", "PHONE", "OTHER"][index % 6],
    customerName: names[index % names.length], customerPhone: "", customerAddress: ["Dhanmondi, Dhaka", "Uttara, Dhaka", "Agrabad, Chattogram"][index % 3],
    orderStatus: stage === "CANCELLED" ? "CANCELLED" : paid ? "COMPLETED" : "OPEN",
    fulfillmentStatus: stage === "NEW" || stage === "PROCESSING" || stage === "CANCELLED" ? "UNFULFILLED" : stage,
    paymentStatus: paid ? "PAID" : stage === "RETURNED" ? "REFUNDED" : index % 2 ? "PARTIALLY_PAID" : "UNPAID",
    isDraft: stage === "NEW", isRevised: index === 3,
    totalAmount: total, dueAmount: paid || stage === "RETURNED" ? 0 : index % 2 ? total - 500 : total,
    businessDate: date(Math.floor(index / 10)),
    handlingUserName: stage !== "NEW" ? "Store team" : undefined,
    trackingNo: stage === "IN_TRANSIT" ? `DEMO-TRACK-${index}` : undefined,
    items: [{ productName: products[index % products.length], variantSku: `SKU-${index % 4 + 1}`, qty: index % 3 + 1, availableStock: index === 1 || index === 10 ? 0 : 15 }],
  };
});

