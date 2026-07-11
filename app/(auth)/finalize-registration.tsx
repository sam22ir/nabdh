import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import {
  clearPendingRegistration,
  loadPendingRegistration,
  type PendingRegistration,
} from '../../src/lib/pendingRegistration';
import { setStoredAuthRole } from '../../src/lib/roleSelection';
import { captureAuthException } from '../../src/lib/sentry';
import { theme } from '../../src/lib/theme';

export default function FinalizeRegistrationScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const registerAccount = useMutation(api.users.registerAccount);
  const [pending, setPending] = useState<PendingRegistration | null | undefined>(
    undefined,
  );
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  useEffect(() => {
    void loadPendingRegistration().then(setPending);
  }, []);

  useEffect(() => {
    if (error || submittedRef.current) return;
    const timeout = setTimeout(() => {
      if (!submittedRef.current) {
        setError('تعذر إكمال إنشاء الحساب. تحقق من اتصالك وحاول مرة أخرى.');
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (
      submittedRef.current ||
      isLoading ||
      !isAuthenticated ||
      pending === undefined
    ) {
      return;
    }

    if (!pending) {
      setError('لا توجد بيانات تسجيل محفوظة. أعد إنشاء الحساب.');
      return;
    }

    submittedRef.current = true;
    setError('');

    void registerAccount({
      role: pending.role,
      fullName: pending.fullName,
      clinicName: pending.clinicName,
      gender: pending.gender,
      phone: pending.phone,
      phoneLoginKey: pending.phoneLoginKey,
      email: pending.email,
      termsVersion: pending.termsVersion,
      privacyVersion: pending.privacyVersion,
      legalAcceptedAt: pending.legalAcceptedAt,
      ...(pending.role === 'doctor'
        ? {
            specialtyId: pending.specialtyId as Id<'specialties'>,
            wilayaId: pending.wilayaId as Id<'wilayas'>,
          }
        : {}),
      ...(pending.role === 'clinic'
        ? {
            wilayaId: pending.wilayaId as Id<'wilayas'>,
            address: pending.address,
            mapUrl: pending.mapUrl,
          }
        : {}),
    })
      .then(async () => {
        await clearPendingRegistration();
        await setStoredAuthRole(pending.role);
        if (pending.role === 'patient') {
          router.replace('/(patient)');
        } else if (pending.role === 'doctor') {
          router.replace('/(doctor)/dashboard');
        } else {
          router.replace('/(clinic)/dashboard');
        }
      })
      .catch((caughtError) => {
        captureAuthException(caughtError, {
          flow: 'finalize-registration',
          role: pending.role,
        });
        console.error('Finalize registration failed', caughtError);
        submittedRef.current = false;
        setError('تعذر إكمال إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.');
      });
  }, [isAuthenticated, isLoading, pending, registerAccount, router]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>تعذر إكمال التسجيل</Text>
        <Text style={styles.error}>{error}</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.buttonText}>العودة لاختيار الدور</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.title}>جاري إكمال إنشاء الحساب</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: 'Cairo-Bold',
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  error: {
    fontFamily: 'Cairo-Regular',
    color: theme.colors.danger,
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  buttonText: {
    fontFamily: 'Cairo-Bold',
    color: theme.colors.white,
    fontSize: 16,
  },
});
