import test from "node:test";
import assert from "node:assert/strict";
import { productPayment, legacyProductKey } from "./purchasePayments.ts";
const items = [{ id: "a", totalCost: 300 }, { id: "b", totalCost: 400 }];
test("payment of one product does not mark another as paid", () => {
 const payment = { purchaseItemId: "a", costKey: "a", amount: 300 };
 assert.equal(productPayment(items[0], items, [payment]), payment);
 assert.equal(productPayment(items[1], items, [payment]), undefined);
});
test("common cost payments do not count as product payments", () => {
 assert.equal(productPayment(items[0], items, [{ costKey: "cost", amount: 300 }]), undefined);
});
test("historical aggregate payment displays line shares without double counting", () => {
 const payments = [{ costKey: legacyProductKey, amount: 700 }];
 assert.equal(items.reduce((sum, item) => sum + productPayment(item, items, payments).amount, 0), 700);
 assert.equal(productPayment(items[0], items, [{ costKey: legacyProductKey, amount: 600 }]), undefined);
});
