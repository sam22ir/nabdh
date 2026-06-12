import { create } from 'zustand';
import type { Patient, Doctor, UserRole } from '../lib/types';

/** A logged-in user is either a Patient or a Doctor, discriminated by `role`. */
type User = Patient | Doctor;

interface AuthState {
  user: User | null;
  role: UserRole | null;

  setUser: (user: User) => void;
  clearUser: () => void;
}

const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  role: null,

  setUser: (user) => set({ user, role: user.role }),
  clearUser: () => set({ user: null, role: null }),
}));

export { useAuthStore };
