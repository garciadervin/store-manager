import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const HOOK_SOURCE_PATH = path.resolve(__dirname, '../../src/hooks/useDebts.ts');

// ---------------------------------------------------------------
// Mocks — must be before any imports that reference these modules
// ---------------------------------------------------------------
const mockDb = {};
jest.mock('../../src/db/connection', () => ({
  getDatabase: () => mockDb,
}));

const mockDebtsRepo = {
  getAll: jest.fn(),
  getById: jest.fn(),
  getByStatus: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  addDebtPayment: jest.fn(),
};
jest.mock('../../src/db/repositories/debts', () => mockDebtsRepo);

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
  return require('../../src/hooks/useDebts');
}

// ---------------------------------------------------------------
// Test data
// ---------------------------------------------------------------
const mockDebt = {
  id: 1,
  sale_id: null,
  customer_name: 'Juan Pérez',
  customer_phone: '584121234567',
  total_amount_usd: 100,
  balance_due_usd: 45.5,
  status: 'partial',
  notes: null,
  last_contact_date: null,
  created_at: '2026-05-01T10:00:00.000Z',
  updated_at: '2026-05-01T10:00:00.000Z',
};

const mockDebts = [
  mockDebt,
  {
    id: 2,
    sale_id: null,
    customer_name: 'María García',
    customer_phone: null,
    total_amount_usd: 200,
    balance_due_usd: 200,
    status: 'pending',
    notes: 'Sin intereses',
    last_contact_date: null,
    created_at: '2026-05-02T10:00:00.000Z',
    updated_at: '2026-05-02T10:00:00.000Z',
  },
];

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('useDebts.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(HOOK_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export useDebts (plural, no args)', () => {
      expect(source).toContain('export function useDebts');
    });

    it('should export useDebt (singular, with id)', () => {
      expect(source).toContain('export function useDebt');
    });

    it('should export useDebtsByStatus', () => {
      expect(source).toContain('export function useDebtsByStatus');
    });

    it('should export useCreateDebt', () => {
      expect(source).toContain('export function useCreateDebt');
    });

    it('should export useUpdateDebt', () => {
      expect(source).toContain('export function useUpdateDebt');
    });

    it('should export useAddDebtPayment', () => {
      expect(source).toContain('export function useAddDebtPayment');
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
    it('should call getAll from the debts repository', () => {
      expect(source).toContain('getAll');
    });

    it('should call getById from the debts repository', () => {
      expect(source).toContain('getById');
    });

    it('should call getByStatus from the debts repository', () => {
      expect(source).toContain('getByStatus');
    });

    it('should call create from the debts repository', () => {
      expect(source).toContain('create');
    });

    it('should call update from the debts repository', () => {
      expect(source).toContain('update');
    });

    it('should call addDebtPayment from the debts repository', () => {
      expect(source).toContain('addDebtPayment');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock repository and verify hook behaviour
// ---------------------------------------------------------------
describe('useDebts.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── useDebts (list) ─────────────────────────────────────────
  describe('useDebts', () => {
    it('should return debts list on success', async () => {
      mockDebtsRepo.getAll.mockResolvedValue(mockDebts);

      const { useDebts } = loadModule();
      const { result } = renderHook(() => useDebts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDebts);
      expect(mockDebtsRepo.getAll).toHaveBeenCalledTimes(1);
    });

    it('should start in loading state', () => {
      mockDebtsRepo.getAll.mockReturnValue(new Promise(() => {}));

      const { useDebts } = loadModule();
      const { result } = renderHook(() => useDebts(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockDebtsRepo.getAll.mockRejectedValue(
        new Error('Failed to fetch debts'),
      );

      const { useDebts } = loadModule();
      const { result } = renderHook(() => useDebts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe('Failed to fetch debts');
    });
  });

  // ── useDebt (single) ────────────────────────────────────────
  describe('useDebt', () => {
    it('should return a single debt by id', async () => {
      mockDebtsRepo.getById.mockResolvedValue(mockDebt);

      const { useDebt } = loadModule();
      const { result } = renderHook(() => useDebt(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDebt);
      expect(mockDebtsRepo.getById).toHaveBeenCalledWith(1);
    });

    it('should return null when debt is not found', async () => {
      mockDebtsRepo.getById.mockResolvedValue(null);

      const { useDebt } = loadModule();
      const { result } = renderHook(() => useDebt(999), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('should start in loading state', () => {
      mockDebtsRepo.getById.mockReturnValue(new Promise(() => {}));

      const { useDebt } = loadModule();
      const { result } = renderHook(() => useDebt(1), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when repository throws', async () => {
      mockDebtsRepo.getById.mockRejectedValue(new Error('Not found'));

      const { useDebt } = loadModule();
      const { result } = renderHook(() => useDebt(1), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useDebtsByStatus ────────────────────────────────────────
  describe('useDebtsByStatus', () => {
    it('should return filtered debts by status', async () => {
      const pendingDebts = [mockDebts[1]];
      mockDebtsRepo.getByStatus.mockResolvedValue(pendingDebts);

      const { useDebtsByStatus } = loadModule();
      const { result } = renderHook(() => useDebtsByStatus('pending'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(pendingDebts);
      expect(mockDebtsRepo.getByStatus).toHaveBeenCalledWith('pending');
    });

    it('should return empty array when no debts match the status', async () => {
      mockDebtsRepo.getByStatus.mockResolvedValue([]);

      const { useDebtsByStatus } = loadModule();
      const { result } = renderHook(() => useDebtsByStatus('settled'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('should start in loading state', () => {
      mockDebtsRepo.getByStatus.mockReturnValue(new Promise(() => {}));

      const { useDebtsByStatus } = loadModule();
      const { result } = renderHook(() => useDebtsByStatus('pending'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should propagate error when status query fails', async () => {
      mockDebtsRepo.getByStatus.mockRejectedValue(
        new Error('Status query failed'),
      );

      const { useDebtsByStatus } = loadModule();
      const { result } = renderHook(() => useDebtsByStatus('pending'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  // ── useCreateDebt ───────────────────────────────────────────
  describe('useCreateDebt', () => {
    it('should call create with customer_name, total_amount_usd and return new id', async () => {
      mockDebtsRepo.create.mockResolvedValue(42);

      const { useCreateDebt } = loadModule();
      const { result } = renderHook(() => useCreateDebt(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        customer_name: 'Juan Pérez',
        total_amount_usd: 100,
        customer_phone: '584121234567',
        notes: 'Compra a crédito',
      });

      expect(response).toBe(42);
      expect(mockDebtsRepo.create).toHaveBeenCalledWith({
        customer_name: 'Juan Pérez',
        total_amount_usd: 100,
        customer_phone: '584121234567',
        notes: 'Compra a crédito',
      });
    });

    it('should propagate error when create fails', async () => {
      mockDebtsRepo.create.mockRejectedValue(new Error('Create failed'));

      const { useCreateDebt } = loadModule();
      const { result } = renderHook(() => useCreateDebt(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          customer_name: 'Fail',
          total_amount_usd: 50,
        }),
      ).rejects.toThrow('Create failed');
    });
  });

  // ── useUpdateDebt ───────────────────────────────────────────
  describe('useUpdateDebt', () => {
    it('should call update with id and data', async () => {
      mockDebtsRepo.update.mockResolvedValue(1);

      const { useUpdateDebt } = loadModule();
      const { result } = renderHook(() => useUpdateDebt(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        id: 3,
        data: { customer_name: 'Juan Actualizado', notes: 'Llamar mañana' },
      });

      expect(response).toBe(1);
      expect(mockDebtsRepo.update).toHaveBeenCalledWith(3, {
        customer_name: 'Juan Actualizado',
        notes: 'Llamar mañana',
      });
    });

    it('should propagate error when update fails', async () => {
      mockDebtsRepo.update.mockRejectedValue(new Error('Update failed'));

      const { useUpdateDebt } = loadModule();
      const { result } = renderHook(() => useUpdateDebt(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          id: 1,
          data: { customer_name: 'Fail' },
        }),
      ).rejects.toThrow('Update failed');
    });
  });

  // ── useAddDebtPayment ───────────────────────────────────────
  describe('useAddDebtPayment', () => {
    it('should call addDebtPayment with debt_id and amount_usd and return payment id', async () => {
      mockDebtsRepo.addDebtPayment.mockResolvedValue(10);

      const { useAddDebtPayment } = loadModule();
      const { result } = renderHook(() => useAddDebtPayment(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.mutateAsync({
        debt_id: 1,
        amount_usd: 25,
        notes: 'Abono quincenal',
      });

      expect(response).toBe(10);
      expect(mockDebtsRepo.addDebtPayment).toHaveBeenCalledWith({
        debt_id: 1,
        amount_usd: 25,
        notes: 'Abono quincenal',
      });
    });

    it('should propagate error when addDebtPayment fails', async () => {
      mockDebtsRepo.addDebtPayment.mockRejectedValue(
        new Error('Payment failed'),
      );

      const { useAddDebtPayment } = loadModule();
      const { result } = renderHook(() => useAddDebtPayment(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ debt_id: 1, amount_usd: 25 }),
      ).rejects.toThrow('Payment failed');
    });
  });
});
