import { getDatabase } from '../connection';

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateDebtPaymentData {
  debt_id: number;
  amount_usd: number;
  method_id?: number | null;
  notes?: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve all payments belonging to a given debt.
 */
export async function getByDebtId(debtId: number) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY payment_date;',
    [debtId],
  );
}

/**
 * Create a new debt payment and return its new id.
 */
export async function create(data: CreateDebtPaymentData) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO debt_payments (debt_id, amount_usd, method_id, notes)
     VALUES (?, ?, ?, ?);`,
    [data.debt_id, data.amount_usd, data.method_id ?? null, data.notes ?? null],
  );
  return result.lastInsertRowId;
}
