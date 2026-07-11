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
