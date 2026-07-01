// =============================================================================
// Booking – Confirmation Screen (Final Step)
// Route: /(patient)/booking/confirm
// Shows a summary card (doctor, specialty, clinic + address, date, time),
// visit type selector, optional reason + note inputs, price, and confirm
// button. Calls api.bookings.create or api.bookings.reschedule on confirm.
// RTL layout – Arabic‑first.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import { isIsoDateParam, isTimeParam, routeParamString } from '@/lib/routeParams';
import type { VisitType } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types
// =============================================================================

/** Doctor shape returned by Convex api.doctors.getById. */
interface DoctorDetail {
  _id: Id<'doctors'>;
  _creationTime: number;
  userId: Id<'users'>;
  specialtyId: Id<'specialties'>;
  bioAr: string;
  consultationFee: number;
  user: { fullNameAr: string | null; phone: string | null; fullNameFr: string | null; email: string | null; image: string | null };
  specialty: { nameAr: string; nameFr: string };
  clinics: Array<{
    _id: Id<'clinics'>;
    _creationTime: number;
    doctorId: Id<'doctors'>;
    name: string;
    wilayaId: Id<'wilayas'>;
    communeId: Id<'communes'>;
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    isActive: boolean;
  }>;
}

/** Clinic shape returned by Convex api.clinics.getById. */
interface ClinicDetail {
  _id: Id<'clinics'>;
  _creationTime: number;
  doctorId: Id<'doctors'>;
  name: string;
  wilayaId: Id<'wilayas'>;
  communeId: Id<'communes'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  isActive: boolean;
  wilayaNameAr: string;
  wilayaNameFr: string;
  communeNameAr: string;
  communeNameFr: string;
}

// =============================================================================
// Constants
// =============================================================================

const VISIT_TYPES: { value: VisitType; label: string }[] = [
  { value: 'first', label: 'كشف أول' },
  { value: 'followup', label: 'مراجعة' },
  { value: 'consultation', label: 'استشارة' },
];

// =============================================================================
// Helpers
// =============================================================================

/** Format a YYYY-MM-DD date string into a full Arabic‑locale date. */
function formatArabicDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Header ──────────────────────────────────────────────────────────────────

function ScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="رجوع"
      >
        <Ionicons
          name="arrow-forward"
          size={24}
          color={theme.colors.textPrimary}
        />
      </Pressable>
      <View style={styles.headerTitleArea}>
        <Text style={styles.headerTitle}>تأكيد الحجز</Text>
      </View>
    </View>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  doctorName,
  specialtyName,
  clinicName,
  address,
  date,
  time,
}: {
  doctorName: string;
  specialtyName: string | null;
  clinicName: string;
  address: string;
  date: string;
  time: string;
}) {
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'medical-outline', label: 'الطبيب', value: doctorName },
    ...(specialtyName
      ? [{ icon: 'flask-outline' as const, label: 'التخصص', value: specialtyName }]
      : []),
    { icon: 'business-outline', label: 'العيادة', value: clinicName },
    { icon: 'location-outline', label: 'العنوان', value: address },
    { icon: 'calendar-outline', label: 'التاريخ', value: date },
    { icon: 'time-outline', label: 'الوقت', value: time },
  ];

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>ملخص الحجز</Text>
      {rows.map((item, idx) => (
        <View
          key={item.label}
          style={[
            styles.summaryRow,
            idx < rows.length - 1 && styles.summaryRowBorder,
          ]}
        >
          <View style={styles.summaryIconContainer}>
            <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Visit Type Selector ─────────────────────────────────────────────────────

function VisitTypeSelector({
  selected,
  onSelect,
}: {
  selected: VisitType;
  onSelect: (value: VisitType) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>نوع الزيارة</Text>
      <View style={styles.visitTypeGrid}>
        {VISIT_TYPES.map((vt) => {
          const isSelected = vt.value === selected;
          return (
            <Pressable
              key={vt.value}
              onPress={() => onSelect(vt.value)}
              style={[
                styles.visitTypeChip,
                isSelected && styles.visitTypeChipSelected,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={vt.label}
            >
              <Text
                style={[
                  styles.visitTypeChipText,
                  isSelected && styles.visitTypeChipTextSelected,
                ]}
              >
                {vt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Text Input ──────────────────────────────────────────────────────────────

function FormInput({
  placeholder,
  value,
  onChangeText,
  multiline,
  maxLength,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <TextInput
      style={[styles.textInput, multiline && styles.textInputMultiline]}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.border}
      value={value}
      onChangeText={onChangeText}
      textAlign="right"
      textAlignVertical={multiline ? 'top' : 'center'}
      multiline={multiline}
      maxLength={maxLength}
      autoCorrect={false}
    />
  );
}

// ─── Fee Display ─────────────────────────────────────────────────────────────

function FeeRow({ fee }: { fee: number }) {
  if (fee <= 0) return null;

  return (
    <View style={styles.feeRow}>
      <Text style={styles.feeLabel}>رسوم الكشف</Text>
      <Text style={styles.feeValue}>
        {fee.toLocaleString('ar-SA')} د.ج
      </Text>
    </View>
  );
}

// ─── Confirm Button ──────────────────────────────────────────────────────────

function ConfirmButton({
  loading,
  onPress,
}: {
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={({ pressed }) => [
          styles.confirmButton,
          loading && styles.confirmButtonDisabled,
          !loading && pressed && styles.confirmButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="تأكيد الحجز"
        accessibilityState={{ disabled: loading }}
      >
        {loading ? (
          <View style={styles.confirmButtonLoadingRow}>
            <ActivityIndicator size="small" color={theme.colors.white} />
            <Text style={styles.confirmButtonText}>جاري تأكيد الحجز...</Text>
          </View>
        ) : (
          <View style={styles.confirmButtonRow}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.colors.white}
            />
            <Text style={styles.confirmButtonText}>تأكيد الحجز</Text>
          </View>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function BookingConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    doctorId?: string | string[];
    clinicId?: string | string[];
    date?: string | string[];
    time?: string | string[];
    profileId?: string | string[];
    rescheduleBookingId?: string | string[];
  }>();
  const doctorId = routeParamString(params.doctorId);
  const clinicId = routeParamString(params.clinicId);
  const date = routeParamString(params.date);
  const time = routeParamString(params.time);
  const profileId = routeParamString(params.profileId);
  const rescheduleBookingId = routeParamString(params.rescheduleBookingId);
  const hasValidBookingParams =
    Boolean(doctorId && clinicId) && isIsoDateParam(date) && isTimeParam(time);
  const me = useQuery(api.users.me, {});

  // ── Local state ──────────────────────────────────────────────────────────
  const [visitType, setVisitType] = useState<VisitType>('first');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ── Data fetching via Convex ─────────────────────────────────────────────
  const doctor = useQuery(
    api.doctors.getById,
    doctorId && hasValidBookingParams
      ? { doctorId: doctorId as Id<'doctors'> }
      : 'skip',
  ) as DoctorDetail | null | undefined;

  const clinic = useQuery(
    api.clinics.getById,
    clinicId && hasValidBookingParams
      ? { clinicId: clinicId as Id<'clinics'> }
      : 'skip',
  ) as ClinicDetail | null | undefined;

  const doctorLoading = doctor === undefined;
  const clinicLoading = clinic === undefined;

  const specialtyName = doctor?.specialty?.nameAr ?? null;

  // ── Confirm mutation via Convex ──────────────────────────────────────────
  const createBooking = useMutation(api.bookings.create);
  const rescheduleBooking = useMutation(api.bookings.reschedule);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleConfirm = useCallback(async () => {
    if (me === undefined) {
      Alert.alert('انتظر قليلاً', 'جاري التحقق من تسجيل الدخول');
      return;
    }
    if (!me || me.role !== 'patient') {
      Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }
    if (!me.profile) {
      Alert.alert(
        'أكمل ملفك الطبي',
        'يرجى إكمال ملفك الطبي قبل تأكيد الحجز.',
      );
      return;
    }
    if (!hasValidBookingParams) {
      Alert.alert('خطأ', 'بيانات الحجز غير مكتملة');
      return;
    }

    setIsCreating(true);
    try {
      const bookingId = rescheduleBookingId
        ? await rescheduleBooking({
            bookingId: rescheduleBookingId as Id<'bookings'>,
            newDate: date,
            newTime: time,
            reason: reason.trim() || undefined,
          })
        : await createBooking({
            clinicId: clinicId as Id<'clinics'>,
            doctorId: doctorId as Id<'doctors'>,
            appointmentDate: date,
            appointmentTime: time,
            visitType: visitType,
            reason: reason || undefined,
            patientNote: note || undefined,
            profileId: profileId ? (profileId as Id<'patientProfiles'>) : undefined,
          });

      // Navigate to success screen
      router.replace({
        pathname: '/(patient)/booking/success',
        params: {
          doctor: doctor?.user?.fullNameAr ?? '',
          clinic: clinic?.name ?? '',
          date: date ?? '',
          time: time ?? '',
          referenceId: bookingId,
        },
      });
    } catch (error) {
      // Check for slot_taken ConvexError
      if (error instanceof ConvexError) {
        const data = error.data as Record<string, unknown> | undefined;
        if (data?.code === 'slot_taken') {
          Alert.alert(
            'عذراً',
            'هذا الوقت حُجز للتو. اختر وقتاً آخر.',
            [
              {
                text: 'العودة لاختيار الوقت',
                style: 'default',
                onPress: () => router.back(),
              },
            ],
            { cancelable: false },
          );
          return;
        }
      }

      // Generic error
      Alert.alert(
        'خطأ',
        getArabicErrorMessage(
          error,
          'حدث خطأ أثناء تأكيد الحجز. يرجى المحاولة مرة أخرى.',
        ),
      );
    } finally {
      setIsCreating(false);
    }
  }, [
    me,
    doctorId,
    clinicId,
    date,
    time,
    hasValidBookingParams,
    visitType,
    reason,
    note,
    profileId,
    rescheduleBookingId,
    doctor,
    clinic,
    router,
    createBooking,
    rescheduleBooking,
  ]);

  // ── Loading state ────────────────────────────────────────────────────────
  const isInitialLoading = doctorLoading || clinicLoading;

  if (isInitialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل معلومات الحجز...</Text>
      </View>
    );
  }

  // ── Error / missing data ─────────────────────────────────────────────────
  if (!doctor || !clinic) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={theme.colors.danger}
        />
        <Text style={styles.errorTitle}>عذراً، حدث خطأ</Text>
        <Text style={styles.errorMessage}>
          تعذر تحميل معلومات الحجز. يرجى المحاولة مرة أخرى.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleBack}
        >
          <Text style={styles.retryButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  // ── Missing required params ──────────────────────────────────────────────
  if (!hasValidBookingParams) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={theme.colors.danger}
        />
        <Text style={styles.errorTitle}>عذراً، حدث خطأ</Text>
        <Text style={styles.errorMessage}>
          بيانات الحجز غير مكتملة. يرجى العودة والمحاولة مرة أخرى.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleBack}
        >
          <Text style={styles.retryButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const formattedDate = formatArabicDate(date);
  const fee = doctor.consultationFee ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader onBack={handleBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <SummaryCard
          doctorName={doctor.user?.fullNameAr ?? ''}
          specialtyName={specialtyName}
          clinicName={clinic.name}
          address={clinic.address}
          date={formattedDate}
          time={time}
        />

        {/* Visit Type Selector */}
        <VisitTypeSelector selected={visitType} onSelect={setVisitType} />

        {/* Reason (optional) */}
        <View style={styles.section}>
          <FormInput
            placeholder="سبب الزيارة (اختياري)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={200}
          />
        </View>

        {/* Note for doctor (optional) */}
        <View style={styles.section}>
          <FormInput
            placeholder="ملاحظة للطبيب (اختياري)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
          />
        </View>

        {/* Fee */}
        <FeeRow fee={fee} />

        {/* Spacer so bottom button doesn't overlap */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirm Button */}
      <ConfirmButton
        loading={isCreating}
        onPress={handleConfirm}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 32,
  },

  // ── Loading / Error ──────────────────────────────────────────────────────
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    ...theme.shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: theme.colors.background,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },

  // ── Summary Card ─────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 16,
    ...theme.shadows.sm,
  },
  summaryTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  summaryValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginTop: 2,
  },

  // ── Section ──────────────────────────────────────────────────────────────
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: 12,
  },

  // ── Visit Type Selector ──────────────────────────────────────────────────
  visitTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  visitTypeChip: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
  },
  visitTypeChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  visitTypeChipText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
  },
  visitTypeChipTextSelected: {
    color: theme.colors.white,
  },

  // ── Text Input ───────────────────────────────────────────────────────────
  textInput: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  textInputMultiline: {
    minHeight: 80,
    paddingTop: 14,
  },

  // ── Fee Row ──────────────────────────────────────────────────────────────
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 20,
    ...theme.shadows.sm,
  },
  feeLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  feeValue: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 16,
    color: theme.colors.primary,
  },

  // ── Confirm Button ───────────────────────────────────────────────────────
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  confirmButtonPressed: {
    opacity: 0.88,
  },
  confirmButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
    marginLeft: 8,
  },
});
