export {
  buildPhoneIdentity,
  normalizeOptionalEmail,
  validatePasswordPair,
} from './phone';

import { buildPhoneIdentity, normalizeOptionalEmail } from './phone';

export function normalizePhoneForAuth(raw: string): string {
  return buildPhoneIdentity(raw).phoneNormalized;
}

export function normalizeEmailForAuth(raw: string): string {
  const { emailNormalized } = normalizeOptionalEmail(raw);
  if (!emailNormalized) {
    throw new Error('Invalid email address');
  }
  return emailNormalized;
}
