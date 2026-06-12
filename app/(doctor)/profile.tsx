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
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Constants
// =============================================================================

const TOAST_DURATION = 2500;

const LANGUAGES_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'العربية', value: 'ar' },
  { label: 'الفرنسية', value: 'fr' },
  { label: 'الإنجليزية', value: 'en' },
  { label: 'الأمازيغية', value: 'ber' },
  { label: 'الإسبانية', value: 'es' },
  { label: 'الألمانية', value: 'de' },
];

type SpecialtyOption = { id: Id<'specialties'>; nameAr: string; nameFr: string };

interface ClinicInfo {
  _id: Id<'clinics'>;
  name: string;
  wilayaId: Id<'wilayas'>;
  communeId: Id<'communes'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  isActive: boolean;
}

interface DoctorProfileData {
  specialtyId: Id<'specialties'>;
  subSpecialties: Id<'specialties'>[];
  bioAr: string;
  bioFr: string;
  yearsOfExperience: number;
  languages: string[];
  orderRegistrationNumber: string;
  consultationFee: number;
  followUpFee: number;
  user: {
    fullNameAr: string | null;
    phone: string | null;
    fullNameFr: string | null;
    email: string | null;
  };
  specialty: {
    nameAr: string;
    nameFr: string;
  };
  clinics: ClinicInfo[];
}

// =============================================================================
// Zod Schema
// =============================================================================

const profileSchema = z.object({
  // Personal info
  fullNameAr: z.string().min(2, { message: 'الاسم العربي مطلوب' }),
  fullNameFr: z.string().min(2, { message: 'الاسم الفرنسي مطلوب' }),
  phone: z
    .string()
    .min(8, { message: 'رقم الهاتف غير صالح' })
    .regex(/^[0-9+\-\s]+$/, { message: 'رقم الهاتف غير صالح' }),

  // Professional info
  specialtyId: z.string().min(1, { message: 'الرجاء اختيار التخصص' }),
  subSpecialties: z.array(z.string()),
  bioAr: z.string().max(500, { message: 'السيرة الذاتية يجب أن لا تتجاوز 500 حرف' }).optional().or(z.literal('')),
  bioFr: z.string().max(500, { message: 'La biographie ne doit pas depasser 500 caracteres' }).optional().or(z.literal('')),
  yearsOfExperience: z.coerce
    .number({ message: 'الرجاء إدخال عدد سنوات الخبرة' })
    .min(0, { message: 'عدد السنوات يجب أن يكون 0 أو أكثر' })
    .max(70, { message: 'عدد السنوات غير منطقي' }),
  languages: z.array(z.string()).min(1, { message: 'الرجاء اختيار لغة واحدة على الأقل' }),
  orderRegistrationNumber: z.string().min(3, { message: 'رقم التسجيل مطلوب' }),

  // Pricing
  consultationFee: z.coerce
    .number({ message: 'الرجاء إدخال قيمة صحيحة' })
    .min(0, { message: 'يجب أن تكون القيمة 0 أو أكثر' }),
  followUpFee: z.coerce
    .number({ message: 'الرجاء إدخال قيمة صحيحة' })
    .min(0, { message: 'يجب أن تكون القيمة 0 أو أكثر' }),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const EMPTY_INITIAL_DATA: ProfileFormData = {
  fullNameAr: '',
  fullNameFr: '',
  phone: '',
  specialtyId: '',
  subSpecialties: [],
  bioAr: '',
  bioFr: '',
  yearsOfExperience: 0,
  languages: ['ar'],
  orderRegistrationNumber: '',
  consultationFee: 0,
  followUpFee: 0,
};

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

// ── Section Header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon }) => (
  <View style={styles.sectionHeader}>
    {icon ? (
      <Ionicons
        name={icon}
        size={18}
        color={theme.colors.primary}
        style={styles.sectionHeaderIcon}
      />
    ) : null}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ── Form Field ──────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
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
  error,
  placeholder,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  editable = true,
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[
        styles.fieldInput,
        multiline && styles.fieldInputMultiline,
        !editable && styles.fieldInputDisabled,
        error ? styles.fieldInputError : undefined,
      ]}
      value={value}
      onChangeText={onChangeText}
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

interface SpecialtyPickerProps {
  visible: boolean;
  selectedId: string;
  options: SpecialtyOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const SpecialtyPicker: React.FC<SpecialtyPickerProps> = ({
  visible,
  selectedId,
  options,
  onSelect,
  onClose,
}) => {
  const renderOption = useCallback(
    ({ item }: ListRenderItemInfo<SpecialtyOption>) => {
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
          <Text style={styles.pickerOptionSub}>{item.nameFr}</Text>
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
            <Text style={styles.pickerTitle}>اختر التخصص</Text>
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

// ── Language Chip Selector ──────────────────────────────────────────────────

interface LanguageChipsProps {
  selected: string[];
  options: typeof LANGUAGES_OPTIONS;
  onToggle: (value: string) => void;
  error?: string;
}

const LanguageChips: React.FC<LanguageChipsProps> = ({
  selected,
  options,
  onToggle,
  error,
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>اللغات</Text>
    <View style={styles.chipsContainer}>
      {options.map((lang) => {
        const isSelected = selected.includes(lang.value);
        return (
          <Pressable
            key={lang.value}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onToggle(lang.value)}
            accessibilityRole="button"
            accessibilityLabel={`${lang.label} ${isSelected ? 'محدد' : 'غير محدد'}`}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {lang.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

// ── Clinics Manager ─────────────────────────────────────────────────────────

interface ClinicsManagerProps {
  clinics: ClinicInfo[];
  onAdd: () => void;
  onEdit: (clinic: ClinicInfo) => void;
  onDeactivate: (clinicId: Id<'clinics'>) => void;
}

const ClinicsManager: React.FC<ClinicsManagerProps> = ({
  clinics,
  onAdd,
  onEdit,
  onDeactivate,
}) => (
  <View style={styles.clinicsManager}>
    {clinics.length === 0 ? (
      <View style={styles.emptyClinicsBox}>
        <Ionicons name="business-outline" size={38} color={theme.colors.textSecondary} />
        <Text style={styles.emptyClinicsText}>لا توجد عيادات مضافة</Text>
      </View>
    ) : (
      clinics.map((clinic) => (
        <View key={clinic._id} style={styles.clinicManageCard}>
          <View style={styles.clinicManageInfo}>
            <Text style={styles.clinicManageName}>{clinic.name}</Text>
            <Text style={styles.clinicManageDetail}>{clinic.address}</Text>
            <Text style={styles.clinicManageDetail}>{clinic.phone}</Text>
          </View>
          <View style={styles.clinicManageActions}>
            <Pressable
              style={({ pressed }) => [
                styles.clinicEditButton,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onEdit(clinic)}
              accessibilityRole="button"
              accessibilityLabel={`تعديل عيادة ${clinic.name}`}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.clinicDeactivateButton,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onDeactivate(clinic._id)}
              accessibilityRole="button"
              accessibilityLabel={`تعطيل عيادة ${clinic.name}`}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>
      ))
    )}

    <Pressable
      style={({ pressed }) => [
        styles.addClinicButton,
        pressed && styles.chipPressed,
      ]}
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel="إضافة عيادة"
    >
      <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
      <Text style={styles.addClinicButtonText}>إضافة عيادة</Text>
    </Pressable>
  </View>
);

// ── Read-only Display Row ───────────────────────────────────────────────────

interface DisplayRowProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const DisplayRow: React.FC<DisplayRowProps> = ({ label, value, icon }) => (
  <View style={styles.displayRow}>
    {icon ? (
      <Ionicons
        name={icon}
        size={16}
        color={theme.colors.textSecondary}
        style={styles.displayRowIcon}
      />
    ) : null}
    <View style={styles.displayRowContent}>
      <Text style={styles.displayRowLabel}>{label}</Text>
      <Text style={styles.displayRowValue}>{value}</Text>
    </View>
  </View>
);

// =============================================================================
// Main Screen
// =============================================================================

export default function DoctorProfileScreen() {
  const me = useQuery(api.users.me, {});
  const profile = useQuery(api.doctors.getMyProfile, {}) as
    | DoctorProfileData
    | null
    | undefined;
  const wilayas = useQuery(api.locations.listWilayas, {}) ?? [];
  const updateProfile = useMutation(api.doctors.updateProfile);
  const createClinic = useMutation(api.clinics.create);
  const updateClinic = useMutation(api.clinics.update);
  const deactivateClinic = useMutation(api.clinics.delete_);

  // ── Form ──────────────────────────────────────────────────────────────────
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: EMPTY_INITIAL_DATA,
  });

  const watchedLanguages = watch('languages');
  const watchedSpecialtyId = watch('specialtyId');

  // ── Local state ───────────────────────────────────────────────────────────
  const [toastVisible, setToastVisible] = useState(false);
  const [specialtyPickerVisible, setSpecialtyPickerVisible] = useState(false);
  const [clinicModalVisible, setClinicModalVisible] = useState(false);
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicLatitude, setClinicLatitude] = useState('');
  const [clinicLongitude, setClinicLongitude] = useState('');
  const [clinicWilayaId, setClinicWilayaId] = useState<Id<'wilayas'> | null>(null);
  const [clinicCommuneId, setClinicCommuneId] = useState<Id<'communes'> | null>(null);
  const [editingClinicId, setEditingClinicId] = useState<Id<'clinics'> | null>(null);
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const communes = useQuery(
    api.locations.listCommunesByWilaya,
    clinicWilayaId ? { wilayaId: clinicWilayaId } : 'skip',
  ) ?? [];

  // ── Derived ───────────────────────────────────────────────────────────────
  const specialtyOptions = useMemo<SpecialtyOption[]>(() => {
    if (!profile) return [];
    const options = new Map<Id<'specialties'>, SpecialtyOption>();
    options.set(profile.specialtyId, {
      id: profile.specialtyId,
      nameAr: profile.specialty.nameAr,
      nameFr: profile.specialty.nameFr,
    });
    return [...options.values()];
  }, [profile]);

  const selectedSpecialty = useMemo(
    () => specialtyOptions.find((s) => s.id === watchedSpecialtyId),
    [specialtyOptions, watchedSpecialtyId],
  );

  const activeClinics = useMemo(
    () => (profile?.clinics ?? []).filter((clinic) => clinic.isActive),
    [profile?.clinics],
  );

  useEffect(() => {
    if (!profile) return;
    reset({
      fullNameAr: profile.user.fullNameAr ?? '',
      fullNameFr: profile.user.fullNameFr ?? '',
      phone: profile.user.phone ?? '',
      specialtyId: profile.specialtyId,
      subSpecialties: profile.subSpecialties,
      bioAr: profile.bioAr,
      bioFr: profile.bioFr,
      yearsOfExperience: profile.yearsOfExperience,
      languages: profile.languages,
      orderRegistrationNumber: profile.orderRegistrationNumber,
      consultationFee: profile.consultationFee,
      followUpFee: profile.followUpFee,
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
        fullNameFr: data.fullNameFr,
        phone: data.phone,
        specialtyId: data.specialtyId as Id<'specialties'>,
        subSpecialties: data.subSpecialties as Id<'specialties'>[],
        bioAr: data.bioAr || '',
        bioFr: data.bioFr || '',
        yearsOfExperience: data.yearsOfExperience,
        languages: data.languages,
        orderRegistrationNumber: data.orderRegistrationNumber,
        consultationFee: data.consultationFee,
        followUpFee: data.followUpFee,
      });
      showToast();
    },
    [showToast, updateProfile],
  );

  const handleOpenClinicModal = useCallback(() => {
    setEditingClinicId(null);
    setClinicName('');
    setClinicAddress('');
    setClinicPhone('');
    setClinicLatitude('');
    setClinicLongitude('');
    setClinicWilayaId(null);
    setClinicCommuneId(null);
    setClinicError(null);
    setClinicModalVisible(true);
  }, []);

  const handleEditClinic = useCallback((clinic: ClinicInfo) => {
    setEditingClinicId(clinic._id);
    setClinicName(clinic.name);
    setClinicAddress(clinic.address);
    setClinicPhone(clinic.phone);
    setClinicLatitude(String(clinic.latitude));
    setClinicLongitude(String(clinic.longitude));
    setClinicWilayaId(clinic.wilayaId);
    setClinicCommuneId(clinic.communeId);
    setClinicError(null);
    setClinicModalVisible(true);
  }, []);

  const handleSaveClinic = useCallback(async () => {
    const latitude = Number(clinicLatitude);
    const longitude = Number(clinicLongitude);
    if (
      !clinicName.trim() ||
      !clinicAddress.trim() ||
      !clinicPhone.trim() ||
      !clinicWilayaId ||
      !clinicCommuneId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setClinicError('كل معلومات العيادة مطلوبة، بما فيها الإحداثيات.');
      return;
    }

    setClinicSaving(true);
    setClinicError(null);
    try {
      if (editingClinicId) {
        await updateClinic({
          clinicId: editingClinicId,
          name: clinicName.trim(),
          wilayaId: clinicWilayaId,
          communeId: clinicCommuneId,
          address: clinicAddress.trim(),
          latitude,
          longitude,
          phone: clinicPhone.trim(),
        });
      } else {
        await createClinic({
          name: clinicName.trim(),
          wilayaId: clinicWilayaId,
          communeId: clinicCommuneId,
          address: clinicAddress.trim(),
          latitude,
          longitude,
          phone: clinicPhone.trim(),
        });
      }
      setClinicModalVisible(false);
      showToast();
    } catch (error) {
      setClinicError(getArabicErrorMessage(error, 'تعذر حفظ العيادة'));
    } finally {
      setClinicSaving(false);
    }
  }, [
    clinicAddress,
    clinicCommuneId,
    clinicLatitude,
    clinicLongitude,
    clinicName,
    clinicPhone,
    clinicWilayaId,
    createClinic,
    editingClinicId,
    showToast,
    updateClinic,
  ]);

  const handleDeactivateClinic = useCallback(
    async (clinicId: Id<'clinics'>) => {
      await deactivateClinic({ clinicId });
      showToast();
    },
    [deactivateClinic, showToast],
  );

  // ── Language toggle ───────────────────────────────────────────────────────
  const handleLanguageToggle = useCallback(
    (value: string) => {
      const current = watchedLanguages;
      if (current.includes(value)) {
        setValue(
          'languages',
          current.filter((l) => l !== value),
          { shouldDirty: true },
        );
      } else {
        setValue('languages', [...current, value], { shouldDirty: true });
      }
    },
    [watchedLanguages, setValue],
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

  if (!profile || me?.role !== 'doctor') {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ملفي الشخصي</Text>
        </View>

        {/* ── Scrollable Form ─────────────────────────────────────── */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ──────────────────────────────────────────────────────── */}
          {/* Personal Information Section                           */}
          {/* ──────────────────────────────────────────────────────── */}
          <SectionHeader title="المعلومات الشخصية" icon="person-outline" />

          <View style={styles.sectionCard}>
            {/* Email - read-only */}
            <View style={styles.emailDisplayRow}>
              <Ionicons
                name="mail-outline"
                size={16}
                color={theme.colors.textSecondary}
                style={styles.displayRowIcon}
              />
              <View style={styles.displayRowContent}>
                <Text style={styles.displayRowLabel}>البريد الإلكتروني</Text>
                <Text style={styles.emailDisplayValue}>
                  {me?.role === 'doctor' ? (me.email ?? '') : ''}
                </Text>
              </View>
              <View style={styles.emailBadge}>
                <Text style={styles.emailBadgeText}>للقراءة فقط</Text>
              </View>
            </View>

            <View style={styles.fieldDivider} />

            <Controller
              control={control}
              name="fullNameAr"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="الاسم الكامل (عربي)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fullNameAr?.message}
                  placeholder="مثال: أحمد بن سالم"
                />
              )}
            />

            <Controller
              control={control}
              name="fullNameFr"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="الاسم الكامل (فرنسي)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fullNameFr?.message}
                  placeholder="Ex: Ahmed Ben Salem"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="رقم الهاتف"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  placeholder="مثال: 0555123456"
                  keyboardType="phone-pad"
                />
              )}
            />
          </View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* Professional Information Section                        */}
          {/* ──────────────────────────────────────────────────────── */}
          <SectionHeader title="المعلومات المهنية" icon="medkit-outline" />

          <View style={styles.sectionCard}>
            {/* Specialty - Pressable dropdown */}
            <View style={styles.fieldContainer}>
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

            {/* Sub-specialties (simple text input for MVP) */}
            <Controller
              control={control}
              name="subSpecialties"
              render={({ field: { onChange, value } }) => (
                <FormField
                  label="التخصصات الفرعية"
                  value={value.join('، ')}
                  onChangeText={(text) =>
                    onChange(
                      text
                        .split('،')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="مفصولة بفاصلة (،)"
                />
              )}
            />

            {/* Bio Arabic */}
            <Controller
              control={control}
              name="bioAr"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="السيرة الذاتية (عربي)"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.bioAr?.message}
                  placeholder="نبذة عن مسيرتك المهنية..."
                  multiline
                  numberOfLines={3}
                />
              )}
            />

            {/* Bio French */}
            <Controller
              control={control}
              name="bioFr"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="السيرة الذاتية (فرنسي)"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.bioFr?.message}
                  placeholder="Votre parcours professionnel..."
                  multiline
                  numberOfLines={3}
                />
              )}
            />

            {/* Years of Experience */}
            <Controller
              control={control}
              name="yearsOfExperience"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="سنوات الخبرة"
                  value={String(value)}
                  onChangeText={(text) => onChange(text === '' ? '' : Number(text))}
                  onBlur={onBlur}
                  error={errors.yearsOfExperience?.message}
                  placeholder="مثال: 10"
                  keyboardType="numeric"
                />
              )}
            />

            {/* Languages - Chip Selector */}
            <Controller
              control={control}
              name="languages"
              render={() => (
                <LanguageChips
                  selected={watchedLanguages}
                  options={LANGUAGES_OPTIONS}
                  onToggle={handleLanguageToggle}
                  error={errors.languages?.message}
                />
              )}
            />

            {/* Order Registration Number */}
            <Controller
              control={control}
              name="orderRegistrationNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="رقم التسجيل في النقابة"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.orderRegistrationNumber?.message}
                  placeholder="مثال: 2024-12345"
                />
              )}
            />
          </View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* Clinics Section                                         */}
          {/* ──────────────────────────────────────────────────────── */}
          <SectionHeader title="العيادات" icon="business-outline" />

          <View style={styles.sectionCard}>
            <ClinicsManager
              clinics={activeClinics}
              onAdd={handleOpenClinicModal}
              onEdit={handleEditClinic}
              onDeactivate={handleDeactivateClinic}
            />
          </View>

          {/* ──────────────────────────────────────────────────────── */}
          {/* Pricing Section                                         */}
          {/* ──────────────────────────────────────────────────────── */}
          <SectionHeader title="الأسعار" icon="cash-outline" />

          <View style={styles.sectionCard}>
            <Controller
              control={control}
              name="consultationFee"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="رسوم الاستشارة (د.ج)"
                  value={String(value)}
                  onChangeText={(text) => onChange(text === '' ? '' : Number(text))}
                  onBlur={onBlur}
                  error={errors.consultationFee?.message}
                  placeholder="مثال: 3000"
                  keyboardType="numeric"
                />
              )}
            />

            <Controller
              control={control}
              name="followUpFee"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="رسوم المتابعة (د.ج)"
                  value={String(value)}
                  onChangeText={(text) => onChange(text === '' ? '' : Number(text))}
                  onBlur={onBlur}
                  error={errors.followUpFee?.message}
                  placeholder="مثال: 1500"
                  keyboardType="numeric"
                />
              )}
            />
          </View>

          {/* ── Save Button ────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!isDirty || isSubmitting) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSubmit(onSave)}
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
        <SpecialtyPicker
          visible={specialtyPickerVisible}
          selectedId={watchedSpecialtyId}
          options={specialtyOptions}
          onSelect={(id) => {
            setValue('specialtyId', id, { shouldDirty: true });
            setSpecialtyPickerVisible(false);
          }}
          onClose={() => setSpecialtyPickerVisible(false)}
        />

        {/* ── Add Clinic Modal ────────────────────────────────────── */}
        <Modal
          visible={clinicModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setClinicModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.pickerOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable
              style={styles.pickerBackdrop}
              onPress={() => setClinicModalVisible(false)}
            />
            <View style={[styles.pickerSheet, styles.clinicModalSheet]}>
              <View style={styles.pickerHandle}>
                <View style={styles.pickerHandleBar} />
              </View>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {editingClinicId ? 'تعديل عيادة' : 'إضافة عيادة'}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerCloseButton,
                    pressed && styles.pickerCloseButtonPressed,
                  ]}
                  onPress={() => setClinicModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق"
                >
                  <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.clinicModalScroll}
                contentContainerStyle={styles.clinicModalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <FormField
                  label="اسم العيادة"
                  value={clinicName}
                  onChangeText={setClinicName}
                  placeholder="مثال: عيادة الشفاء"
                />
                <FormField
                  label="العنوان"
                  value={clinicAddress}
                  onChangeText={setClinicAddress}
                  placeholder="الشارع، الحي"
                  multiline
                  numberOfLines={2}
                />
                <FormField
                  label="رقم الهاتف"
                  value={clinicPhone}
                  onChangeText={setClinicPhone}
                  placeholder="0550 00 00 00"
                  keyboardType="phone-pad"
                />

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>الولاية</Text>
                  <View style={styles.chipsContainer}>
                    {wilayas.map((wilaya) => {
                      const isSelected = clinicWilayaId === wilaya._id;
                      return (
                        <Pressable
                          key={wilaya._id}
                          style={({ pressed }) => [
                            styles.chip,
                            isSelected && styles.chipSelected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => {
                            setClinicWilayaId(wilaya._id);
                            setClinicCommuneId(null);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`اختيار ولاية ${wilaya.nameAr}`}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
                            ]}
                          >
                            {wilaya.nameAr}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>البلدية</Text>
                  {clinicWilayaId ? (
                    <View style={styles.chipsContainer}>
                      {communes.map((commune) => {
                        const isSelected = clinicCommuneId === commune._id;
                        return (
                          <Pressable
                            key={commune._id}
                            style={({ pressed }) => [
                              styles.chip,
                              isSelected && styles.chipSelected,
                              pressed && styles.chipPressed,
                            ]}
                            onPress={() => setClinicCommuneId(commune._id)}
                            accessibilityRole="button"
                            accessibilityLabel={`اختيار بلدية ${commune.nameAr}`}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                isSelected && styles.chipTextSelected,
                              ]}
                            >
                              {commune.nameAr}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.fieldHint}>اختر الولاية أولاً</Text>
                  )}
                </View>

                <View style={styles.coordinateRow}>
                  <View style={styles.coordinateInput}>
                    <FormField
                      label="خط العرض"
                      value={clinicLatitude}
                      onChangeText={setClinicLatitude}
                      placeholder="36.7525"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.coordinateInput}>
                    <FormField
                      label="خط الطول"
                      value={clinicLongitude}
                      onChangeText={setClinicLongitude}
                      placeholder="3.0419"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {clinicError ? (
                  <Text style={styles.fieldError}>{clinicError}</Text>
                ) : null}

                <View style={styles.clinicModalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalSecondaryButton,
                      pressed && styles.saveButtonPressed,
                    ]}
                    onPress={() => setClinicModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="إلغاء"
                  >
                    <Text style={styles.modalSecondaryButtonText}>إلغاء</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalPrimaryButton,
                      clinicSaving && styles.saveButtonDisabled,
                      pressed && !clinicSaving && styles.saveButtonPressed,
                    ]}
                    onPress={handleSaveClinic}
                    disabled={clinicSaving}
                    accessibilityRole="button"
                    accessibilityLabel="حفظ العيادة"
                  >
                    <Ionicons
                      name={clinicSaving ? 'hourglass-outline' : 'save-outline'}
                      size={18}
                      color={theme.colors.white}
                      style={styles.saveButtonIcon}
                    />
                    <Text style={styles.modalPrimaryButtonText}>
                      {clinicSaving
                        ? 'جاري الحفظ...'
                        : editingClinicId
                          ? 'حفظ التعديل'
                          : 'حفظ العيادة'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    marginLeft: theme.spacing.sm,
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

  // ─── Fields ──────────────────────────────────────────────────────────────
  fieldContainer: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: rtlTextAlign(),
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
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },

  // ─── Email Display ───────────────────────────────────────────────────────
  emailDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emailDisplayValue: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  emailBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
  },
  emailBadgeText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 10,
    color: theme.colors.primary,
  },

  // ─── Display Row ─────────────────────────────────────────────────────────
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  displayRowIcon: {
    marginLeft: theme.spacing.sm,
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
    marginRight: theme.spacing.md,
  },
  clinicEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicDeactivateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    marginRight: theme.spacing.xs,
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
    marginLeft: theme.spacing.sm,
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
    marginLeft: theme.spacing.sm,
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
  pickerOptionSub: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.md,
  },
  pickerOptionCheck: {
    marginRight: theme.spacing.sm,
  },
});
