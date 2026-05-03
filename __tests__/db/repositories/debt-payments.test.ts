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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/debt-payments.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/debt-payments');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('debt-payments.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getByDebtId', () => {
      expect(source).toContain('export async function getByDebtId');
    });

    it('should export create', () => {
      expect(source).toContain('export async function create');
    });
  });

  describe('function signatures', () => {
    it('getByDebtId should accept a debtId parameter', () => {
      expect(source).toMatch(/getByDebtId\s*\(\s*debtId\s*[:)]/);
    });

    it('create should accept debt_id, amount_usd, and optional fields', () => {
      expect(source).toMatch(/create\s*\(/);
      expect(source).toContain('debt_id');
      expect(source).toContain('amount_usd');
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the debt_payments table', () => {
      expect(source).toContain('debt_payments');
    });

    it('should contain INSERT INTO for create', () => {
      expect(source).toContain('INSERT INTO');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('debt-payments.ts — unit', () => {
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

  describe('getByDebtId', () => {
    it('should return payments for a given debt id', async () => {
      const fakePayments = [
        { id: 1, debt_id: 1, amount_usd: 30, notes: 'First payment' },
        { id: 2, debt_id: 1, amount_usd: 20, notes: 'Second payment' },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakePayments);

      const { getByDebtId } = loadModule();
      const result = await getByDebtId(1);

      expect(result).toEqual(fakePayments);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when debt has no payments', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getByDebtId } = loadModule();
      const result = await getByDebtId(999);

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Query failed'));

      const { getByDebtId } = loadModule();
      await expect(getByDebtId(1)).rejects.toThrow('Query failed');
    });
  });

  describe('create', () => {
    it('should create a debt payment and return the new id', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 8, changes: 1 });

      const { create } = loadModule();
      const result = await create({ debt_id: 1, amount_usd: 50 });

      expect(result).toBe(8);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should create a debt payment with optional notes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 9, changes: 1 });

      const { create } = loadModule();
      const result = await create({ debt_id: 1, amount_usd: 25, notes: 'Partial payment', method_id: 1 });

      expect(result).toBe(9);
    });

    it('should propagate database errors on create', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { create } = loadModule();
      await expect(create({ debt_id: 1, amount_usd: 50 })).rejects.toThrow('Insert failed');
    });
  });
});
