import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import * as salesRepo from '../db/repositories/sales';
import * as saleItemsRepo from '../db/repositories/sale-items';
import * as salePaymentsRepo from '../db/repositories/sale-payments';
import * as productsRepo from '../db/repositories/products';
import { getRate } from '../services/exchange-rate';
import { calculateSubtotal, convertToVES } from '../utils/format';
import type { SaleFormItem, SaleFormPayment } from '../utils/types';

const QUERY_KEY = 'sales';

// ─── Types ──────────────────────────────────────────────────────────

interface CreateSaleInput {
  items: SaleFormItem[];
  payments: SaleFormPayment[];
  rateSource: string;
  notes?: string | null;
}

// ─── Hooks ──────────────────────────────────────────────────────────

/**
 * Fetch all sales.
 */
export function useSales() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => salesRepo.getAll(),
  });
}

/**
 * Fetch a single sale by id, including items and payments.
 */
export function useSale(id: number) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => salesRepo.getById(id),
  });
}

/**
 * Create a sale with items and payments.
 * Fetches the current exchange rate, calculates totals,
 * creates the sale record, sale items (with stock decrement),
 * and sale payments.
 */
export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, payments, rateSource, notes }: CreateSaleInput) => {
      // Get current exchange rate
      const rate = await getRate(rateSource);

      // Calculate totals
      let totalUsd = 0;
      for (const item of items) {
        totalUsd += calculateSubtotal(item.quantity, item.unit_price_usd);
      }

      // Create the sale record
      const saleId = await salesRepo.createSale({
        total_usd: totalUsd,
        total_ves: convertToVES(totalUsd, rate.rate_buy),
        rate_value: rate.rate_buy,
        rate_source: rate.source,
        notes: notes ?? null,
        items: items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_usd: item.unit_price_usd,
          subtotal_usd: calculateSubtotal(item.quantity, item.unit_price_usd),
        })),
        payments: payments.map((payment) => ({
          method_id: payment.method_id,
          amount_usd: payment.amount_usd,
        })),
      });

      return saleId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * Refund (mark as refunded) a sale by id.
 */
export function useRefundSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => salesRepo.refundSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
