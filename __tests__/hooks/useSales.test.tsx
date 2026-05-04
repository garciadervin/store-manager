import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const HOOK_SOURCE_PATH = path.resolve(__dirname, '../../src/hooks/useSales.ts');

// ---------------------------------------------------------------
// Mocks — must be before any imports that reference these modules
// ---------------------------------------------------------------
const mockDb = {};
jest.mock('../../src/db/connection', () => ({
  getDatabase: () => mockDb,
}));

const mockSalesRepo = {
  getAll: jest.fn(),
  getById: jest.fn(),
  createSale: jest.fn(),
  refundSale: jest.fn(),
};
jest.mock('../../src/db/repositories/sales', () => mockSalesRepo);

const mockSaleItemsRepo = {
  create: jest.fn(),
};
jest.mock('../../src/db/repositories/sale-items', () => mockSaleItemsRepo);

const mockSalePaymentsRepo = {
  create: jest.fn(),
};
jest.mock('../../src/db/repositories/sale-payments', () => mockSalePaymentsRepo);

const mockProductsRepo = {
  update: jest.fn(),
};
jest.mock('../../src/db/repositories/products', () => mockProductsRepo);

const mockExchangeRate = {
  getRate: jest.fn(),
};
jest.mock('../../src/services/exchange-rate', () => mockExchangeRate);

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
  return require('../../src/hooks/useSales');
}

// ---------------------------------------------------------------
// Test data
// ---------------------------------------------------------------
const mockRateResult = {
  source: 'bcv',
  rate_buy: 63.5,
  rate_sell: 64.0,
  timestamp: '2026-05-03T12:00:00.000Z',
};

const mockSale = {
  id: 1,
  timestamp: '2026-05-03T12:00:00.000Z',
  total_usd: 20,
  total_ves: 1270,
  rate_value: 63.5,
  rate_source: 'bcv',
  status: 'completed',
  notes: null,
  created_at: '2026-05-03T12:00:00.000Z',
  items: [
    {
      id: 1,
      sale_id: 1,
      product_id: 1,
      product_name: 'Product A',
      quantity: 2,
      unit_price_usd: 10,
      subtotal_usd: 20,
    },
  ],
  payments: [
    { id: 1, sale_id: 1, method_id: 1, amount_usd: 15, created_at: '2026-05-03T12:00:00.000Z' },
    { id: 2, sale_id: 1, method_id: 2, amount_usd: 5, created_at: '2026-05-03T12:00:00.000Z' },
  ],
};

const mockCreateSaleInput = {
  items: [
    { product_id: 1, product_name: 'Product A', quantity: 2, unit_price_usd: 10 },
  ],
  payments: [
    { method_id: 1, amount_usd: 15 },
    { method_id: 2, amount_usd: 5 },
  ],
  notes: null,
};

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('useSales.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(HOOK_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export useSales (plural, no args)', () => {
      expect(source).toContain('export function useSales');
    });

    it('should export useSale (singular, with id)', () => {
      expect(source).toContain('export function useSale');
    });

    it('should export useCreateSale', () => {
      expect(source).toContain('export function useCreateSale');
    });

    it('should export useRefundSale', () => {
      expect(source).toContain('export function useRefundSale');
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

  describe('exchange-rate service integration', () => {
    it('should call getRate from exchange-rate service in useCreateSale', () => {
      expect(source).toContain('getRate');
    });
  });

  describe('repository integration', () => {
    it('should call getAll from the sales repository', () => {
      expect(source).toContain('getAll');
    });

    it('should call getById from the sales repository', () => {
      expect(source).toContain('getById');
    });

    it('should call createSale from the sales repository', () => {
      expect(source).toContain('createSale');
    });

    it('should call refundSale from the sales repository', () => {
      expect(source).toContain('refundSale');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock repositories and verify hook behaviour
// ---------------------------------------------------------------
describe('useSales.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useSales (list) ─────────────────────────────────────────
  describe('useSales', () => {
    it('should return sales data on success', async () => {
      const fakeSales = [mockSale];
      mockSalesRepo.getAll.mockResolvedValue(fakeSales);

      const { useSales } = loadModule();
      const { result } = renderHook(() => useSales(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeSales);
      expect(mockSalesRepo.getAll).toHaveBeenCalledTimes(1);
    });

    it('should start in loading state', () => {
      mockSalesRepo.getAll.mockReturnValue(new Promise(() => {}));

      const { useSales } = loadModule();
      const { result } = renderHook(() => useSales(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockSalesRepo.getAll.mockRejectedValue(
        new Error('Failed to fetch sales'),
      );

      const { useSales } = loadModule();
      const { result } = renderHook(() => useSales(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to fetch sales');
    });
  });

  // ── useSale (single) ────────────────────────────────────────
  describe('useSale', () => {
    it('should return a single sale with items and payments by id', async () => {
      mockSalesRepo.getById.mockResolvedValue(mockSale);

      const { useSale } = loadModule();
      const { result } = renderHook(() => useSale(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSale);
      expect(mockSalesRepo.getById).toHaveBeenCalledWith(1);
    });

    it('should return null when sale is not found', async () => {
      mockSalesRepo.getById.mockResolvedValue(null);

      const { useSale } = loadModule();
      const { result } = renderHook(() => useSale(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('should start in loading state', () => {
      mockSalesRepo.getById.mockReturnValue(new Promise(() => {}));

      const { useSale } = loadModule();
      const { result } = renderHook(() => useSale(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockSalesRepo.getById.mockRejectedValue(new Error('Not found'));

      const { useSale } = loadModule();
      const { result } = renderHook(() => useSale(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useCreateSale ───────────────────────────────────────────
  describe('useCreateSale', () => {
    const newSaleId = 42;

    beforeEach(() => {
      mockExchangeRate.getRate.mockResolvedValue(mockRateResult);
      mockSalesRepo.createSale.mockResolvedValue(newSaleId);
    });

    it('should call getRate from exchange-rate service', async () => {
      const { useCreateSale } = loadModule();
      const { result } = renderHook(() => useCreateSale(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(mockCreateSaleInput);

      expect(mockExchangeRate.getRate).toHaveBeenCalledTimes(1);
    });

    it('should call sales repo createSale with correct total_usd, total_ves, rate_value', async () => {
      const { useCreateSale } = loadModule();
      const { result } = renderHook(() => useCreateSale(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(mockCreateSaleInput);

      // total_usd = 2 * $10 = $20
      // total_ves = $20 * 63.5 = 1,270 Bs.
      expect(mockSalesRepo.createSale).toHaveBeenCalledWith(
        expect.objectContaining({
          total_usd: 20,
          total_ves: 1270,
          rate_value: 63.5,
          rate_source: 'bcv',
        }),
      );
    });

    it('should return the new sale id on success', async () => {
      const { useCreateSale } = loadModule();
      const { result } = renderHook(() => useCreateSale(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(mockCreateSaleInput);

      expect(response).toBe(newSaleId);
    });

    it('should propagate error when exchange rate fetch fails', async () => {
      mockExchangeRate.getRate.mockRejectedValue(
        new Error('Rate fetch failed'),
      );

      const { useCreateSale } = loadModule();
      const { result } = renderHook(() => useCreateSale(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync(mockCreateSaleInput),
      ).rejects.toThrow('Rate fetch failed');
    });

    it('should propagate error when sale creation fails', async () => {
      mockSalesRepo.createSale.mockRejectedValue(
        new Error('Sale creation failed'),
      );

      const { useCreateSale } = loadModule();
      const { result } = renderHook(() => useCreateSale(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync(mockCreateSaleInput),
      ).rejects.toThrow('Sale creation failed');
    });
  });

  // ── useRefundSale ───────────────────────────────────────────
  describe('useRefundSale', () => {
    it('should call refundSale with the given id', async () => {
      mockSalesRepo.refundSale.mockResolvedValue(1);

      const { useRefundSale } = loadModule();
      const { result } = renderHook(() => useRefundSale(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(1);

      expect(response).toBe(1);
      expect(mockSalesRepo.refundSale).toHaveBeenCalledWith(1);
    });

    it('should propagate error when refund fails', async () => {
      mockSalesRepo.refundSale.mockRejectedValue(
        new Error('Refund failed'),
      );

      const { useRefundSale } = loadModule();
      const { result } = renderHook(() => useRefundSale(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync(1),
      ).rejects.toThrow('Refund failed');
    });
  });
});
