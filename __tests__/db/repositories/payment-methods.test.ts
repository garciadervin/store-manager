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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/payment-methods.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/payment-methods');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('payment-methods.ts — structural', () => {
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

    it('should export create', () => {
      expect(source).toContain('export async function create');
    });

    it('should export update', () => {
      expect(source).toContain('export async function update');
    });

    it('should export delete', () => {
      expect(source).toContain('export async function delete');
    });
  });

  describe('function signatures', () => {
    it('getAll should accept no parameters', () => {
      expect(source).toMatch(/getAll\s*\(\s*\)/);
    });

    it('getById should accept an id parameter', () => {
      expect(source).toMatch(/getById\s*\(\s*id\s*[:)]/);
    });

    it('create should accept label and instructions parameters', () => {
      expect(source).toMatch(/create\s*\(/);
      expect(source).toContain('label');
      expect(source).toContain('instructions');
    });

    it('update should accept an id parameter', () => {
      expect(source).toMatch(/update\s*\(\s*id\s*[:)]/);
    });

    it('delete should accept an id parameter', () => {
      expect(source).toMatch(/delete\s*\(\s*id\s*[:)]/);
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the payment_methods table', () => {
      expect(source).toContain('payment_methods');
    });

    it('should contain INSERT INTO for create', () => {
      expect(source).toContain('INSERT INTO');
    });

    it('should contain UPDATE for update', () => {
      expect(source).toContain('UPDATE');
    });

    it('should contain DELETE FROM for delete', () => {
      expect(source).toContain('DELETE FROM');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('payment-methods.ts — unit', () => {
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
    it('should return an array of payment methods', async () => {
      const fakeMethods = [
        { id: 1, label: 'Cash', instructions: 'USD cash' },
        { id: 2, label: 'Zelle', instructions: 'Send to x@y.com' },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeMethods);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual(fakeMethods);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no payment methods exist', async () => {
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
    it('should return a payment method when found', async () => {
      const fakeMethod = { id: 1, label: 'Cash', instructions: 'USD cash' };
      mockDb.getFirstAsync.mockResolvedValue(fakeMethod);

      const { getById } = loadModule();
      const result = await getById(1);

      expect(result).toEqual(fakeMethod);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return null when payment method is not found', async () => {
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

  describe('create', () => {
    it('should create a payment method and return the new id', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 5, changes: 1 });

      const { create } = loadModule();
      const result = await create('Zelle', 'Send to pay@me.com');

      expect(result).toBe(5);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should create a payment method without instructions', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 6, changes: 1 });

      const { create } = loadModule();
      const result = await create('Cash');

      expect(result).toBe(6);
    });

    it('should propagate database errors on create', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { create } = loadModule();
      await expect(create('Fail', 'x')).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('should update a payment method and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

      const { update } = loadModule();
      const result = await update(1, { label: 'Updated Cash' });

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when updating a non-existent payment method', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { update } = loadModule();
      const result = await update(999, { label: 'Ghost' });

      expect(result).toBe(0);
    });

    it('should propagate database errors on update', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Update failed'));

      const { update } = loadModule();
      await expect(update(1, { label: 'Fail' })).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete a payment method and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { delete: deleteMethod } = loadModule();
      const result = await deleteMethod(1);

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when deleting a non-existent payment method', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { delete: deleteMethod } = loadModule();
      const result = await deleteMethod(999);

      expect(result).toBe(0);
    });

    it('should propagate database errors on delete', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Delete failed'));

      const { delete: deleteMethod } = loadModule();
      await expect(deleteMethod(1)).rejects.toThrow('Delete failed');
    });
  });
});
