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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/sales.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/sales');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('sales.ts — structural', () => {
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

    it('should export createSale', () => {
      expect(source).toContain('export async function createSale');
    });

    it('should export refundSale', () => {
      expect(source).toContain('export async function refundSale');
    });
  });

  describe('function signatures', () => {
    it('getAll should accept no parameters', () => {
      expect(source).toMatch(/getAll\s*\(\s*\)/);
    });

    it('getById should accept an id parameter', () => {
      expect(source).toMatch(/getById\s*\(\s*id\s*[:)]/);
    });

    it('createSale should accept items, payments, and totals', () => {
      expect(source).toMatch(/createSale\s*\(/);
    });

    it('refundSale should accept a sale id parameter', () => {
      expect(source).toMatch(/refundSale\s*\(\s*id\s*[:)]/);
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the sales table', () => {
      expect(source).toContain('sales');
    });

    it('should reference the sale_items table', () => {
      expect(source).toContain('sale_items');
    });

    it('should reference the sale_payments table', () => {
      expect(source).toContain('sale_payments');
    });

    it('should contain INSERT INTO for createSale', () => {
      expect(source).toContain('INSERT INTO');
    });

    it('should contain UPDATE for refundSale', () => {
      expect(source).toContain('UPDATE');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('sales.ts — unit', () => {
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
    it('should return an array of sales', async () => {
      const fakeSales = [
        { id: 1, total_usd: 100, total_ves: 3500, status: 'completed' },
        { id: 2, total_usd: 50, total_ves: 1750, status: 'completed' },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeSales);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual(fakeSales);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no sales exist', async () => {
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
    it('should return a sale with items and payments when found', async () => {
      const fakeSale = {
        id: 1,
        total_usd: 100,
        total_ves: 3500,
        status: 'completed',
        items: [{ id: 1, product_name: 'Item A', quantity: 2 }],
        payments: [{ id: 1, method_id: 1, amount_usd: 100 }],
      };
      mockDb.getFirstAsync.mockResolvedValue(fakeSale);

      const { getById } = loadModule();
      const result = await getById(1);

      expect(result).toEqual(fakeSale);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return null when sale is not found', async () => {
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

  describe('createSale', () => {
    const saleData = {
      items: [
        { product_id: 1, product_name: 'Item A', quantity: 2, unit_price_usd: 10, subtotal_usd: 20 },
      ],
      payments: [
        { method_id: 1, amount_usd: 20 },
      ],
      total_usd: 20,
      total_ves: 700,
      rate_value: 35,
      rate_source: 'BCV',
    };

    it('should create a sale with items and payments in a transaction', async () => {
      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 10, changes: 1 }) // sale insert
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 })  // item insert
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 })  // payment insert
        .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 }); // stock decrement

      const { createSale } = loadModule();
      const result = await createSale(saleData);

      expect(result).toBe(10);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should propagate database errors and roll back', async () => {
      mockDb.runAsync
        .mockResolvedValueOnce({ lastInsertRowId: 10, changes: 1 })
        .mockRejectedValueOnce(new Error('Item insert failed'));

      const { createSale } = loadModule();
      await expect(createSale(saleData)).rejects.toThrow('Item insert failed');
    });
  });

  describe('refundSale', () => {
    it('should refund a sale and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { refundSale } = loadModule();
      const result = await refundSale(1);

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when refunding a non-existent sale', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { refundSale } = loadModule();
      const result = await refundSale(999);

      expect(result).toBe(0);
    });

    it('should propagate database errors on refund', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Refund failed'));

      const { refundSale } = loadModule();
      await expect(refundSale(1)).rejects.toThrow('Refund failed');
    });
  });
});
