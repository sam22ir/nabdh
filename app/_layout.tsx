import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackendProvider, useAuthState, useBackend } from '@/lib/backend';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import BackendErrorBoundary from '../src/components/BackendErrorBoundary';
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from '../src/lib/pushNotifications';
import { wrapWithSentry } from '../src/lib/sentry';

// ---------------------------------------------------------------------------
// Keep the splash screen visible while we load fonts and initialise services
// ---------------------------------------------------------------------------
void SplashScreen.preventAutoHideAsync();

// Nabdh is Arabic-first. Configure direction before any route is rendered so
// auth, patient, doctor, and clinic screens all share the same layout rules.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
if (Platform.OS !== 'web') {
  I18nManager.swapLeftAndRightInRTL(true);
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
  document.body.dir = 'rtl';
}

function installWebClipboardGuard() {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

  const clipboard = navigator.clipboard as Clipboard & {
    __nabdhSafeWriteText?: boolean;
  };
  if (clipboard.__nabdhSafeWriteText) return;

  const writeText = clipboard.writeText.bind(clipboard);
  clipboard.writeText = async (text: string) => {
    try {
      await writeText(text);
    } catch {
      // Expo's web LogBox can attempt clipboard writes without permission.
    }
  };
  clipboard.__nabdhSafeWriteText = true;
}

installWebClipboardGuard();

function removeLegacyAuthStore() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth-storage');
    return;
  }

  void AsyncStorage.removeItem('auth-storage');
}

function PushNotificationsRegistrar() {
  const convexClient = useBackend();
  const { isAuthenticated, isLoading } = useAuthState();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    let active = true;
    let token: string | null = null;

    void registerPushNotifications({ convex: convexClient })
      .then((registeredToken) => {
        if (!registeredToken) return;
        if (active) {
          token = registeredToken;
        } else {
          void unregisterPushNotifications(convexClient, registeredToken).catch(
            () => undefined,
          );
        }
      })
      .catch(() => {
        // Push registration is best-effort; in-app notifications still work.
      });

    return () => {
      active = false;
      void unregisterPushNotifications(convexClient, token).catch(
        () => undefined,
      );
    };
  }, [convexClient, isAuthenticated, isLoading]);

  return null;
}

function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    'Cairo-Regular': require('../assets/fonts/Cairo-Regular.ttf'),
    'Cairo-Bold': require('../assets/fonts/Cairo-Bold.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
  });

  useEffect(() => {
    removeLegacyAuthStore();
  }, []);

  // Hide splash once fonts are ready — or if fonts fail to load
  useEffect(() => {
    if (fontsLoaded || fontsError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontsError]);

  // Keep splash visible while loading
  if (!fontsLoaded && !fontsError) {
    return null;
  }

  return (
    <AuthProvider>
      <BackendProvider>
        <BackendErrorBoundary>
          <SafeAreaProvider>
            <PushNotificationsRegistrar />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(patient)" />
              <Stack.Screen name="(doctor)" />
              <Stack.Screen name="(clinic)" />
            </Stack>
          </SafeAreaProvider>
        </BackendErrorBoundary>
      </BackendProvider>
    </AuthProvider>
  );
}

export default wrapWithSentry(RootLayout);
