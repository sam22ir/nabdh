import { buildPhoneIdentity, normalizeOptionalEmail, validatePasswordPair } from './phone';
import type { PublicAuthRole } from './roleSelection';

export type Gender = 'male' | 'female';
export type FormErrors = Record<string, string>;

const messages = {
  fullName: 'الاسم مطلوب',
  clinicName: 'اسم المركز مطلوب',
  gender: 'اختر الجنس',
  phone: 'رقم هاتف جزائري صحيح مطلوب',
  email: 'البريد الإلكتروني غير صحيح',
  emailRequired: 'البريد الإلكتروني مطلوب لاستعادة كلمة المرور',
  password: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
  passwordStrength: 'كلمة المرور ضعيفة. استخدم أحرفا وأرقاما وتجنب الأرقام المتسلسلة',
  confirmPassword: 'كلمتا المرور غير متطابقتين',
  specialtyId: 'اختر التخصص',
  wilayaId: 'اختر الولاية',
};

export const weakPasswordMessage = messages.passwordStrength;

export type LoginInput = {
  phone: string;
  password: string;
};

export type BaseRegistrationInput = {
  fullName: string;
  gender: Gender | null;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type PatientRegistrationInput = BaseRegistrationInput;

export type DoctorRegistrationInput = BaseRegistrationInput & {
  specialtyId: string | null;
  wilayaId: string | null;
};

export type ClinicRegistrationInput = {
  clinicName: string;
  phone: string;
  email: string;
  wilayaId: string | null;
  address: string;
  mapUrl: string;
  password: string;
  confirmPassword: string;
};

function validateBaseRegistration(input: BaseRegistrationInput): FormErrors {
  const errors: FormErrors = {};

  if (!input.fullName.trim()) errors.fullName = messages.fullName;
  if (input.gender !== 'male' && input.gender !== 'female') {
    errors.gender = messages.gender;
  }

  try {
    buildPhoneIdentity(input.phone);
  } catch {
    errors.phone = messages.phone;
  }

  if (!input.email.trim()) {
    errors.email = messages.emailRequired;
  } else try {
    normalizeOptionalEmail(input.email);
  } catch {
    errors.email = messages.email;
  }

  const passwordError = validatePasswordPair(input.password, input.confirmPassword);
  if (passwordError) {
    errors.password =
      input.password.length < 8 ? messages.password : messages.passwordStrength;
  }
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = messages.confirmPassword;
  }

  return errors;
}

export function validatePatientRegistration(
  input: PatientRegistrationInput,
): FormErrors {
  return validateBaseRegistration(input);
}

export function validateDoctorRegistration(
  input: DoctorRegistrationInput,
): FormErrors {
  const errors = validateBaseRegistration(input);
  if (!input.specialtyId) errors.specialtyId = messages.specialtyId;
  if (!input.wilayaId) errors.wilayaId = messages.wilayaId;
  return errors;
}

export function validateClinicRegistration(
  input: ClinicRegistrationInput,
): FormErrors {
  const errors: FormErrors = {};

  if (!input.clinicName.trim()) errors.clinicName = messages.clinicName;
  if (!input.wilayaId) errors.wilayaId = messages.wilayaId;

  try {
    buildPhoneIdentity(input.phone);
  } catch {
    errors.phone = messages.phone;
  }

  if (!input.email.trim()) {
    errors.email = messages.emailRequired;
  } else try {
    normalizeOptionalEmail(input.email);
  } catch {
    errors.email = messages.email;
  }

  const passwordError = validatePasswordPair(input.password, input.confirmPassword);
  if (passwordError) {
    errors.password =
      input.password.length < 8 ? messages.password : messages.passwordStrength;
  }
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = messages.confirmPassword;
  }

  return errors;
}

export function validateLogin(input: LoginInput): FormErrors {
  const errors: FormErrors = {};
  try {
    buildPhoneIdentity(input.phone);
  } catch {
    errors.phone = messages.phone;
  }
  if (!input.password) errors.password = messages.password;
  return errors;
}

export function roleLabel(role: PublicAuthRole): string {
  if (role === 'patient') return 'عميل';
  if (role === 'doctor') return 'مختص';
  return 'مركز';
}
