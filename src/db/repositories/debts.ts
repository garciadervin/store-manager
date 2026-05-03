import { getDatabase } from '../connection';

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateDebtData {
  customer_name: string;
  total_amount_usd: number;
  sale_id?: number | null;
  customer_phone?: string | null;
  notes?: string | null;
}

export interface DebtUpdateData {
  customer_name?: string;
  customer_phone?: string | null;
  total_amount_usd?: number;
  balance_due_usd?: number;
  status?: 'pending' | 'partial' | 'settled';
  notes?: string | null;
  last_contact_date?: string | null;
}

export interface AddDebtPaymentData {
  debt_id: number;
  amount_usd: number;
  method_id?: number | null;
  notes?: string | null;
}

export interface DebtSummary {
  total_outstanding: number;
  total_pending: number;
  total_partial: number;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve all debts, ordered by created_at descending.
 */
export async function getAll() {
  const db = getDatabase();
  return db.getAllAsync('SELECT * FROM debts ORDER BY created_at DESC;');
}

/**
 * Retrieve a single debt by its id.
 */
export async function getById(id: number) {
  const db = getDatabase();
  return db.getFirstAsync('SELECT * FROM debts WHERE id = ?;', [id]);
}

/**
 * Retrieve debts filtered by status.
 */
export async function getByStatus(status: string) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM debts WHERE status = ? ORDER BY created_at DESC;',
    [status],
  );
}

/**
 * Retrieve debts for a specific customer.
 */
export async function getByCustomer(customerName: string) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM debts WHERE customer_name = ? ORDER BY created_at DESC;',
    [customerName],
  );
}

/**
 * Create a new debt and return its new id.
 */
export async function create(data: CreateDebtData) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO debts (customer_name, total_amount_usd, balance_due_usd, sale_id, customer_phone, notes)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      data.customer_name,
      data.total_amount_usd,
      data.total_amount_usd, // initial balance equals total
      data.sale_id ?? null,
      data.customer_phone ?? null,
      data.notes ?? null,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * Update an existing debt.  Only the supplied fields are changed.
 * Returns the number of affected rows.
 */
export async function update(id: number, data: DebtUpdateData) {
  const db = getDatabase();

  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.customer_name !== undefined) {
    sets.push('customer_name = ?');
    params.push(data.customer_name);
  }
  if (data.customer_phone !== undefined) {
    sets.push('customer_phone = ?');
    params.push(data.customer_phone);
  }
  if (data.total_amount_usd !== undefined) {
    sets.push('total_amount_usd = ?');
    params.push(data.total_amount_usd);
  }
  if (data.balance_due_usd !== undefined) {
    sets.push('balance_due_usd = ?');
    params.push(data.balance_due_usd);
  }
  if (data.status !== undefined) {
    sets.push('status = ?');
    params.push(data.status);
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?');
    params.push(data.notes);
  }
  if (data.last_contact_date !== undefined) {
    sets.push('last_contact_date = ?');
    params.push(data.last_contact_date);
  }

  if (sets.length === 0) {
    return 0;
  }

  sets.push("updated_at = datetime('now')");
  params.push(id);

  const result = await db.runAsync(
    `UPDATE debts SET ${sets.join(', ')} WHERE id = ?;`,
    params,
  );
  return result.changes;
}

/**
 * Add a payment to a debt and update the balance_due.
 * Auto-updates the debt status:
 *   - If balance_due becomes 0 → 'settled'
 *   - If balance_due is less than total → 'partial'
 *   - Otherwise stays 'pending'
 * Returns the new debt payment id.
 */
export async function addDebtPayment(data: AddDebtPaymentData) {
  const db = getDatabase();

  try {
    await db.execAsync('BEGIN TRANSACTION;');

    // Insert the debt payment
    const paymentResult = await db.runAsync(
      `INSERT INTO debt_payments (debt_id, amount_usd, method_id, notes)
       VALUES (?, ?, ?, ?);`,
      [data.debt_id, data.amount_usd, data.method_id ?? null, data.notes ?? null],
    );
    const paymentId = paymentResult.lastInsertRowId;

    // Update balance_due
    await db.runAsync(
      `UPDATE debts
       SET balance_due_usd = balance_due_usd - ?,
           updated_at = datetime('now')
       WHERE id = ?;`,
      [data.amount_usd, data.debt_id],
    );

    // Auto-update status based on new balance
    await db.execAsync(`
      UPDATE debts
      SET status = CASE
        WHEN balance_due_usd <= 0 THEN 'settled'
        WHEN balance_due_usd < total_amount_usd THEN 'partial'
        ELSE 'pending'
      END,
      updated_at = datetime('now')
      WHERE id = ${data.debt_id};
    `);

    await db.execAsync('COMMIT;');
    return paymentId;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Get a summary of all debts: total outstanding, total pending, total partial.
 */
export async function getDebtSummary(): Promise<DebtSummary> {
  const db = getDatabase();
  const result = await db.getFirstAsync<DebtSummary>(`
    SELECT
      COALESCE(SUM(balance_due_usd), 0) AS total_outstanding,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN balance_due_usd ELSE 0 END), 0) AS total_pending,
      COALESCE(SUM(CASE WHEN status = 'partial' THEN balance_due_usd ELSE 0 END), 0) AS total_partial
    FROM debts;
  `);

  return result ?? { total_outstanding: 0, total_pending: 0, total_partial: 0 };
}
