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
import { useQuery } from '@/lib/backend';

import { api } from '@/lib/backend/api';
import { theme } from '@/lib/theme';
import { routeParamString } from '@/lib/routeParams';
import {
  formatBookingDateStr,
  algeriaCalendarDate,
  formatAlgerianGregorianMonth,
  getBookingDayOfWeek,
  selectInitialBookingDate,
} from '@/lib/bookingDates';
import type { Id } from '@/lib/backend/types';

// =============================================================================
// Types – mirrors the actual Convex shapes
// =============================================================================

/** Schedule shape from Convex api.schedules.getByClinic. */
interface ConvexSchedule {
  _id: Id<'schedules'>;
  _creationTime: number;
  clinicId: Id<'clinics'>;
  doctorId?: Id<'doctors'>;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  appointmentDurationMinutes: number;
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
  isPast: boolean;
  hasAvailability: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DAY_NAMES_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']; // ح=أحد,ن=إثنين,ث=ثلاثاء,ر=أربعاء,خ=خميس,ج=جمعة,س=سبت
const DAY_NAMES_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function firstDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, offset: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function monthDates(month: Date) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, monthIndex, index + 1)),
  );
}

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

function ScreenHeader({ onBack }: { onBack: () => void }) {
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

    </View>
  );
}

// ─── Calendar Strip ──────────────────────────────────────────────────────────

function CalendarMonth({
  days,
  selectedDateStr,
  onSelectDate,
  month,
  onChangeMonth,
  canGoPrevious,
}: {
  days: DayData[];
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  month: Date;
  onChangeMonth: (offset: number) => void;
  canGoPrevious: boolean;
}) {
  const leadingEmptyCells = getBookingDayOfWeek(month);

  return (
    <View style={styles.calendarSection}>
      <View style={styles.calendarHeading}>
        <Pressable
          onPress={() => onChangeMonth(1)}
          style={styles.monthNavButton}
          accessibilityRole="button"
          accessibilityLabel="الشهر التالي"
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.official} />
        </Pressable>
        <View style={styles.monthTitleBlock}>
          <Text style={styles.calendarSectionTitle}>اختر التاريخ</Text>
          <Text style={styles.monthTitle}>
            {formatAlgerianGregorianMonth(month)} {month.getUTCFullYear()}
          </Text>
        </View>
        <Pressable
          onPress={() => onChangeMonth(-1)}
          disabled={!canGoPrevious}
          style={[styles.monthNavButton, !canGoPrevious && styles.monthNavButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel="الشهر السابق"
          accessibilityState={{ disabled: !canGoPrevious }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.colors.official} />
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {DAY_NAMES_SHORT.map((day) => <Text key={day} style={styles.weekdayText}>{day}</Text>)}
      </View>
      <View style={styles.monthGrid}>
        {Array.from({ length: leadingEmptyCells }, (_, index) => <View key={`empty-${index}`} style={styles.dayEmptyCell} />)}
        {days.map((day) => {
          const isSelected = day.dateStr === selectedDateStr;
          const disabled = day.isPast;
          return (
            <Pressable
              key={day.dateStr}
              onPress={() => !disabled && onSelectDate(day.dateStr)}
              disabled={disabled}
              style={[styles.dayCell, day.isToday && styles.dayCellToday, isSelected && styles.dayCellSelected, disabled && styles.dayCellDisabled]}
              accessibilityRole="button"
              accessibilityLabel={`اختيار ${day.dayName} ${day.dayNumber} ${day.monthName}`}
              accessibilityState={{ selected: isSelected, disabled }}
            >
              <Text style={[styles.dayNumberText, !day.hasAvailability && styles.dayTextMuted, isSelected && styles.dayTextSelected]}>{day.dayNumber}</Text>
              {day.hasAvailability && !isSelected ? <View style={styles.availabilityDot} /> : null}
            </Pressable>
          );
        })}
      </View>
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
  const [visibleMonth, setVisibleMonth] = useState(() => firstDayOfMonth(algeriaCalendarDate()));

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
    selectedDateStr && clinicId && doctorId
      ? {
          clinicId: clinicId as Id<'clinics'>,
          doctorId: doctorId as Id<'doctors'>,
          date: selectedDateStr,
        }
      : 'skip',
  );
  const slotsLoading = availableSlotsRaw === undefined;

  const availableSlots: AvailableSlot[] = useMemo(() => {
    // Filter to only available slots for the selected date
    const allSlots = (availableSlotsRaw ?? []) as AvailableSlot[];
    return allSlots.sort((a, b) => a.time.localeCompare(b.time));
  }, [availableSlotsRaw]);

  const days: DayData[] = useMemo(() => {
    const todayStr = formatBookingDateStr(algeriaCalendarDate());

    return monthDates(visibleMonth).map((date) => {
      const dateStr = formatBookingDateStr(date);
      const dow = getBookingDayOfWeek(date);

      // Check if any active schedule exists for this day-of-week
      const hasSchedule = schedules.some(
        (s) =>
          s.dayOfWeek === dow &&
          s.isActive &&
          (!s.doctorId || s.doctorId === doctorId),
      );

      return {
        dateStr,
        dayName: DAY_NAMES_SHORT[dow],
        dayNumber: date.getUTCDate(),
        monthName: formatAlgerianGregorianMonth(date),
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
        hasAvailability: !((dateStr < todayStr)) && hasSchedule,
      };
    });
  }, [doctorId, schedules, visibleMonth]);

  // Select the earliest available day whenever the visible month changes.
  useEffect(() => {
    const initialDate = selectInitialBookingDate(days);
    const isSelectedDateVisible = days.some((day) => day.dateStr === selectedDateStr);
    if ((!selectedDateStr || !isSelectedDateVisible) && initialDate) {
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

  const handleChangeMonth = useCallback((offset: number) => {
    setVisibleMonth((current) => addMonths(current, offset));
    setSelectedSlot(null);
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
          بيانات المختص أو المركز غير مكتملة. يرجى العودة والمحاولة مرة أخرى.
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
          تعذر تحميل معلومات المختص أو المركز.
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
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar */}
        <CalendarMonth
          days={days}
          selectedDateStr={selectedDateStr}
          onSelectDate={handleSelectDate}
          month={visibleMonth}
          onChangeMonth={handleChangeMonth}
          canGoPrevious={visibleMonth > firstDayOfMonth(algeriaCalendarDate())}
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
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },

  // ── Calendar Section ─────────────────────────────────────────────────────
  calendarSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  calendarHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  monthTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  calendarSectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
    textAlign: 'right',
  },
  monthTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.official,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
  },
  monthNavButtonDisabled: { opacity: 0.35 },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
  },
  weekdayText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  dayEmptyCell: {
    width: '13.45%',
    aspectRatio: 1,
  },
  dayCell: {
    width: '13.45%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayCellDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.surfaceMuted,
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
  },
  availabilityDot: {
    position: 'absolute',
    bottom: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.success,
  },
  dayNumberAvailable: {
    color: theme.colors.primary,
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
    marginStart: 8,
  },
});
