import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

// Native-only (guarded by isNativeApp() at every call site) — one shared SQLite database for the
// whole offline layer: the product catalog cache AND the offline sales queue live in the same
// file, rather than juggling two separate local storage mechanisms the way the web fallback
// (Dexie) does on its own.
const DB_NAME = 'reseller_offline';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let dbPromise: Promise<SQLiteDBConnection> | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS product_cache (
    variantId TEXT PRIMARY KEY,
    productId TEXT,
    productName TEXT,
    variantSku TEXT,
    barcode TEXT,
    sellingPrice REAL,
    imageUrl TEXT,
    unitCode TEXT,
    variantValuesJson TEXT,
    stock REAL,
    avgLandedCost REAL,
    marketPrice REAL,
    wholesaleMinQty REAL,
    wholesaleUnitPrice REAL,
    categoryId TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_product_cache_barcode ON product_cache(barcode);
  CREATE INDEX IF NOT EXISTS idx_product_cache_name ON product_cache(productName);
  CREATE INDEX IF NOT EXISTS idx_product_cache_category ON product_cache(categoryId);

  CREATE TABLE IF NOT EXISTS catalog_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS category_cache (
    id TEXT PRIMARY KEY,
    name TEXT,
    nameBn TEXT,
    parentCategoryId TEXT
  );

  CREATE TABLE IF NOT EXISTS customer_cache (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    address TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_customer_cache_name ON customer_cache(name);
  CREATE INDEX IF NOT EXISTS idx_customer_cache_phone ON customer_cache(phone);

  CREATE TABLE IF NOT EXISTS offline_sales (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    customerName TEXT,
    customerPhone TEXT,
    itemsJson TEXT NOT NULL,
    discountType TEXT,
    discountValue REAL,
    note TEXT,
    method TEXT NOT NULL,
    paidAmount REAL NOT NULL,
    total REAL NOT NULL,
    businessDate TEXT,
    createdAt INTEGER NOT NULL,
    status TEXT NOT NULL,
    orderId TEXT,
    paid INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    lastError TEXT
  );
`;

// CREATE TABLE IF NOT EXISTS never touches a table that already exists, so a device that installed
// the app before these columns existed needs them added by hand. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so each ALTER is just attempted and its failure (column already
// present) is swallowed.
async function addMissingColumns(db: SQLiteDBConnection): Promise<void> {
  const alters = [
    'ALTER TABLE product_cache ADD COLUMN categoryId TEXT;',
    'ALTER TABLE offline_sales ADD COLUMN businessDate TEXT;',
  ];
  for (const sql of alters) {
    try {
      await db.execute(sql);
    } catch {
      // already has the column
    }
  }
}

async function openDb(): Promise<SQLiteDBConnection> {
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = isConn
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute(SCHEMA);
  await addMissingColumns(db);
  return db;
}

// Lazily opened once, reused for the lifetime of the app — every caller awaits the same promise
// rather than racing multiple createConnection calls against the same database name.
export function getLocalDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}
