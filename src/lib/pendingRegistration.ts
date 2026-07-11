import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gender } from './authFormValidation';
import type { PublicAuthRole } from './roleSelection';

const PENDING_REGISTRATION_KEY = 'nabdh.pendingRegistration';

export type PendingRegistration = {
  role: PublicAuthRole;
  fullName?: string;
  clinicName?: string;
  gender?: Gender;
  phone: string;
  phoneLoginKey: string;
  email: string;
  specialtyId?: string;
  wilayaId?: string;
  address?: string;
  mapUrl?: string;
  termsVersion: string;
  privacyVersion: string;
  legalAcceptedAt: number;
};

export async function savePendingRegistration(
  registration: PendingRegistration,
): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_REGISTRATION_KEY,
    JSON.stringify(registration),
  );
}

export async function loadPendingRegistration(): Promise<PendingRegistration | null> {
  const raw = await AsyncStorage.getItem(PENDING_REGISTRATION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingRegistration;
    if (
      (parsed.role !== 'patient' && parsed.role !== 'doctor' && parsed.role !== 'clinic') ||
      (parsed.role !== 'clinic' &&
        parsed.gender !== 'male' &&
        parsed.gender !== 'female') ||
      (parsed.role === 'clinic' ? !parsed.clinicName : !parsed.fullName) ||
      (parsed.role === 'doctor' && (!parsed.specialtyId || !parsed.wilayaId)) ||
      (parsed.role === 'clinic' && !parsed.wilayaId) ||
      !parsed.phone ||
      !parsed.termsVersion ||
      !parsed.privacyVersion ||
      !Number.isFinite(parsed.legalAcceptedAt)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingRegistration(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_REGISTRATION_KEY);
}
