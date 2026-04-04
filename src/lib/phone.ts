/**
 * Normalize a phone number to digits only.
 * "054-351-6136" → "0543516136"
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Format a digits-only Israeli phone for display.
 * "0543516136" → "054-351-6136"
 * "035516136"  → "03-551-6136"
 * Non-Israeli or short numbers returned as-is.
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Mobile: 05X-XXX-XXXX (10 digits starting with 05)
  if (digits.length === 10 && digits.startsWith("05")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Landline 2-digit area: 0X-XXX-XXXX (9 digits, area codes 02,03,04,08,09)
  if (digits.length === 9 && /^0[23489]/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  // Landline 3-digit area: 0XX-XXX-XXXX (10 digits, e.g. 072, 073, 077)
  if (digits.length === 10 && /^07[2-9]/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Fallback: return as-is
  return phone;
}
