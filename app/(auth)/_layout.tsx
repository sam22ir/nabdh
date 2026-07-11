import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../../src/lib/theme';

export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.users.me, isSignedIn ? {} : 'skip');

  useEffect(() => {
    const isLegalDocument =
      segments.includes('terms-of-use') || segments.includes('privacy-policy');
    if (!isLoaded || !isSignedIn || me === undefined || !me || isLegalDocument) return;
    if (me.role === 'patient') {
      router.replace('/(patient)');
    } else if (me.role === 'doctor') {
      router.replace('/(doctor)/dashboard');
    } else if (me.role === 'clinic') {
      router.replace('/(clinic)/dashboard');
    }
  }, [isLoaded, isSignedIn, me, router, segments]);

  if (!isLoaded || (isSignedIn && me === undefined)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="patient/login" />
      <Stack.Screen name="patient/register" />
      <Stack.Screen name="doctor/login" />
      <Stack.Screen name="doctor/register" />
      <Stack.Screen name="clinic/login" />
      <Stack.Screen name="clinic/register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="finalize-registration" />
      <Stack.Screen name="terms-of-use" />
      <Stack.Screen name="privacy-policy" />
    </Stack>
  );
}
