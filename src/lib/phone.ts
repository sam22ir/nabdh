export type PhoneIdentity = {
  phone: string;
  phoneNormalized: string;
  phoneLoginKey: string;
};

export type OptionalEmailIdentity = {
  email: string | undefined;
  emailNormalized: string | undefined;
};

export function buildPhoneIdentity(raw: string): PhoneIdentity {
  const phone = raw.trim();
  const compact = phone.replace(/[\s().-]/g, '');
  const digits = compact.replace(/\D/g, '');

  let nationalDigits: string;
  if (/^0[567]\d{8}$/.test(digits) && !compact.startsWith('+')) {
    nationalDigits = digits.slice(1);
  } else if (/^213[567]\d{8}$/.test(digits) && compact.startsWith('+')) {
    nationalDigits = digits.slice(3);
  } else {
    throw new Error('Invalid Algerian mobile phone number');
  }

  return {
    phone,
    phoneNormalized: `+213${nationalDigits}`,
    phoneLoginKey: `dz213${nationalDigits}`,
  };
}

export function buildClerkPasswordIdentifier(raw: string): string {
  return buildClerkPasswordIdentifierFromLoginKey(
    buildPhoneIdentity(raw).phoneLoginKey,
  );
}

export function buildClerkPasswordIdentifierFromLoginKey(
  phoneLoginKey: string,
): string {
  return phoneLoginKey;
}

export function buildUniquePhoneLoginKey(
  raw: string,
  nonce = Date.now(),
): string {
  return `${buildPhoneIdentity(raw).phoneLoginKey}x${nonce}`;
}

export function normalizeOptionalEmail(raw?: string): OptionalEmailIdentity {
  const email = raw?.trim() ?? '';
  if (email.length === 0) {
    return { email: undefined, emailNormalized: undefined };
  }

  const emailNormalized = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
    throw new Error('Invalid email address');
  }

  return { email, emailNormalized };
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string,
): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!isPasswordStrongEnough(password)) {
    return 'Password is not strong enough';
  }
  if (password !== confirmPassword) {
    return 'Passwords must match';
  }
  return null;
}

export function isPasswordStrongEnough(password: string): boolean {
  const normalized = password.trim().toLowerCase();
  if (normalized.length < 8) return false;

  const hasLetter = /[a-z]/i.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) return false;

  if (/^(.)\1+$/.test(normalized)) return false;

  const weakFragments = [
    '123456',
    '654321',
    'abcdef',
    'qwerty',
    'azerty',
    'password',
    'letmein',
  ];

  return !weakFragments.some((fragment) => normalized.includes(fragment));
}
