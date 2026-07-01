export function normalizePhoneForAuth(raw: string): string {
  const trimmed = raw.trim();
  const hasInternationalPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  const normalized = hasInternationalPrefix ? `+${digits}` : digits;

  const isLocalAlgerianMobile = /^0[567]\d{8}$/.test(digits);
  const isInternationalAlgerianMobile =
    hasInternationalPrefix && /^213[567]\d{8}$/.test(digits);

  if (!isLocalAlgerianMobile && !isInternationalAlgerianMobile) {
    throw new Error('Invalid Algerian phone number');
  }

  return normalized;
}

export function normalizeOptionalEmail(raw?: string): string | undefined {
  const normalized = raw?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeEmailForAuth(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);

  if (!isValidEmail) {
    throw new Error('Invalid email address');
  }

  return normalized;
}
