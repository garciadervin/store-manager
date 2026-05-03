import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Mock expo-sqlite — schema.ts shouldn't import it, but keep for safety
// ---------------------------------------------------------------
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: jest.fn(({ children }) => children),
  useSQLiteContext: jest.fn(),
}));

const SOURCE_PATH = path.resolve(__dirname, '../../src/db/schema.ts');

// Expected table names from project-spec.md
const EXPECTED_TABLES = [
  'products',
  'payment_methods',
  'sales',
  'sale_items',
  'sale_payments',
  'debts',
  'debt_payments',
  'app_settings',
] as const;

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/db/schema');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('schema.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getSchemaSQL', () => {
      expect(source).toContain('export function getSchemaSQL');
    });

    it('should export TABLE_NAMES', () => {
      expect(source).toContain('export const TABLE_NAMES');
    });

    it('should export getCreateTableSQL', () => {
      expect(source).toContain('export function getCreateTableSQL');
    });
  });

  describe('TABLE_NAMES contains all 8 tables', () => {
    it('should contain all 8 expected table name strings', () => {
      for (const table of EXPECTED_TABLES) {
        expect(source).toContain(table);
      }
    });

    it('should have TABLE_NAMES as an enum or const object', () => {
      const hasEnum = /(enum\s+TABLE_NAMES|TABLE_NAMES\s*=\s*\{)/.test(source);
      expect(hasEnum).toBe(true);
    });

    it('should define exactly 8 entries in TABLE_NAMES', () => {
      const tableNamesBlock = source.match(/TABLE_NAMES\s*=\s*\{([^}]+)\}/s);
      if (tableNamesBlock) {
        const entries = tableNamesBlock[1].match(/\w+\s*:/g);
        expect(entries).toHaveLength(8);
      }
    });
  });

  describe('getSchemaSQL returns full schema', () => {
    it('should contain CREATE TABLE IF NOT EXISTS statement', () => {
      expect(source).toContain('CREATE TABLE IF NOT EXISTS');
    });

    it('should contain products table definition', () => {
      expect(source).toContain('price_usd');
      expect(source).toContain('stock_qty');
    });

    it('should contain sales table definition', () => {
      expect(source).toContain('total_usd');
      expect(source).toContain('total_ves');
    });

    it('should contain debts table definition', () => {
      expect(source).toContain('balance_due_usd');
      expect(source).toContain('customer_name');
    });

    it('should contain indexes for products, sales, and debts', () => {
      expect(source).toContain('CREATE INDEX IF NOT EXISTS');
    });
  });

  describe('getCreateTableSQL signature', () => {
    it('should accept a tableName parameter', () => {
      expect(source).toMatch(/getCreateTableSQL\s*\(\s*tableName\s*[:)]/);
    });

    it('should return a string', () => {
      expect(source).toMatch(/getCreateTableSQL[\s\S]+?string/);
    });

    it('should handle unknown table names with an error or fallback', () => {
      const hasErrorHandling =
        source.includes('throw') ||
        source.includes('Error') ||
        source.includes('unknown') ||
        source.includes('default');
      expect(hasErrorHandling).toBe(true);
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — import the module and verify runtime behaviour
// ---------------------------------------------------------------
describe('schema.ts — unit', () => {
  describe('getSchemaSQL', () => {
    it('should return a string', () => {
      const { getSchemaSQL } = loadModule();
      const sql = getSchemaSQL();
      expect(typeof sql).toBe('string');
    });

    it('should contain CREATE TABLE IF NOT EXISTS for products', () => {
      const { getSchemaSQL } = loadModule();
      const sql = getSchemaSQL();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
      expect(sql).toContain('products');
    });

    it('should contain CREATE TABLE statements for all 8 tables', () => {
      const { getSchemaSQL } = loadModule();
      const sql = getSchemaSQL();
      for (const table of EXPECTED_TABLES) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      }
    });

    it('should contain CREATE INDEX statements', () => {
      const { getSchemaSQL } = loadModule();
      const sql = getSchemaSQL();
      expect(sql).toContain('CREATE INDEX');
    });

    it('should contain all expected columns for products table', () => {
      const { getSchemaSQL } = loadModule();
      const sql = getSchemaSQL();
      expect(sql).toContain('price_usd');
      expect(sql).toContain('stock_qty');
      expect(sql).toContain('unit_type');
      expect(sql).toContain('category');
      expect(sql).toContain('created_at');
      expect(sql).toContain('updated_at');
    });
  });

  describe('TABLE_NAMES', () => {
    it('should be an object with all 8 expected keys', () => {
      const { TABLE_NAMES } = loadModule();
      const expectedKeys = [
        'PRODUCTS',
        'PAYMENT_METHODS',
        'SALES',
        'SALE_ITEMS',
        'SALE_PAYMENTS',
        'DEBTS',
        'DEBT_PAYMENTS',
        'APP_SETTINGS',
      ];
      for (const key of expectedKeys) {
        expect(TABLE_NAMES).toHaveProperty(key);
      }
    });

    it('should map to correct table name strings', () => {
      const { TABLE_NAMES } = loadModule();
      expect(TABLE_NAMES.PRODUCTS).toBe('products');
      expect(TABLE_NAMES.PAYMENT_METHODS).toBe('payment_methods');
      expect(TABLE_NAMES.SALES).toBe('sales');
      expect(TABLE_NAMES.SALE_ITEMS).toBe('sale_items');
      expect(TABLE_NAMES.SALE_PAYMENTS).toBe('sale_payments');
      expect(TABLE_NAMES.DEBTS).toBe('debts');
      expect(TABLE_NAMES.DEBT_PAYMENTS).toBe('debt_payments');
      expect(TABLE_NAMES.APP_SETTINGS).toBe('app_settings');
    });

    it('should not have extra unexpected keys', () => {
      const { TABLE_NAMES } = loadModule();
      const entries = Object.keys(TABLE_NAMES);
      expect(entries).toHaveLength(8);
    });

    it('should have all values as non-empty strings', () => {
      const { TABLE_NAMES } = loadModule();
      for (const value of Object.values(TABLE_NAMES)) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getCreateTableSQL', () => {
    it('should return SQL for products table', () => {
      const { getCreateTableSQL, TABLE_NAMES } = loadModule();
      const sql = getCreateTableSQL(TABLE_NAMES.PRODUCTS);
      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS products');
      expect(sql).toContain('price_usd');
      expect(sql).toContain('stock_qty');
    });

    it('should return SQL for sales table', () => {
      const { getCreateTableSQL, TABLE_NAMES } = loadModule();
      const sql = getCreateTableSQL(TABLE_NAMES.SALES);
      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS sales');
      expect(sql).toContain('total_usd');
      expect(sql).toContain('total_ves');
    });

    it('should return SQL for debts table', () => {
      const { getCreateTableSQL, TABLE_NAMES } = loadModule();
      const sql = getCreateTableSQL(TABLE_NAMES.DEBTS);
      expect(typeof sql).toBe('string');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS debts');
      expect(sql).toContain('balance_due_usd');
      expect(sql).toContain('customer_name');
    });

    it('should throw or return empty string for unknown table', () => {
      const { getCreateTableSQL } = loadModule();
      expect(() => getCreateTableSQL('nonexistent_table')).toThrow();
    });

    it('should throw for empty string table name', () => {
      const { getCreateTableSQL } = loadModule();
      expect(() => getCreateTableSQL('')).toThrow();
    });
  });
});
