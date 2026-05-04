import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------
// Paths
// ---------------------------------------------------------------
const SERVICE_SOURCE_PATH = path.resolve(
  __dirname,
  '../../src/services/whatsapp.ts',
);

// ---------------------------------------------------------------
// Mock expo-linking
// ---------------------------------------------------------------
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/services/whatsapp');
}

// ---------------------------------------------------------------
// Test data
// ---------------------------------------------------------------
const mockDebt = {
  id: 1,
  customer_name: 'Juan Pérez',
  customer_phone: '584121234567',
  total_amount_usd: 100,
  balance_due_usd: 45.5,
  status: 'partial',
  notes: null,
  last_contact_date: null,
  created_at: '2026-05-01T10:00:00.000Z',
  updated_at: '2026-05-01T10:00:00.000Z',
  sale_id: null,
};

const mockMethods = [
  { id: 1, label: 'Pago Móvil', instructions: '0412-555-5555', created_at: '' },
  { id: 2, label: 'Zelle', instructions: 'juan@banco.com', created_at: '' },
];

const mockSale = {
  id: 1,
  timestamp: '2026-05-03T12:00:00.000Z',
  total_usd: 20,
  total_ves: 1270,
  rate_value: 63.5,
  rate_source: 'bcv',
  status: 'completed',
  notes: null,
  created_at: '2026-05-03T12:00:00.000Z',
  items: [
    {
      id: 1,
      sale_id: 1,
      product_id: 1,
      product_name: 'Producto A',
      quantity: 2,
      unit_price_usd: 10,
      subtotal_usd: 20,
    },
  ],
  payments: [
    { id: 1, sale_id: 1, method_id: 1, amount_usd: 15, created_at: '2026-05-03T12:00:00.000Z' },
    { id: 2, sale_id: 1, method_id: 2, amount_usd: 5, created_at: '2026-05-03T12:00:00.000Z' },
  ],
};

// ---------------------------------------------------------------
// Structural tests — verify exports by reading source file
// ---------------------------------------------------------------
describe('whatsapp.ts — structural', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SERVICE_SOURCE_PATH, 'utf-8');
  });

  describe('exports', () => {
    it('should export sendWhatsApp function', () => {
      expect(source).toContain('export function sendWhatsApp');
    });

    it('should export formatDebtReminder function', () => {
      expect(source).toContain('export function formatDebtReminder');
    });

    it('should export formatReceipt function', () => {
      expect(source).toContain('export function formatReceipt');
    });
  });

  describe('expo-linking integration', () => {
    it('should use Linking.openURL from expo-linking', () => {
      expect(source).toContain('Linking.openURL');
    });
  });
});

// ---------------------------------------------------------------
// Unit tests — mock expo-linking and verify service behaviour
// ---------------------------------------------------------------
describe('whatsapp.ts — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── sendWhatsApp ────────────────────────────────────────────
  describe('sendWhatsApp', () => {
    it('should call Linking.openURL with a whatsapp:// URL', () => {
      const { sendWhatsApp } = loadModule();
      const { openURL } = require('expo-linking');

      sendWhatsApp('584121234567', 'Hola');

      expect(openURL).toHaveBeenCalledTimes(1);
      const calledUrl = openURL.mock.calls[0][0];
      expect(calledUrl).toMatch(/^whatsapp:\/\/send\?phone=584121234567/);
    });

    it('should encode the message in the URL', () => {
      const { sendWhatsApp } = loadModule();
      const { openURL } = require('expo-linking');

      sendWhatsApp('584121234567', 'Hola, ¿cómo estás?');

      const calledUrl = openURL.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('Hola, ¿cómo estás?'));
    });

    it('should handle empty message gracefully', () => {
      const { sendWhatsApp } = loadModule();
      const { openURL } = require('expo-linking');

      sendWhatsApp('584121234567', '');

      expect(openURL).toHaveBeenCalledTimes(1);
    });
  });

  // ── formatDebtReminder ──────────────────────────────────────
  describe('formatDebtReminder', () => {
    it('should include customer name in the reminder', () => {
      const { formatDebtReminder } = loadModule();

      const result = formatDebtReminder(mockDebt, mockMethods);

      expect(result).toContain('Juan Pérez');
    });

    it('should include balance due formatted in USD', () => {
      const { formatDebtReminder } = loadModule();

      const result = formatDebtReminder(mockDebt, mockMethods);

      expect(result).toContain('45.50');
      expect(result).toContain('USD');
    });

    it('should include payment method instructions', () => {
      const { formatDebtReminder } = loadModule();

      const result = formatDebtReminder(mockDebt, mockMethods);

      expect(result).toContain('Pago Móvil');
      expect(result).toContain('0412-555-5555');
      expect(result).toContain('Zelle');
      expect(result).toContain('juan@banco.com');
    });

    it('should return a string in Spanish', () => {
      const { formatDebtReminder } = loadModule();

      const result = formatDebtReminder(mockDebt, mockMethods);

      expect(typeof result).toBe('string');
      // Common Spanish words expected in a debt reminder
      expect(result).toMatch(/recordatorio|deuda|pendiente|saldo/i);
    });

    it('should work without payment methods (no instructions)', () => {
      const { formatDebtReminder } = loadModule();

      const result = formatDebtReminder(mockDebt, []);

      expect(result).toContain('Juan Pérez');
      expect(result).toContain('45.50');
    });
  });

  // ── formatReceipt ───────────────────────────────────────────
  describe('formatReceipt', () => {
    it('should include merchant/store name', () => {
      const { formatReceipt } = loadModule();

      const result = formatReceipt(mockSale);

      expect(result).toContain('Store Manager');
    });

    it('should include items list with product names', () => {
      const { formatReceipt } = loadModule();

      const result = formatReceipt(mockSale);

      expect(result).toContain('Producto A');
    });

    it('should include total amount', () => {
      const { formatReceipt } = loadModule();

      const result = formatReceipt(mockSale);

      expect(result).toContain('20');
      expect(result).toContain('USD');
    });

    it('should include exchange rate info', () => {
      const { formatReceipt } = loadModule();

      const result = formatReceipt(mockSale);

      expect(result).toContain('63.5');
      expect(result).toContain('bcv');
    });

    it('should return a formatted string in Spanish', () => {
      const { formatReceipt } = loadModule();

      const result = formatReceipt(mockSale);

      expect(typeof result).toBe('string');
      expect(result).toMatch(/recibo|factura|gracias|total/i);
    });
  });
});
