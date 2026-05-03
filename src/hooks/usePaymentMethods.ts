import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import * as paymentMethodRepo from '../db/repositories/payment-methods';

const QUERY_KEY = 'payment-methods';

/**
 * Fetch all payment methods.
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => paymentMethodRepo.getAll(),
  });
}

/**
 * Fetch a single payment method by id.
 */
export function usePaymentMethod(id: number) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => paymentMethodRepo.getById(id),
  });
}

/**
 * Create a new payment method.
 */
export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; instructions?: string }) =>
      paymentMethodRepo.create(data.label, data.instructions),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Update an existing payment method.
 */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{ label: string; instructions: string }>;
    }) => paymentMethodRepo.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Delete a payment method by id.
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => paymentMethodRepo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
