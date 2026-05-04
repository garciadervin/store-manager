import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const SERVICE_SOURCE_PATH = path.resolve(
  __dirname,
  '../../src/services/exchange-rate.ts',
);

// ---------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/exchange-rate');
}

// ---------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------
const mockDollarApiResponse = [
  {
    moneda: 'USD',
    casa: 'oficial',
    nombre: 'Dólar Oficial',
    compra: 63.5,
    venta: 64.0,
  },
  {
    moneda: 'USD',
    casa: 'paralelo',
    nombre: 'Dólar Paralelo',
    compra: 70.2,
    venta: 71.5,
  },
  {
    moneda: 'USD',
    casa: 'binance',
    nombre: 'Binance',
    compra: 68.0,
    venta: 69.0,
  },
];

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('exchange-rate.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SERVICE_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export getAllRates function', () => {
      expect(source).toContain('export async function getAllRates');
    });

    it('should export getRate function', () => {
      expect(source).toContain('export async function getRate');
    });

    it('should export getCachedRate function', () => {
      expect(source).toContain('export function getCachedRate');
    });

    it('should export clearCache function', () => {
      expect(source).toContain('export function clearCache');
    });
  });

  describe('API integration', () => {
    it('should fetch from DOLAR_API_URL constant', () => {
      expect(source).toContain('DOLAR_API_URL');
    });

    it('should use fetch to call the API', () => {
      expect(source).toContain('fetch(');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock fetch and verify service behaviour
// ---------------------------------------------------------------
describe('exchange-rate.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache before each test
    const { clearCache } = loadModule();
    clearCache();
  });

  // ── getAllRates ─────────────────────────────────────────────
  describe('getAllRates', () => {
    it('should fetch from DolarApi URL and return DollarRate array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDollarApiResponse,
      });

      const { getAllRates } = loadModule();
      const rates = await getAllRates();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://dolarapi.com/v1/dolares',
      );
      expect(rates).toHaveLength(3);
      expect(rates[0]).toMatchObject({
        moneda: 'USD',
        casa: 'oficial',
        compra: 63.5,
        venta: 64.0,
      });
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { getAllRates } = loadModule();

      await expect(getAllRates()).rejects.toThrow('Network failure');
    });

    it('should throw on non-ok HTTP response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { getAllRates } = loadModule();

      await expect(getAllRates()).rejects.toThrow();
    });

    it('should throw on malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => 'not-an-array',
      });

      const { getAllRates } = loadModule();

      await expect(getAllRates()).rejects.toThrow();
    });
  });

  // ── getRate ─────────────────────────────────────────────────
  describe('getRate', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDollarApiResponse,
      });
      // Pre-populate cache by calling getAllRates
      const { getAllRates } = loadModule();
      await getAllRates();
    });

    it('should return ExchangeRateResult for source "bcv"', async () => {
      const { getRate } = loadModule();
      const result = await getRate('bcv');

      expect(result).toMatchObject({
        source: 'bcv',
        rate_buy: 63.5,
        rate_sell: 64.0,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should return ExchangeRateResult for source "parallel"', async () => {
      const { getRate } = loadModule();
      const result = await getRate('parallel');

      expect(result).toMatchObject({
        source: 'parallel',
        rate_buy: 70.2,
        rate_sell: 71.5,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should return ExchangeRateResult for source "binance"', async () => {
      const { getRate } = loadModule();
      const result = await getRate('binance');

      expect(result).toMatchObject({
        source: 'binance',
        rate_buy: 68.0,
        rate_sell: 69.0,
      });
      expect(result).toHaveProperty('timestamp');
    });

    it('should throw for invalid source', async () => {
      const { getRate } = loadModule();

      await expect(getRate('invalid')).rejects.toThrow();
    });

    it('should throw when no rates are cached', async () => {
      jest.clearAllMocks();
      const { clearCache, getRate } = loadModule();
      clearCache();

      await expect(getRate('bcv')).rejects.toThrow();
    });
  });

  // ── getCachedRate ───────────────────────────────────────────
  describe('getCachedRate', () => {
    it('should return null before any fetch', () => {
      const { getCachedRate } = loadModule();
      const result = getCachedRate('bcv');

      expect(result).toBeNull();
    });

    it('should return rate after getAllRates was called', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDollarApiResponse,
      });

      const { getAllRates, getCachedRate } = loadModule();
      await getAllRates();

      const result = getCachedRate('bcv');
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        source: 'bcv',
        rate_buy: 63.5,
        rate_sell: 64.0,
      });
    });

    it('should return null for uncached source after fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDollarApiResponse,
      });

      const { getAllRates, getCachedRate } = loadModule();
      await getAllRates();

      const result = getCachedRate('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── clearCache ──────────────────────────────────────────────
  describe('clearCache', () => {
    it('should clear the cache so getCachedRate returns null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDollarApiResponse,
      });

      const { getAllRates, getCachedRate, clearCache } = loadModule();
      await getAllRates();

      // Verify cache is populated
      expect(getCachedRate('bcv')).not.toBeNull();

      // Clear and verify
      clearCache();
      expect(getCachedRate('bcv')).toBeNull();
    });
  });
});
