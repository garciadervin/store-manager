import type { DollarRate, ExchangeRateResult } from '../utils/types';
import { DOLAR_API_URL, RATE_SOURCES } from '../utils/constants';

// ─── In-memory cache ────────────────────────────────────────────────

let cachedRates: DollarRate[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Source name mapping ────────────────────────────────────────────

const SOURCE_NAMES: Record<string, string> = {
  [RATE_SOURCES.BCV]: 'BCV',
  [RATE_SOURCES.PARALLEL]: 'Paralelo',
  [RATE_SOURCES.BINANCE]: 'Binance',
};

// ─── Casa (API field) mapping ───────────────────────────────────────

const CASA_MAP: Record<string, string> = {
  [RATE_SOURCES.BCV]: 'oficial',
  [RATE_SOURCES.PARALLEL]: 'paralelo',
  [RATE_SOURCES.BINANCE]: 'binance',
};

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Fetch all exchange rates from DolarApi.com.
 * Updates the in-memory cache on success.
 */
export async function getAllRates(): Promise<DollarRate[]> {
  const response = await fetch(DOLAR_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch rates: ${response.status}`);
  }
  const data: unknown = await response.json();

  // Validate that the response is an array of DollarRate objects
  if (!Array.isArray(data)) {
    throw new Error('Invalid response: expected an array of rates');
  }

  cachedRates = data as DollarRate[];
  cacheTimestamp = Date.now();
  return data as DollarRate[];
}

/**
 * Get a specific exchange rate by source key.
 * Fetches fresh rates if the cache is empty or expired.
 */
export async function getRate(source: string): Promise<ExchangeRateResult> {
  // Fetch fresh rates if cache is empty or expired
  if (!cachedRates || !cacheTimestamp || Date.now() - cacheTimestamp > CACHE_TTL) {
    await getAllRates();
  }

  const casa = CASA_MAP[source];
  if (!casa || !cachedRates) {
    throw new Error(`Invalid rate source: ${source}`);
  }

  const rate = cachedRates.find((r) => r.casa === casa);
  if (!rate) {
    throw new Error(`Rate not found for source: ${source}`);
  }

  return {
    source,
    rate_buy: rate.compra,
    rate_sell: rate.venta,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Return a cached rate without fetching, or null if not available.
 */
export function getCachedRate(source: string): ExchangeRateResult | null {
  if (!cachedRates || !cacheTimestamp) return null;

  const casa = CASA_MAP[source];
  if (!casa) return null;

  const rate = cachedRates.find((r) => r.casa === casa);
  if (!rate) return null;

  return {
    source,
    rate_buy: rate.compra,
    rate_sell: rate.venta,
    timestamp: new Date(cacheTimestamp).toISOString(),
  };
}

/**
 * Clear the in-memory rate cache.
 */
export function clearCache(): void {
  cachedRates = null;
  cacheTimestamp = null;
}
