// @ts-nocheck
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePaginatedQuery, useQuery } from '@/lib/backend';
import { useRouter } from 'expo-router';

import { api } from '@/lib/backend/api';
import EmptyState from '@/components/EmptyState';
import {
  AppointmentWorkItem,
  DoctorHeader,
  DoctorSection,
  SegmentedControl,
  type MetricItem,
  type SegmentOption,
} from '@/components/doctor-ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { buildDoctorWeekSections, type DoctorWeekSection } from '@/lib/doctorAppointmentWeeks';
import type { Appointment, AppointmentStatus, VisitType } from '@/lib/types';
import type { Id } from '@/lib/backend/types';

// =============================================================================
// Constants
// =============================================================================

const ARABIC_DAYS: readonly string[] = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const ARABIC_MONTHS: readonly string[] = [
  'جانفي',
  'فيفري',
  'مارس',
  'أفريل',
  'ماي',
  'جوان',
  'جويلية',
  'أوت',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  first: 'زيارة أولى',
  followup: 'متابعة',
  consultation: 'استشارة',
};

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; backgroundColor: string }
> = {
  confirmed: {
    label: 'في الانتظار',
    color: theme.colors.status.info.text,
    backgroundColor: theme.colors.status.info.background,
  },
  present: {
    label: 'حاضر',
    color: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  in_room: {
    label: 'داخل عند المختص',
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  cancelled: {
    label: 'ملغى',
    color: theme.colors.danger,
    backgroundColor: '#FDEDEC',
  },
  completed: {
    label: 'مكتمل',
    color: theme.colors.textSecondary,
    backgroundColor: '#F3F4F6',
  },
  no_show: {
    label: 'لم يحضر',
    color: theme.colors.status.danger.text,
    backgroundColor: theme.colors.status.danger.background,
  },
};

type ViewTab = 'today' | 'week' | 'month' | 'history';
type NullableStatus = AppointmentStatus | null;
type NullableVisitType = VisitType | null;
type AppointmentTabOption = SegmentOption<ViewTab> & {
  icon: keyof typeof Ionicons.glyphMap;
};
type StatusFilterOption = SegmentOption<'all' | AppointmentStatus>;
type VisitTypeFilterOption = SegmentOption<'all' | VisitType>;
type FilterChipOption<T extends string> = SegmentOption<T>;
type DoctorAppointmentFilterArgs = {
  normalizedPatientSearch: string;
  selectedStatus: NullableStatus;
  selectedVisitType: NullableVisitType;
};

const TABS: AppointmentTabOption[] = [
  { key: 'today', label: 'اليوم', icon: 'today' },
  { key: 'week', label: 'الأسبوع', icon: 'calendar' },
  { key: 'month', label: 'الشهر', icon: 'calendar-outline' },
  { key: 'history', label: 'السجل', icon: 'time-outline' },
];

const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { key: 'all', label: 'الكل', icon: 'list-outline' },
  { key: 'confirmed', label: STATUS_CONFIG.confirmed.label, icon: 'checkmark-circle-outline' },
  { key: 'present', label: STATUS_CONFIG.present.label, icon: 'person-outline' },
  { key: 'in_room', label: STATUS_CONFIG.in_room.label, icon: 'person-outline' },
  { key: 'completed', label: STATUS_CONFIG.completed.label, icon: 'checkmark-done-outline' },
  { key: 'cancelled', label: STATUS_CONFIG.cancelled.label, icon: 'ban-outline' },
  { key: 'no_show', label: STATUS_CONFIG.no_show.label, icon: 'close-circle-outline' },
];

const VISIT_TYPE_FILTER_OPTIONS: VisitTypeFilterOption[] = [
  { key: 'all', label: 'الكل', icon: 'layers-outline' },
  { key: 'first', label: VISIT_TYPE_LABELS.first, icon: 'person-add-outline' },
  { key: 'followup', label: VISIT_TYPE_LABELS.followup, icon: 'repeat-outline' },
  { key: 'consultation', label: VISIT_TYPE_LABELS.consultation, icon: 'chatbubbles-outline' },
];

function buildDoctorAppointmentFilterArgs({
  normalizedPatientSearch,
  selectedStatus,
  selectedVisitType,
}: DoctorAppointmentFilterArgs) {
  return {
    query: normalizedPatientSearch || undefined,
    status: selectedStatus ?? undefined,
    visitType: selectedVisitType ?? undefined,
  };
}

function useLatestDefinedQueryResult<T>(value: T | undefined): T | undefined {
  const latestValueRef = useRef<T | undefined>(undefined);

  if (value !== undefined) {
    latestValueRef.current = value;
  }

  return value ?? latestValueRef.current;
}

// =============================================================================
// Types
// =============================================================================

interface DashboardAppointment extends Omit<Appointment, 'id' | 'profileId' | 'patientNote' | 'doctorNote' | 'reason' | 'cancelledBy' | 'cancellationReason' | 'createdAt'> {
  id: Id<'bookings'>;
  profileId?: Id<'patientProfiles'>;
  reason?: string;
  patientNote?: string;
  doctorNote?: string;
  cancelledBy?: 'patient' | 'doctor' | 'system';
  cancellationReason?: string;
  createdAt?: string;
  patientName: string;
  patientPhone?: string;
  profileName?: string;
}

interface ConvexDoctorBooking {
  _id: Id<'bookings'>;
  _creationTime: number;
  patientId: Id<'patients'>;
  doctorId: Id<'doctors'>;
  clinicId: Id<'clinics'>;
  profileId?: Id<'patientProfiles'>;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDuration: number;
  visitType: VisitType;
  reason?: string;
  patientNote?: string;
  doctorNote?: string;
  status: AppointmentStatus;
  cancelledBy?: 'patient' | 'doctor' | 'system';
  cancellationReason?: string;
  confirmedAt?: number;
  cancelledAt?: number;
  completedAt?: number;
  patientName: string;
  patientPhone?: string;
  profileName?: string;
}

type WeekSection = DoctorWeekSection<DashboardAppointment>;

// =============================================================================
// Helpers
// =============================================================================

function todayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toDashboardAppointment(booking: ConvexDoctorBooking): DashboardAppointment {
  return {
    id: booking._id,
    patientId: booking.patientId,
    doctorId: booking.doctorId,
    clinicId: booking.clinicId,
    profileId: booking.profileId,
    appointmentDate: booking.appointmentDate,
    appointmentTime: booking.appointmentTime,
    appointmentDuration: booking.appointmentDuration,
    visitType: booking.visitType,
    reason: booking.reason,
    patientNote: booking.patientNote,
    doctorNote: booking.doctorNote,
    status: booking.status,
    cancelledBy: booking.cancelledBy,
    cancellationReason: booking.cancellationReason,
    patientName: booking.profileName ?? booking.patientName,
    patientPhone: booking.patientPhone,
    profileName: booking.profileName,
  };
}

/** Format YYYY-MM-DD to Arabic date string. */
function formatArabicDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = ARABIC_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const month = ARABIC_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}، ${dayNum} ${month} ${year}`;
}

/** Return today's appointments sorted by time. */
function sortAppointments(list: DashboardAppointment[]): DashboardAppointment[] {
  return [...list].sort((a, b) => {
    const dateCmp = a.appointmentDate.localeCompare(b.appointmentDate);
    if (dateCmp !== 0) return dateCmp;
    return a.appointmentTime.localeCompare(b.appointmentTime);
  });
}

function getStatusTone(status: AppointmentStatus): MetricItem['tone'] {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'no_show') return 'danger';
  return 'info';
}

/** Get days in month with appointments for the calendar grid. */
function getMonthGrid(
  monthDays: { date: string; total: number; appointments: ConvexDoctorBooking[] }[],
  year: number,
  month: number,
): {
  grid: (number | null)[][];
  appointmentDays: Set<number>;
} {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const appointmentDays = new Set(
    monthDays
      .filter((day) => day.total > 0)
      .map((day) => new Date(day.date + 'T00:00:00').getDate()),
  );

  const grid: (number | null)[][] = [];
  let week: (number | null)[] = [];

  // Fill leading nulls
  for (let i = 0; i < firstDay; i++) {
    week.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }

  // Fill trailing nulls
  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    grid.push(week);
  }

  return { grid, appointmentDays };
}

// =============================================================================
// Sub-components
// =============================================================================

// ── Appointment Card with Actions ───────────────────────────────────────────

interface AppointmentCardActionsProps {
  appointment: DashboardAppointment;
}

const AppointmentCardActions: React.FC<AppointmentCardActionsProps> = ({
  appointment,
}) => {
  const router = useRouter();
  const statusCfg = STATUS_CONFIG[appointment.status];

  return (
    <View style={styles.cardWrapper}>
      <View>
        <AppointmentWorkItem
          time={appointment.appointmentTime}
          patientName={appointment.patientName}
          meta={VISIT_TYPE_LABELS[appointment.visitType]}
          statusLabel={statusCfg.label}
          tone={getStatusTone(appointment.status)}
          showIcon={false}
        />
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [
            styles.cardActionBtn,
            styles.cardActionNote,
            pressed && styles.cardActionPressed,
          ]}
          onPress={() => router.push({
            pathname: '/(doctor)/notes',
            params: { bookingId: appointment.id },
          })}
          accessibilityRole="button"
          accessibilityLabel={`فتح ملاحظات ${appointment.patientName}`}
        >
          <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.cardActionTextNote}>الملاحظات</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ── Week Day Header ─────────────────────────────────────────────────────────

interface WeekDayHeaderProps {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  isToday: boolean;
}

const WeekDayHeader: React.FC<WeekDayHeaderProps> = ({
  title,
  count,
  isExpanded,
  onToggle,
  isToday,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.weekDayHeader,
      isToday && styles.weekDayHeaderToday,
      pressed && styles.weekDayHeaderPressed,
    ]}
    onPress={onToggle}
    accessibilityRole="button"
    accessibilityLabel={`${title}، ${count} مواعيد`}
  >
    <View style={styles.weekDayHeaderLeft}>
      <View style={[styles.weekDayDot, isToday && styles.weekDayDotToday]} />
      <Text
        style={[
          styles.weekDayHeaderTitle,
          isToday && styles.weekDayHeaderTitleToday,
        ]}
      >
        {title}
      </Text>
    </View>
    <View style={styles.weekDayHeaderRight}>
      <View style={styles.weekDayCountBadge}>
        <Text style={styles.weekDayCountText}>{count}</Text>
      </View>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={theme.colors.textSecondary}
        style={styles.weekDayChevron}
      />
    </View>
  </Pressable>
);

// ── Calendar Day Cell ───────────────────────────────────────────────────────

interface CalendarDayCellProps {
  day: number | null;
  hasAppointment: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: (day: number) => void;
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  day,
  hasAppointment,
  isToday,
  isSelected,
  onPress,
}) => {
  if (day === null) {
    return <View style={styles.calCell} />;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.calCell,
        isSelected && !isToday && styles.calCellSelected,
        isToday && styles.calCellToday,
        pressed && styles.calCellPressed,
      ]}
      onPress={() => onPress(day)}
      accessibilityRole="button"
      accessibilityLabel={`${day}${hasAppointment ? '، يوجد موعد' : ''}`}
    >
      <Text
        style={[
          styles.calCellText,
          isToday && styles.calCellTextToday,
          isSelected && !isToday && styles.calCellTextSelected,
          hasAppointment && !isToday && styles.calCellTextHasAppointment,
        ]}
      >
        {day}
      </Text>
      {hasAppointment && (
        <View
          style={[
            styles.calDot,
            isToday && styles.calDotToday,
          ]}
        />
      )}
    </Pressable>
  );
};

// ── Separator ───────────────────────────────────────────────────────────────

const Separator: React.FC = () => <View style={styles.separator} />;

interface FilterChipGroupProps<T extends string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

function FilterChipGroup<T extends string>({
  options,
  value,
  onChange,
}: FilterChipGroupProps<T>) {
  return (
    <View style={styles.filterChipGrid}>
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.filterChipButton,
              isActive && styles.filterChipButtonActive,
              pressed && styles.filterChipButtonPressed,
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={14}
                color={isActive ? theme.colors.white : theme.colors.textSecondary}
              />
            ) : null}
            <Text
              style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================================
// Main Appointments Screen
// =============================================================================

export default function DoctorAppointmentsScreen() {
  const todayDate = useMemo(() => todayString(), []);
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [patientSearchText, setPatientSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<NullableStatus>(null);
  const [selectedVisitType, setSelectedVisitType] =
    useState<NullableVisitType>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [draftSelectedStatus, setDraftSelectedStatus] =
    useState<NullableStatus>(null);
  const [draftSelectedVisitType, setDraftSelectedVisitType] =
    useState<NullableVisitType>(null);
  const autoExpandedWeekDateRef = useRef<string | null>(null);
  const deferredPatientSearchText = useDeferredValue(patientSearchText);
  const normalizedPatientSearch = deferredPatientSearchText.trim();
  const doctorAppointmentFilterArgs = useMemo(
    () =>
      buildDoctorAppointmentFilterArgs({
        normalizedPatientSearch,
        selectedStatus,
        selectedVisitType,
      }),
    [normalizedPatientSearch, selectedStatus, selectedVisitType],
  );
  const todayData = useQuery(api.bookings.listDoctorToday, {
    ...doctorAppointmentFilterArgs,
  });
  const weekData = useQuery(api.bookings.listDoctorWeek, {
    ...doctorAppointmentFilterArgs,
  });
  const monthData = useQuery(api.bookings.listDoctorMonth, {
    year: monthYear.year,
    month: monthYear.month + 1,
    ...doctorAppointmentFilterArgs,
  });
  const stableTodayData = useLatestDefinedQueryResult(todayData);
  const stableWeekData = useLatestDefinedQueryResult(weekData);
  const stableMonthData = useLatestDefinedQueryResult(monthData);
  const {
    results: historyResults,
    status: historyStatus,
    loadMore: loadMoreHistory,
  } = usePaginatedQuery(api.bookings.listDoctorHistory, {}, { initialNumItems: 20 });

  // ── State ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('today');

  // Week view expand/collapse
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<
    DashboardAppointment[] | null
  >(null);
  const activeFilterCount = [
    selectedStatus,
    selectedVisitType,
  ].filter(Boolean).length;

  // ── Derived data ──────────────────────────────────────────────────────
  const todayList = useMemo(
    () => sortAppointments((stableTodayData ?? []).map(toDashboardAppointment)),
    [stableTodayData],
  );

  const weekSections = useMemo(
    () =>
      stableWeekData
        ? buildDoctorWeekSections({
            startDate: stableWeekData.startDate,
            endDate: stableWeekData.endDate,
            days: stableWeekData.days,
            mapAppointment: toDashboardAppointment,
            sortAppointments,
          })
        : [],
    [stableWeekData],
  );

  const monthAppointmentsByDate = useMemo(() => {
    const map = new Map<string, DashboardAppointment[]>();
    for (const day of stableMonthData?.days ?? []) {
      map.set(
        day.date,
        sortAppointments(day.appointments.map(toDashboardAppointment)),
      );
    }
    return map;
  }, [stableMonthData]);

  // Auto-expand today once in week view; after that, manual collapse wins.
  useEffect(() => {
    const todaySection = weekSections.find((s) => s.date === todayDate);
    if (!todaySection || autoExpandedWeekDateRef.current === todayDate) {
      return;
    }

    autoExpandedWeekDateRef.current = todayDate;
    setExpandedDates((prev) => {
      if (prev.has(todayDate)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(todayDate);
      return next;
    });
  }, [weekSections, todayDate]);

  const { grid: monthGrid, appointmentDays } = useMemo(
    () => getMonthGrid(stableMonthData?.days ?? [], monthYear.year, monthYear.month),
    [stableMonthData, monthYear],
  );

  useEffect(() => {
    if (!selectedDayDate) return;

    const updatedAppointments =
      monthAppointmentsByDate.get(selectedDayDate) ?? [];
    setSelectedDayAppointments(
      updatedAppointments.length > 0 ? updatedAppointments : null,
    );
  }, [monthAppointmentsByDate, selectedDayDate]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    queueMicrotask(() => setRefreshing(false));
  }, []);

  const handleOpenFilterSheet = useCallback(() => {
    setDraftSelectedStatus(selectedStatus);
    setDraftSelectedVisitType(selectedVisitType);
    setFilterSheetVisible(true);
  }, [selectedStatus, selectedVisitType]);

  const handleApplyFilterSheet = useCallback(() => {
    setSelectedStatus(draftSelectedStatus);
    setSelectedVisitType(draftSelectedVisitType);
    setFilterSheetVisible(false);
  }, [draftSelectedStatus, draftSelectedVisitType]);

  const handleClearFilterSheet = useCallback(() => {
    setDraftSelectedStatus(null);
    setDraftSelectedVisitType(null);
    setSelectedStatus(null);
    setSelectedVisitType(null);
    setFilterSheetVisible(false);
  }, []);

  // ── Week expand/collapse ─────────────────────────────────────────────
  const toggleDay = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  // ── Calendar navigation ─────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setMonthYear((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthYear((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  }, []);

  const handleDayPress = useCallback(
    (day: number) => {
      const yyyy = monthYear.year;
      const mm = String(monthYear.month + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayApts = monthAppointmentsByDate.get(dateStr) ?? [];

      setSelectedDayDate(dateStr);
      setSelectedDayAppointments(dayApts.length > 0 ? dayApts : null);
    },
    [monthAppointmentsByDate, monthYear],
  );

  const today = new Date(todayDate + 'T00:00:00');
  const isCurrentMonth =
    monthYear.year === today.getFullYear() && monthYear.month === today.getMonth();

  // ── Render today item ────────────────────────────────────────────────
  const renderTodayItem = useCallback(
    ({ item }: ListRenderItemInfo<DashboardAppointment>) => (
      <AppointmentCardActions
        appointment={item}
      />
    ),
    [],
  );

  const todayKeyExtractor = useCallback(
    (item: DashboardAppointment) => item.id,
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: WeekSection }) => {
      const isToday = section.date === todayDate;
      const isExpanded = expandedDates.has(section.date);
      return (
        <WeekDayHeader
          title={section.title}
          count={section.data.length}
          isExpanded={isExpanded}
          isToday={isToday}
          onToggle={() => toggleDay(section.date)}
        />
      );
    },
    [expandedDates, todayDate, toggleDay],
  );

  const weekKeyExtractor = useCallback(
    (item: DashboardAppointment) => item.id,
    [],
  );

  // ── Loading state ────────────────────────────────────────────────────
  const isInitialLoading =
    stableTodayData === undefined ||
    stableWeekData === undefined ||
    stableMonthData === undefined;

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المواعيد...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <DoctorHeader
          title="مواعيد المركز"
          icon={null}
        />

        <View style={styles.patientFiltersSection}>
          <View style={styles.patientSearchBox}>
            <Ionicons name="search" size={18} color={theme.colors.textMuted} />
            <TextInput
              value={patientSearchText}
              onChangeText={setPatientSearchText}
              placeholder="ابحث باسم العميل أو رقم الهاتف"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.patientSearchInput}
              textAlign="right"
              returnKeyType="search"
              blurOnSubmit={false}
              accessibilityLabel="بحث في العملاء"
            />
            <Pressable
              onPress={handleOpenFilterSheet}
              accessibilityRole="button"
              accessibilityLabel="فتح فلاتر العملاء"
              style={({ pressed }) => [
                styles.searchFilterButton,
                activeFilterCount > 0 && styles.searchFilterButtonActive,
                pressed && styles.searchFilterButtonPressed,
              ]}
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={
                  activeFilterCount > 0
                    ? theme.colors.white
                    : theme.colors.primary
                }
              />
              {activeFilterCount > 0 ? (
                <View style={styles.searchFilterBadge}>
                  <Text style={styles.searchFilterBadgeText}>
                    {activeFilterCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            {patientSearchText ? (
              <Pressable
                onPress={() => setPatientSearchText('')}
                accessibilityRole="button"
                accessibilityLabel="مسح بحث العملاء"
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <DoctorSection title="فرز حسب الفترة">
          <SegmentedControl
            options={TABS}
            value={activeTab}
            onChange={setActiveTab}
          />
        </DoctorSection>

        {/* ── Content ───────────────────────────────────────────────── */}
        <DoctorSection
          title="قائمة المواعيد"
          subtitle="استخدمها للفرز وإضافة ملاحظات المختص"
        >
        {/* ─── Today Tab ──────────────────────────────────────── */}
        {activeTab === 'today' && (
          <>
            {todayList.length > 0 ? (
              <View style={styles.todayCountRow}>
                <Ionicons name="calendar" size={16} color={theme.colors.primary} />
                <Text style={styles.todayCountText}>
                  {todayList.length} موعد{todayList.length !== 1 ? 'اً' : ''} اليوم
                </Text>
              </View>
            ) : null}

            {todayList.length > 0 ? (
              <FlatList
                data={todayList}
                renderItem={renderTodayItem}
                keyExtractor={todayKeyExtractor}
                scrollEnabled={false}
                ItemSeparatorComponent={Separator}
              />
            ) : (
              <EmptyState
                icon="📅"
                title="لا يوجد مواعيد اليوم"
                subtitle="ليس لديك أي مواعيد لهذا اليوم"
              />
            )}
          </>
        )}

        {/* ─── Week Tab ───────────────────────────────────────── */}
        {activeTab === 'week' && (
          <>
            {weekSections.length > 0 ? (
              <SectionList
                sections={weekSections}
                renderItem={({ item, section }) =>
                  expandedDates.has(section.date) ? (
                    <AppointmentCardActions
                      appointment={item}
                    />
                  ) : null
                }
                renderSectionHeader={renderSectionHeader}
                keyExtractor={weekKeyExtractor}
                scrollEnabled={false}
                ItemSeparatorComponent={Separator}
              />
            ) : (
              <EmptyState
                icon="📅"
                title="لا يوجد مواعيد هذا الأسبوع"
                subtitle="ليس لديك أي مواعيد لهذا الأسبوع"
              />
            )}
          </>
        )}

        {/* ─── Month Tab ──────────────────────────────────────── */}
        {activeTab === 'month' && (
          <>
            {/* Month header */}
            <View style={styles.calHeader}>
              <Pressable
                style={({ pressed }) => [
                  styles.calNavButton,
                  pressed && styles.calNavButtonPressed,
                ]}
                onPress={goToPrevMonth}
                accessibilityRole="button"
                accessibilityLabel="الشهر السابق"
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
              </Pressable>

              <Text style={styles.calTitle}>
                {ARABIC_MONTHS[monthYear.month]} {monthYear.year}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.calNavButton,
                  pressed && styles.calNavButtonPressed,
                ]}
                onPress={goToNextMonth}
                accessibilityRole="button"
                accessibilityLabel="الشهر التالي"
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
              </Pressable>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.calWeekRow}>
              {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((d, i) => (
                <View key={i} style={styles.calWeekDayCell}>
                  <Text style={styles.calWeekDayText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            {monthGrid.map((week, wi) => (
              <View key={wi} style={styles.calWeekRow}>
                {week.map((day, di) => (
                  <CalendarDayCell
                    key={`${wi}-${di}`}
                    day={day}
                    hasAppointment={day !== null && appointmentDays.has(day)}
                    isToday={day !== null && isCurrentMonth && day === today.getDate()}
                    isSelected={
                      day !== null &&
                      selectedDayDate ===
                        `${monthYear.year}-${String(monthYear.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    }
                    onPress={handleDayPress}
                  />
                ))}
              </View>
            ))}

            {/* Selected day appointments */}
            {selectedDayAppointments && (
              <View style={styles.selectedDaySection}>
                <View style={styles.selectedDayHeader}>
                  <Text style={styles.selectedDayTitle}>
                    {formatArabicDate(selectedDayAppointments[0].appointmentDate)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSelectedDayDate(null);
                      setSelectedDayAppointments(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="إغلاق"
                  >
                    <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                </View>
                {selectedDayAppointments.map((apt) => (
                  <AppointmentCardActions
                    key={apt.id}
                    appointment={apt}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <View style={styles.historyList}>
            {historyResults.length ? (
              historyResults.map((booking: ConvexDoctorBooking) => (
                <AppointmentCardActions
                  key={booking._id}
                  appointment={toDashboardAppointment(booking)}
                />
              ))
            ) : historyStatus === 'LoadingFirstPage' ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <EmptyState
                icon="🕘"
                title="لا يوجد سجل مواعيد"
                subtitle="ستظهر هنا المواعيد السابقة وملاحظاتها."
              />
            )}
            {historyStatus === 'CanLoadMore' ? (
              <Pressable
                style={styles.historyLoadMore}
                onPress={() => loadMoreHistory(20)}
              >
                <Text style={styles.historyLoadMoreText}>عرض المزيد</Text>
              </Pressable>
            ) : historyStatus === 'LoadingMore' ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : null}
          </View>
        )}

        </DoctorSection>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={filterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <View style={styles.filterSheetOverlay}>
          <Pressable
            style={styles.filterSheetBackdrop}
            onPress={() => setFilterSheetVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="إغلاق فلاتر العملاء"
          />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <View style={styles.filterSheetTitleBlock}>
                <Text style={styles.filterSheetTitle}>فلاتر العملاء</Text>
                <Text style={styles.filterSheetSubtitle}>
                  اختر الحالة ونوع الزيارة ثم طبق النتائج.
                </Text>
              </View>
              <Pressable
                onPress={() => setFilterSheetVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.filterSheetGroup}>
              <Text style={styles.filterGroupLabel}>حالة الموعد</Text>
              <FilterChipGroup
                options={STATUS_FILTER_OPTIONS}
                value={draftSelectedStatus ?? 'all'}
                onChange={(value) =>
                  setDraftSelectedStatus(value === 'all' ? null : value)
                }
              />
            </View>

            <View style={styles.filterSheetGroup}>
              <Text style={styles.filterGroupLabel}>نوع الزيارة</Text>
              <FilterChipGroup
                options={VISIT_TYPE_FILTER_OPTIONS}
                value={draftSelectedVisitType ?? 'all'}
                onChange={(value) =>
                  setDraftSelectedVisitType(value === 'all' ? null : value)
                }
              />
            </View>

            <View style={styles.filterSheetActions}>
              <Pressable
                onPress={handleClearFilterSheet}
                accessibilityRole="button"
                accessibilityLabel="مسح الفلاتر"
                style={({ pressed }) => [
                  styles.filterSheetButton,
                  styles.filterSheetClearButton,
                  pressed && styles.filterSheetButtonPressed,
                ]}
              >
                <Text style={styles.filterSheetClearText}>مسح الفلاتر</Text>
              </Pressable>
              <Pressable
                onPress={handleApplyFilterSheet}
                accessibilityRole="button"
                accessibilityLabel="تطبيق الفلاتر"
                style={({ pressed }) => [
                  styles.filterSheetButton,
                  styles.filterSheetApplyButton,
                  pressed && styles.filterSheetButtonPressed,
                ]}
              >
                <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                <Text style={styles.filterSheetApplyText}>تطبيق الفلاتر</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['2xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },
  separator: {
    height: theme.spacing.xs,
  },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  patientFiltersSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  patientSearchBox: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  patientSearchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.sm,
  },
  searchFilterButton: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchFilterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  searchFilterButtonPressed: {
    opacity: 0.82,
  },
  searchFilterBadge: {
    position: 'absolute',
    top: -5,
    end: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 4,
  },
  searchFilterBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 10,
    color: theme.colors.white,
  },
  filterGroup: {
    marginTop: theme.spacing.xs,
  },
  filterGroupLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },

  // ─── Segment Tabs ───────────────────────────────────────────────────────
  segmentContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  segmentTabActive: {
    backgroundColor: theme.colors.secondary,
  },
  segmentTabPressed: {
    opacity: 0.7,
  },
  segmentTabText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  segmentTabTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },

  // ─── Today count ────────────────────────────────────────────────────────
  todayCountRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  todayCountText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  // ─── Appointment Card ───────────────────────────────────────────────────
  cardWrapper: {
    marginHorizontal: 0,
  },
  cardBody: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatarCol: {
    marginEnd: theme.spacing.md,
  },
  cardAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
  },
  cardInfoCol: {
    flex: 1,
  },
  cardPatientName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  cardTextMuted: {
    color: theme.colors.textSecondary,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  cardTime: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  cardDot: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.xs,
  },
  cardType: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.primary,
  },
  cardReason: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  cardBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginStart: theme.spacing.sm,
  },
  cardBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 10,
  },

  // ─── Card Actions ──────────────────────────────────────────────────────
  cardActions: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  cardActionPressed: {
    opacity: 0.75,
  },

  // Individual action button colours
  cardActionCompleted: {
    backgroundColor: theme.colors.success,
  },
  cardActionNoShow: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  cardActionCancel: {
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  cardActionNote: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },

  cardActionTextCompleted: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.white,
  },
  cardActionTextNoShow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.warning,
  },
  cardActionTextCancel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.danger,
  },
  cardActionTextNote: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.primary,
  },

  // ─── Week View ─────────────────────────────────────────────────────────
  weekDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  weekDayHeaderToday: {
    borderStartWidth: 4,
    borderStartColor: theme.colors.primary,
  },
  weekDayHeaderPressed: {
    opacity: 0.8,
  },
  weekDayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekDayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
    marginEnd: theme.spacing.md,
  },
  weekDayDotToday: {
    backgroundColor: theme.colors.primary,
  },
  weekDayHeaderTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  weekDayHeaderTitleToday: {
    color: theme.colors.primary,
  },
  weekDayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekDayCountBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    minWidth: 24,
    alignItems: 'center',
  },
  weekDayCountText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.primary,
  },
  weekDayChevron: {
    marginStart: theme.spacing.sm,
  },

  // ─── Calendar ──────────────────────────────────────────────────────────
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  calNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavButtonPressed: {
    opacity: 0.7,
  },
  calTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  calWeekRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
  },
  calWeekDayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  calWeekDayText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  calCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
  },
  calCellToday: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  calCellSelected: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'transparent',
  },
  calCellPressed: {
    opacity: 0.7,
  },
  calCellText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  calCellTextToday: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
  },
  calCellTextSelected: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  calCellTextHasAppointment: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.primary,
    marginTop: 2,
  },
  calDotToday: {
    backgroundColor: theme.colors.white,
  },

  // ─── Selected Day Section (month view) ────────────────────────────────
  selectedDaySection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  selectedDayTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },

  // ─── Filter Sheet ───────────────────────────────────────────────────────
  filterSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  filterSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing['2xl'],
    ...theme.shadows.xl,
  },
  filterSheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  filterSheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  filterSheetTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  filterSheetSubtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  filterSheetGroup: {
    marginBottom: theme.spacing.lg,
  },
  filterChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChipButton: {
    minHeight: 40,
    minWidth: 112,
    flexBasis: '30%',
    flexGrow: 1,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  filterChipButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipButtonPressed: {
    opacity: 0.82,
  },
  filterChipText: {
    minWidth: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  filterChipTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
  },
  filterSheetActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  filterSheetButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  filterSheetButtonPressed: {
    opacity: 0.82,
  },
  filterSheetClearButton: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterSheetApplyButton: {
    backgroundColor: theme.colors.primary,
  },
  filterSheetClearText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  filterSheetApplyText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
  historyList: {
    gap: theme.spacing.md,
  },
  historyLoadMore: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
  },
  historyLoadMoreText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  // ─── Modal ─────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.xl,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.sm,
  },
  modalSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.lg,
  },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 90,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  noteTimeline: {
    maxHeight: 210,
    marginBottom: theme.spacing.md,
  },
  noteEntry: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  noteEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  noteEntryAuthor: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  noteEntryMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  noteEntryContent: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  noteEmpty: {
    paddingVertical: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  noteVisibilityRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  noteVisibilityOption: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  noteVisibilityOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  noteVisibilityText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  noteVisibilityTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonDanger: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonTextPrimary: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
  modalButtonTextSecondary: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  modalButtonTextDanger: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
