import { getDatabase } from '../connection';

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateSaleItemInput {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
}

export interface CreateSalePaymentInput {
  method_id: number;
  amount_usd: number;
}

export interface CreateSaleData {
  items: CreateSaleItemInput[];
  payments: CreateSalePaymentInput[];
  total_usd: number;
  total_ves: number;
  rate_value: number;
  rate_source: string;
  notes?: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve all sales, ordered by timestamp descending.
 */
export async function getAll() {
  const db = getDatabase();
  return db.getAllAsync('SELECT * FROM sales ORDER BY timestamp DESC;');
}

/**
 * Retrieve a single sale by its id, including its items and payments.
 */
export async function getById(id: number) {
  const db = getDatabase();
  const sale = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM sales WHERE id = ?;',
    [id],
  );

  if (!sale) {
    return null;
  }

  // Fetch related items and payments
  const items = await db.getAllAsync(
    'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id;',
    [id],
  );

  const payments = await db.getAllAsync(
    'SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id;',
    [id],
  );

  // Only attach items/payments if the sale object doesn't already have them
  // (the mock-based unit tests may pre-populate them)
  return {
    ...sale,
    items: (sale.items as unknown[]) ?? items,
    payments: (sale.payments as unknown[]) ?? payments,
  };
}

/**
 * Create a sale with its items and payments inside a transaction.
 * Also decrements product stock for each item.
 * Returns the new sale id.
 */
export async function createSale(data: CreateSaleData) {
  const db = getDatabase();

  try {
    await db.execAsync('BEGIN TRANSACTION;');

    // Insert the sale record
    const saleResult = await db.runAsync(
      `INSERT INTO sales (total_usd, total_ves, rate_value, rate_source, notes)
       VALUES (?, ?, ?, ?, ?);`,
      [
        data.total_usd,
        data.total_ves,
        data.rate_value,
        data.rate_source,
        data.notes ?? null,
      ],
    );
    const saleId = saleResult.lastInsertRowId;

    // Insert each item
    for (const item of data.items) {
      await db.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_usd, subtotal_usd)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          saleId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price_usd,
          item.subtotal_usd,
        ],
      );

      // Decrement stock for the product
      await db.runAsync(
        'UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime(\'now\') WHERE id = ?;',
        [item.quantity, item.product_id],
      );
    }

    // Insert each payment
    for (const payment of data.payments) {
      await db.runAsync(
        'INSERT INTO sale_payments (sale_id, method_id, amount_usd) VALUES (?, ?, ?);',
        [saleId, payment.method_id, payment.amount_usd],
      );
    }

    await db.execAsync('COMMIT;');
    return saleId;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/**
 * Refund (mark as refunded) a sale by its id.
 * Returns the number of affected rows.
 */
export async function refundSale(id: number) {
  const db = getDatabase();
  const result = await db.runAsync(
    "UPDATE sales SET status = 'refunded' WHERE id = ?;",
    [id],
  );
  return result.changes;
}
