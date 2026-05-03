/**
 * Format a USD amount with 2 decimal places
 */
export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a VES amount with 2 decimal places
 */
export function formatVES(amount: number): string {
  return `Bs. ${amount.toFixed(2)}`;
}

/**
 * Format a date string to locale format
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a datetime string
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-VE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate total from sale items
 */
export function calculateSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * Convert USD to VES at a given rate
 */
export function convertToVES(usdAmount: number, rate: number): number {
  return Math.round(usdAmount * rate * 100) / 100;
}
