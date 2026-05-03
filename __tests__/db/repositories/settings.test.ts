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

const SOURCE_PATH = path.resolve(__dirname, '../../../src/db/repositories/settings.ts');

// Helper: when source exists, require returns the module; before that, it throws → TDD red
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../../src/db/repositories/settings');
}

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('settings.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getSetting', () => {
      expect(source).toContain('export async function getSetting');
    });

    it('should export setSetting', () => {
      expect(source).toContain('export async function setSetting');
    });

    it('should export getAllSettings', () => {
      expect(source).toContain('export async function getAllSettings');
    });

    it('should export deleteSetting', () => {
      expect(source).toContain('export async function deleteSetting');
    });
  });

  describe('function signatures', () => {
    it('getSetting should accept a key parameter', () => {
      expect(source).toMatch(/getSetting\s*\(\s*key\s*[:)]/);
    });

    it('setSetting should accept key and value parameters', () => {
      expect(source).toMatch(/setSetting\s*\(\s*key\s*[:)]/);
      expect(source).toContain('value');
    });

    it('getAllSettings should accept no parameters', () => {
      expect(source).toMatch(/getAllSettings\s*\(\s*\)/);
    });

    it('deleteSetting should accept a key parameter', () => {
      expect(source).toMatch(/deleteSetting\s*\(\s*key\s*[:)]/);
    });
  });

  describe('SQL queries', () => {
    it('should contain SELECT queries', () => {
      expect(source).toContain('SELECT');
    });

    it('should reference the app_settings table', () => {
      expect(source).toContain('app_settings');
    });

    it('should contain INSERT OR REPLACE for setSetting', () => {
      expect(source).toContain('INSERT OR REPLACE');
    });

    it('should contain DELETE FROM for deleteSetting', () => {
      expect(source).toContain('DELETE FROM');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock getDatabase and verify runtime behaviour
// ---------------------------------------------------------------
describe('settings.ts — unit', () => {
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

  describe('getSetting', () => {
    it('should return the setting value when found', async () => {
      const fakeSetting = { key: 'store_name', value: 'My Store' };
      mockDb.getFirstAsync.mockResolvedValue(fakeSetting);

      const { getSetting } = loadModule();
      const result = await getSetting('store_name');

      expect(result).toEqual(fakeSetting);
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
    });

    it('should return null when setting key is not found', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const { getSetting } = loadModule();
      const result = await getSetting('nonexistent_key');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('Query failed'));

      const { getSetting } = loadModule();
      await expect(getSetting('store_name')).rejects.toThrow('Query failed');
    });
  });

  describe('setSetting', () => {
    it('should set a setting and return the result', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { setSetting } = loadModule();
      const result = await setSetting('store_name', 'My Store');

      expect(result).toBeDefined();
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should update an existing setting', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { setSetting } = loadModule();
      const result = await setSetting('store_name', 'Updated Name');

      expect(result).toBeDefined();
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Insert failed'));

      const { setSetting } = loadModule();
      await expect(setSetting('key', 'value')).rejects.toThrow('Insert failed');
    });
  });

  describe('getAllSettings', () => {
    it('should return all settings as an array', async () => {
      const fakeSettings = [
        { key: 'store_name', value: 'My Store' },
        { key: 'currency', value: 'USD' },
      ];
      mockDb.getAllAsync.mockResolvedValue(fakeSettings);

      const { getAllSettings } = loadModule();
      const result = await getAllSettings();

      expect(result).toEqual(fakeSettings);
      expect(mockDb.getAllAsync).toHaveBeenCalled();
    });

    it('should return an empty array when no settings exist', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const { getAllSettings } = loadModule();
      const result = await getAllSettings();

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Query failed'));

      const { getAllSettings } = loadModule();
      await expect(getAllSettings()).rejects.toThrow('Query failed');
    });
  });

  describe('deleteSetting', () => {
    it('should delete a setting and return the number of changes', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 1 });

      const { deleteSetting } = loadModule();
      const result = await deleteSetting('store_name');

      expect(result).toBe(1);
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should return 0 when deleting a non-existent setting', async () => {
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });

      const { deleteSetting } = loadModule();
      const result = await deleteSetting('nonexistent_key');

      expect(result).toBe(0);
    });

    it('should propagate database errors on delete', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('Delete failed'));

      const { deleteSetting } = loadModule();
      await expect(deleteSetting('key')).rejects.toThrow('Delete failed');
    });
  });
});
