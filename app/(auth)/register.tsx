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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { theme } from '../../src/lib/theme';
import { rtlValue } from '../../src/lib/rtl';
import { getArabicErrorMessage } from '../../src/lib/errorMessages';
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

const step1Schema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.email('يرجى إدخال بريد إلكتروني صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).superRefine(passwordMatchRefine);

const step2Schema = z.object({
  wilayaId: z.string({ message: 'يرجى اختيار ولايتك' }).min(1, 'يرجى اختيار ولايتك'),
  communeId: z.string({ message: 'يرجى اختيار بلديتك' }).min(1, 'يرجى اختيار بلديتك'),
  dateOfBirth: z.string().optional(),
  gender: z.union([z.literal('male'), z.literal('female')]).optional(),
});

const fullSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.email('يرجى إدخال بريد إلكتروني صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
  wilayaId: z.string({ message: 'يرجى اختيار ولايتك' }).min(1, 'يرجى اختيار ولايتك'),
  communeId: z.string({ message: 'يرجى اختيار بلديتك' }).min(1, 'يرجى اختيار بلديتك'),
  dateOfBirth: z.string().optional(),
  gender: z.union([z.literal('male'), z.literal('female')]).optional(),
}).superRefine(passwordMatchRefine);

type FormData = z.output<typeof fullSchema>;

type RegistrationPayload = {
  fullNameAr: string;
  role: UserRole;
  wilayaId: Id<'wilayas'>;
  communeId?: Id<'communes'>;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
};

function getRegistrationErrorMessage(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';

  return message.includes('already')
    ? 'البريد الإلكتروني مستخدم بالفعل'
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
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const registerUser = useMutation(api.users.register);
  const wilayas = useQuery(api.locations.listWilayas, {});

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);
  const [pendingRegistration, setPendingRegistration] =
    useState<RegistrationPayload | null>(null);
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
      email: '',
      password: '',
      confirmPassword: '',
      wilayaId: undefined as unknown as string,
      communeId: undefined as unknown as string,
      dateOfBirth: '',
      gender: 'male',
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
      'email',
      'password',
      'confirmPassword',
    ]);
    if (valid) {
      setServerError(null);
      setStep(2);
    }
  }, [trigger]);

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

  // Final submission
  const onSubmit = useCallback(
    async (data: FormData) => {
      setSubmitting(true);
      setServerError(null);

      try {
        if (role === 'patient' && !data.dateOfBirth?.trim()) {
          setServerError('يرجى إدخال تاريخ الميلاد');
          setSubmitting(false);
          return;
        }
        if (role === 'patient' && !data.gender) {
          setServerError('يرجى اختيار الجنس');
          setSubmitting(false);
          return;
        }

        const registrationPayload: RegistrationPayload = {
          fullNameAr: data.fullName.trim(),
          role: role ?? 'patient',
          wilayaId: data.wilayaId as Id<'wilayas'>,
          communeId:
            role === 'patient'
              ? (data.communeId as Id<'communes'>)
              : undefined,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
        };

        const signInResult = await signIn('password', {
          email: data.email,
          password: data.password,
          flow: 'signUp',
        });

        if (!signInResult.signingIn) {
          throw new Error('Sign up did not complete.');
        }

        setPendingRegistration(registrationPayload);
      } catch (err: any) {
        setServerError(getRegistrationErrorMessage(err));
        setSubmitting(false);
      }
    },
    [role, signIn],
  );

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
              ) : null}

              {/* Action buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep(1)}
                  activeOpacity={0.8}
                  disabled={submitting}
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
                  disabled={submitting}
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
