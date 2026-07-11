import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface DoctorSettingsState {
  newBookingAlerts: boolean;
  cancellationAlerts: boolean;
  dailySummary: boolean;

  setNewBookingAlerts: (value: boolean) => void;
  setCancellationAlerts: (value: boolean) => void;
  setDailySummary: (value: boolean) => void;
}

const useDoctorSettingsStore = create<DoctorSettingsState>()(
  persist(
    (set) => ({
      newBookingAlerts: true,
      cancellationAlerts: true,
      dailySummary: false,

      setNewBookingAlerts: (newBookingAlerts) => set({ newBookingAlerts }),
      setCancellationAlerts: (cancellationAlerts) =>
        set({ cancellationAlerts }),
      setDailySummary: (dailySummary) => set({ dailySummary }),
    }),
    {
      name: 'doctor-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export { useDoctorSettingsStore };
