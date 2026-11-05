import { QueryClient } from "@tanstack/react-query";

export const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 1 } },
});

export type CacheResource = "products" | "customers";
export const pickerKey = (resource: CacheResource, businessId?: string, branchId?: string, path = "") =>
  ["picker", resource, businessId ?? null, branchId ?? null, path] as const;

export function invalidatePickerResources(client: QueryClient, businessId: string, resources: readonly CacheResource[] = ["products", "customers"]) {
  for (const resource of resources) {
    void client.invalidateQueries({ queryKey: ["picker", resource, businessId] });
  }
}

export function applyPickerEvent(client: QueryClient, businessId: string, event: { businessId?: string; resources?: unknown }) {
  if (event?.businessId !== businessId || !Array.isArray(event.resources)) return;
  invalidatePickerResources(client, businessId, event.resources.filter((value): value is CacheResource => value === "products" || value === "customers"));
}

// All writes use AuthContext.api, including inline customer creation by orders.
// Invalidate across branches because product/customer edits can affect the whole business.
export function invalidatePickerMutation(client: QueryClient, path: string, method: string, businessId?: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return;
  if (/\/(preview|receipt\/send|barcode-labels\/batch(?:\/send)?)\/?(?:\?|$)/.test(path)) return;
  const resource = path.split("?")[0].split("/")[1];
  const affected: CacheResource[] = [];
  if (["products", "categories", "purchase-trips", "orders", "supplier-returns", "cartons"].includes(resource)) affected.push("products");
  if (["customers", "orders"].includes(resource)) affected.push("customers");
  for (const name of affected) {
    void client.invalidateQueries({ queryKey: ["picker", name, businessId ?? null] });
  }
}
