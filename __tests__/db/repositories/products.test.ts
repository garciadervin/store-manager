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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/products.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/products');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('products.ts — structural', () => {
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

    it('should export searchProducts', () => {
      expect(source).toContain('export async function searchProducts');
    });

    it('should export getProductsByCategory', () => {
      expect(source).toContain('export async function getProductsByCategory');
    });
  });

  describe('function signatures', () => {
    it('getAll should accept no parameters', () => {
      expect(source).toMatch(/getAll\s*\(\s*\)/);
    });

    it('getById should accept an id parameter', () => {
      expect(source).toMatch(/getById\s*\(\s*id\s*[:)]/);
    });

    it('create should accept name, price_usd, stock_qty parameters', () => {
      expect(source).toMatch(/create\s*\(/);
      expect(source).toContain('name');
      expect(source).toContain('price_usd');
      expect(source).toContain('stock_qty');
    });

    it('update should accept an id parameter', () => {
      expect(source).toMatch(/update\s*\(\s*id\s*[:)]/);
    });

    it('delete should accept an id parameter', () => {
      expect(source).toMatch(/delete\s*\(\s*id\s*[:)]/);
    });

    it('searchProducts should accept a query parameter', () => {
      expect(source).toMatch(/searchProducts\s*\(\s*query\s*[:)]/);
    });

    it('getProductsByCategory should accept a category parameter', () => {
      expect(source).toMatch(/getProductsByCategory\s*\(\s*category\s*[:)]/);
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the products table', () => {
      expect(source).toContain('products');
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
describe('products.ts — unit', () => {
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
    it('should return an array of products', async () => {
      const fakeProducts = [
        { id: 1, name: 'Product A', price_usd: 10, stock_qty: 5 },
        { id: 2, name: 'Product B', price_usd: 20, stock_qty: 3 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeProducts);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual(fakeProducts);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no products exist', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getAll } = loadModule();
      const result = await getAll();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      const dbError = new Error('DB connection lost');
      mockDb.getAllAsync.mockRejectedValue(dbError);

      const { getAll } = loadModule();
      await expect(getAll()).rejects.toThrow('DB connection lost');
    });
  });

  describe('getById', () => {
    it('should return a product when found', async () => {
      const fakeProduct = { id: 1, name: 'Product A', price_usd: 10, stock_qty: 5 };
      mockDb.getFirstAsync.mockResolvedValue(fakeProduct);

      const { getById } = loadModule();
      const result = await getById(1);

      expect(result).toEqual(fakeProduct);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return null when product is not found', async () => {
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
    it('should create a product and return the new id', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 42, changes: 1 });

      const { create } = loadModule();
      const result = await create('New Product', 15.99, 10);

      expect(result).toBe(42);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should propagate database errors on create', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { create } = loadModule();
      await expect(create('Fail', 1, 1)).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('should update a product and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

      const { update } = loadModule();
      const result = await update(1, { name: 'Updated', price_usd: 12 });

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when updating a non-existent product', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { update } = loadModule();
      const result = await update(999, { name: 'Ghost' });

      expect(result).toBe(0);
    });

    it('should propagate database errors on update', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Update failed'));

      const { update } = loadModule();
      await expect(update(1, { name: 'Fail' })).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete a product and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { delete: deleteProduct } = loadModule();
      const result = await deleteProduct(1);

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when deleting a non-existent product', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { delete: deleteProduct } = loadModule();
      const result = await deleteProduct(999);

      expect(result).toBe(0);
    });

    it('should propagate database errors on delete', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Delete failed'));

      const { delete: deleteProduct } = loadModule();
      await expect(deleteProduct(1)).rejects.toThrow('Delete failed');
    });
  });

  describe('searchProducts', () => {
    it('should return matching products for a search query', async () => {
      const fakeResults = [
        { id: 1, name: 'Coca Cola', price_usd: 1.5, stock_qty: 100 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeResults);

      const { searchProducts } = loadModule();
      const result = await searchProducts('coca');

      expect(result).toEqual(fakeResults);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no products match', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { searchProducts } = loadModule();
      const result = await searchProducts('zzzzz');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Search failed'));

      const { searchProducts } = loadModule();
      await expect(searchProducts('test')).rejects.toThrow('Search failed');
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products for a given category', async () => {
      const fakeProducts = [
        { id: 1, name: 'Beer', category: 'drinks', price_usd: 2, stock_qty: 50 },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeProducts);

      const { getProductsByCategory } = loadModule();
      const result = await getProductsByCategory('drinks');

      expect(result).toEqual(fakeProducts);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when category has no products', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getProductsByCategory } = loadModule();
      const result = await getProductsByCategory('nonexistent');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Category query failed'));

      const { getProductsByCategory } = loadModule();
      await expect(getProductsByCategory('drinks')).rejects.toThrow('Category query failed');
    });
  });
});
