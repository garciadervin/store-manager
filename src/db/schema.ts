// ─── Table name constants ──────────────────────────────────────
// Keys are used throughout the codebase to reference tables by name.

export const TABLE_NAMES = {
  PRODUCTS: 'products',
  PAYMENT_METHODS: 'payment_methods',
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  SALE_PAYMENTS: 'sale_payments',
  DEBTS: 'debts',
  DEBT_PAYMENTS: 'debt_payments',
  APP_SETTINGS: 'app_settings',
} as const;

// ─── Individual CREATE TABLE SQL builders ──────────────────────

function getProductsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PRODUCTS} (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  category    TEXT,
  price_usd   REAL    NOT NULL CHECK(price_usd >= 0),
  stock_qty   INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
  unit_type   TEXT    NOT NULL DEFAULT 'unit',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_name ON ${TABLE_NAMES.PRODUCTS}(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON ${TABLE_NAMES.PRODUCTS}(category);`;
}

function getPaymentMethodsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PAYMENT_METHODS} (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  label        TEXT    NOT NULL,
  instructions TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);`;
}

function getSalesSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SALES} (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
  total_usd   REAL    NOT NULL CHECK(total_usd >= 0),
  total_ves   REAL    NOT NULL CHECK(total_ves >= 0),
  rate_value  REAL    NOT NULL CHECK(rate_value > 0),
  rate_source TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','refunded')),
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON ${TABLE_NAMES.SALES}(timestamp);`;
}

function getSaleItemsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SALE_ITEMS} (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id        INTEGER NOT NULL REFERENCES ${TABLE_NAMES.SALES}(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES ${TABLE_NAMES.PRODUCTS}(id) ON DELETE SET NULL,
  product_name   TEXT    NOT NULL,
  quantity       INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_usd REAL    NOT NULL CHECK(unit_price_usd >= 0),
  subtotal_usd   REAL    NOT NULL CHECK(subtotal_usd >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON ${TABLE_NAMES.SALE_ITEMS}(sale_id);`;
}

function getSalePaymentsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.SALE_PAYMENTS} (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id   INTEGER NOT NULL REFERENCES ${TABLE_NAMES.SALES}(id) ON DELETE CASCADE,
  method_id INTEGER NOT NULL REFERENCES ${TABLE_NAMES.PAYMENT_METHODS}(id),
  amount_usd REAL   NOT NULL CHECK(amount_usd > 0),
  created_at TEXT   NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON ${TABLE_NAMES.SALE_PAYMENTS}(sale_id);`;
}

function getDebtsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.DEBTS} (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id          INTEGER REFERENCES ${TABLE_NAMES.SALES}(id) ON DELETE SET NULL,
  customer_name    TEXT    NOT NULL,
  customer_phone   TEXT,
  total_amount_usd REAL    NOT NULL CHECK(total_amount_usd >= 0),
  balance_due_usd  REAL    NOT NULL CHECK(balance_due_usd >= 0),
  status           TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','settled')),
  notes            TEXT,
  last_contact_date TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_debts_status ON ${TABLE_NAMES.DEBTS}(status);
CREATE INDEX IF NOT EXISTS idx_debts_customer ON ${TABLE_NAMES.DEBTS}(customer_name);`;
}

function getDebtPaymentsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.DEBT_PAYMENTS} (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id      INTEGER NOT NULL REFERENCES ${TABLE_NAMES.DEBTS}(id) ON DELETE CASCADE,
  amount_usd   REAL    NOT NULL CHECK(amount_usd > 0),
  payment_date TEXT    NOT NULL DEFAULT (datetime('now')),
  method_id    INTEGER REFERENCES ${TABLE_NAMES.PAYMENT_METHODS}(id),
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON ${TABLE_NAMES.DEBT_PAYMENTS}(debt_id);`;
}

function getAppSettingsSQL(): string {
  return `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.APP_SETTINGS} (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;
}

// ─── Table SQL registry ────────────────────────────────────────
// Maps table names to their CREATE TABLE SQL.  Used by getCreateTableSQL.

const TABLE_SQL_REGISTRY: Record<string, () => string> = {
  [TABLE_NAMES.PRODUCTS]: getProductsSQL,
  [TABLE_NAMES.PAYMENT_METHODS]: getPaymentMethodsSQL,
  [TABLE_NAMES.SALES]: getSalesSQL,
  [TABLE_NAMES.SALE_ITEMS]: getSaleItemsSQL,
  [TABLE_NAMES.SALE_PAYMENTS]: getSalePaymentsSQL,
  [TABLE_NAMES.DEBTS]: getDebtsSQL,
  [TABLE_NAMES.DEBT_PAYMENTS]: getDebtPaymentsSQL,
  [TABLE_NAMES.APP_SETTINGS]: getAppSettingsSQL,
};

// ─── Public API ────────────────────────────────────────────────

/**
 * Return a single SQL string containing all CREATE TABLE IF NOT EXISTS
 * statements (with indexes) for every table in the schema.
 */
export function getSchemaSQL(): string {
  const statements = Object.values(TABLE_SQL_REGISTRY).map((fn) => fn());
  return statements.join('\n\n');
}

/**
 * Return the CREATE TABLE IF NOT EXISTS SQL for a specific table.
 *
 * @param tableName - One of the values from `TABLE_NAMES`.
 * @returns The SQL string for the requested table.
 * @throws {Error} If the table name is unknown or empty.
 */
export function getCreateTableSQL(tableName: string): string {
  if (!tableName) {
    throw new Error('Table name is required');
  }

  const builder = TABLE_SQL_REGISTRY[tableName];
  if (!builder) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  return builder();
}
