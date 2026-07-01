// =============================================================================
// Booking – Date & Time Selection Screen (Step 2)
// Route: /(patient)/booking/datetime
// Shows clinic + doctor name, a 14‑day calendar strip, and available time slots.
// RTL layout – Arabic‑first.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { routeParamString } from '@/lib/routeParams';
import {
  formatBookingDateStr,
  formatGregorianArabicMonthShort,
  generateAlgeriaDateRange,
  selectInitialBookingDate,
} from '@/lib/bookingDates';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types – mirrors the actual Convex shapes
// =============================================================================

/** Schedule shape from Convex api.schedules.getByClinic. */
interface ConvexSchedule {
  _id: Id<'schedules'>;
  _creationTime: number;
  clinicId: Id<'clinics'>;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  appointmentDurationMinutes: number;
  maxPatientsPerDay: number;
  isActive: boolean;
}

/** Available slot from Convex api.bookings.getAvailableSlots. */
interface AvailableSlot {
  time: string;
  available: boolean;
}

/** Pre‑computed data for one calendar day. */
interface DayData {
  dateStr: string;       // YYYY-MM-DD
  dayName: string;       // short Arabic name
  dayNumber: number;     // 1-31
  monthName: string;     // short Arabic month
  isToday: boolean;
  hasAvailability: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DAYS_TO_SHOW = 14;

const DAY_NAMES_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // ح=أحد,ن=إثنين,ث=ثلاثاء,ر=أربعاء,خ=خميس,ج=جمعة,س=سبت
const DAY_NAMES_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Data-fetching hooks
// =============================================================================

function useDoctorInfo(doctorId: string | null | undefined) {
  return useQuery(
    api.doctors.getById,
    doctorId ? { doctorId: doctorId as Id<'doctors'> } : 'skip',
  );
}

function useClinicInfo(clinicId: string | null | undefined) {
  return useQuery(
    api.clinics.getById,
    clinicId ? { clinicId: clinicId as Id<'clinics'> } : 'skip',
  );
}

function useClinicSchedules(clinicId: string | null | undefined) {
  return useQuery(
    api.schedules.getByClinic,
    clinicId ? { clinicId: clinicId as Id<'clinics'> } : 'skip',
  );
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Header ──────────────────────────────────────────────────────────────────

function ScreenHeader({
  clinicName,
  doctorName,
  onBack,
}: {
  clinicName: string;
  doctorName: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      {/* Back button */}
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

      {/* Title area */}
      <View style={styles.headerTitleArea}>
        <Text style={styles.headerClinicName} numberOfLines={1}>
          {clinicName}
        </Text>
        <Text style={styles.headerDoctorName} numberOfLines={1}>
          {doctorName}
        </Text>
      </View>
    </View>
  );
}

// ─── Calendar Strip ──────────────────────────────────────────────────────────

function CalendarStrip({
  days,
  selectedDateStr,
  onSelectDate,
}: {
  days: DayData[];
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
}) {
  const renderDay = useCallback(
    ({ item }: { item: DayData }) => {
      const isSelected = item.dateStr === selectedDateStr;

      return (
        <Pressable
          onPress={() => onSelectDate(item.dateStr)}
          style={[
            styles.dayCell,
            item.isToday && styles.dayCellToday,
            isSelected && styles.dayCellSelected,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`اختيار تاريخ ${item.dayNumber} ${item.monthName}`}
        >
          <Text
            style={[
              styles.dayNameText,
              !item.hasAvailability && styles.dayTextMuted,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {item.dayName}
          </Text>
          <Text
            style={[
              styles.dayNumberText,
              item.hasAvailability && styles.dayNumberAvailable,
              !item.hasAvailability && styles.dayTextMuted,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {item.dayNumber}
          </Text>
          <Text
            style={[
              styles.dayMonthText,
              !item.hasAvailability && styles.dayTextMuted,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {item.monthName}
          </Text>
        </Pressable>
      );
    },
    [selectedDateStr, onSelectDate],
  );

  return (
    <View style={styles.calendarSection}>
      <Text style={styles.calendarSectionTitle}>اختر التاريخ</Text>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(item) => item.dateStr}
        renderItem={renderDay}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarList}
        initialScrollIndex={0}
        getItemLayout={(_data, index) => ({
          length: 72,
          offset: 72 * index,
          index,
        })}
      />
    </View>
  );
}

// ─── Time Slot Grid ──────────────────────────────────────────────────────────

function TimeSlotGrid({
  slots,
  selectedSlot,
  onSelectSlot,
  loading,
}: {
  slots: AvailableSlot[];
  selectedSlot: string | null;
  onSelectSlot: (time: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View style={styles.loadingSlotsContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={styles.noSlotsContainer}>
        <Ionicons
          name="calendar-outline"
          size={40}
          color={theme.colors.border}
        />
        <Text style={styles.noSlotsText}>
          لا توجد مواعيد متاحة لهذا اليوم
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.slotsSection}>
      <Text style={styles.slotsSectionTitle}>اختر الوقت</Text>
      <View style={styles.slotsGrid}>
        {slots.map((slot) => {
          const isSelected = slot.time === selectedSlot;
          const disabled = !slot.available;

          return (
            <Pressable
              key={slot.time}
              onPress={() => {
                if (!disabled) onSelectSlot(slot.time);
              }}
              disabled={disabled}
              style={[
                styles.slotChip,
                isSelected && styles.slotChipSelected,
                disabled && styles.slotChipDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${slot.time}${disabled ? ' – غير متاح' : ''}`}
            >
              <Text
                style={[
                  styles.slotChipText,
                  isSelected && styles.slotChipTextSelected,
                  disabled && styles.slotChipTextDisabled,
                ]}
              >
                {slot.time}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Bottom Button ───────────────────────────────────────────────────────────

function BottomButton({
  disabled,
  onPress,
}: {
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.nextButton,
          disabled && styles.nextButtonDisabled,
          !disabled && pressed && styles.nextButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="التالي"
        accessibilityState={{ disabled }}
      >
        <Text
          style={[
            styles.nextButtonText,
            disabled && styles.nextButtonTextDisabled,
          ]}
        >
          التالي
        </Text>
        <Ionicons
          name="arrow-back"
          size={20}
          color={disabled ? theme.colors.textSecondary : theme.colors.white}
          style={styles.nextButtonIcon}
        />
      </Pressable>
    </SafeAreaView>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function BookingDateTimeScreen() {
  const router = useRouter();
  const params =
    useLocalSearchParams<{
      doctorId?: string | string[];
      clinicId?: string | string[];
      rescheduleBookingId?: string | string[];
    }>();
  const doctorId = routeParamString(params.doctorId);
  const clinicId = routeParamString(params.clinicId);
  const rescheduleBookingId = routeParamString(params.rescheduleBookingId);

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // ── Data fetching via Convex ─────────────────────────────────────────────
  const doctorRaw = useDoctorInfo(doctorId);
  const clinicRaw = useClinicInfo(clinicId);
  const schedulesRaw = useClinicSchedules(clinicId);

  const doctorLoading = doctorRaw === undefined;
  const clinicLoading = clinicRaw === undefined;
  const schedulesLoading = schedulesRaw === undefined;

  const doctor = doctorRaw as { user: { fullNameAr: string | null }; name?: string } | null | undefined;
  const clinic = clinicRaw as { name: string } | null | undefined;
  const schedules = (schedulesRaw ?? []) as ConvexSchedule[];

  // ── Get available slots for the selected date ────────────────────────────
  const availableSlotsRaw = useQuery(
    api.bookings.getAvailableSlots,
    selectedDateStr && clinicId
      ? { clinicId: clinicId as Id<'clinics'>, date: selectedDateStr }
      : 'skip',
  );
  const slotsLoading = availableSlotsRaw === undefined;

  const availableSlots: AvailableSlot[] = useMemo(() => {
    // Filter to only available slots for the selected date
    const allSlots = (availableSlotsRaw ?? []) as AvailableSlot[];
    return allSlots.sort((a, b) => a.time.localeCompare(b.time));
  }, [availableSlotsRaw]);

  // ── Derived data: build DayData[] for the 14 days ───────────────────────
  const dateRange = useMemo(() => {
    const dates = generateAlgeriaDateRange(DAYS_TO_SHOW);
    return { all: dates };
  }, []);

  const days: DayData[] = useMemo(() => {
    const todayStr = formatBookingDateStr(dateRange.all[0]);

    return dateRange.all.map((date) => {
      const dateStr = formatBookingDateStr(date);
      const dow = date.getUTCDay();

      // Check if any active schedule exists for this day-of-week
      const hasSchedule = schedules.some(
        (s) => s.dayOfWeek === dow && s.isActive,
      );

      return {
        dateStr,
        dayName: DAY_NAMES_SHORT[dow],
        dayNumber: date.getUTCDate(),
        monthName: formatGregorianArabicMonthShort(date),
        isToday: dateStr === todayStr,
        hasAvailability: hasSchedule,
      };
    });
  }, [dateRange, schedules]);

  // Auto-select the earliest visible date that has an active schedule.
  useEffect(() => {
    const initialDate = selectInitialBookingDate(days);
    if (!selectedDateStr && initialDate) {
      setSelectedDateStr(initialDate);
    }
  }, [days, selectedDateStr]);

  // Reset selected slot when date changes (if no longer valid)
  useEffect(() => {
    if (selectedSlot) {
      const stillValid = availableSlots.some(
        (s) => s.time === selectedSlot && s.available,
      );
      if (!stillValid) setSelectedSlot(null);
    }
  }, [selectedDateStr, availableSlots, selectedSlot]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDateStr(dateStr);
  }, []);

  const handleSelectSlot = useCallback((time: string) => {
    setSelectedSlot(time);
  }, []);

  const handleNext = useCallback(() => {
    if (!selectedSlot || !doctorId || !clinicId) return;
    router.push({
      pathname: '/(patient)/booking/profile',
      params: {
        doctorId,
        clinicId,
        date: selectedDateStr,
        time: selectedSlot,
        rescheduleBookingId,
      },
    } as any);
  }, [
    router,
    doctorId,
    clinicId,
    selectedDateStr,
    selectedSlot,
    rescheduleBookingId,
  ]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ── Loading state ───────────────────────────────────────────────────────
  const isInitialLoading = doctorLoading || clinicLoading || schedulesLoading;

  if (!doctorId || !clinicId) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={theme.colors.danger}
        />
        <Text style={styles.errorTitle}>رابط غير صالح</Text>
        <Text style={styles.errorMessage}>
          بيانات الطبيب أو العيادة غير مكتملة. يرجى العودة والمحاولة مرة أخرى.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل بيانات المواعيد...</Text>
      </View>
    );
  }

  // ── Error / missing data ────────────────────────────────────────────────
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
          تعذر تحميل معلومات الطبيب أو العيادة.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.85 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  // ── Content ─────────────────────────────────────────────────────────────
  const doctorName = (doctor as any)?.user?.fullNameAr ?? '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        clinicName={(clinic as any).name}
        doctorName={doctorName}
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar */}
        <CalendarStrip
          days={days}
          selectedDateStr={selectedDateStr}
          onSelectDate={handleSelectDate}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Time slots */}
        <TimeSlotGrid
          slots={availableSlots}
          selectedSlot={selectedSlot}
          onSelectSlot={handleSelectSlot}
          loading={slotsLoading}
        />

        {/* Spacer so bottom button doesn't overlap */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom "التالي" button */}
      <BottomButton disabled={!selectedSlot} onPress={handleNext} />
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
  loadingSlotsContainer: {
    paddingVertical: 48,
    alignItems: 'center',
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
  headerClinicName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  headerDoctorName: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
  },

  // ── Calendar Section ─────────────────────────────────────────────────────
  calendarSection: {
    marginTop: 16,
  },
  calendarSectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginHorizontal: 16,
    marginBottom: 12,
    textAlign: 'right',
  },
  calendarList: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  dayCell: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginHorizontal: 4,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayNameText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  dayNumberText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  dayNumberAvailable: {
    color: theme.colors.primary,
  },
  dayMonthText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  dayTextMuted: {
    color: theme.colors.border,
  },
  dayTextSelected: {
    color: theme.colors.white,
  },

  // ── Divider ──────────────────────────────────────────────────────────────
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
    marginVertical: 20,
  },

  // ── Time Slot Grid ───────────────────────────────────────────────────────
  slotsSection: {
    marginHorizontal: 16,
  },
  slotsSectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'right',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    minWidth: 72,
    alignItems: 'center',
  },
  slotChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  slotChipDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  slotChipText: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 14,
    color: theme.colors.primary,
  },
  slotChipTextSelected: {
    color: theme.colors.white,
  },
  slotChipTextDisabled: {
    color: theme.colors.textSecondary,
  },
  noSlotsContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    marginHorizontal: 16,
  },
  noSlotsText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },

  // ── Bottom Button ────────────────────────────────────────────────────────
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  nextButtonPressed: {
    opacity: 0.88,
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  nextButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
  },
  nextButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  nextButtonIcon: {
    marginRight: 8,
  },
});
