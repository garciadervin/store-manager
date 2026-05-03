import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const HOOK_SOURCE_PATH = path.resolve(__dirname, '../../src/hooks/useProducts.ts');

// ---------------------------------------------------------------
// Mocks — must be before any imports that reference these modules
// ---------------------------------------------------------------
const mockDb = {};
jest.mock('../../src/db/connection', () => ({
  getDatabase: () => mockDb,
}));

const mockRepo = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  searchProducts: jest.fn(),
  getProductsByCategory: jest.fn(),
};
jest.mock('../../src/db/repositories/products', () => mockRepo);

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/hooks/useProducts');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('useProducts.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(HOOK_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export useProducts (plural, no args)', () => {
      expect(source).toContain('export function useProducts');
    });

    it('should export useProduct (singular, with id)', () => {
      expect(source).toContain('export function useProduct');
    });

    it('should export useCreateProduct', () => {
      expect(source).toContain('export function useCreateProduct');
    });

    it('should export useUpdateProduct', () => {
      expect(source).toContain('export function useUpdateProduct');
    });

    it('should export useDeleteProduct', () => {
      expect(source).toContain('export function useDeleteProduct');
    });

    it('should export useSearchProducts', () => {
      expect(source).toContain('export function useSearchProducts');
    });

    it('should export useProductsByCategory', () => {
      expect(source).toContain('export function useProductsByCategory');
    });
  });

  describe('TanStack Query usage', () => {
    it('should use useQuery for fetching', () => {
      expect(source).toContain('useQuery');
    });

    it('should use useMutation for mutations', () => {
      expect(source).toContain('useMutation');
    });

    it('should use useQueryClient for invalidation', () => {
      expect(source).toContain('useQueryClient');
    });
  });

  describe('repository integration', () => {
    it('should call getAll from the products repository', () => {
      expect(source).toContain('getAll');
    });

    it('should call getById from the products repository', () => {
      expect(source).toContain('getById');
    });

    it('should call create from the products repository', () => {
      expect(source).toContain('create');
    });

    it('should call update from the products repository', () => {
      expect(source).toContain('update');
    });

    it('should call delete from the products repository', () => {
      expect(source).toContain('delete');
    });

    it('should call searchProducts from the products repository', () => {
      expect(source).toContain('searchProducts');
    });

    it('should call getProductsByCategory from the products repository', () => {
      expect(source).toContain('getProductsByCategory');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock repository and verify hook behaviour
// ---------------------------------------------------------------
describe('useProducts.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useProducts (list) ──────────────────────────────────────
  describe('useProducts', () => {
    it('should return products data on success', async () => {
      const fakeProducts = [
        { id: 1, name: 'Coca Cola', price_usd: 1.5, stock_qty: 100, category: 'drinks', unit_type: 'unit', created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 2, name: 'Pepsi', price_usd: 1.4, stock_qty: 80, category: 'drinks', unit_type: 'unit', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ];
      mockRepo.getAll.mockResolvedValue(fakeProducts);

      const { useProducts } = loadModule();
      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeProducts);
      expect(mockRepo.getAll).toHaveBeenCalledTimes(1);
    });

    it('should start in loading state', () => {
      mockRepo.getAll.mockReturnValue(new Promise(() => {}));

      const { useProducts } = loadModule();
      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockRepo.getAll.mockRejectedValue(new Error('Failed to fetch products'));

      const { useProducts } = loadModule();
      const { result } = renderHook(() => useProducts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to fetch products');
    });
  });

  // ── useProduct (single) ─────────────────────────────────────
  describe('useProduct', () => {
    it('should return a single product by id', async () => {
      const fakeProduct = { id: 3, name: 'Product X', price_usd: 10, stock_qty: 5, category: null, unit_type: 'unit', created_at: '2026-01-01', updated_at: '2026-01-01' };
      mockRepo.getById.mockResolvedValue(fakeProduct);

      const { useProduct } = loadModule();
      const { result } = renderHook(() => useProduct(3), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeProduct);
      expect(mockRepo.getById).toHaveBeenCalledWith(3);
    });

    it('should return null when product is not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      const { useProduct } = loadModule();
      const { result } = renderHook(() => useProduct(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('should start in loading state', () => {
      mockRepo.getById.mockReturnValue(new Promise(() => {}));

      const { useProduct } = loadModule();
      const { result } = renderHook(() => useProduct(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockRepo.getById.mockRejectedValue(new Error('Not found'));

      const { useProduct } = loadModule();
      const { result } = renderHook(() => useProduct(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useCreateProduct ────────────────────────────────────────
  describe('useCreateProduct', () => {
    it('should call create with name, price_usd, stock_qty and return new id', async () => {
      mockRepo.create.mockResolvedValue(42);

      const { useCreateProduct } = loadModule();
      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        name: 'New Product',
        price_usd: 15.99,
        stock_qty: 10,
      });

      expect(response).toBe(42);
      expect(mockRepo.create).toHaveBeenCalledWith('New Product', 15.99, 10);
    });

    it('should propagate error when create fails', async () => {
      mockRepo.create.mockRejectedValue(new Error('Insert failed'));

      const { useCreateProduct } = loadModule();
      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ name: 'Fail', price_usd: 1, stock_qty: 1 }),
      ).rejects.toThrow('Insert failed');
    });
  });

  // ── useUpdateProduct ────────────────────────────────────────
  describe('useUpdateProduct', () => {
    it('should call update with id and data', async () => {
      mockRepo.update.mockResolvedValue(1);

      const { useUpdateProduct } = loadModule();
      const { result } = renderHook(() => useUpdateProduct(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        id: 5,
        data: { name: 'Updated Name', price_usd: 20 },
      });

      expect(response).toBe(1);
      expect(mockRepo.update).toHaveBeenCalledWith(5, {
        name: 'Updated Name',
        price_usd: 20,
      });
    });

    it('should propagate error when update fails', async () => {
      mockRepo.update.mockRejectedValue(new Error('Update failed'));

      const { useUpdateProduct } = loadModule();
      const { result } = renderHook(() => useUpdateProduct(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ id: 1, data: { name: 'Fail' } }),
      ).rejects.toThrow('Update failed');
    });
  });

  // ── useDeleteProduct ────────────────────────────────────────
  describe('useDeleteProduct', () => {
    it('should call delete with the given id', async () => {
      mockRepo.delete.mockResolvedValue(1);

      const { useDeleteProduct } = loadModule();
      const { result } = renderHook(() => useDeleteProduct(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(7);

      expect(response).toBe(1);
      expect(mockRepo.delete).toHaveBeenCalledWith(7);
    });

    it('should propagate error when delete fails', async () => {
      mockRepo.delete.mockRejectedValue(new Error('Delete failed'));

      const { useDeleteProduct } = loadModule();
      const { result } = renderHook(() => useDeleteProduct(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(1)).rejects.toThrow('Delete failed');
    });
  });

  // ── useSearchProducts ───────────────────────────────────────
  describe('useSearchProducts', () => {
    it('should return matching products for a search query', async () => {
      const fakeResults = [
        { id: 1, name: 'Coca Cola', price_usd: 1.5, stock_qty: 100, category: 'drinks', unit_type: 'unit', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ];
      mockRepo.searchProducts.mockResolvedValue(fakeResults);

      const { useSearchProducts } = loadModule();
      const { result } = renderHook(() => useSearchProducts('coca'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeResults);
      expect(mockRepo.searchProducts).toHaveBeenCalledWith('coca');
    });

    it('should return empty array when no products match', async () => {
      mockRepo.searchProducts.mockResolvedValue([]);

      const { useSearchProducts } = loadModule();
      const { result } = renderHook(() => useSearchProducts('zzzzz'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('should start in loading state', () => {
      mockRepo.searchProducts.mockReturnValue(new Promise(() => {}));

      const { useSearchProducts } = loadModule();
      const { result } = renderHook(() => useSearchProducts('test'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when search fails', async () => {
      mockRepo.searchProducts.mockRejectedValue(new Error('Search failed'));

      const { useSearchProducts } = loadModule();
      const { result } = renderHook(() => useSearchProducts('test'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useProductsByCategory ───────────────────────────────────
  describe('useProductsByCategory', () => {
    it('should return products for a given category', async () => {
      const fakeProducts = [
        { id: 1, name: 'Beer', category: 'drinks', price_usd: 2, stock_qty: 50, unit_type: 'unit', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ];
      mockRepo.getProductsByCategory.mockResolvedValue(fakeProducts);

      const { useProductsByCategory } = loadModule();
      const { result } = renderHook(() => useProductsByCategory('drinks'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeProducts);
      expect(mockRepo.getProductsByCategory).toHaveBeenCalledWith('drinks');
    });

    it('should return empty array when category has no products', async () => {
      mockRepo.getProductsByCategory.mockResolvedValue([]);

      const { useProductsByCategory } = loadModule();
      const { result } = renderHook(() => useProductsByCategory('nonexistent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('should start in loading state', () => {
      mockRepo.getProductsByCategory.mockReturnValue(new Promise(() => {}));

      const { useProductsByCategory } = loadModule();
      const { result } = renderHook(() => useProductsByCategory('drinks'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when category query fails', async () => {
      mockRepo.getProductsByCategory.mockRejectedValue(new Error('Category query failed'));

      const { useProductsByCategory } = loadModule();
      const { result } = renderHook(() => useProductsByCategory('drinks'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
