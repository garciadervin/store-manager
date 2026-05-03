import { getDatabase } from '../connection';

// ─── Types ──────────────────────────────────────────────────────────

export interface CreateSaleItemData {
  sale_id: number;
  product_id: number | null;
  product_name?: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
}

// ─── Queries ────────────────────────────────────────────────────────

/**
 * Retrieve all items belonging to a given sale.
 */
export async function getBySaleId(saleId: number) {
  const db = getDatabase();
  return db.getAllAsync(
    'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id;',
    [saleId],
  );
}

/**
 * Create a new sale item and return its new id.
 */
export async function create(data: CreateSaleItemData) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_usd, subtotal_usd)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      data.sale_id,
      data.product_id,
      data.product_name ?? '',
      data.quantity,
      data.unit_price_usd,
      data.subtotal_usd,
    ],
  );
  return result.lastInsertRowId;
}
