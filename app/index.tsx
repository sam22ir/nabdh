import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import LegalNotice from '@/components/LegalNotice';
import { useAuth } from '@/lib/auth';
import { api, useQuery } from '@/lib/backend';
import { getStoredAuthRole, setStoredAuthRole, type PublicAuthRole } from '@/lib/roleSelection';
import { captureAuthException } from '@/lib/sentry';
import { theme } from '@/lib/theme';

const ROLES: Array<{
  role: PublicAuthRole;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { role: 'patient', title: 'عميل', subtitle: 'احجز موعداً وتابع مواعيدك', icon: 'person-outline' },
  { role: 'doctor', title: 'مختص', subtitle: 'أنشئ ملفك المهني', icon: 'briefcase-outline' },
  { role: 'clinic', title: 'مركز', subtitle: 'أنشئ حساب المركز وأدر المختصين', icon: 'business-outline' },
];

const ROLE_LABEL: Record<PublicAuthRole, string> = {
  patient: 'عميل',
  doctor: 'مختص',
  clinic: 'مركز',
};

function homeRoute(role: PublicAuthRole) {
  if (role === 'patient') return '/(patient)' as const;
  if (role === 'doctor') return '/(doctor)/dashboard' as const;
  return '/(clinic)/dashboard' as const;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn, signInWithGoogle } = useAuth();
  const me = useQuery(api.users.me, isSignedIn ? {} : 'skip');
  const [selectedRole, setSelectedRole] = useState<PublicAuthRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void getStoredAuthRole().then((stored) => {
      setSelectedRole(stored);
      setRoleLoaded(true);
    });
  }, []);

  // Route once we know who is signed in. An existing account's role always wins
  // over the card that was tapped.
  useEffect(() => {
    if (!isLoaded || !roleLoaded || !isSignedIn || me === undefined) return;
    if (me) {
      const role = me.role as PublicAuthRole;
      if (selectedRole && selectedRole !== role) {
        Alert.alert('تم تسجيل دخولك', `هذا الحساب مسجل كـ ${ROLE_LABEL[role]}.`);
      }
      void setStoredAuthRole(role);
      router.replace(homeRoute(role));
      return;
    }
    // Signed in with Google but no account yet: continue as the chosen role.
    router.replace('/onboarding');
  }, [isLoaded, roleLoaded, isSignedIn, me, router, selectedRole]);

  const handleRole = (role: PublicAuthRole) => {
    setSelectedRole(role);
    void setStoredAuthRole(role);
  };

  const handleGoogle = async () => {
    setError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      captureAuthException(caught, { flow: 'google-sign-in', role: selectedRole ?? 'none' });
      setError('تعذر تسجيل الدخول عبر Google. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setSigningIn(false);
    }
  };

  if (!isLoaded || !roleLoaded || (isSignedIn && me === undefined)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>نبض</Text>
        <Text style={styles.title}>اختر نوع الحساب</Text>
      </View>

      <View style={styles.roles}>
        {ROLES.map((item) => {
          const active = selectedRole === item.role;
          return (
            <Pressable
              key={item.role}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => handleRole(item.role)}
              style={[styles.roleCard, active && styles.roleCardActive]}
            >
              <View style={[styles.iconShell, active && styles.iconShellActive]}>
                <Ionicons
                  name={item.icon}
                  size={28}
                  color={active ? theme.colors.primary : theme.colors.textPrimary}
                />
              </View>
              <View style={styles.roleCopy}>
                <Text style={styles.roleTitle}>{item.title}</Text>
                <Text style={styles.roleSubtitle}>{item.subtitle}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={!selectedRole || signingIn}
          onPress={() => void handleGoogle()}
          style={[styles.googleButton, (!selectedRole || signingIn) && styles.disabled]}
        >
          {signingIn ? (
            <ActivityIndicator color={theme.colors.textPrimary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.googleText}>المتابعة باستخدام Google</Text>
            </>
          )}
        </Pressable>
        {!selectedRole ? <Text style={styles.pickHint}>اختر نوع الحساب أولاً</Text> : null}
        <LegalNotice />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 72,
    paddingBottom: theme.spacing['2xl'],
    justifyContent: 'space-between',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  header: { gap: theme.spacing.xs, alignItems: 'center' },
  kicker: { fontFamily: 'Cairo-Bold', fontSize: 34, color: theme.colors.official },
  title: { fontFamily: 'Cairo-Bold', fontSize: 22, color: theme.colors.textPrimary },
  roles: { gap: theme.spacing.md },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  roleCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.secondary },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceMuted,
  },
  iconShellActive: { backgroundColor: theme.colors.white },
  roleCopy: { flex: 1, gap: 2 },
  roleTitle: { fontFamily: 'Cairo-Bold', fontSize: 18, color: theme.colors.textPrimary, textAlign: 'right' },
  roleSubtitle: { fontFamily: 'Cairo-Regular', color: theme.colors.textSecondary, textAlign: 'right' },
  actions: { gap: theme.spacing.md },
  googleButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  googleText: { fontFamily: 'Cairo-Bold', fontSize: 16, color: theme.colors.textPrimary },
  disabled: { opacity: 0.5 },
  pickHint: { fontFamily: 'Cairo-Regular', color: theme.colors.textSecondary, textAlign: 'center' },
  error: { fontFamily: 'Cairo-Regular', color: theme.colors.danger, textAlign: 'center' },
});
