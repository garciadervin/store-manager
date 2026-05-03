import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Mock expo-sqlite for unit tests that import connection.ts
// ---------------------------------------------------------------
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: jest.fn(({ children }) => children),
  useSQLiteContext: jest.fn(),
}));

const SOURCE_PATH = path.resolve(__dirname, '../../src/db/connection.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/db/connection');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('connection.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('file exists and exports are defined', () => {
    it('should export initDatabase as an async function', () => {
      expect(source).toContain('export async function initDatabase');
    });

    it('should export getDatabase as a function', () => {
      expect(source).toContain('export function getDatabase');
    });

    it('should export DB_NAME as a const', () => {
      expect(source).toContain('export const DB_NAME');
    });
  });

  describe('initDatabase signature', () => {
    it('should declare initDatabase with correct parameter list', () => {
      expect(source).toMatch(/export async function initDatabase\s*\(\s*\)/);
    });

    it('should call openDatabaseAsync inside initDatabase', () => {
      expect(source).toMatch(/openDatabaseAsync\s*\(/);
    });
  });

  describe('getDatabase signature', () => {
    it('should declare getDatabase with correct parameter list', () => {
      expect(source).toMatch(/export function getDatabase\s*\(\s*\)/);
    });

    it('should return a typed database instance', () => {
      expect(source).toMatch(/SQLiteDatabase|getDatabase\s*\(/);
    });
  });

  describe('DB_NAME value', () => {
    it('should define DB_NAME with a string ending in .db', () => {
      expect(source).toMatch(/DB_NAME\s*=\s*['"].*\.db['"]/);
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — import the module and verify runtime behaviour
// ---------------------------------------------------------------
describe('connection.ts — unit', () => {
  describe('initDatabase', () => {
    it('should be an async function', () => {
      const mod = loadModule();
      expect(mod.initDatabase).toBeInstanceOf(Function);
      expect(mod.initDatabase.constructor.name).toBe('AsyncFunction');
    });

    it('should resolve without throwing', async () => {
      const { initDatabase } = loadModule();
      const mockDb = { execAsync: jest.fn(), getAllAsync: jest.fn(), runAsync: jest.fn() };
      const { openDatabaseAsync } = require('expo-sqlite');
      (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);

      await initDatabase();

      expect(openDatabaseAsync).toHaveBeenCalled();
    });
  });

  describe('getDatabase', () => {
    it('should return a database instance after initDatabase has been called', async () => {
      const { initDatabase, getDatabase } = loadModule();
      const mockDb = { execAsync: jest.fn(), getAllAsync: jest.fn(), runAsync: jest.fn() };
      const { openDatabaseAsync } = require('expo-sqlite');
      (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);

      await initDatabase();
      const db = getDatabase();

      expect(db).toBeDefined();
      expect(typeof db.execAsync).toBe('function');
      expect(typeof db.getAllAsync).toBe('function');
      expect(typeof db.runAsync).toBe('function');
    });

    it('should throw if called before initDatabase', () => {
      const { getDatabase } = loadModule();
      expect(() => getDatabase()).toThrow();
    });
  });

  describe('DB_NAME constant', () => {
    it('should be a non-empty string', () => {
      const { DB_NAME } = loadModule();
      expect(DB_NAME).toBeDefined();
      expect(typeof DB_NAME).toBe('string');
      expect(DB_NAME.length).toBeGreaterThan(0);
    });

    it('should end with .db extension', () => {
      const { DB_NAME } = loadModule();
      expect(DB_NAME).toMatch(/\.db$/);
    });
  });

  describe('singleton behaviour', () => {
    it('should only initialise the database once on multiple calls', async () => {
      const { initDatabase } = loadModule();
      const { openDatabaseAsync } = require('expo-sqlite');
      (openDatabaseAsync as jest.Mock).mockResolvedValue({
        execAsync: jest.fn(),
        getAllAsync: jest.fn(),
        runAsync: jest.fn(),
      });

      await initDatabase();
      await initDatabase(); // Second call should not throw

      expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    });

    it('should return the same database reference from getDatabase every time', async () => {
      const { initDatabase, getDatabase } = loadModule();
      const mockDb = { execAsync: jest.fn(), getAllAsync: jest.fn(), runAsync: jest.fn() };
      const { openDatabaseAsync } = require('expo-sqlite');
      (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);

      await initDatabase();
      const ref1 = getDatabase();
      const ref2 = getDatabase();

      expect(ref1).toBe(ref2);
    });
  });

  describe('error handling', () => {
    it('should propagate openDatabaseAsync errors', async () => {
      const { initDatabase } = loadModule();
      const { openDatabaseAsync } = require('expo-sqlite');
      const testError = new Error('DB open failed');
      (openDatabaseAsync as jest.Mock).mockRejectedValue(testError);

      await expect(initDatabase()).rejects.toThrow('DB open failed');
    });

    it('should pass DB_NAME to openDatabaseAsync', async () => {
      const { initDatabase, DB_NAME } = loadModule();
      const { openDatabaseAsync } = require('expo-sqlite');
      (openDatabaseAsync as jest.Mock).mockResolvedValue({
        execAsync: jest.fn(),
        getAllAsync: jest.fn(),
        runAsync: jest.fn(),
      });

      await initDatabase();

      expect(openDatabaseAsync).toHaveBeenCalledWith(DB_NAME);
    });
  });
});
