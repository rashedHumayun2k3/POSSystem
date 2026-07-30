import { useEffect } from 'react';
import { getLocalDb } from './sqliteClient';
import { browseProducts, searchProducts, lookupBarcode, getCategories, getActiveCategories, getTodaySoldByVariant } from '../catalogApi';
import { getCustomerCache, searchCustomers } from '../ordersApi';
import { isNetworkError } from '../networkError';
import { isNativeApp } from '../platform';
import type { ProductSearchResult } from '@/types/catalog';
import type { CustomerCacheEntry, CustomerSummary } from '@/types/orders';

// Row → ProductSearchResult is a 1:1 field mapping deliberately, so ProductPicker/CartPanel don't
// need to know or care whether a result came from the live API or the local cache.
function rowToResult(row: Record<string, unknown>): ProductSearchResult {
  return {
    productId: row.productId as string,
    variantId: row.variantId as string,
    productName: row.productName as string,
    variantSku: row.variantSku as string,
    barcode: row.barcode as string,
    sellingPrice: row.sellingPrice as number,
    imageUrl: (row.imageUrl as string) ?? null,
    unitCode: (row.unitCode as string) ?? null,
    variantValuesJson: row.variantValuesJson as string,
    stock: row.stock as number,
    avgLandedCost: row.avgLandedCost as number,
    marketPrice: (row.marketPrice as number) ?? null,
    wholesaleMinQty: (row.wholesaleMinQty as number) ?? null,
    wholesaleUnitPrice: (row.wholesaleUnitPrice as number) ?? null,
    categoryId: row.categoryId as string,
  };
}

function rowToCustomer(row: Record<string, unknown>): CustomerCacheEntry {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    address: (row.address as string) ?? null,
  };
}

// Full replace, not an incremental diff — the server is the only source of truth for the catalog
// (the local copy is a read-only cache, never written to independently), and a reseller's catalog
// is small enough (BrowseAsync itself caps at 500 variants) that a delete-and-reinsert on every
// refresh is simpler and safer than reconciling adds/updates/removes/price-changes separately.
export async function syncCatalogFromServer(): Promise<number> {
  const products = await browseProducts(undefined, false);
  const db = await getLocalDb();

  await db.execute('DELETE FROM product_cache;');
  await db.execute('BEGIN TRANSACTION;');
  try {
    for (const p of products) {
      await db.run(
        `INSERT INTO product_cache
          (variantId, productId, productName, variantSku, barcode, sellingPrice, imageUrl, unitCode,
           variantValuesJson, stock, avgLandedCost, marketPrice, wholesaleMinQty, wholesaleUnitPrice, categoryId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.variantId, p.productId, p.productName, p.variantSku, p.barcode, p.sellingPrice,
          p.imageUrl, p.unitCode, p.variantValuesJson, p.stock, p.avgLandedCost,
          p.marketPrice, p.wholesaleMinQty, p.wholesaleUnitPrice, p.categoryId,
        ]
      );
    }
    await db.run('INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)', ['lastSyncedAt', String(Date.now())]);
    await db.execute('COMMIT;');
  } catch (err) {
    await db.execute('ROLLBACK;');
    throw err;
  }
  return products.length;
}

// Same full replace approach as syncCatalogFromServer — categories/customers are small lists for a
// reseller business, so delete-and-reinsert is simpler than reconciling diffs.
export async function syncCategoriesFromServer(): Promise<number> {
  const categories = await getCategories();
  const db = await getLocalDb();

  await db.execute('DELETE FROM category_cache;');
  await db.execute('BEGIN TRANSACTION;');
  try {
    for (const c of categories) {
      await db.run(
        `INSERT INTO category_cache (id, name, nameBn, parentCategoryId) VALUES (?, ?, ?, ?)`,
        [c.id, c.name, c.nameBn ?? null, c.parentCategoryId ?? null]
      );
    }
    await db.execute('COMMIT;');
  } catch (err) {
    await db.execute('ROLLBACK;');
    throw err;
  }
  return categories.length;
}

export async function syncCustomersFromServer(): Promise<number> {
  const customers = await getCustomerCache();
  const db = await getLocalDb();

  await db.execute('DELETE FROM customer_cache;');
  await db.execute('BEGIN TRANSACTION;');
  try {
    for (const c of customers) {
      await db.run(
        `INSERT INTO customer_cache (id, name, phone, address) VALUES (?, ?, ?, ?)`,
        [c.id, c.name, c.phone, c.address]
      );
    }
    await db.execute('COMMIT;');
  } catch (err) {
    await db.execute('ROLLBACK;');
    throw err;
  }
  return customers.length;
}

// Stored under catalog_meta alongside its own business-date stamp — a cached "sold today" map is
// only meaningful for the day it was captured on. If the cached date isn't today (e.g. the device
// was offline overnight and never got a fresh snapshot), the fallback returns empty rather than
// showing yesterday's numbers as if they were today's.
export async function syncTodaySoldFromServer(): Promise<void> {
  const sold = await getTodaySoldByVariant();
  const db = await getLocalDb();
  await db.run('INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)', ['todaySold', JSON.stringify(sold)]);
  await db.run('INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)', ['todaySoldDate', todayStr()]);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getLocalTodaySold(): Promise<Record<string, number>> {
  const db = await getLocalDb();
  const result = await db.query('SELECT key, value FROM catalog_meta WHERE key IN (?, ?)', ['todaySold', 'todaySoldDate']);
  const rows = result.values ?? [];
  const cachedDate = rows.find((r) => r.key === 'todaySoldDate')?.value as string | undefined;
  if (cachedDate !== todayStr()) return {};
  const raw = rows.find((r) => r.key === 'todaySold')?.value as string | undefined;
  return raw ? JSON.parse(raw) : {};
}

// Native only, live-first — falls back to the last-synced "sold today" snapshot on a network
// error. That snapshot won't include sales made during the current offline stretch itself; callers
// combine this with their own session-local tally for that (see hawker/night-entry's
// sessionSoldDelta) rather than this module trying to track per-page session state.
export async function getTodaySoldWithFallback(): Promise<Record<string, number>> {
  if (!isNativeApp()) return getTodaySoldByVariant();
  try {
    return await getTodaySoldByVariant();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return getLocalTodaySold();
  }
}

export async function searchLocalCustomers(q: string): Promise<CustomerCacheEntry[]> {
  const db = await getLocalDb();
  const like = `%${q}%`;
  const result = await db.query(
    `SELECT * FROM customer_cache WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 50`,
    [like, like]
  );
  return (result.values ?? []).map(rowToCustomer);
}

export async function getLocalCatalogLastSynced(): Promise<number | null> {
  const db = await getLocalDb();
  const result = await db.query('SELECT value FROM catalog_meta WHERE key = ?', ['lastSyncedAt']);
  const raw = result.values?.[0]?.value;
  return raw ? Number(raw) : null;
}

export async function getLocalCatalogCount(): Promise<number> {
  const db = await getLocalDb();
  const result = await db.query('SELECT COUNT(*) as cnt FROM product_cache');
  return (result.values?.[0]?.cnt as number) ?? 0;
}

export async function searchLocalCatalog(q: string): Promise<ProductSearchResult[]> {
  const db = await getLocalDb();
  const like = `%${q}%`;
  const result = await db.query(
    `SELECT * FROM product_cache
     WHERE productName LIKE ? OR variantSku LIKE ? OR barcode LIKE ?
     ORDER BY productName LIMIT 50`,
    [like, like, like]
  );
  return (result.values ?? []).map(rowToResult);
}

export async function lookupLocalBarcode(barcode: string): Promise<ProductSearchResult | null> {
  const db = await getLocalDb();
  const result = await db.query('SELECT * FROM product_cache WHERE barcode = ? LIMIT 1', [barcode]);
  const row = result.values?.[0];
  return row ? rowToResult(row) : null;
}

export async function browseLocalCatalog(categoryId?: string): Promise<ProductSearchResult[]> {
  const db = await getLocalDb();
  const result = categoryId
    ? await db.query('SELECT * FROM product_cache WHERE categoryId = ? ORDER BY productName', [categoryId])
    : await db.query('SELECT * FROM product_cache ORDER BY productName');
  return (result.values ?? []).map(rowToResult);
}

// ── Live-first, cache-as-fallback wrappers ──────────────────────────────────────
// Native only, and only falls back on an actual network error — a real 404/business rejection
// from the live call still surfaces normally. Prefers live data whenever it's reachable (freshest
// stock/price), only reaching for the cache when the request can't reach the server at all.

export async function searchProductsWithFallback(q: string, onlyInStock = false): Promise<ProductSearchResult[]> {
  if (!isNativeApp()) return searchProducts(q, onlyInStock);
  try {
    return await searchProducts(q, onlyInStock);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const local = await searchLocalCatalog(q);
    return onlyInStock ? local.filter((p) => p.stock > 0) : local;
  }
}

export async function lookupBarcodeWithFallback(barcode: string): Promise<ProductSearchResult> {
  if (!isNativeApp()) return lookupBarcode(barcode);
  try {
    return await lookupBarcode(barcode);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const local = await lookupLocalBarcode(barcode);
    if (!local) throw err; // no cached match either — surface the original network error
    return local;
  }
}

export async function browseProductsWithFallback(categoryId?: string, onlyInStock = false): Promise<ProductSearchResult[]> {
  if (!isNativeApp()) return browseProducts(categoryId, onlyInStock);
  try {
    return await browseProducts(categoryId, onlyInStock);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const local = await browseLocalCatalog(categoryId);
    return onlyInStock ? local.filter((p) => p.stock > 0) : local;
  }
}

// Native only, live-first — falls back to categories derived straight from the cached products
// (distinct categoryId values still present in product_cache, joined against category_cache for
// display names) rather than the full category_cache list, so the offline chip row only ever
// shows categories that actually have something to sell right now — matching what
// getActiveCategories means online ("has ≥1 active product").
export async function getActiveCategoriesWithFallback(): Promise<{ id: string; name: string }[]> {
  if (!isNativeApp()) return getActiveCategories();
  try {
    return await getActiveCategories();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const db = await getLocalDb();
    const result = await db.query(
      `SELECT DISTINCT cc.id as id, cc.name as name
       FROM category_cache cc
       INNER JOIN product_cache pc ON pc.categoryId = cc.id
       ORDER BY cc.name`
    );
    return (result.values ?? []).map((row) => ({ id: row.id as string, name: row.name as string }));
  }
}

// Fallback rows carry only what customer_cache stores (GTR-10: STAFF/offline never gets
// financial fields — no balance/order-history is cached on-device), zero-filled into
// CustomerSummary's shape so CustomerPickerSlide
// doesn't need a separate offline type: the risk/balance badges just don't show for a customer
// picked up during an outage, which is honest — that data genuinely isn't known offline.
function cacheEntryToSummary(c: CustomerCacheEntry): CustomerSummary {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address ?? undefined,
    creditLimit: 0,
    storeCreditBalance: 0,
    isSerialRejecter: false,
    recentReturnCount: 0,
    recentOrderCount: 0,
    orderCount: 0,
    returnCount: 0,
    lastOrderAt: null,
    unpaidBalance: 0,
  };
}

export async function searchCustomersWithFallback(q: string): Promise<CustomerSummary[]> {
  if (!isNativeApp()) return searchCustomers(q);
  try {
    return await searchCustomers(q);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const local = await searchLocalCustomers(q);
    return local.map(cacheEntryToSummary);
  }
}

const CATALOG_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Native only — keeps the local catalog/category/customer caches fresh automatically: once when
// the POS screen mounts, again whenever connectivity returns, and every 5 minutes while online in
// between. Each sync runs independently (Promise.allSettled) so one failing (e.g. a transient
// error on the customer list) doesn't block the others. Silently skipped if offline at trigger
// time (nothing to sync against — whatever's already cached keeps serving
// lookupBarcodeWithFallback/searchProductsWithFallback/browseProductsWithFallback/
// getActiveCategoriesWithFallback/searchCustomersWithFallback in the meantime) and is a no-op on
// the web build entirely.
export function useCatalogAutoSync(): void {
  useEffect(() => {
    if (!isNativeApp()) return;

    const trySync = () => {
      if (!navigator.onLine) return;
      Promise.allSettled([
        syncCatalogFromServer(),
        syncCategoriesFromServer(),
        syncCustomersFromServer(),
        syncTodaySoldFromServer(),
      ]);
    };

    trySync();
    window.addEventListener('online', trySync);
    const interval = setInterval(trySync, CATALOG_SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', trySync);
      clearInterval(interval);
    };
  }, []);
}
