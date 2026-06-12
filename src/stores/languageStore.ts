import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/lib/i18n';

type Language = 'ar' | 'fr';

interface LanguageState {
  language: Language;

  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
}

const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ar',

      setLanguage: (language) => {
        void i18n.changeLanguage(language);
        set({ language });
      },
      toggleLanguage: () =>
        set((state) => {
          const nextLanguage = state.language === 'ar' ? 'fr' : 'ar';
          void i18n.changeLanguage(nextLanguage);
          return { language: nextLanguage };
        }),
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export { useLanguageStore };
