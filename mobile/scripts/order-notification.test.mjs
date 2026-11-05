import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrderNotification } from "../src/notifications/model.ts";

const id = "11111111-2222-4333-8444-555555555555";
const valid = { type: "NEW_ORDER", notificationId: id, orderId: id, businessId: id, recipientId: id, branchId: null };
test("accepts an order notification with validated identifiers", () => {
  assert.deepEqual(parseOrderNotification(valid), valid);
  assert.equal(parseOrderNotification({ ...valid, branchId: id }).branchId, id);
});
test("rejects arbitrary URLs, missing recipient and malformed payloads", () => {
  for (const payload of [null, "text", {}, { ...valid, type: "TASK" }, { ...valid, recipientId: undefined },
    { ...valid, orderId: "https://example.com" }, { ...valid, businessId: "../other" }, { ...valid, branchId: "wrong" }]) {
    assert.equal(parseOrderNotification(payload), null);
  }
});
test("ignores an injected navigation path", () => {
  assert.deepEqual(parseOrderNotification({ ...valid, url: "https://example.com", route: "/admin" }), valid);
});
