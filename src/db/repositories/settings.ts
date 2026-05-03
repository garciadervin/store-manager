import { getDatabase } from '../connection';

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve a single setting by its key.
 */
export async function getSetting(key: string) {
  const db = getDatabase();
  return db.getFirstAsync(
    'SELECT * FROM app_settings WHERE key = ?;',
    [key],
  );
}

/**
 * Set (insert or replace) a setting value.
 * Returns the runAsync result.
 */
export async function setSetting(key: string, value: string) {
  const db = getDatabase();
  return db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
    [key, value],
  );
}

/**
 * Retrieve all settings.
 */
export async function getAllSettings() {
  const db = getDatabase();
  return db.getAllAsync('SELECT * FROM app_settings ORDER BY key;');
}

/**
 * Delete a setting by its key.  Returns the number of deleted rows.
 */
export async function deleteSetting(key: string) {
  const db = getDatabase();
  const result = await db.runAsync(
    'DELETE FROM app_settings WHERE key = ?;',
    [key],
  );
  return result.changes;
}
