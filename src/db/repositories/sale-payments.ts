import { getDatabase } from '../connection';

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateSalePaymentData {
  sale_id: number;
  method_id: number;
  amount_usd: number;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve all payments belonging to a given sale.
 */
export async function getBySaleId(saleId: number) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id;',
    [saleId],
  );
}

/**
 * Create a new sale payment and return its new id.
 */
export async function create(data: CreateSalePaymentData) {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO sale_payments (sale_id, method_id, amount_usd) VALUES (?, ?, ?);',
    [data.sale_id, data.method_id, data.amount_usd],
  );
  return result.lastInsertRowId;
}
