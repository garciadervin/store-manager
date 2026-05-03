// App-wide constants
export const APP_NAME = 'Store Manager';
export const APP_VERSION = '1.0.0';

// Database
export const DB_NAME = 'store-manager.db';
export const DB_VERSION = 1;

// Exchange rates
export const RATE_SOURCES = {
  BCV: 'bcv',
  PARALLEL: 'parallel',
  BINANCE: 'binance',
} as const;

export type RateSource = (typeof RATE_SOURCES)[keyof typeof RATE_SOURCES];

// API endpoints
export const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares';

// Default rate source key for app_settings
export const SETTING_RATE_SOURCE = 'rate_source';
export const SETTING_DB_VERSION = 'db_version';

// AI
export const GROQ_PROXY_URL = '/api/groq'; // Relative to Vercel deployment
export const AI_MAX_TOKENS = 512;
export const AI_TEMPERATURE = 0.7;

// Pagination
export const PAGE_SIZE = 20;

// Currency
export const USD_SYMBOL = 'USD';
export const VES_SYMBOL = 'Bs.';
