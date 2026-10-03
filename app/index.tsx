import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import {
  getStoredAuthRole,
  setStoredAuthRole,
  type PublicAuthRole,
} from '../src/lib/roleSelection';
import { theme } from '../src/lib/theme';

const roles: Array<{
  role: PublicAuthRole;
  title: string;
  subtitle: string;
  loginRoute:
    | '/(auth)/patient/login'
    | '/(auth)/doctor/login'
    | '/(auth)/clinic/login';
  registerRoute:
    | '/(auth)/patient/register'
    | '/(auth)/doctor/register'
    | '/(auth)/clinic/register';
}> = [
  {
    role: 'patient',
    title: 'عميل',
    subtitle: 'احجز موعدا وتابع مواعيدك',
    loginRoute: '/(auth)/patient/login',
    registerRoute: '/(auth)/patient/register',
  },
  {
    role: 'doctor',
    title: 'مختص',
    subtitle: 'أنشئ ملفك المهني',
    loginRoute: '/(auth)/doctor/login',
    registerRoute: '/(auth)/doctor/register',
  },
  {
    role: 'clinic',
    title: 'مركز',
    subtitle: 'أنشئ حساب المركز وأدر المختصين',
    loginRoute: '/(auth)/clinic/login',
    registerRoute: '/(auth)/clinic/register',
  },
];

export default function IndexScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.users.me, isSignedIn ? {} : 'skip');
  const [selectedRole, setSelectedRole] = useState<PublicAuthRole | null>(null);

  useEffect(() => {
    void getStoredAuthRole().then(setSelectedRole);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || me === undefined) return;
    if (!me) return;
    if (me.role === 'patient') {
      router.replace('/(patient)');
    } else if (me.role === 'doctor') {
      router.replace('/(doctor)/dashboard');
    } else if (me.role === 'clinic') {
      router.replace('/(clinic)/dashboard');
    }
  }, [isLoaded, isSignedIn, me, router]);

  const handleRolePress = async (role: PublicAuthRole) => {
    await setStoredAuthRole(role);
    setSelectedRole(role);
  };

  const handleAuthRoutePress = (mode: 'login' | 'register') => {
    const selectedRoleConfig = roles.find((item) => item.role === selectedRole);
    if (!selectedRoleConfig) return;

    router.push(
      mode === 'login'
        ? selectedRoleConfig.loginRoute
        : selectedRoleConfig.registerRoute,
    );
  };

  if (!isLoaded || (isSignedIn && me === undefined)) {
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
        {roles.map((item) => {
          const active = selectedRole === item.role;
          const iconName =
            item.role === 'patient'
              ? 'person-outline'
              : item.role === 'doctor'
                ? 'person-outline'
                : 'business-outline';
          return (
            <Pressable
              key={item.role}
              accessibilityRole="button"
              onPress={() => void handleRolePress(item.role)}
              style={[styles.roleCard, active && styles.roleCardActive]}
            >
              <View style={[styles.iconShell, active && styles.iconShellActive]}>
                <Ionicons
                  name={iconName}
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
        <Text style={styles.actionsTitle}>
          {selectedRole ? 'اختر طريقة المتابعة' : 'اختر نوع الحساب أولاً'}
        </Text>
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedRole}
            onPress={() => handleAuthRoutePress('register')}
            style={[
              styles.secondaryButton,
              !selectedRole && styles.actionDisabled,
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                !selectedRole && styles.actionDisabledText,
              ]}
            >
              إنشاء حساب
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedRole}
            onPress={() => handleAuthRoutePress('login')}
            style={[styles.primaryButton, !selectedRole && styles.actionDisabled]}
          >
            <Text style={styles.primaryButtonText}>تسجيل الدخول</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  kicker: {
    fontFamily: 'Cairo-Bold',
    fontSize: 18,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'Cairo-Bold',
    fontSize: 28,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  roles: {
    gap: theme.spacing.md,
  },
  actions: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  actionsTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  roleCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  roleCardActive: {
    borderColor: theme.colors.primary,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  iconShellActive: {
    backgroundColor: theme.colors.secondary,
  },
  roleCopy: {
    flex: 1,
    gap: 4,
  },
  roleTitle: {
    fontFamily: 'Cairo-Bold',
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  roleSubtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: theme.colors.white,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    fontFamily: 'Cairo-Bold',
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionDisabledText: {
    color: theme.colors.textSecondary,
  },
});
