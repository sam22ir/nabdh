import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import fr from '../../assets/locales/fr.json';

const deviceLanguage = getLocales()?.[0]?.languageCode ?? 'ar';
const lng = deviceLanguage === 'fr' ? 'fr' : 'ar';

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: {} },
    fr: { translation: fr },
  },
  lng,
  fallbackLng: 'ar',
  interpolation: {
    escapeValue: false,
  },
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
});

export default i18n;
export const t = i18n.t;
