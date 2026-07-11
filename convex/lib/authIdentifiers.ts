export {
  buildPhoneIdentity,
  normalizeOptionalEmail,
} from './identity';

import { buildPhoneIdentity, normalizeOptionalEmail } from './identity';

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
