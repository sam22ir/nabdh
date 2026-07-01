import { useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { theme } from '../src/lib/theme';

export default function IndexScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const navigationReady = navigationState?.key != null;

  const me = useQuery(api.users.me, {});
  const completionContext = useQuery(api.users.getProfileCompletionContext, {});

  const redirectBasedOnAuth = useCallback(() => {
    if (me === undefined || completionContext === undefined) return;

    if (completionContext.isAuthenticated && !me) {
      router.replace('/complete-profile');
      return;
    }

    if (!me) {
      router.replace('/(auth)/onboarding');
      return;
    }

    if (me.role === 'patient' && me.profile) {
      router.replace('/(patient)');
    } else if (me.role === 'doctor' && me.profile) {
      router.replace('/(doctor)/dashboard');
    } else {
      router.replace('/complete-profile');
    }
  }, [completionContext, me, router]);

  useEffect(() => {
    if (navigationReady) {
      redirectBasedOnAuth();
    }
  }, [navigationReady, redirectBasedOnAuth]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
