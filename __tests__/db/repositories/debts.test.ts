import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Mock expo-sqlite — repositories use getDatabase from connection
// ---------------------------------------------------------------
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: jest.fn(({ children }) => children),
  useSQLiteContext: jest.fn(),
}));

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/debts.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/debts');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('debts.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getAll', () => {
      expect(source).toContain('export async function getAll');
    });

    it('should export getById', () => {
      expect(source).toContain('export async function getById');
    });

    it('should export getByStatus', () => {
      expect(source).toContain('export async function getByStatus');
    });

    it('should export getByCustomer', () => {
      expect(source).toContain('export async function getByCustomer');
    });

    it('should export create', () => {
      expect(source).toContain('export async function create');
    });

    it('should export update', () => {
      expect(source).toContain('export async function update');
    });

    it('should export addDebtPayment', () => {
      expect(source).toContain('export async function addDebtPayment');
    });

    it('should export getDebtSummary', () => {
      expect(source).toContain('export async function getDebtSummary');
    });
  });

  describe('function signatures', () => {
    it('getAll should accept no parameters', () => {
      expect(source).toMatch(/getAll\s*\(\s*\)/);
    });

    it('getById should accept an id parameter', () => {
      expect(source).toMatch(/getById\s*\(\s*id\s*[:)]/);
    });

    it('getByStatus should accept a status parameter', () => {
      expect(source).toMatch(/getByStatus\s*\(\s*status\s*[:)]/);
    });

    it('getByCustomer should accept a customerName parameter', () => {
      expect(source).toMatch(/getByCustomer\s*\(\s*customerName\s*[:)]/);
    });

    it('create should accept customer_name and total_amount_usd', () => {
      expect(source).toMatch(/create\s*\(/);
      expect(source).toContain('customer_name');
      expect(source).toContain('total_amount_usd');
    });

    it('update should accept an id parameter', () => {
      expect(source).toMatch(/update\s*\(\s*id\s*[:)]/);
    });

    it('addDebtPayment should accept debt_id and amount_usd', () => {
      expect(source).toMatch(/addDebtPayment\s*\(/);
      expect(source).toContain('debt_id');
      expect(source).toContain('amount_usd');
    });

    it('getDebtSummary should accept no parameters', () => {
      expect(source).toMatch(/getDebtSummary\s*\(\s*\)/);
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the debts table', () => {
      expect(source).toContain('debts');
    });

    it('should reference the debt_payments table', () => {
      expect(source).toContain('debt_payments');
    });

    it('should contain INSERT INTO for create', () => {
      expect(source).toContain('INSERT INTO');
    });

    it('should contain UPDATE for update', () => {
      expect(source).toContain('UPDATE');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('debts.ts — unit', () => {
  let mockDb: {
    execAsync: jest.Mock;
    getFirstAsync: jest.Mock;
    getAllAsync: jest.Mock;
    runAsync: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    mockDb = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    };

    jest.mock('../../../src/db/connection', () => ({
      getDatabase: jest.fn(() => mockDb),
    }));
  });

  describe('getAll', () => {
    it('should return an array of debts', async () => {
      const fakeDebts = [
        { id: 1, customer_name: 'John', total_amount_usd: 100, balance_due_usd: 50, status: 'pending' },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeDebts);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual(fakeDebts);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no debts exist', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('DB error'));

      const { getAll } = loadModule();
      await expect(getAll()).rejects.toThrow('DB error');
    });
  });

  describe('getById', () => {
    it('should return a debt when found', async () => {
      const fakeDebt = { id: 1, customer_name: 'John', total_amount_usd: 100, balance_due_usd: 50, status: 'pending' };
      mockDb.getFirstAsync.mockResolvedValue(fakeDebt);

      const { getById } = loadModule();
      const result = await getById(1);

      expect(result).toEqual(fakeDebt);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return null when debt is not found', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const { getById } = loadModule();
      const result = await getById(999);

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('Query failed'));

      const { getById } = loadModule();
      await expect(getById(1)).rejects.toThrow('Query failed');
    });
  });

  describe('getByStatus', () => {
    it('should return debts filtered by status', async () => {
      const fakeDebts = [
        { id: 1, customer_name: 'John', status: 'pending', balance_due_usd: 50 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeDebts);

      const { getByStatus } = loadModule();
      const result = await getByStatus('pending');

      expect(result).toEqual(fakeDebts);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no debts match the status', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getByStatus } = loadModule();
      const result = await getByStatus('settled');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Status query failed'));

      const { getByStatus } = loadModule();
      await expect(getByStatus('pending')).rejects.toThrow('Status query failed');
    });
  });

  describe('getByCustomer', () => {
    it('should return debts for a given customer', async () => {
      const fakeDebts = [
        { id: 1, customer_name: 'John', total_amount_usd: 100, balance_due_usd: 50 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeDebts);

      const { getByCustomer } = loadModule();
      const result = await getByCustomer('John');

      expect(result).toEqual(fakeDebts);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when customer has no debts', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getByCustomer } = loadModule();
      const result = await getByCustomer('Unknown');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Customer query failed'));

      const { getByCustomer } = loadModule();
      await expect(getByCustomer('John')).rejects.toThrow('Customer query failed');
    });
  });

  describe('create', () => {
    it('should create a debt and return the new id', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 5, changes: 1 });

      const { create } = loadModule();
      const result = await create({ customer_name: 'John', total_amount_usd: 100 });

      expect(result).toBe(5);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should propagate database errors on create', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { create } = loadModule();
      await expect(create({ customer_name: 'Fail', total_amount_usd: 50 })).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('should update a debt and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

      const { update } = loadModule();
      const result = await update(1, { customer_name: 'John Updated' });

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when updating a non-existent debt', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { update } = loadModule();
      const result = await update(999, { customer_name: 'Ghost' });

      expect(result).toBe(0);
    });

    it('should propagate database errors on update', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Update failed'));

      const { update } = loadModule();
      await expect(update(1, { customer_name: 'Fail' })).rejects.toThrow('Update failed');
    });
  });

  describe('addDebtPayment', () => {
    it('should create a debt payment and update balance_due', async () => {
      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 10, changes: 1 }) // payment insert
        .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 }); // balance update

      const { addDebtPayment } = loadModule();
      const result = await addDebtPayment({ debt_id: 1, amount_usd: 30 });

      expect(result).toBe(10);
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    });

    it('should propagate database errors', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Payment insert failed'));

      const { addDebtPayment } = loadModule();
      await expect(addDebtPayment({ debt_id: 1, amount_usd: 30 })).rejects.toThrow('Payment insert failed');
    });
  });

  describe('getDebtSummary', () => {
    it('should return debt summary with totals', async () => {
      const fakeSummary = {
        total_outstanding: 5000,
        total_pending: 3000,
        total_partial: 2000,
      };
      mockDb.getFirstAsync.mockResolvedValue(fakeSummary);

      const { getDebtSummary } = loadModule();
      const result = await getDebtSummary();

      expect(result).toEqual(fakeSummary);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return zeros when no debts exist', async () => {
      const emptySummary = {
        total_outstanding: 0,
        total_pending: 0,
        total_partial: 0,
      };
      mockDb.getFirstAsync.mockResolvedValue(emptySummary);

      const { getDebtSummary } = loadModule();
      const result = await getDebtSummary();

      expect(result).toEqual(emptySummary);
    });

    it('should propagate database errors', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('Summary query failed'));

      const { getDebtSummary } = loadModule();
      await expect(getDebtSummary()).rejects.toThrow('Summary query failed');
    });
  });
});
