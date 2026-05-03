import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import * as productRepo from '../db/repositories/products';

const QUERY_KEY = 'products';

/**
 * Fetch all products.
 */
export function useProducts() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => productRepo.getAll(),
  });
}

/**
 * Fetch a single product by id.
 */
export function useProduct(id: number) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => productRepo.getById(id),
  });
}

/**
 * Create a new product.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; price_usd: number; stock_qty: number }) =>
      productRepo.create(data.name, data.price_usd, data.stock_qty),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Update an existing product.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<{
        name: string;
        category: string;
        price_usd: number;
        stock_qty: number;
        unit_type: string;
      }>;
    }) => productRepo.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Delete a product by id.
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productRepo.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

/**
 * Search products whose name matches the given query (case-insensitive).
 * Only enabled when query is truthy.
 */
export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'search', query],
    queryFn: () => productRepo.searchProducts(query),
    enabled: !!query,
  });
}

/**
 * Fetch all products belonging to a specific category.
 * Only enabled when category is truthy.
 */
export function useProductsByCategory(category: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'category', category],
    queryFn: () => productRepo.getProductsByCategory(category),
    enabled: !!category,
  });
}
