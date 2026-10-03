import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import LegalNotice from '@/components/LegalNotice';
import LocationField from '@/components/LocationField';
import SpecialtyPicker from '@/components/SpecialtyPicker';
import WilayaPicker from '@/components/WilayaPicker';
import { useAuth } from '@/lib/auth';
import { api, useMutation, useQuery } from '@/lib/backend';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal';
import type { Coordinates } from '@/lib/mapPickerHtml';
import { getStoredAuthRole, type PublicAuthRole } from '@/lib/roleSelection';
import { captureAuthException } from '@/lib/sentry';
import { theme } from '@/lib/theme';

const ERROR_TEXT = 'تعذر إكمال إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.';

function homeRoute(role: PublicAuthRole) {
  if (role === 'patient') return '/(patient)' as const;
  if (role === 'doctor') return '/(doctor)/dashboard' as const;
  return '/(clinic)/dashboard' as const;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { userId, signOut } = useAuth();
  const me = useQuery(api.users.me, {});
  const specialties = useQuery(api.specialties.list, {});
  const wilayas = useQuery(api.locations.listWilayas, {});
  const onboardPatient = useMutation(api.users.onboardPatient);
  const onboardDoctor = useMutation(api.users.onboardDoctor);
  const onboardClinic = useMutation(api.users.onboardClinic);
  const createSoloPractice = useMutation(api.users.createSoloPractice);
  const applyDefaultSchedule = useMutation(api.schedules.applyDefaultSchedule);

  const [role, setRole] = useState<PublicAuthRole | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  const [wilayaId, setWilayaId] = useState<string | null>(null);
  const [centerName, setCenterName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [soloStep, setSoloStep] = useState<'closed' | 'choice' | 'form'>('closed');
  const [soloName, setSoloName] = useState('');
  const [soloLocation, setSoloLocation] = useState<Coordinates | null>(null);
  const [withSchedule, setWithSchedule] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    void getStoredAuthRole().then((stored) => {
      if (!stored) router.replace('/');
      setRole(stored);
    });
  }, [router]);

  // Already has an account (e.g. opened this screen by mistake): go home.
  useEffect(() => {
    if (started.current || !me) return;
    router.replace(homeRoute(me.role as PublicAuthRole));
  }, [me, router]);

  const fail = (caught: unknown) => {
    captureAuthException(caught, { flow: 'onboarding', role: role ?? 'none' });
    started.current = false;
    setError(ERROR_TEXT);
  };

  const legal = { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION };

  // Clients need nothing but their Google account.
  const createPatient = async () => {
    started.current = true;
    setError('');
    try {
      await onboardPatient(legal);
      router.replace('/(patient)');
    } catch (caught) {
      fail(caught);
    }
  };

  useEffect(() => {
    if (role !== 'patient' || me === undefined || me || started.current) return;
    void createPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, me]);

  const submitDoctor = async () => {
    if (!specialtyId || !wilayaId) {
      setError('اختر التخصص والولاية.');
      return;
    }
    started.current = true;
    setSubmitting(true);
    setError('');
    try {
      await onboardDoctor({ ...legal, specialtyId, wilayaId });
      setSoloName(me?.fullName ?? '');
      setSoloStep('choice');
    } catch (caught) {
      fail(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const submitSolo = async () => {
    if (!soloLocation) {
      setError('حدد موقع المركز.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const clinicId = (await createSoloPractice({
        name: soloName.trim() || undefined,
        latitude: soloLocation.latitude,
        longitude: soloLocation.longitude,
      })) as string;
      if (withSchedule && userId) {
        await applyDefaultSchedule({ clinicId, doctorId: userId });
      }
      setSoloStep('closed');
      router.replace('/(doctor)/dashboard');
    } catch (caught) {
      fail(caught);
      started.current = true;
    } finally {
      setSubmitting(false);
    }
  };

  const submitClinic = async () => {
    if (!centerName.trim() || !wilayaId) {
      setError('اسم المركز والولاية مطلوبان.');
      return;
    }
    if (!location) {
      setError('حدد موقع المركز.');
      return;
    }
    started.current = true;
    setSubmitting(true);
    setError('');
    try {
      await onboardClinic({
        ...legal,
        clinicName: centerName.trim(),
        wilayaId,
        latitude: location.latitude,
        longitude: location.longitude,
        phone: phone.trim() || undefined,
      });
      router.replace('/(clinic)/dashboard');
    } catch (caught) {
      fail(caught);
    } finally {
      setSubmitting(false);
    }
  };

  const switchAccount = async () => {
    await signOut();
    router.replace('/');
  };

  if (role === undefined || me === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (role === 'patient') {
    return (
      <View style={styles.centered}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.button} onPress={() => void createPatient()}>
              <Text style={styles.buttonText}>إعادة المحاولة</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.title}>جاري تجهيز حسابك</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{role === 'doctor' ? 'أكمل ملفك المهني' : 'بيانات المركز'}</Text>

        {role === 'doctor' ? (
          <>
            <SpecialtyPicker
              options={(specialties as any[]) ?? []}
              value={specialtyId}
              onChange={setSpecialtyId}
              disabled={specialties === undefined}
            />
            <WilayaPicker
              options={(wilayas as any[]) ?? []}
              value={wilayaId}
              onChange={setWilayaId}
              disabled={wilayas === undefined}
            />
          </>
        ) : (
          <>
            <TextInput
              value={centerName}
              onChangeText={setCenterName}
              placeholder="اسم المركز"
              style={styles.input}
            />
            <WilayaPicker
              options={(wilayas as any[]) ?? []}
              value={wilayaId}
              onChange={setWilayaId}
              disabled={wilayas === undefined}
            />
            <LocationField value={location} onChange={setLocation} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="رقم الهاتف (اختياري)"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </>
        )}

        {error && soloStep === 'closed' ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          style={[styles.button, submitting && styles.disabled]}
          onPress={() => void (role === 'doctor' ? submitDoctor() : submitClinic())}
        >
          {submitting && soloStep === 'closed' ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.buttonText}>متابعة</Text>
          )}
        </Pressable>
        <LegalNotice />
        <Pressable onPress={() => void switchAccount()}>
          <Text style={styles.link}>استخدام حساب Google آخر</Text>
        </Pressable>
      </ScrollView>

      {/* Specialists: do you work alone? */}
      <Modal visible={soloStep !== 'closed'} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {soloStep === 'choice' ? (
              <>
                <Ionicons name="business-outline" size={32} color={theme.colors.primary} />
                <Text style={styles.sheetTitle}>هل تعمل بمفردك؟</Text>
                <Text style={styles.sheetCopy}>
                  إذا كنت تعمل بمفردك سننشئ لك مركزاً خاصاً بك لتتمكن من استقبال الحجوزات. ويمكنك
                  التبديل بين حساب المختص وحساب المركز من الإعدادات.
                </Text>
                <Pressable style={styles.button} onPress={() => setSoloStep('form')}>
                  <Text style={styles.buttonText}>نعم، أعمل بمفردي</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondary]}
                  onPress={() => {
                    setSoloStep('closed');
                    router.replace('/(doctor)/dashboard');
                  }}
                >
                  <Text style={styles.secondaryText}>لا، سأنضم إلى مركز</Text>
                </Pressable>
              </>
            ) : (
              <ScrollView contentContainerStyle={styles.soloForm} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>مركزك الخاص</Text>
                <TextInput
                  value={soloName}
                  onChangeText={setSoloName}
                  placeholder="اسم المركز"
                  style={styles.input}
                />
                <LocationField value={soloLocation} onChange={setSoloLocation} />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: withSchedule }}
                  onPress={() => setWithSchedule((value) => !value)}
                  style={styles.checkRow}
                >
                  <View style={[styles.checkbox, withSchedule && styles.checkboxOn]}>
                    {withSchedule ? <Ionicons name="checkmark" size={16} color={theme.colors.white} /> : null}
                  </View>
                  <Text style={styles.checkText}>
                    جدول افتراضي: الأحد إلى الخميس، 09:00 – 16:00 (يمكنك تغييره لاحقاً)
                  </Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  style={[styles.button, submitting && styles.disabled]}
                  onPress={() => void submitSolo()}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text style={styles.buttonText}>إنشاء المركز</Text>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 72,
  },
  title: { fontFamily: 'Cairo-Bold', fontSize: 24, color: theme.colors.textPrimary, textAlign: 'center' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    backgroundColor: theme.colors.surface,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  buttonText: { fontFamily: 'Cairo-Bold', color: theme.colors.white, fontSize: 16 },
  secondary: { backgroundColor: theme.colors.surfaceMuted },
  secondaryText: { fontFamily: 'Cairo-Bold', color: theme.colors.textPrimary, fontSize: 16 },
  disabled: { opacity: 0.6 },
  error: { fontFamily: 'Cairo-Regular', color: theme.colors.danger, textAlign: 'center' },
  link: { fontFamily: 'Cairo-Bold', color: theme.colors.primary, textAlign: 'center' },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    maxHeight: '90%',
    gap: theme.spacing.md,
    alignItems: 'stretch',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
  },
  sheetTitle: { fontFamily: 'Cairo-Bold', fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center' },
  sheetCopy: { fontFamily: 'Cairo-Regular', color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  soloForm: { gap: theme.spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkText: { flex: 1, fontFamily: 'Cairo-Regular', color: theme.colors.textPrimary, textAlign: 'right' },
});
