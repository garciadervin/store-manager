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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/sale-items.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/sale-items');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('sale-items.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getBySaleId', () => {
      expect(source).toContain('export async function getBySaleId');
    });

    it('should export create', () => {
      expect(source).toContain('export async function create');
    });
  });

  describe('function signatures', () => {
    it('getBySaleId should accept a saleId parameter', () => {
      expect(source).toMatch(/getBySaleId\s*\(\s*saleId\s*[:)]/);
    });

    it('create should accept product_id, sale_id, quantity, unit_price_usd, subtotal_usd', () => {
      expect(source).toMatch(/create\s*\(/);
      expect(source).toContain('product_id');
      expect(source).toContain('sale_id');
      expect(source).toContain('quantity');
      expect(source).toContain('unit_price_usd');
      expect(source).toContain('subtotal_usd');
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the sale_items table', () => {
      expect(source).toContain('sale_items');
    });

    it('should contain INSERT INTO for create', () => {
      expect(source).toContain('INSERT INTO');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('sale-items.ts — unit', () => {
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

  describe('getBySaleId', () => {
    it('should return sale items for a given sale id', async () => {
      const fakeItems = [
        { id: 1, sale_id: 1, product_id: 1, product_name: 'Item A', quantity: 2, unit_price_usd: 10, subtotal_usd: 20 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeItems);

      const { getBySaleId } = loadModule();
      const result = await getBySaleId(1);

      expect(result).toEqual(fakeItems);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when sale has no items', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getBySaleId } = loadModule();
      const result = await getBySaleId(999);

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Query failed'));

      const { getBySaleId } = loadModule();
      await expect(getBySaleId(1)).rejects.toThrow('Query failed');
    });
  });

  describe('create', () => {
    it('should create a sale item and return the new id', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 7, changes: 1 });

      const { create } = loadModule();
      const result = await create({
        product_id: 1,
        sale_id: 1,
        quantity: 2,
        unit_price_usd: 10,
        subtotal_usd: 20,
      });

      expect(result).toBe(7);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should propagate database errors on create', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { create } = loadModule();
      await expect(create({
        product_id: 1,
        sale_id: 1,
        quantity: 1,
        unit_price_usd: 5,
        subtotal_usd: 5,
      })).rejects.toThrow('Insert failed');
    });
  });
});
