import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ConvexAuthProvider,
  type TokenStorage,
} from '@convex-dev/auth/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/lib/i18n';
import { convex } from '../src/lib/convex';
import ConvexErrorBoundary from '../src/components/ConvexErrorBoundary';

// ---------------------------------------------------------------------------
// Keep the splash screen visible while we load fonts and initialise services
// ---------------------------------------------------------------------------
void SplashScreen.preventAutoHideAsync();

const authStorage: TokenStorage = {
  getItem: (key) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

function removeLegacyAuthStore() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth-storage');
    return;
  }

  void AsyncStorage.removeItem('auth-storage');
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded, fontsError] = useFonts({
    'Cairo-Regular': require('../assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Bold': require('../assets/fonts/Cairo-Bold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
  });

  useEffect(() => {
    removeLegacyAuthStore();
  }, []);

  // Wait for i18next to initialise before rendering children
  useEffect(() => {
    if (i18n.isInitialized) {
      setI18nReady(true);
      return;
    }
    const handleInitialized = () => setI18nReady(true);
    i18n.on('initialized', handleInitialized);
    return () => {
      i18n.off('initialized', handleInitialized);
    };
  }, []);

  // Hide splash once fonts (and i18n) are ready — or if fonts fail to load
  useEffect(() => {
    if ((fontsLoaded || fontsError) && i18nReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError, i18nReady]);

  // Keep splash visible while loading
  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ConvexAuthProvider client={convex} storage={authStorage}>
        <ConvexErrorBoundary>
          <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(patient)" />
            <Stack.Screen name="(doctor)" />
          </Stack>
          </SafeAreaProvider>
        </ConvexErrorBoundary>
      </ConvexAuthProvider>
    </I18nextProvider>
  );
}
