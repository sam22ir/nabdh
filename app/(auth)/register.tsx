import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isClerkAPIResponseError, useSSO, useSignUp } from '@clerk/clerk-expo';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../../src/lib/theme';
import { rtlValue } from '../../src/lib/rtl';
import { getArabicErrorMessage } from '../../src/lib/errorMessages';
import {
  normalizeEmailForAuth,
  normalizePhoneForAuth,
} from '../../src/lib/authIdentifiers';
import type { UserRole } from '../../src/lib/types';
import type { Id } from '../../convex/_generated/dataModel';

// =============================================================================
// Zod validation schemas
// =============================================================================

const passwordMatchRefine = (data: {
  password: string;
  confirmPassword: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>, ctx: z.RefinementCtx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'كلمتا المرور غير متطابقتين',
    });
  }
};

const phoneSchema = z.string().refine(
  (phone) => {
    try {
      normalizePhoneForAuth(phone);
      return true;
    } catch {
      return false;
    }
  },
  'يرجى إدخال رقم هاتف جزائري يبدأ بـ 05 أو 06 أو 07 أو +213',
);
const emailSchema = z.email('يرجى إدخال بريد إلكتروني صالح');

const step1Schema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: phoneSchema,
  email: emailSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).superRefine(passwordMatchRefine);

const step2Schema = z.object({
  wilayaId: z.string({ message: 'يرجى اختيار ولايتك' }).min(1, 'يرجى اختيار ولايتك'),
  communeId: z.string({ message: 'يرجى اختيار بلديتك' }).min(1, 'يرجى اختيار بلديتك'),
  dateOfBirth: z.string().optional(),
  gender: z.union([z.literal('male'), z.literal('female')]).optional(),
  specialtyId: z.string().optional(),
  orderRegistrationNumber: z.string().optional(),
});

const fullSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: phoneSchema,
  email: emailSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
  wilayaId: z.string({ message: 'يرجى اختيار ولايتك' }).min(1, 'يرجى اختيار ولايتك'),
  communeId: z.string({ message: 'يرجى اختيار بلديتك' }).min(1, 'يرجى اختيار بلديتك'),
  dateOfBirth: z.string().optional(),
  gender: z.union([z.literal('male'), z.literal('female')]).optional(),
  specialtyId: z.string().optional(),
  orderRegistrationNumber: z.string().optional(),
}).superRefine(passwordMatchRefine);

type FormData = z.output<typeof fullSchema>;

type RegistrationPayload = {
  fullNameAr: string;
  phone: string;
  email: string;
  role: UserRole;
  wilayaId: Id<'wilayas'>;
  communeId?: Id<'communes'>;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  specialtyId?: Id<'specialties'>;
  orderRegistrationNumber?: string;
};

class RegistrationFormError extends Error {}

function buildRegistrationPayload(data: FormData, role?: UserRole) {
  const resolvedRole = role === 'doctor' ? 'doctor' : 'patient';

  if (resolvedRole === 'patient' && !data.dateOfBirth?.trim()) {
    throw new RegistrationFormError('يرجى إدخال تاريخ الميلاد');
  }
  if (resolvedRole === 'patient' && !data.gender) {
    throw new RegistrationFormError('يرجى اختيار الجنس');
  }
  if (resolvedRole === 'doctor' && !data.specialtyId) {
    throw new RegistrationFormError('يرجى اختيار التخصص');
  }
  if (
    resolvedRole === 'doctor' &&
    (!data.orderRegistrationNumber ||
      data.orderRegistrationNumber.trim().length < 3)
  ) {
    throw new RegistrationFormError('يرجى إدخال رقم التسجيل في النقابة');
  }

  const phoneAuthIdentifier = normalizePhoneForAuth(data.phone);
  const emailAuthIdentifier = normalizeEmailForAuth(data.email);
  const registrationPayload: RegistrationPayload = {
    fullNameAr: data.fullName.trim(),
    phone: data.phone,
    email: emailAuthIdentifier,
    role: resolvedRole,
    wilayaId: data.wilayaId as Id<'wilayas'>,
    communeId:
      resolvedRole === 'patient'
        ? (data.communeId as Id<'communes'>)
        : undefined,
    dateOfBirth: data.dateOfBirth,
    gender: data.gender,
    specialtyId:
      resolvedRole === 'doctor'
        ? (data.specialtyId as Id<'specialties'>)
        : undefined,
    orderRegistrationNumber:
      resolvedRole === 'doctor'
        ? data.orderRegistrationNumber?.trim()
        : undefined,
  };

  return {
    emailAuthIdentifier,
    phoneAuthIdentifier,
    registrationPayload,
  };
}

function getRegistrationErrorMessage(err: unknown) {
  if (err instanceof RegistrationFormError) {
    return err.message;
  }

  if (isClerkAPIResponseError(err)) {
    const clerkError = err.errors[0] as {
      code?: string;
      message?: string;
      longMessage?: string;
    } | undefined;
    const code = clerkError?.code ?? '';
    const message = [
      clerkError?.message,
      clerkError?.longMessage,
      code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      code.includes('identifier_exists') ||
      message.includes('already exists') ||
      message.includes('already taken')
    ) {
      return 'البريد الإلكتروني مستخدم بالفعل';
    }
    if (
      code.includes('verification') ||
      code.includes('code') ||
      message.includes('verification') ||
      message.includes('code')
    ) {
      return 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
    }
    if (
      code.includes('form_password') ||
      message.includes('password')
    ) {
      return 'كلمة المرور غير مقبولة. جرّب كلمة مرور أقوى.';
    }
    if (
      code.includes('form_identifier') ||
      message.includes('email')
    ) {
      return 'تحقق من البريد الإلكتروني ثم حاول مرة أخرى.';
    }
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';

  return message.includes('already')
    ? 'البريد الإلكتروني مستخدم بالفعل'
    : message.toLowerCase().includes('clerk signup requires')
      ? 'تحقق من بريدك الإلكتروني لإكمال إنشاء الحساب.'
      : message.toLowerCase().includes('email verification')
        ? 'رمز التحقق غير صحيح أو منتهي الصلاحية.'
    : getArabicErrorMessage(
        err,
        'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      );
}

// =============================================================================
// Reusable select option type
// =============================================================================

interface SelectOption {
  id: string;
  nameAr: string;
}

// =============================================================================
// Custom dropdown component (modal-based picker)
// =============================================================================

function CustomSelect({
  placeholder,
  value,
  options,
  onSelect,
  error,
  disabled = false,
  loading = false,
  emptyMessage = 'لا توجد خيارات متاحة',
}: {
  placeholder: string;
  value: string | undefined;
  options: readonly SelectOption[] | SelectOption[];
  onSelect: (id: string) => void;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.id === value);
  const canOpen = !disabled && !loading;

  return (
    <View style={fieldStyles.wrapper}>
      <TouchableOpacity
        style={[
          fieldStyles.selectButton,
          error ? fieldStyles.selectError : null,
          !canOpen ? fieldStyles.selectDisabled : null,
        ]}
        onPress={() => {
          if (canOpen) {
            setVisible(true);
          }
        }}
        activeOpacity={0.7}
        disabled={!canOpen}
      >
        <View style={fieldStyles.selectContent}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : null}
          <Text
            style={[
              fieldStyles.selectText,
              selected == null ? fieldStyles.placeholderText : null,
            ]}
          >
            {selected != null ? selected.nameAr : placeholder}
          </Text>
        </View>
      </TouchableOpacity>

      {error ? (
        <Text style={fieldStyles.errorText}>{error}</Text>
      ) : null}

      <Modal visible={visible} transparent animationType="fade">
        <View style={fieldStyles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
          />
          <View style={fieldStyles.modalContent}>
            <FlatList
              data={options as SelectOption[]}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <View style={fieldStyles.emptyState}>
                  <Text style={fieldStyles.emptyStateText}>{emptyMessage}</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={fieldStyles.optionItem}
                  onPress={() => {
                    onSelect(item.id);
                    setVisible(false);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={fieldStyles.optionText}>{item.nameAr}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// Main screen
// =============================================================================

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: UserRole }>();
  const { isLoaded: clerkLoaded, signUp, setActive } = useSignUp();
  const { startSSOFlow } = useSSO();
  const googleRedirectUrl = makeRedirectUri({ path: 'sso-callback' });
  const convexClient = useConvex();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const registerUser = useMutation(api.users.register);
  const wilayas = useQuery(api.locations.listWilayas, {});
  const specialties = useQuery(api.specialties.list, {});

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [pendingRegistration, setPendingRegistration] =
    useState<RegistrationPayload | null>(null);
  const [verificationModalVisible, setVerificationModalVisible] =
    useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const completingRegistrationRef = useRef(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      wilayaId: undefined as unknown as string,
      communeId: undefined as unknown as string,
      dateOfBirth: '',
      gender: 'male',
      specialtyId: undefined as unknown as string,
      orderRegistrationNumber: '',
    },
  });

  const selectedWilayaId = watch('wilayaId');

  const communes = useQuery(
    api.locations.listCommunesByWilaya,
    selectedWilayaId != null
      ? { wilayaId: selectedWilayaId as Id<'wilayas'> }
      : 'skip',
  );

  const wilayaOptions: SelectOption[] =
    wilayas?.map((wilaya) => ({
      id: wilaya._id,
      nameAr: wilaya.nameAr,
    })) ?? [];

  const filteredCommunes: SelectOption[] =
    communes?.map((commune) => ({
      id: commune._id,
      nameAr: commune.nameAr,
    })) ?? [];
  const communesLoading = selectedWilayaId != null && communes === undefined;
  const specialtyOptions: SelectOption[] =
    specialties?.map((specialty) => ({
      id: specialty._id,
      nameAr: specialty.nameAr,
    })) ?? [];
  const specialtiesLoading = specialties === undefined;

  // Redirect to onboarding if role is missing or invalid
  useEffect(() => {
    if (role !== 'patient' && role !== 'doctor') {
      router.replace('/(auth)/onboarding');
    } else {
      setRoleReady(true);
    }
  }, [role, router]);

  // Reset commune when wilaya changes
  const handleWilayaSelect = useCallback(
    (wilayaId: string) => {
      setValue('wilayaId', wilayaId, { shouldValidate: step === 2 });
      setValue('communeId', undefined as unknown as string, {
        shouldValidate: false,
      });
    },
    [setValue, step],
  );

  // Advance from step 1 to step 2 after validating step 1 fields
  const handleNext = useCallback(async () => {
    const valid = await trigger([
      'fullName',
      'phone',
      'email',
      'password',
      'confirmPassword',
    ]);
    if (valid) {
      setServerError(null);
      setStep(2);
    }
  }, [trigger]);

  const handleStartGoogleSignUp = useCallback(async () => {
    setSubmitting(true);
    setGoogleLoading(true);
    setServerError(null);

    try {
      const {
        createdSessionId,
        setActive: activateOAuthSession,
      } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: googleRedirectUrl,
      });
      const activateSession = activateOAuthSession ?? setActive;

      if (!createdSessionId || !activateSession) {
        throw new Error('Google sign-up did not complete.');
      }

      await activateSession({ session: createdSessionId });
      router.replace('/');
    } catch (err: any) {
      setServerError(getRegistrationErrorMessage(err));
    } finally {
      setSubmitting(false);
      setGoogleLoading(false);
    }
  }, [
    googleRedirectUrl,
    router,
    setActive,
    startSSOFlow,
  ]);

  useEffect(() => {
    if (
      pendingRegistration == null ||
      authLoading ||
      !isAuthenticated ||
      completingRegistrationRef.current
    ) {
      return;
    }

    completingRegistrationRef.current = true;
    void (async () => {
      try {
        await registerUser(pendingRegistration);

        if (pendingRegistration.role === 'patient') {
          router.replace('/(patient)');
        } else {
          router.replace('/(doctor)/dashboard');
        }
      } catch (err) {
        setServerError(getRegistrationErrorMessage(err));
      } finally {
        completingRegistrationRef.current = false;
        setPendingRegistration(null);
        setSubmitting(false);
      }
    })();
  }, [
    authLoading,
    isAuthenticated,
    pendingRegistration,
    registerUser,
    router,
  ]);

  const completeClerkSignup = useCallback(
    async (
      createdSessionId: string,
      registrationPayload: RegistrationPayload,
      activateOAuthSession = setActive,
    ) => {
      if (!activateOAuthSession) {
        throw new Error('Clerk session activation is not ready.');
      }
      await activateOAuthSession({ session: createdSessionId });
      setVerificationModalVisible(false);
      setVerificationCode('');
      setPendingRegistration(registrationPayload);
    },
    [setActive],
  );

  // Final submission
  const onSubmit = useCallback(
    async (data: FormData) => {
      setSubmitting(true);
      setServerError(null);

      try {
        const {
          emailAuthIdentifier,
          phoneAuthIdentifier,
          registrationPayload,
        } = buildRegistrationPayload(data, role);
        const emailAccountExists = await convexClient.query(
          api.users.isPasswordAccountRegistered,
          { email: emailAuthIdentifier },
        );
        if (emailAccountExists) {
          setServerError('البريد الإلكتروني مستخدم بالفعل');
          setSubmitting(false);
          return;
        }

        if (!clerkLoaded || !signUp) {
          throw new Error('Clerk sign-up is not ready.');
        }

        const signUpAttempt = await signUp.create({
          emailAddress: emailAuthIdentifier,
          password: data.password,
          unsafeMetadata: {
            role: registrationPayload.role,
            phone: phoneAuthIdentifier,
          },
        });

        if (
          signUpAttempt.status === 'complete' &&
          signUpAttempt.createdSessionId
        ) {
          await completeClerkSignup(
            signUpAttempt.createdSessionId,
            registrationPayload,
          );
          return;
        }

        if (signUpAttempt.unverifiedFields.includes('email_address')) {
          await signUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
          setPendingRegistration(registrationPayload);
          setVerificationCode('');
          setVerificationModalVisible(true);
          Alert.alert(
            'تم إرسال رمز التحقق',
            'أدخل الرمز الذي وصل إلى بريدك الإلكتروني لإكمال إنشاء الحساب.',
          );
          return;
        }

        throw new Error(`Clerk signup requires: ${signUpAttempt.missingFields.join(', ')}`);
      } catch (err: any) {
        setServerError(getRegistrationErrorMessage(err));
        setSubmitting(false);
      }
    },
    [clerkLoaded, completeClerkSignup, convexClient, role, signUp],
  );

  const handleVerifyEmailCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      setServerError('أدخل رمز التحقق الذي وصل إلى بريدك الإلكتروني');
      return;
    }
    if (!signUp || !pendingRegistration) {
      setServerError('انتهت جلسة إنشاء الحساب. أعد المحاولة.');
      setVerificationModalVisible(false);
      setSubmitting(false);
      return;
    }

    setVerificationLoading(true);
    setServerError(null);

    try {
      const verificationAttempt =
        await signUp.attemptEmailAddressVerification({
          code: verificationCode.trim(),
        });

      if (
        verificationAttempt.status !== 'complete' ||
        !verificationAttempt.createdSessionId
      ) {
        throw new Error('Email verification did not complete.');
      }

      await completeClerkSignup(
        verificationAttempt.createdSessionId,
        pendingRegistration,
      );
    } catch (err: any) {
      setServerError(getRegistrationErrorMessage(err));
      setSubmitting(false);
    } finally {
      setVerificationLoading(false);
    }
  }, [completeClerkSignup, pendingRegistration, signUp, verificationCode]);

  const handleResendVerificationCode = useCallback(async () => {
    if (!signUp) {
      setServerError('انتهت جلسة إنشاء الحساب. أعد المحاولة.');
      setVerificationModalVisible(false);
      setSubmitting(false);
      return;
    }

    setVerificationLoading(true);
    setServerError(null);

    try {
      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code',
      });
      Alert.alert(
        'تم إرسال رمز جديد',
        'تحقق من بريدك الإلكتروني، ثم أدخل الرمز الجديد.',
      );
    } catch (err) {
      setServerError(getRegistrationErrorMessage(err));
    } finally {
      setVerificationLoading(false);
    }
  }, [signUp]);

  // Don't render until role is validated
  if (!roleReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.title}>إنشاء حساب</Text>
            <Text style={styles.subtitle}>
              {role === 'patient'
                ? 'أنشئ حسابك كـ مريض'
                : 'أنشئ حسابك كـ طبيب'}
            </Text>
          </View>

          {/* ── Step indicator ─────────────────────────────────── */}
          <View style={styles.stepIndicator}>
            <View
              style={[
                styles.stepDot,
                step >= 1 && styles.stepDotActive,
              ]}
            />
            <View style={styles.stepLine} />
            <View
              style={[
                styles.stepDot,
                step >= 2 && styles.stepDotActive,
              ]}
            />
          </View>
          <View style={styles.stepLabels}>
            <Text
              style={[
                styles.stepLabel,
                step === 1 && styles.stepLabelActive,
              ]}
            >
              المعلومات الأساسية
            </Text>
            <Text
              style={[
                styles.stepLabel,
                step === 2 && styles.stepLabelActive,
              ]}
            >
              الموقع
            </Text>
          </View>

          {/* ── Server error ────────────────────────────────────── */}
          {serverError ? (
            <View style={styles.serverErrorBox}>
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          ) : null}

          {/* ── Step 1: Personal info ──────────────────────────── */}
          {step === 1 && (
            <View style={styles.fieldsContainer}>
              {/* Full name */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>الاسم الكامل</Text>
                <Controller
                  control={control}
                  name="fullName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[
                        fieldStyles.input,
                        errors.fullName ? fieldStyles.inputError : null,
                      ]}
                      placeholder="الاسم الكامل بالعربية"
                      placeholderTextColor={theme.colors.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      textAlign={rtlValue('left', 'right')}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  )}
                />
                {errors.fullName ? (
                  <Text style={fieldStyles.errorText}>
                    {errors.fullName.message}
                  </Text>
                ) : null}
              </View>

              {/* Phone */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>رقم الهاتف</Text>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[
                        fieldStyles.input,
                        errors.phone ? fieldStyles.inputError : null,
                      ]}
                      placeholder="0555 12 34 56"
                      placeholderTextColor={theme.colors.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textAlign={rtlValue('left', 'right')}
                      returnKeyType="next"
                    />
                  )}
                />
                {errors.phone ? (
                  <Text style={fieldStyles.errorText}>
                    {errors.phone.message}
                  </Text>
                ) : null}
              </View>

              {/* Email */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>البريد الإلكتروني</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[
                        fieldStyles.input,
                        errors.email ? fieldStyles.inputError : null,
                      ]}
                      placeholder="example@email.com"
                      placeholderTextColor={theme.colors.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      keyboardType="email-address"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textAlign={rtlValue('left', 'right')}
                      returnKeyType="next"
                    />
                  )}
                />
                {errors.email ? (
                  <Text style={fieldStyles.errorText}>
                    {errors.email.message}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[
                  styles.googleButton,
                  googleLoading ? styles.buttonDisabled : null,
                ]}
                onPress={handleStartGoogleSignUp}
                activeOpacity={0.8}
                disabled={submitting || googleLoading}
                accessibilityRole="button"
                accessibilityLabel="المتابعة باستخدام Google"
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.official} />
                ) : (
                  <>
                    <View style={styles.googleMark}>
                      <Text style={styles.googleMarkText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>
                      المتابعة باستخدام Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.oauthDivider}>
                <View style={styles.oauthDividerLine} />
                <Text style={styles.oauthDividerText}>أو سجل بكلمة مرور</Text>
                <View style={styles.oauthDividerLine} />
              </View>

              {/* Password */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>كلمة المرور</Text>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[
                        fieldStyles.input,
                        errors.password ? fieldStyles.inputError : null,
                      ]}
                      placeholder="كلمة المرور (6 أحرف على الأقل)"
                      placeholderTextColor={theme.colors.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      secureTextEntry
                      autoCapitalize="none"
                      textAlign={rtlValue('left', 'right')}
                      returnKeyType="next"
                    />
                  )}
                />
                {errors.password ? (
                  <Text style={fieldStyles.errorText}>
                    {errors.password.message}
                  </Text>
                ) : null}
              </View>

              {/* Confirm password */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>تأكيد كلمة المرور</Text>
                <Controller
                  control={control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[
                        fieldStyles.input,
                        errors.confirmPassword
                          ? fieldStyles.inputError
                          : null,
                      ]}
                      placeholder="أعد كتابة كلمة المرور"
                      placeholderTextColor={theme.colors.textSecondary}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      secureTextEntry
                      autoCapitalize="none"
                      textAlign={rtlValue('left', 'right')}
                      returnKeyType="done"
                    />
                  )}
                />
                {errors.confirmPassword ? (
                  <Text style={fieldStyles.errorText}>
                    {errors.confirmPassword.message}
                  </Text>
                ) : null}
              </View>

              {/* Next button */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>التالي</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Location ───────────────────────────────── */}
          {step === 2 && (
            <View style={styles.fieldsContainer}>
              {/* Wilaya dropdown */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>الولاية</Text>
                <Controller
                  control={control}
                  name="wilayaId"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <CustomSelect
                      placeholder="اختر ولايتك"
                      value={value}
                      options={wilayaOptions}
                      onSelect={handleWilayaSelect}
                      error={error?.message}
                    />
                  )}
                />
              </View>

              {/* Commune dropdown */}
              <View style={fieldStyles.wrapper}>
                <Text style={fieldStyles.label}>البلدية</Text>
                <Controller
                  control={control}
                  name="communeId"
                  render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <CustomSelect
                      placeholder={
                        selectedWilayaId != null
                          ? communesLoading
                            ? 'جاري تحميل البلديات...'
                            : 'اختر بلديتك'
                          : 'اختر الولاية أولاً'
                      }
                      value={value}
                      options={filteredCommunes}
                      onSelect={onChange}
                      error={error?.message}
                      disabled={selectedWilayaId == null}
                      loading={communesLoading}
                      emptyMessage="لا توجد بلديات متاحة لهذه الولاية"
                    />
                  )}
                />
              </View>

              {role === 'patient' ? (
                <>
                  <View style={fieldStyles.wrapper}>
                    <Text style={fieldStyles.label}>تاريخ الميلاد</Text>
                    <Controller
                      control={control}
                      name="dateOfBirth"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          style={fieldStyles.input}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={theme.colors.textSecondary}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          keyboardType="numbers-and-punctuation"
                          textAlign={rtlValue('left', 'right')}
                          returnKeyType="next"
                        />
                      )}
                    />
                  </View>

                  <View style={fieldStyles.wrapper}>
                    <Text style={fieldStyles.label}>الجنس</Text>
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field: { onChange, value } }) => (
                        <View style={styles.genderRow}>
                          <TouchableOpacity
                            style={[
                              styles.genderChip,
                              value === 'male' && styles.genderChipActive,
                            ]}
                            onPress={() => onChange('male')}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="ذكر"
                          >
                            <Text
                              style={[
                                styles.genderChipText,
                                value === 'male' && styles.genderChipTextActive,
                              ]}
                            >
                              ذكر
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.genderChip,
                              value === 'female' && styles.genderChipActive,
                            ]}
                            onPress={() => onChange('female')}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="أنثى"
                          >
                            <Text
                              style={[
                                styles.genderChipText,
                                value === 'female' && styles.genderChipTextActive,
                              ]}
                            >
                              أنثى
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={fieldStyles.wrapper}>
                    <Text style={fieldStyles.label}>التخصص</Text>
                    <Controller
                      control={control}
                      name="specialtyId"
                      render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <CustomSelect
                          placeholder={
                            specialtiesLoading
                              ? 'جاري تحميل التخصصات...'
                              : 'اختر تخصصك'
                          }
                          value={value}
                          options={specialtyOptions}
                          onSelect={onChange}
                          error={error?.message}
                          disabled={specialtiesLoading}
                          loading={specialtiesLoading}
                          emptyMessage="لا توجد تخصصات متاحة"
                        />
                      )}
                    />
                  </View>

                  <View style={fieldStyles.wrapper}>
                    <Text style={fieldStyles.label}>رقم التسجيل في النقابة</Text>
                    <Controller
                      control={control}
                      name="orderRegistrationNumber"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          style={fieldStyles.input}
                          placeholder="مثال: 2024-12345"
                          placeholderTextColor={theme.colors.textSecondary}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="characters"
                          textAlign={rtlValue('left', 'right')}
                          returnKeyType="done"
                        />
                      )}
                    />
                  </View>
                </>
              )}

              <View nativeID="clerk-captcha" style={styles.clerkCaptcha} />

              {/* Action buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep(1)}
                  activeOpacity={0.8}
                  disabled={submitting || googleLoading}
                >
                  <Text style={styles.secondaryButtonText}>رجوع</Text>
                </TouchableOpacity>

                  <TouchableOpacity
                   style={[
                     styles.primaryButton,
                     styles.primaryButtonFlex,
                     submitting ? styles.buttonDisabled : null,
                   ]}
                   onPress={handleSubmit(onSubmit)}
                   activeOpacity={0.8}
                   disabled={submitting || googleLoading}
                 >
                   {submitting ? (
                     <ActivityIndicator size="small" color={theme.colors.white} />
                   ) : (
                     <Text style={styles.primaryButtonText}>تسجيل</Text>
                   )}
                 </TouchableOpacity>
               </View>
             </View>
           )}

          {/* ── Extra Links ────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟ </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>تسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Modal
          visible={verificationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!verificationLoading) {
              setVerificationModalVisible(false);
              setSubmitting(false);
            }
          }}
        >
          <View style={styles.verificationOverlay}>
            <View style={styles.verificationModal}>
              <Text style={styles.verificationTitle}>رمز التحقق</Text>
              <Text style={styles.verificationSubtitle}>
                أدخل الرمز الذي وصل إلى بريدك الإلكتروني لإكمال إنشاء الحساب
              </Text>

              {serverError ? (
                <View style={styles.serverErrorBox}>
                  <Text style={styles.serverErrorText}>{serverError}</Text>
                </View>
              ) : null}

              <TextInput
                style={fieldStyles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="123456"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                textAlign={rtlValue('left', 'right')}
                editable={!verificationLoading}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setVerificationModalVisible(false);
                    setSubmitting(false);
                  }}
                  activeOpacity={0.8}
                  disabled={verificationLoading}
                >
                  <Text style={styles.secondaryButtonText}>إلغاء</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.primaryButtonFlex,
                    verificationLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={handleVerifyEmailCode}
                  activeOpacity={0.8}
                  disabled={verificationLoading}
                >
                  {verificationLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>تأكيد</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.resendCodeButton}
                onPress={handleResendVerificationCode}
                activeOpacity={0.8}
                disabled={verificationLoading}
              >
                <Text style={styles.resendCodeText}>
                  لم يصلك الرمز؟ أرسل رمزاً جديداً
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing['5xl'],
  },

  // Header
  header: {
    marginTop: theme.spacing['3xl'],
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: 28,
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.border,
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 38,
    marginBottom: theme.spacing['2xl'],
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
  },
  stepLabelActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },

  // Fields container
  fieldsContainer: {
    gap: theme.spacing.lg,
  },

  // Server error
  serverErrorBox: {
    backgroundColor: '#FDF2F2',
    borderColor: theme.colors.danger,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  serverErrorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.arabic,
    textAlign: 'right',
  },

  // Buttons
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  primaryButtonFlex: {
    flex: 1,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  oauthDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  oauthDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderStrong,
  },
  oauthDividerText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  googleButton: {
    minHeight: 50,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.official,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleMarkText: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 14,
    color: theme.colors.official,
  },
  googleButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.official,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  clerkCaptcha: {
    minHeight: 1,
  },
  verificationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  verificationModal: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },
  verificationTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.sm,
  },
  verificationSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.lg,
  },
  resendCodeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  resendCodeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  genderRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  genderChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  genderChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  genderChipText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  genderChipTextActive: {
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing['3xl'],
  },
  footerText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
});

// =============================================================================
// Field-level styles (shared by main screen & CustomSelect)
// =============================================================================

const fieldStyles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: 2,
  },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.arabic,
    textAlign: 'right',
  },

  // Select (dropdown)
  selectButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  selectDisabled: {
    opacity: 0.65,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  selectError: {
    borderColor: theme.colors.danger,
  },
  selectText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  placeholderText: {
    color: theme.colors.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxHeight: '60%',
    overflow: 'hidden',
  },
  optionItem: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  optionText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  emptyState: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['2xl'],
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
