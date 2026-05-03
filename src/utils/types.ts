// ─── Database Models ───────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  category: string | null;
  price_usd: number;
  stock_qty: number;
  unit_type: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: number;
  label: string;
  instructions: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  timestamp: string;
  total_usd: number;
  total_ves: number;
  rate_value: number;
  rate_source: string;
  status: 'completed' | 'refunded';
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  subtotal_usd: number;
}

export interface SalePayment {
  id: number;
  sale_id: number;
  method_id: number;
  amount_usd: number;
  created_at: string;
}

export interface Debt {
  id: number;
  sale_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  total_amount_usd: number;
  balance_due_usd: number;
  status: 'pending' | 'partial' | 'settled';
  notes: string | null;
  last_contact_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: number;
  debt_id: number;
  amount_usd: number;
  payment_date: string;
  method_id: number | null;
  notes: string | null;
}

export interface AppSetting {
  key: string;
  value: string;
}

// ─── API Types ────────────────────────────────────────────

export interface DollarRate {
  moneda: string;
  casa: 'oficial' | 'paralelo' | 'binance';
  nombre: string;
  compra: number;
  venta: number;
}

export interface ExchangeRateResult {
  source: string;
  rate_buy: number;
  rate_sell: number;
  timestamp: string;
}

// ─── Form Types ───────────────────────────────────────────

export interface SaleFormItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
}

export interface SaleFormPayment {
  method_id: number;
  amount_usd: number;
}

// ─── AI Types ─────────────────────────────────────────────

export interface GroqRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface GroqResponse {
  content: string;
}
