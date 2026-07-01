import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useConvex, useConvexAuth } from 'convex/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/lib/i18n';
import { convex } from '../src/lib/convex';
import ConvexErrorBoundary from '../src/components/ConvexErrorBoundary';
import {
  registerPushNotifications,
  unregisterPushNotifications,
} from '../src/lib/pushNotifications';

// ---------------------------------------------------------------------------
// Keep the splash screen visible while we load fonts and initialise services
// ---------------------------------------------------------------------------
void SplashScreen.preventAutoHideAsync();

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add your Clerk publishable key to the app environment.',
  );
}

function removeLegacyAuthStore() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth-storage');
    return;
  }

  void AsyncStorage.removeItem('auth-storage');
}

function PushNotificationsRegistrar() {
  const convexClient = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();

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
      <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ConvexErrorBoundary>
            <SafeAreaProvider>
              <PushNotificationsRegistrar />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(patient)" />
                <Stack.Screen name="(doctor)" />
              </Stack>
            </SafeAreaProvider>
          </ConvexErrorBoundary>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </I18nextProvider>
  );
}
