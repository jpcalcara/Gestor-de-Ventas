/**
 * Formatea un número con separador de miles (punto) y decimales (coma)
 * Ejemplo: 1234.56 -> "1.234,56"
 */
export function formatCurrency(value: number | string, decimals: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0,00';
  }

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Formatea un número entero con separador de miles (punto)
 * Ejemplo: 1234 -> "1.234"
 */
export function formatNumber(value: number | string): string {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  if (isNaN(numValue)) {
    return '0';
  }

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

/**
 * Formatea un precio con símbolo de moneda (€)
 * Ejemplo: 1234.56 -> "1.234,56 €"
 */
export function formatPrice(value: number | string, decimals: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0,00 €';
  }

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
}

/**
 * Determina si un valor de stock es bajo (< 50)
 */
export function isLowStock(stock: number): boolean {
  return stock < 50;
}
