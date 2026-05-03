import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';

/** The SQLite database file name. */
export const DB_NAME = 'store-manager.db';

/** Singleton database instance (null before initDatabase is called) */
let dbInstance: SQLiteDatabase | null = null;

/**
 * Initialise the database singleton.
 *
 * Opens the SQLite database file, enables WAL mode and foreign keys,
 * then runs any pending migrations.  Safe to call multiple times —
 * subsequent calls are no-ops once the database is open.
 */
export async function initDatabase(): Promise<void> {
  if (dbInstance) {
    return; // Already initialised
  }

  const db = await openDatabaseAsync(DB_NAME);

  // Performance & integrity pragmas
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Run pending schema migrations
  await runMigrations(db);

  dbInstance = db;
}

/**
 * Return the initialised database singleton.
 *
 * @throws {Error} If `initDatabase()` has not been called yet.
 */
export function getDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error(
      'Database not initialised. Call initDatabase() first.',
    );
  }
  return dbInstance;
}
