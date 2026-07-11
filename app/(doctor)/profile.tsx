// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import {
  DoctorHeader,
  DoctorSection,
  MetricStrip,
  type MetricItem,
} from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Constants
// =============================================================================

const TOAST_DURATION = 2500;
const COMPLETE_PROFILE_TIMEOUT_MS = 10000;

type SpecialtyOption = { id: Id<'specialties'>; nameAr: string };
type PickerOption = { id: string; nameAr: string };

interface DoctorProfileData {
  specialtyId: Id<'specialties'>;
  bioAr: string;
  yearsOfExperience: number;
  consultationFee?: number;
  followUpFee?: number;
  user: {
    fullNameAr: string | null;
    phone: string | null;
    email: string | null;
  };
  specialty: {
    nameAr: string;
  };
}

// =============================================================================
// Zod Schema
// =============================================================================

const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase()),
    { message: 'البريد الإلكتروني غير صحيح' },
  );

const optionalFeeSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  },
  z.number({ message: 'الرجاء إدخال قيمة صحيحة' })
    .min(0, { message: 'يجب أن تكون القيمة 0 أو أكثر' })
    .optional(),
);

const profileSchema = z.object({
  // Personal info
  fullNameAr: z.string().min(2, { message: 'الاسم العربي مطلوب' }),
  email: optionalEmailSchema,
  phone: z
    .string()
    .min(8, { message: 'رقم الهاتف غير صالح' })
    .regex(/^[0-9+\-\s]+$/, { message: 'رقم الهاتف غير صالح' }),

  // Professional info
  specialtyId: z.string().min(1, { message: 'الرجاء اختيار التخصص' }),
  bioAr: z.string().max(120, { message: 'الوصف القصير يجب أن لا يتجاوز 120 حرفاً' }).optional().or(z.literal('')),
  yearsOfExperience: z.coerce
    .number({ message: 'الرجاء إدخال عدد سنوات الخبرة' })
    .min(0, { message: 'عدد السنوات يجب أن يكون 0 أو أكثر' })
    .max(70, { message: 'عدد السنوات غير منطقي' }),

  // Pricing
  consultationFee: optionalFeeSchema,
  followUpFee: optionalFeeSchema,
});

type ProfileFormData = z.infer<typeof profileSchema>;

const completeDoctorProfileSchema = z.object({
  specialtyId: z.string().min(1, { message: 'الرجاء اختيار التخصص' }),
});

type CompleteDoctorProfileFormData = z.infer<typeof completeDoctorProfileSchema>;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

const EMPTY_INITIAL_DATA: ProfileFormData = {
  fullNameAr: '',
  email: '',
  phone: '',
  specialtyId: '',
  bioAr: '',
  yearsOfExperience: 0,
  consultationFee: undefined,
  followUpFee: undefined,
};

const PROFILE_FIELD_ORDER = [
  'fullNameAr',
  'email',
  'phone',
  'specialtyId',
  'bioAr',
  'yearsOfExperience',
  'consultationFee',
  'followUpFee',
] as const;

// =============================================================================
// Sub-components
// =============================================================================

// ── Toast ───────────────────────────────────────────────────────────────────

interface ToastProps {
  visible: boolean;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const Toast: React.FC<ToastProps> = ({ visible, message, icon }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toastContainer, { opacity }]}>
      <View style={styles.toastContent}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={theme.colors.white}
            style={styles.toastIcon}
          />
        ) : null}
        <Text style={styles.toastMessage}>{message}</Text>
      </View>
    </Animated.View>
  );
};

// ── Form Field ──────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  inputRef?: React.Ref<TextInput>;
  onLayout?: (event: any) => void;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  editable?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChangeText,
  onBlur: _onBlur,
  inputRef,
  onLayout,
  error,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  editable = true,
}) => (
  <View style={styles.fieldContainer} onLayout={onLayout}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      ref={inputRef}
      style={[
        styles.fieldInput,
        multiline && styles.fieldInputMultiline,
        !editable && styles.fieldInputDisabled,
        error ? styles.fieldInputError : undefined,
      ]}
      value={value}
      onChangeText={onChangeText}
      onBlur={_onBlur}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical={multiline ? 'top' : 'center'}
      textAlign="right"
      keyboardType={keyboardType}
      editable={editable}
      accessibilityLabel={label}
    />
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

// ── Specialty Picker Modal ──────────────────────────────────────────────────

interface OptionPickerProps {
  visible: boolean;
  selectedId: string;
  title: string;
  options: PickerOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const OptionPicker: React.FC<OptionPickerProps> = ({
  visible,
  selectedId,
  title,
  options,
  onSelect,
  onClose,
}) => {
  const renderOption = useCallback(
    ({ item }: ListRenderItemInfo<PickerOption>) => {
      const isSelected = item.id === selectedId;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.pickerOption,
            isSelected && styles.pickerOptionSelected,
            pressed && styles.pickerOptionPressed,
          ]}
          onPress={() => onSelect(item.id)}
          accessibilityRole="button"
          accessibilityLabel={item.nameAr}
        >
          <Text
            style={[
              styles.pickerOptionText,
              isSelected && styles.pickerOptionTextSelected,
            ]}
          >
            {item.nameAr}
          </Text>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.primary}
              style={styles.pickerOptionCheck}
            />
          ) : null}
        </Pressable>
      );
    },
    [selectedId, onSelect],
  );

  const keyExtractor = useCallback(
    (item: SpecialtyOption) => item.id,
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.pickerOverlay}>
        <Pressable style={styles.pickerBackdrop} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle}>
            <View style={styles.pickerHandleBar} />
          </View>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.pickerCloseButton,
                pressed && styles.pickerCloseButtonPressed,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            renderItem={renderOption}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.pickerListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// Main Screen
// =============================================================================

export default function DoctorProfileScreen() {
  const me = useQuery(api.users.me, {});
  const profile = useQuery(api.doctors.getMyProfile, {}) as
    | DoctorProfileData
    | null
    | undefined;
  const specialties = useQuery(api.specialties.list, {}) ?? [];
  const updateProfile = useMutation(api.doctors.updateProfile);
  const completeDoctorProfile = useMutation(api.users.completeDoctorProfile);

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: EMPTY_INITIAL_DATA,
  });

  const {
    control: completeControl,
    handleSubmit: handleCompleteSubmit,
    formState: {
      errors: completeErrors,
      isSubmitting: isCompletingDoctorProfile,
    },
    setValue: setCompleteValue,
    watch: watchComplete,
  } = useForm<CompleteDoctorProfileFormData>({
    resolver: zodResolver(completeDoctorProfileSchema) as any,
    defaultValues: {
      specialtyId: '',
    },
  });
  const profileScrollRef = useRef<ScrollView | null>(null);
  const profileFieldOffsetsRef = useRef<Record<string, number>>({});

  const registerProfileFieldLayout = useCallback(
    (fieldName: string) => (event: any) => {
      profileFieldOffsetsRef.current[fieldName] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToProfileField = useCallback(
    (fieldName: string) => {
      const fieldOffset = profileFieldOffsetsRef.current[fieldName];
      if (fieldOffset === undefined) return;

      profileScrollRef.current?.scrollTo({
        y: Math.max(fieldOffset - theme.spacing.xl, 0),
        animated: true,
      });

      if (fieldName !== 'specialtyId') {
        setTimeout(() => setFocus(fieldName as any), 240);
      }
    },
    [setFocus],
  );

  const handleProfileInvalid = useCallback(
    (formErrors: Record<string, unknown>) => {
      const firstInvalidField = PROFILE_FIELD_ORDER.find(
        (fieldName) => formErrors[fieldName],
      );
      if (!firstInvalidField) return;

      scrollToProfileField(firstInvalidField);
      if (firstInvalidField === 'specialtyId') {
        setTimeout(() => setSpecialtyPickerVisible(true), 260);
      }
    },
    [scrollToProfileField],
  );

  const watchedSpecialtyId = watch('specialtyId');
  const watchedCompleteSpecialtyId = watchComplete('specialtyId');

  // ── Local state ───────────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [specialtyPickerVisible, setSpecialtyPickerVisible] = useState(false);
  const [completeSpecialtyPickerVisible, setCompleteSpecialtyPickerVisible] =
    useState(false);
  const [completeDoctorProfileError, setCompleteDoctorProfileError] = useState<
    string | null
  >(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const specialtyOptions = useMemo<SpecialtyOption[]>(() => {
    const options = new Map<Id<'specialties'>, SpecialtyOption>();
    for (const specialty of specialties) {
      options.set(specialty._id, {
        id: specialty._id,
        nameAr: specialty.name,
      });
    }
    if (profile) {
      options.set(profile.specialtyId, {
        id: profile.specialtyId,
        nameAr: profile.specialty.nameAr,
      });
    }
    return [...options.values()];
  }, [profile, specialties]);

  const selectedSpecialty = useMemo(
    () => specialtyOptions.find((s) => s.id === watchedSpecialtyId),
    [specialtyOptions, watchedSpecialtyId],
  );

  const selectedCompleteSpecialty = useMemo(
    () => specialtyOptions.find((s) => s.id === watchedCompleteSpecialtyId),
    [specialtyOptions, watchedCompleteSpecialtyId],
  );

  const completionStats = useMemo(() => {
    if (!profile) {
      return { complete: 0, total: 8, percent: 0 };
    }
    const completionChecks = [
      Boolean(profile.user.fullNameAr?.trim()),
      Boolean(profile.user.email?.trim()),
      Boolean(profile.user.phone?.trim()),
      Boolean(profile.specialtyId),
      Boolean(profile.bioAr?.trim()),
      profile.yearsOfExperience > 0,
      profile.consultationFee !== undefined && profile.consultationFee !== null,
      profile.followUpFee !== undefined && profile.followUpFee !== null,
    ];
    const complete = completionChecks.filter(Boolean).length;
    return {
      complete,
      total: completionChecks.length,
      percent: Math.round((complete / completionChecks.length) * 100),
    };
  }, [profile]);

  const profileMetrics = useMemo((): MetricItem[] => [
    {
      label: 'حالة اكتمال الملف الشخصي',
      value: `${completionStats.percent}%`,
      icon: 'shield-checkmark-outline',
      tone: completionStats.percent >= 85 ? 'success' : 'warning',
      progressValue: completionStats.percent,
    },
  ], [completionStats.percent]);

  useEffect(() => {
    if (!profile) return;
    reset({
      fullNameAr: profile.user.fullNameAr ?? '',
      email: profile.user.email ?? '',
      phone: profile.user.phone ?? '',
      specialtyId: profile.specialtyId,
      bioAr: profile.bioAr,
      yearsOfExperience: profile.yearsOfExperience,
      consultationFee: profile.consultationFee && profile.consultationFee > 0
        ? profile.consultationFee
        : undefined,
      followUpFee: profile.followUpFee && profile.followUpFee > 0
        ? profile.followUpFee
        : undefined,
    });
  }, [profile, reset]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), TOAST_DURATION);
  }, []);

  // ── Save handler ──────────────────────────────────────────────────────────
  const onSave = useCallback(
    async (data: ProfileFormData) => {
      await updateProfile({
        fullNameAr: data.fullNameAr,
        email: data.email,
        phone: data.phone,
        specialtyId: data.specialtyId as Id<'specialties'>,
        bioAr: data.bioAr || '',
        yearsOfExperience: data.yearsOfExperience,
        consultationFee: data.consultationFee ?? null,
        followUpFee: data.followUpFee ?? null,
      });
      showToast();
    },
    [showToast, updateProfile],
  );

  const onCompleteDoctorProfile = useCallback(
    async (data: CompleteDoctorProfileFormData) => {
      setCompleteDoctorProfileError(null);
      try {
        await withTimeout(
          completeDoctorProfile({
            specialtyId: data.specialtyId as Id<'specialties'>,
          }),
          COMPLETE_PROFILE_TIMEOUT_MS,
          'profile_completion_timeout',
        );
        showToast();
      } catch (error) {
        setCompleteDoctorProfileError(
          getArabicErrorMessage(error, 'تعذر إكمال ملف الطبيب'),
        );
      }
    },
    [completeDoctorProfile, showToast],
  );

  // ── Pricing formatter for display ─────────────────────────────────────────
  const formatPrice = useCallback((value: number) => {
    return `${value.toLocaleString()} د.ج`;
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (profile === undefined || me === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الملف الشخصي...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (me?.role !== 'doctor') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.danger}
          />
          <Text style={styles.loadingText}>تعذر تحميل ملف الطبيب</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.missingProfileContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.missingProfileIcon}>
              <Ionicons
                name="medkit-outline"
                size={32}
                color={theme.colors.primary}
              />
            </View>
            <DoctorHeader
              title="أكمل ملف الطبيب"
              subtitle="نحتاج التخصص قبل فتح إعدادات العيادات والمواعيد."
              icon="medkit-outline"
              style={styles.missingDoctorHeader}
            />
            <Text style={styles.missingProfileText}>
              نحتاج التخصص قبل فتح إعدادات العيادات والمواعيد.
            </Text>

            {completeDoctorProfileError ? (
              <View style={styles.serverErrorBox}>
                <Text style={styles.serverErrorText}>
                  {completeDoctorProfileError}
                </Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>التخصص</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.dropdownField,
                    completeErrors.specialtyId
                      ? styles.fieldInputError
                      : undefined,
                    pressed && styles.dropdownFieldPressed,
                  ]}
                  onPress={() => setCompleteSpecialtyPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="اختر التخصص"
                >
                  <Text
                    style={[
                      styles.dropdownFieldText,
                      !selectedCompleteSpecialty &&
                        styles.dropdownFieldPlaceholder,
                    ]}
                  >
                    {selectedCompleteSpecialty
                      ? selectedCompleteSpecialty.nameAr
                      : 'اختر التخصص...'}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
                {completeErrors.specialtyId ? (
                  <Text style={styles.fieldError}>
                    {completeErrors.specialtyId.message}
                  </Text>
                ) : null}
              </View>

            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                isCompletingDoctorProfile && styles.saveButtonDisabled,
                pressed && !isCompletingDoctorProfile && styles.saveButtonPressed,
              ]}
              onPress={handleCompleteSubmit(onCompleteDoctorProfile)}
              disabled={isCompletingDoctorProfile}
              accessibilityRole="button"
              accessibilityLabel="إكمال ملف الطبيب"
            >
              <Ionicons
                name={
                  isCompletingDoctorProfile ? 'hourglass-outline' : 'save-outline'
                }
                size={20}
                color={theme.colors.white}
                style={styles.saveButtonIcon}
              />
              <Text style={styles.saveButtonText}>
                {isCompletingDoctorProfile ? 'جاري الحفظ...' : 'إكمال الملف'}
              </Text>
            </Pressable>
          </ScrollView>

          <OptionPicker
            visible={completeSpecialtyPickerVisible}
            selectedId={watchedCompleteSpecialtyId}
            title="اختر التخصص"
            options={specialtyOptions}
            onSelect={(id) => {
              setCompleteValue('specialtyId', id, {
                shouldDirty: true,
                shouldValidate: true,
              });
              setCompleteSpecialtyPickerVisible(false);
            }}
            onClose={() => setCompleteSpecialtyPickerVisible(false)}
          />

          <Toast visible={toastVisible} message="تم الحفظ" icon="checkmark-circle" />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Scrollable Form ─────────────────────────────────────── */}
        <ScrollView
          ref={profileScrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <DoctorHeader
            title="الملف الشخصي"
            icon="id-card-outline"
            centerTitle
          />

          <MetricStrip items={profileMetrics} />

          <DoctorSection
            title="المعلومات الشخصية"
          >
          <View style={styles.sectionCard}>
            <Controller
              control={control}
              name="fullNameAr"
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <FormField
                  label="الاسم"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  inputRef={ref}
                  onLayout={registerProfileFieldLayout('fullNameAr')}
                  error={errors.fullNameAr?.message}
                  placeholder="مثال: أحمد بن سالم"
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <FormField
                  label="البريد الإلكتروني"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  inputRef={ref}
                  onLayout={registerProfileFieldLayout('email')}
                  error={errors.email?.message}
                  placeholder="example@email.com"
                  keyboardType="email-address"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <FormField
                  label="رقم الهاتف"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  inputRef={ref}
                  onLayout={registerProfileFieldLayout('phone')}
                  error={errors.phone?.message}
                  placeholder="مثال: 0555123456"
                  keyboardType="phone-pad"
                />
              )}
            />
          </View>
          </DoctorSection>

          <DoctorSection
            title="المعلومات المهنية"
          >
          <View style={styles.sectionCard}>
            {/* Specialty - Pressable dropdown */}
            <View
              style={styles.fieldContainer}
              onLayout={registerProfileFieldLayout('specialtyId')}
            >
              <Text style={styles.fieldLabel}>التخصص</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.dropdownField,
                  errors.specialtyId ? styles.fieldInputError : undefined,
                  pressed && styles.dropdownFieldPressed,
                ]}
                onPress={() => setSpecialtyPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="اختر التخصص"
              >
                <Text
                  style={[
                    styles.dropdownFieldText,
                    !selectedSpecialty && styles.dropdownFieldPlaceholder,
                  ]}
                >
                  {selectedSpecialty
                    ? selectedSpecialty.nameAr
                    : 'اختر التخصص...'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
              {errors.specialtyId ? (
                <Text style={styles.fieldError}>{errors.specialtyId.message}</Text>
              ) : null}
            </View>

            {/* Short description */}
            <Controller
              control={control}
              name="bioAr"
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <FormField
                  label="وصف قصير"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  inputRef={ref}
                  onLayout={registerProfileFieldLayout('bioAr')}
                  error={errors.bioAr?.message}
                  placeholder="مثال: طبيب مختص بخبرة في المتابعة اليومية"
                />
              )}
            />

            {/* Years of Experience */}
            <Controller
              control={control}
              name="yearsOfExperience"
              render={({ field: { onChange, onBlur, value, ref } }) => (
                <FormField
                  label="سنوات الخبرة"
                  value={String(value)}
                  onChangeText={(text) => onChange(text === '' ? '' : Number(text))}
                  onBlur={onBlur}
                  inputRef={ref}
                  onLayout={registerProfileFieldLayout('yearsOfExperience')}
                  error={errors.yearsOfExperience?.message}
                  placeholder="مثال: 10"
                  keyboardType="numeric"
                />
              )}
            />

          </View>
          </DoctorSection>

          {/* ── Save Button ────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!isDirty || isSubmitting) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSubmit(onSave, handleProfileInvalid)}
            disabled={!isDirty || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="حفظ التغييرات"
          >
            <Ionicons
              name={isSubmitting ? 'hourglass-outline' : 'save-outline'}
              size={20}
              color={theme.colors.white}
              style={styles.saveButtonIcon}
            />
            <Text style={styles.saveButtonText}>
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Text>
          </Pressable>

          {/* Bottom spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* ── Toast ───────────────────────────────────────────────── */}
        <Toast visible={toastVisible} message="تم الحفظ" icon="checkmark-circle" />

        {/* ── Specialty Picker Modal ──────────────────────────────── */}
        <OptionPicker
          visible={specialtyPickerVisible}
          selectedId={watchedSpecialtyId}
          title="اختر التخصص"
          options={specialtyOptions}
          onSelect={(id) => {
            setValue('specialtyId', id, { shouldDirty: true });
            setSpecialtyPickerVisible(false);
          }}
          onClose={() => setSpecialtyPickerVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  missingProfileContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing['4xl'],
  },
  missingProfileIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  missingProfileTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  missingProfileText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  missingDoctorHeader: {
    marginHorizontal: 0,
  },
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Section ─────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeaderIcon: {
    marginEnd: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },
  serverErrorBox: {
    backgroundColor: '#FDEDEC',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  serverErrorText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.danger,
    textAlign: 'center',
  },

  // ─── Fields ──────────────────────────────────────────────────────────────
  fieldContainer: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldInputDisabled: {
    backgroundColor: '#F0F0F0',
    color: theme.colors.textSecondary,
  },
  fieldInputError: {
    borderColor: theme.colors.danger,
    borderWidth: 1.5,
  },
  fieldError: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  // ─── Display Row ─────────────────────────────────────────────────────────
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  displayRowIcon: {
    marginEnd: theme.spacing.sm,
  },
  displayRowContent: {
    flex: 1,
  },
  displayRowLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  displayRowValue: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Dropdown ────────────────────────────────────────────────────────────
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  dropdownFieldPressed: {
    opacity: 0.85,
  },
  dropdownFieldText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  dropdownFieldPlaceholder: {
    color: theme.colors.textSecondary,
  },

  // ─── Chips ───────────────────────────────────────────────────────────────
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.primary,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  chipTextSelected: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },

  // ─── Clinics Manager ─────────────────────────────────────────────────────
  clinicsManager: {
    gap: theme.spacing.md,
  },
  emptyClinicsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  },
  emptyClinicsText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  clinicManageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  clinicManageInfo: {
    flex: 1,
  },
  clinicManageName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  clinicManageDetail: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  clinicManageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginStart: theme.spacing.md,
  },
  clinicEditButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicDeactivateButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addClinicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
  },
  addClinicButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.primary,
    marginStart: theme.spacing.xs,
  },
  fieldHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coordinateInput: {
    flex: 1,
  },
  clinicModalSheet: {
    maxHeight: '85%',
  },
  clinicModalScroll: {
    maxHeight: '100%',
  },
  clinicModalContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  clinicModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  modalSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalSecondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  modalPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },
  modalPrimaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ─── Save Button ─────────────────────────────────────────────────────────
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonIcon: {
    marginEnd: theme.spacing.sm,
  },
  saveButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.white,
  },

  // ─── Toast ───────────────────────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    bottom: theme.spacing['4xl'],
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.lg,
  },
  toastIcon: {
    marginEnd: theme.spacing.sm,
  },
  toastMessage: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ─── Specialty Picker Modal ──────────────────────────────────────────────
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
    ...theme.shadows.xl,
  },
  pickerHandle: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  pickerHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  pickerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseButtonPressed: {
    opacity: 0.7,
  },
  pickerListContent: {
    paddingBottom: theme.spacing['3xl'],
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.secondary,
  },
  pickerOptionPressed: {
    opacity: 0.8,
  },
  pickerOptionText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  pickerOptionTextSelected: {
    color: theme.colors.primary,
  },
  pickerOptionCheck: {
    marginStart: theme.spacing.sm,
  },
});
