import * as Linking from 'expo-linking';

import { formatUSD } from '../utils/format';
import type { Debt, PaymentMethod } from '../utils/types';

/**
 * Opens WhatsApp with a pre-filled message to the given phone number.
 */
export function sendWhatsApp(phone: string, message: string): Promise<void> {
  const encoded = encodeURIComponent(message);
  const url = `whatsapp://send?phone=${phone}&text=${encoded}`;
  return Linking.openURL(url);
}

/**
 * Formats a friendly debt reminder message in Spanish.
 */
export function formatDebtReminder(debt: Debt, paymentMethods: PaymentMethod[]): string {
  let message = `¡Hola ${debt.customer_name}! 🙋‍♂️\n\n`;
  message += `Te recordamos que tienes un saldo pendiente de *${formatUSD(debt.balance_due_usd)} USD*.\n\n`;

  if (paymentMethods.length > 0) {
    message += `Puedes pagar a través de:\n`;
    for (const method of paymentMethods) {
      message += `📍 ${method.label}`;
      if (method.instructions) {
        message += `: ${method.instructions}`;
      }
      message += '\n';
    }
    message += '\n';
  }

  message += `¡Gracias por tu preferencia! 🙏`;
  return message;
}

/**
 * Formats a sale receipt for sharing via WhatsApp.
 */
export function formatReceipt(sale: {
  id?: number;
  timestamp?: string;
  created_at?: string;
  total_usd: number;
  total_ves?: number;
  rate_value?: number;
  rate_source?: string;
  items?: Array<{
    product_name: string;
    quantity: number;
    subtotal_usd: number;
  }>;
}): string {
  let receipt = `🧾 *RECIBO DE COMPRA*\n`;
  receipt += `━━━━━━━━━━━━━━━━\n`;
  receipt += `Tienda: Store Manager\n`;
  receipt += `Fecha: ${new Date(sale.timestamp || sale.created_at || '').toLocaleDateString('es-VE')}\n\n`;

  if (sale.items && sale.items.length > 0) {
    receipt += `*PRODUCTOS:*\n`;
    for (const item of sale.items) {
      receipt += `• ${item.product_name} x${item.quantity} = ${formatUSD(item.subtotal_usd)}\n`;
    }
    receipt += '\n';
  }

  receipt += `*TOTAL: ${formatUSD(sale.total_usd)} USD*\n`;

  if (sale.total_ves !== undefined) {
    receipt += `Total en Bs.: ${sale.total_ves.toFixed(2)}\n`;
  }
  if (sale.rate_value !== undefined) {
    receipt += `Tasa: ${sale.rate_value} (${sale.rate_source || 'N/A'})\n`;
  }

  receipt += `━━━━━━━━━━━━━━━━\n`;
  receipt += `¡Gracias por su compra!`;
  return receipt;
}
