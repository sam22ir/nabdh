import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_ROLE_STORAGE_KEY = 'nabdh.selectedAuthRole';

export type PublicAuthRole = 'patient' | 'doctor' | 'clinic';

export async function getStoredAuthRole(): Promise<PublicAuthRole | null> {
  const value = await AsyncStorage.getItem(AUTH_ROLE_STORAGE_KEY);
  return value === 'patient' || value === 'doctor' || value === 'clinic'
    ? value
    : null;
}

export async function setStoredAuthRole(role: PublicAuthRole): Promise<void> {
  await AsyncStorage.setItem(AUTH_ROLE_STORAGE_KEY, role);
}
