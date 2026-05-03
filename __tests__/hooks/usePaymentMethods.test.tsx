import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const HOOK_SOURCE_PATH = path.resolve(__dirname, '../../src/hooks/usePaymentMethods.ts');

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
};
jest.mock('../../src/db/repositories/payment-methods', () => mockRepo);

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
  return require('../../src/hooks/usePaymentMethods');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('usePaymentMethods.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(HOOK_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export usePaymentMethods (plural, no args)', () => {
      expect(source).toContain('export function usePaymentMethods');
    });

    it('should export usePaymentMethod (singular, with id)', () => {
      expect(source).toContain('export function usePaymentMethod');
    });

    it('should export useCreatePaymentMethod', () => {
      expect(source).toContain('export function useCreatePaymentMethod');
    });

    it('should export useUpdatePaymentMethod', () => {
      expect(source).toContain('export function useUpdatePaymentMethod');
    });

    it('should export useDeletePaymentMethod', () => {
      expect(source).toContain('export function useDeletePaymentMethod');
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
    it('should call getAll from the payment-methods repository', () => {
      expect(source).toContain('getAll');
    });

    it('should call getById from the payment-methods repository', () => {
      expect(source).toContain('getById');
    });

    it('should call create from the payment-methods repository', () => {
      expect(source).toContain('create');
    });

    it('should call update from the payment-methods repository', () => {
      expect(source).toContain('update');
    });

    it('should call delete from the payment-methods repository', () => {
      expect(source).toContain('delete');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock repository and verify hook behaviour
// ---------------------------------------------------------------
describe('usePaymentMethods.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── usePaymentMethods (list) ────────────────────────────────
  describe('usePaymentMethods', () => {
    it('should return payment methods data on success', async () => {
      const fakeMethods = [
        { id: 1, label: 'Cash', instructions: null, created_at: '2026-01-01' },
        { id: 2, label: 'Zelle', instructions: 'send@email.com', created_at: '2026-01-02' },
      ];
      mockRepo.getAll.mockResolvedValue(fakeMethods);

      const { usePaymentMethods } = loadModule();
      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeMethods);
      expect(mockRepo.getAll).toHaveBeenCalledTimes(1);
    });

    it('should start in loading state', () => {
      // Never resolve the promise so it stays in loading
      mockRepo.getAll.mockReturnValue(new Promise(() => {}));

      const { usePaymentMethods } = loadModule();
      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockRepo.getAll.mockRejectedValue(new Error('Failed to fetch payment methods'));

      const { usePaymentMethods } = loadModule();
      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to fetch payment methods');
    });
  });

  // ── usePaymentMethod (single) ───────────────────────────────
  describe('usePaymentMethod', () => {
    it('should return a single payment method by id', async () => {
      const fakeMethod = { id: 5, label: 'Pago Móvil', instructions: '0412-555-5555', created_at: '2026-01-01' };
      mockRepo.getById.mockResolvedValue(fakeMethod);

      const { usePaymentMethod } = loadModule();
      const { result } = renderHook(() => usePaymentMethod(5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(fakeMethod);
      expect(mockRepo.getById).toHaveBeenCalledWith(5);
    });

    it('should return null when payment method is not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      const { usePaymentMethod } = loadModule();
      const { result } = renderHook(() => usePaymentMethod(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('should start in loading state', () => {
      mockRepo.getById.mockReturnValue(new Promise(() => {}));

      const { usePaymentMethod } = loadModule();
      const { result } = renderHook(() => usePaymentMethod(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockRepo.getById.mockRejectedValue(new Error('Not found'));

      const { usePaymentMethod } = loadModule();
      const { result } = renderHook(() => usePaymentMethod(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useCreatePaymentMethod ──────────────────────────────────
  describe('useCreatePaymentMethod', () => {
    it('should call create with label and instructions and return new id', async () => {
      mockRepo.create.mockResolvedValue(10);

      const { useCreatePaymentMethod } = loadModule();
      const { result } = renderHook(() => useCreatePaymentMethod(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        label: 'Transferencia',
        instructions: 'Banco Provincial cta 1234',
      });

      expect(response).toBe(10);
      expect(mockRepo.create).toHaveBeenCalledWith(
        'Transferencia',
        'Banco Provincial cta 1234',
      );
    });

    it('should call create with label only when instructions are omitted', async () => {
      mockRepo.create.mockResolvedValue(11);

      const { useCreatePaymentMethod } = loadModule();
      const { result } = renderHook(() => useCreatePaymentMethod(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        label: 'Cash',
      });

      expect(response).toBe(11);
      expect(mockRepo.create).toHaveBeenCalledWith('Cash', undefined);
    });

    it('should propagate error when create fails', async () => {
      mockRepo.create.mockRejectedValue(new Error('Create failed'));

      const { useCreatePaymentMethod } = loadModule();
      const { result } = renderHook(() => useCreatePaymentMethod(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ label: 'Fail' }),
      ).rejects.toThrow('Create failed');
    });
  });

  // ── useUpdatePaymentMethod ──────────────────────────────────
  describe('useUpdatePaymentMethod', () => {
    it('should call update with id and data', async () => {
      mockRepo.update.mockResolvedValue(1);

      const { useUpdatePaymentMethod } = loadModule();
      const { result } = renderHook(() => useUpdatePaymentMethod(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        id: 3,
        data: { label: 'Updated Label', instructions: 'new@email.com' },
      });

      expect(response).toBe(1);
      expect(mockRepo.update).toHaveBeenCalledWith(3, {
        label: 'Updated Label',
        instructions: 'new@email.com',
      });
    });

    it('should propagate error when update fails', async () => {
      mockRepo.update.mockRejectedValue(new Error('Update failed'));

      const { useUpdatePaymentMethod } = loadModule();
      const { result } = renderHook(() => useUpdatePaymentMethod(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ id: 1, data: { label: 'Fail' } }),
      ).rejects.toThrow('Update failed');
    });
  });

  // ── useDeletePaymentMethod ──────────────────────────────────
  describe('useDeletePaymentMethod', () => {
    it('should call delete with the given id', async () => {
      mockRepo.delete.mockResolvedValue(1);

      const { useDeletePaymentMethod } = loadModule();
      const { result } = renderHook(() => useDeletePaymentMethod(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync(7);

      expect(response).toBe(1);
      expect(mockRepo.delete).toHaveBeenCalledWith(7);
    });

    it('should propagate error when delete fails', async () => {
      mockRepo.delete.mockRejectedValue(new Error('Delete failed'));

      const { useDeletePaymentMethod } = loadModule();
      const { result } = renderHook(() => useDeletePaymentMethod(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(1)).rejects.toThrow('Delete failed');
    });
  });
});
