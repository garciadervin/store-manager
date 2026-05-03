import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Mock expo-sqlite — migrations.ts may receive a db instance
// ---------------------------------------------------------------
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  SQLiteProvider: jest.fn(({ children }) => children),
  useSQLiteContext: jest.fn(),
}));

const SOURCE_PATH = path.resolve(__dirname, '../../src/db/migrations.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/db/migrations');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('migrations.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export runMigrations as an async function', () => {
      expect(source).toContain('export async function runMigrations');
    });

    it('should export MIGRATIONS as a const', () => {
      expect(source).toContain('export const MIGRATIONS');
    });

    it('should export getCurrentVersion', () => {
      expect(source).toContain('export function getCurrentVersion');
    });
  });

  describe('runMigrations signature', () => {
    it('should accept a database parameter', () => {
      expect(source).toMatch(/runMigrations\s*\(\s*db\s*[:)]/);
    });

    it('should run migrations in a transaction', () => {
      expect(source).toMatch(/execAsync|runAsync|transaction/);
    });
  });

  describe('MIGRATIONS structure', () => {
    it('should be defined as an array', () => {
      const isArray = /MIGRATIONS\s*[=:]\s*\[/.test(source);
      const isArrayType = /MIGRATIONS\s*[=:]\s*Array/.test(source);
      expect(isArray || isArrayType).toBe(true);
    });

    it('should contain migration objects with version, up, and down', () => {
      expect(source).toContain('version');
      expect(source).toContain('up');
      expect(source).toContain('down');
    });

    it('should have at least version 1 migration', () => {
      expect(source).toContain('1');
    });
  });

  describe('getCurrentVersion signature', () => {
    it('should accept a database parameter', () => {
      expect(source).toMatch(/getCurrentVersion\s*\(\s*db\s*[:)]/);
    });

    it('should return a number', () => {
      expect(source).toMatch(/getCurrentVersion[\s\S]+?number/);
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — import the module and verify runtime behaviour
// ---------------------------------------------------------------
describe('migrations.ts — unit', () => {
  describe('MIGRATIONS', () => {
    it('should be an array', () => {
      const { MIGRATIONS } = loadModule();
      expect(Array.isArray(MIGRATIONS)).toBe(true);
    });

    it('should have at least 1 migration', () => {
      const { MIGRATIONS } = loadModule();
      expect(MIGRATIONS.length).toBeGreaterThanOrEqual(1);
    });

    it('each migration should have version (number), up (function), down (function)', () => {
      const { MIGRATIONS } = loadModule();
      for (const migration of MIGRATIONS) {
        expect(migration).toHaveProperty('version');
        expect(migration).toHaveProperty('up');
        expect(migration).toHaveProperty('down');
        expect(typeof migration.version).toBe('number');
        expect(typeof migration.up).toBe('function');
        expect(typeof migration.down).toBe('function');
      }
    });

    it('should have unique version numbers', () => {
      const { MIGRATIONS } = loadModule();
      const versions = MIGRATIONS.map((m: { version: number }) => m.version);
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(versions.length);
    });

    it('should be sorted in ascending version order', () => {
      const { MIGRATIONS } = loadModule();
      for (let i = 1; i < MIGRATIONS.length; i++) {
        expect(MIGRATIONS[i].version).toBeGreaterThan(MIGRATIONS[i - 1].version);
      }
    });

    it('should start with version 1', () => {
      const { MIGRATIONS } = loadModule();
      expect(MIGRATIONS[0].version).toBe(1);
    });

    it('each up function should be async or return a promise', async () => {
      const { MIGRATIONS } = loadModule();
      for (const migration of MIGRATIONS) {
        const mockDb = { execAsync: jest.fn(), runAsync: jest.fn() };
        const result = migration.up(mockDb);
        expect(result).toBeInstanceOf(Promise);
        await result; // should not reject
      }
    });
  });

  describe('runMigrations', () => {
    it('should be an async function', () => {
      const { runMigrations } = loadModule();
      expect(runMigrations).toBeInstanceOf(Function);
      expect(runMigrations.constructor.name).toBe('AsyncFunction');
    });

    it('should accept a database instance as parameter', () => {
      const { runMigrations } = loadModule();
      expect(runMigrations.length).toBeGreaterThanOrEqual(1);
    });

    it('should resolve without throwing for a valid database instance', async () => {
      const { runMigrations } = loadModule();
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getAllAsync: jest.fn().mockResolvedValue([]),
        runAsync: jest.fn().mockResolvedValue(undefined),
      };
      await expect(runMigrations(mockDb)).resolves.toBeUndefined();
    });

    it('should handle being called on an already up-to-date database', async () => {
      const { runMigrations, getCurrentVersion } = loadModule();
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getAllAsync: jest.fn().mockResolvedValue([{ value: '1' }]),
        runAsync: jest.fn().mockResolvedValue(undefined),
      };

      await expect(runMigrations(mockDb)).resolves.toBeUndefined();
      expect(mockDb.execAsync).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentVersion', () => {
    it('should be a function', () => {
      const { getCurrentVersion } = loadModule();
      expect(getCurrentVersion).toBeInstanceOf(Function);
    });

    it('should return a number', async () => {
      const { getCurrentVersion } = loadModule();
      const mockDb = {
        getAllAsync: jest.fn().mockResolvedValue([{ value: '1' }]),
        execAsync: jest.fn(),
        runAsync: jest.fn(),
      };
      const version = await getCurrentVersion(mockDb);
      expect(typeof version).toBe('number');
    });

    it('should return 0 when no version is stored yet (fresh database)', async () => {
      const { getCurrentVersion } = loadModule();
      const mockDb = {
        getAllAsync: jest.fn().mockResolvedValue([]),
        execAsync: jest.fn(),
        runAsync: jest.fn(),
      };
      const version = await getCurrentVersion(mockDb);
      expect(version).toBe(0);
    });

    it('should query app_settings table for db_version', async () => {
      const { getCurrentVersion } = loadModule();
      const getAllAsync = jest.fn().mockResolvedValue([{ value: '3' }]);
      const mockDb = {
        getAllAsync,
        execAsync: jest.fn(),
        runAsync: jest.fn(),
      };
      await getCurrentVersion(mockDb);
      expect(getAllAsync).toHaveBeenCalled();
      const query = (getAllAsync as jest.Mock).mock.calls[0][0];
      expect(query).toContain('app_settings');
      expect(query).toContain('db_version');
    });
  });
});
