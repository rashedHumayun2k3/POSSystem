import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryObserver } from "@tanstack/react-query";
import { createQueryClient as createAppQueryClient, pickerKey, invalidatePickerMutation, applyPickerEvent, invalidatePickerResources } from "../src/query/cache.ts";

// Disable collection timers in Node; production keeps inactive queries for 30 minutes.
function createQueryClient() {
  const client = createAppQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, gcTime: Infinity } });
  return client;
}

test("fresh picker data is reused and concurrent opens share one request", async () => {
  const client = createQueryClient();
  let calls = 0;
  const options = { queryKey: pickerKey("products", "shop", "branch", "/products/browse"), queryFn: async () => { calls++; return ["product"]; } };
  try {
    await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
    await client.fetchQuery(options);
    assert.equal(calls, 1);
  } finally { client.clear(); }
});

test("reopening a mounted picker reuses fresh data; invalidation refreshes on next open", async () => {
  const client = createQueryClient();
  let calls = 0;
  const options = { queryKey: pickerKey("customers", "shop", "branch", "/customers"), queryFn: async () => ++calls };
  await client.fetchQuery(options);
  const observer = new QueryObserver(client, { ...options, enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  try {
    observer.setOptions({ ...options, enabled: true });
    assert.equal(calls, 1);
    observer.setOptions({ ...options, enabled: false });
    invalidatePickerMutation(client, "/orders", "POST", "shop");
    assert.equal(calls, 1);
    observer.setOptions({ ...options, enabled: true });
    await client.fetchQuery(options);
    assert.equal(calls, 2);
  } finally { unsubscribe(); client.clear(); }
});

test("stock writes invalidate product lists across branches only in their business", () => {
  const client = createQueryClient();
  const a = pickerKey("products", "shop", "a", "/products/browse");
  const b = pickerKey("products", "shop", "b", "/products/search?q=shoe");
  const other = pickerKey("products", "other", "a", "/products/browse");
  const customers = pickerKey("customers", "shop", "a", "/customers");
  try {
    for (const key of [a, b, other, customers]) client.setQueryData(key, []);
    invalidatePickerMutation(client, "/purchase-trips/1/sessions/2/approve", "POST", "shop");
    assert.equal(client.getQueryState(a).isInvalidated, true);
    assert.equal(client.getQueryState(b).isInvalidated, true);
    assert.equal(client.getQueryState(other).isInvalidated, false);
    assert.equal(client.getQueryState(customers).isInvalidated, false);
  } finally { client.clear(); }
});

test("reads and previews preserve cached lists; order creation refreshes customers and products", () => {
  const client = createQueryClient();
  const keys = [pickerKey("products", "shop"), pickerKey("customers", "shop")];
  try {
    keys.forEach(key => client.setQueryData(key, []));
    invalidatePickerMutation(client, "/products", "GET", "shop");
    invalidatePickerMutation(client, "/products/import/preview", "POST", "shop");
    keys.forEach(key => assert.equal(client.getQueryState(key).isInvalidated, false));
    invalidatePickerMutation(client, "/orders", "POST", "shop");
    keys.forEach(key => assert.equal(client.getQueryState(key).isInvalidated, true));
  } finally { client.clear(); }
});

test("stale data remains available while a background refresh completes", async () => {
  const client = createQueryClient();
  const key = pickerKey("products", "shop");
  let finish;
  try {
    client.setQueryData(key, ["old"], { updatedAt: Date.now() - 6 * 60_000 });
    const request = client.fetchQuery({ queryKey: key, queryFn: () => new Promise(resolve => { finish = resolve; }) });
    assert.deepEqual(client.getQueryData(key), ["old"]);
    finish(["new"]);
    await request;
    assert.deepEqual(client.getQueryData(key), ["new"]);
  } finally { client.clear(); }
});

test("clearing a session aborts pending queries and removes cached data", async () => {
  const client = createQueryClient();
  let signal;
  const pending = client.fetchQuery({ queryKey: pickerKey("customers", "shop"), queryFn: context => { signal = context.signal; return new Promise(() => {}); } }).catch(() => {});
  client.clear();
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(client.getQueryCache().getAll().length, 0);
});

test("live events only invalidate recognized resources in the selected business", () => {
  const client = createQueryClient();
  const products = pickerKey("products", "shop");
  const customers = pickerKey("customers", "shop");
  const other = pickerKey("products", "other");
  try {
    for (const key of [products, customers, other]) client.setQueryData(key, []);
    applyPickerEvent(client, "shop", { businessId: "other", resources: ["products"] });
    assert.equal(client.getQueryState(products).isInvalidated, false);
    applyPickerEvent(client, "shop", { businessId: "shop", resources: ["products", "unknown"] });
    assert.equal(client.getQueryState(products).isInvalidated, true);
    assert.equal(client.getQueryState(customers).isInvalidated, false);
    assert.equal(client.getQueryState(other).isInvalidated, false);
  } finally { client.clear(); }
});

test("a second device event refreshes an open list without a user action", async () => {
  const client = createQueryClient();
  let stock = 5;
  const queryKey = pickerKey("products", "shop", "branch", "/products/browse");
  const options = { queryKey, queryFn: async () => stock };
  await client.fetchQuery(options);
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    stock = 4;
    applyPickerEvent(client, "shop", { businessId: "shop", resources: ["products"] });
    await client.fetchQuery(options);
    assert.equal(client.getQueryData(queryKey), 4);
  } finally { unsubscribe(); client.clear(); }
});

test("reconnect invalidates both resources, including closed search results", () => {
  const client = createQueryClient();
  const keys = [pickerKey("products", "shop", "a", "/products/search?q=shoe"), pickerKey("customers", "shop", "b")];
  try {
    keys.forEach(key => client.setQueryData(key, []));
    invalidatePickerResources(client, "shop");
    keys.forEach(key => assert.equal(client.getQueryState(key).isInvalidated, true));
  } finally { client.clear(); }
});
