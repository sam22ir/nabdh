export const TERMS_VERSION = '2026-07-11';
export const PRIVACY_VERSION = '2026-07-11';

export function createLegalAcceptanceEvidence() {
  return {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    legalAcceptedAt: Date.now(),
  };
}
