import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DoctorSettingsState {
  newBookingAlerts: boolean;
  cancellationAlerts: boolean;
  dailySummary: boolean;
  minCancelHours: number;

  setNewBookingAlerts: (value: boolean) => void;
  setCancellationAlerts: (value: boolean) => void;
  setDailySummary: (value: boolean) => void;
  setMinCancelHours: (value: number) => void;
}

const useDoctorSettingsStore = create<DoctorSettingsState>()(
  persist(
    (set) => ({
      newBookingAlerts: true,
      cancellationAlerts: true,
      dailySummary: false,
      minCancelHours: 6,

      setNewBookingAlerts: (newBookingAlerts) => set({ newBookingAlerts }),
      setCancellationAlerts: (cancellationAlerts) =>
        set({ cancellationAlerts }),
      setDailySummary: (dailySummary) => set({ dailySummary }),
      setMinCancelHours: (minCancelHours) => set({ minCancelHours }),
    }),
    {
      name: 'doctor-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export { useDoctorSettingsStore };
