import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import * as debtsRepo from '../db/repositories/debts';

const QUERY_KEY = 'debts';

/**
 * Fetch all debts.
 */
export function useDebts() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => debtsRepo.getAll(),
  });
}

/**
 * Fetch a single debt by id.
 */
export function useDebt(id: number) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => debtsRepo.getById(id),
  });
}

/**
 * Fetch debts filtered by status (pending, partial, settled).
 */
export function useDebtsByStatus(status: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'status', status],
    queryFn: () => debtsRepo.getByStatus(status),
    enabled: !!status,
  });
}

/**
 * Create a new debt.
 */
export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customer_name: string;
      total_amount_usd: number;
      customer_phone?: string | null;
      notes?: string | null;
    }) => debtsRepo.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Update an existing debt.
 */
export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{
        customer_name: string;
        customer_phone: string | null;
        total_amount_usd: number;
        balance_due_usd: number;
        status: 'pending' | 'partial' | 'settled';
        notes: string | null;
        last_contact_date: string | null;
      }>;
    }) => debtsRepo.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Add a payment to a debt.
 */
export function useAddDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      debt_id: number;
      amount_usd: number;
      method_id?: number | null;
      notes?: string | null;
    }) => debtsRepo.addDebtPayment(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
