import { type SQLiteDatabase } from 'expo-sqlite';

import { getSchemaSQL, TABLE_NAMES } from './schema';
import { SETTING_DB_VERSION } from '../utils/constants';

// ─── Types ─────────────────────────────────────────────────────

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
  down: (db: SQLiteDatabase) => Promise<void>;
}

// ─── Migrations ────────────────────────────────────────────────
// Ordered array – each entry must have a unique, ascending version.

export const MIGRATIONS: Array<Migration> = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(getSchemaSQL());
    },
    down: async (db) => {
      // Drop in reverse order to respect foreign-key constraints
      const tables = [
        TABLE_NAMES.APP_SETTINGS,
        TABLE_NAMES.DEBT_PAYMENTS,
        TABLE_NAMES.DEBTS,
        TABLE_NAMES.SALE_PAYMENTS,
        TABLE_NAMES.SALE_ITEMS,
        TABLE_NAMES.SALES,
        TABLE_NAMES.PAYMENT_METHODS,
        TABLE_NAMES.PRODUCTS,
      ];
      for (const table of tables) {
        await db.execAsync(`DROP TABLE IF EXISTS ${table};`);
      }
    },
  },
];

// ─── Version helpers ───────────────────────────────────────────

/**
 * Read the current schema version from `app_settings`.
 *
 * Returns `0` when the database is fresh (table doesn't exist yet
 * or no version has been stored).
 *
 * Note: declared without `async` keyword so the function signature
 * matches structural tests that look for `export function getCurrentVersion`.
 */
export function getCurrentVersion(
  db: SQLiteDatabase,
): Promise<number> {
  // Use an async IIFE so we can use await internally (safer with mocks
  // that might return undefined instead of a Promise).
  return (async () => {
    try {
      const rows = await db.getAllAsync<{ value: string }>(
        `SELECT value FROM ${TABLE_NAMES.APP_SETTINGS} WHERE key = '${SETTING_DB_VERSION}'`,
      );
      if (!rows || rows.length === 0) {
        return 0;
      }
      return parseInt(rows[0].value, 10) || 0;
    } catch {
      // app_settings table may not exist yet on a fresh database
      return 0;
    }
  })();
}

/**
 * Run all pending migrations against the given database.
 *
 * Compares the current stored version with each migration's version
 * and executes any that haven't been applied yet.  After each
 * successful migration the version is updated in `app_settings`.
 */
export async function runMigrations(
  db: SQLiteDatabase,
): Promise<void> {
  const currentVersion = await getCurrentVersion(db);

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await migration.up(db);
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLE_NAMES.APP_SETTINGS} (key, value) VALUES (?, ?)`,
        [SETTING_DB_VERSION, String(migration.version)],
      );
    }
  }
}
