import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import EmptyState from '@/components/EmptyState';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import type { Appointment, AppointmentStatus, VisitType } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

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
    label: 'مؤكد',
    color: theme.colors.success,
    backgroundColor: '#E8F8EE',
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
    color: theme.colors.warning,
    backgroundColor: '#FEF3CD',
  },
};

type ViewTab = 'today' | 'week' | 'month';

interface TabDefinition {
  key: ViewTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: readonly TabDefinition[] = [
  { key: 'today', label: 'اليوم', icon: 'today' },
  { key: 'week', label: 'الأسبوع', icon: 'calendar' },
  { key: 'month', label: 'الشهر', icon: 'calendar-outline' },
];

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

/** Week section for SectionList. */
interface WeekSection {
  title: string;
  date: string;
  dayName: string;
  data: DashboardAppointment[];
}

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

/** Build week sections grouped by day. */
function getWeekSections(
  weekDays: { date: string; appointments: ConvexDoctorBooking[] }[],
): WeekSection[] {
  const todayDate = todayString();
  const today = new Date(todayDate + 'T00:00:00');
  const startOfWeek = new Date(today);
  // Monday start for Arabic locale
  const dayOfWeek = today.getDay(); // 0=Sun
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(today.getDate() + diffToMonday);

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    weekDates.push(`${yyyy}-${mm}-${dd}`);
  }

  const grouped = new Map(
    weekDays.map((day) => [
      day.date,
      sortAppointments(day.appointments.map(toDashboardAppointment)),
    ]),
  );

  return weekDates.map((dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = ARABIC_DAYS[d.getDay()];
    return {
      title: `${dayName} ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`,
      date: dateStr,
      dayName,
      data: grouped.get(dateStr) ?? [],
    };
  });
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

// ── Segment Tabs ─────────────────────────────────────────────────────────────

interface SegmentTabsProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

const SegmentTabs: React.FC<SegmentTabsProps> = ({ activeTab, onTabChange }) => (
  <View style={styles.segmentContainer}>
    <View style={styles.segmentRow}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.segmentTab,
              isActive && styles.segmentTabActive,
              pressed && styles.segmentTabPressed,
            ]}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentTabText,
                isActive && styles.segmentTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

// ── Appointment Card with Actions ───────────────────────────────────────────

interface AppointmentCardActionsProps {
  appointment: DashboardAppointment;
  onMarkCompleted: (id: Id<'bookings'>) => Promise<void>;
  onMarkNoShow: (id: Id<'bookings'>) => Promise<void>;
  onCancel: (id: Id<'bookings'>, reason: string) => Promise<void>;
  onAddNote: (id: Id<'bookings'>, note: string) => Promise<void>;
}

const AppointmentCardActions: React.FC<AppointmentCardActionsProps> = ({
  appointment,
  onMarkCompleted,
  onMarkNoShow,
  onCancel,
  onAddNote,
}) => {
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState(appointment.doctorNote ?? '');

  const statusCfg = STATUS_CONFIG[appointment.status];
  const isCompleted = appointment.status === 'completed';
  const isCancelled = appointment.status === 'cancelled';
  const isNoShow = appointment.status === 'no_show';
  const isConfirmed = appointment.status === 'confirmed';

  const handleConfirmCancel = useCallback(() => {
    if (cancelReason.trim()) {
      void onCancel(appointment.id, cancelReason.trim());
      setCancelModalVisible(false);
      setCancelReason('');
    }
  }, [appointment.id, cancelReason, onCancel]);

  const handleSaveNote = useCallback(() => {
    void onAddNote(appointment.id, noteText);
    setNoteModalVisible(false);
  }, [appointment.id, noteText, onAddNote]);

  return (
    <View style={styles.cardWrapper}>
      {/* Card body */}
      <View style={[styles.cardBody, (isCompleted || isCancelled || isNoShow) && styles.cardBodyMuted]}>
        {/* Avatar + Info */}
        <View style={styles.cardRow}>
          <View style={styles.cardAvatarCol}>
            <View
              style={[
                styles.cardAvatarCircle,
                { backgroundColor: isCompleted ? theme.colors.border : theme.colors.secondary },
              ]}
            >
              <Text
                style={[
                  styles.cardAvatarText,
                  { color: isCompleted ? theme.colors.textSecondary : theme.colors.primary },
                ]}
              >
                {appointment.patientName.charAt(0)}
              </Text>
            </View>
          </View>

          <View style={styles.cardInfoCol}>
            <Text
              style={[
                styles.cardPatientName,
                (isCompleted || isCancelled || isNoShow) && styles.cardTextMuted,
              ]}
              numberOfLines={1}
            >
              {appointment.patientName}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardTime}>{appointment.appointmentTime}</Text>
              <Text style={styles.cardDot}>·</Text>
              <Text style={styles.cardType}>
                {VISIT_TYPE_LABELS[appointment.visitType]}
              </Text>
            </View>
            <Text style={styles.cardReason} numberOfLines={1}>
              {appointment.reason}
            </Text>
          </View>

          <View
            style={[
              styles.cardBadge,
              { backgroundColor: statusCfg.backgroundColor },
            ]}
          >
            <Text style={[styles.cardBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Action buttons (only for confirmed appointments) */}
      {isConfirmed && (
        <View style={styles.cardActions}>
          {/* Mark completed */}
          <Pressable
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionCompleted,
              pressed && styles.cardActionPressed,
            ]}
            onPress={() => void onMarkCompleted(appointment.id)}
            accessibilityRole="button"
            accessibilityLabel="اكتمل"
          >
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.white} />
            <Text style={styles.cardActionTextCompleted}>اكتمل</Text>
          </Pressable>

          {/* No show */}
          <Pressable
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionNoShow,
              pressed && styles.cardActionPressed,
            ]}
            onPress={() => void onMarkNoShow(appointment.id)}
            accessibilityRole="button"
            accessibilityLabel="لم يحضر"
          >
            <Ionicons name="close-circle" size={14} color={theme.colors.warning} />
            <Text style={styles.cardActionTextNoShow}>لم يحضر</Text>
          </Pressable>

          {/* Cancel */}
          <Pressable
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionCancel,
              pressed && styles.cardActionPressed,
            ]}
            onPress={() => setCancelModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="إلغاء"
          >
            <Ionicons name="ban-outline" size={14} color={theme.colors.danger} />
            <Text style={styles.cardActionTextCancel}>إلغاء</Text>
          </Pressable>

          {/* Add note */}
          <Pressable
            style={({ pressed }) => [
              styles.cardActionBtn,
              styles.cardActionNote,
              pressed && styles.cardActionPressed,
            ]}
            onPress={() => {
              setNoteText(appointment.doctorNote ?? '');
              setNoteModalVisible(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="أضف ملاحظة"
          >
            <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.cardActionTextNote}>ملاحظة</Text>
          </Pressable>
        </View>
      )}

      {/* ── Cancel Reason Modal ── */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCancelModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleBar} />
            <Text style={styles.modalTitle}>سبب الإلغاء</Text>
            <Text style={styles.modalSubtitle}>
              يرجى كتابة سبب إلغاء موعد {appointment.patientName}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="اكتب السبب..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="top"
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  pressed && styles.modalButtonPressed,
                ]}
                onPress={() => {
                  setCancelModalVisible(false);
                  setCancelReason('');
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>تراجع</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonDanger,
                  (!cancelReason.trim()) && styles.modalButtonDisabled,
                  pressed && styles.modalButtonPressed,
                ]}
                onPress={handleConfirmCancel}
                disabled={!cancelReason.trim()}
              >
                <Text style={styles.modalButtonTextDanger}>تأكيد الإلغاء</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Note Modal ── */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setNoteModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleBar} />
            <Text style={styles.modalTitle}>ملاحظة داخلية</Text>
            <Text style={styles.modalSubtitle}>
              ملاحظة عن المريض {appointment.patientName}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="أضف ملاحظة..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="top"
              textAlign="right"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  pressed && styles.modalButtonPressed,
                ]}
                onPress={() => setNoteModalVisible(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>تراجع</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  pressed && styles.modalButtonPressed,
                ]}
                onPress={handleSaveNote}
              >
                <Ionicons name="save-outline" size={16} color={theme.colors.white} />
                <Text style={styles.modalButtonTextPrimary}>حفظ</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  onPress: (day: number) => void;
}

const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  day,
  hasAppointment,
  isToday,
  onPress,
}) => {
  if (day === null) {
    return <View style={styles.calCell} />;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.calCell,
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

// =============================================================================
// Main Appointments Screen
// =============================================================================

export default function DoctorAppointmentsScreen() {
  const todayDate = useMemo(() => todayString(), []);
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const todayData = useQuery(api.bookings.listDoctorToday, {});
  const weekData = useQuery(api.bookings.listDoctorWeek, {});
  const monthData = useQuery(api.bookings.listDoctorMonth, {
    year: monthYear.year,
    month: monthYear.month + 1,
  });
  const markCompleted = useMutation(api.bookings.markCompleted);
  const markNoShow = useMutation(api.bookings.markNoShow);
  const cancelBooking = useMutation(api.bookings.cancel);
  const updateDoctorNote = useMutation(api.bookings.updateDoctorNote);

  // ── State ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('today');

  // Week view expand/collapse
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const [selectedDayAppointments, setSelectedDayAppointments] = useState<
    DashboardAppointment[] | null
  >(null);

  // ── Derived data ──────────────────────────────────────────────────────
  const todayList = useMemo(
    () => sortAppointments((todayData ?? []).map(toDashboardAppointment)),
    [todayData],
  );

  const weekSections = useMemo(
    () => getWeekSections(weekData?.days ?? []),
    [weekData],
  );

  const monthAppointmentsByDate = useMemo(() => {
    const map = new Map<string, DashboardAppointment[]>();
    for (const day of monthData?.days ?? []) {
      map.set(
        day.date,
        sortAppointments(day.appointments.map(toDashboardAppointment)),
      );
    }
    return map;
  }, [monthData]);

  // Auto-expand today in week view
  useEffect(() => {
    const todaySection = weekSections.find((s) => s.date === todayDate);
    if (todaySection && !expandedDates.has(todayDate)) {
      setExpandedDates((prev) => {
        const next = new Set(prev);
        next.add(todayDate);
        return next;
      });
    }
  }, [weekSections, expandedDates, todayDate]);

  const { grid: monthGrid, appointmentDays } = useMemo(
    () => getMonthGrid(monthData?.days ?? [], monthYear.year, monthYear.month),
    [monthData, monthYear],
  );

  // ── Pull-to-refresh ───────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    queueMicrotask(() => setRefreshing(false));
  }, []);

  // ── Appointment action handlers ───────────────────────────────────────
  const handleMarkCompleted = useCallback(
    async (id: Id<'bookings'>) => {
      await markCompleted({ bookingId: id });
    },
    [markCompleted],
  );

  const handleMarkNoShow = useCallback(
    async (id: Id<'bookings'>) => {
      await markNoShow({ bookingId: id });
    },
    [markNoShow],
  );

  const handleCancel = useCallback(
    async (id: Id<'bookings'>, reason: string) => {
      await cancelBooking({ bookingId: id, cancellationReason: reason });
    },
    [cancelBooking],
  );

  const handleAddNote = useCallback(
    async (id: Id<'bookings'>, note: string) => {
      await updateDoctorNote({ bookingId: id, doctorNote: note });
    },
    [updateDoctorNote],
  );

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

      if (dayApts.length > 0) {
        setSelectedDayAppointments(dayApts);
      }
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
        onMarkCompleted={handleMarkCompleted}
        onMarkNoShow={handleMarkNoShow}
        onCancel={handleCancel}
        onAddNote={handleAddNote}
      />
    ),
    [handleMarkCompleted, handleMarkNoShow, handleCancel, handleAddNote],
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
  if (todayData === undefined || weekData === undefined || monthData === undefined) {
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
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>المواعيد</Text>
        <Text style={styles.headerSubtitle}>{formatArabicDate(todayDate)}</Text>
      </View>

      {/* ── Segment Tabs ──────────────────────────────────────────── */}
      <SegmentTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Content ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
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
                      onMarkCompleted={handleMarkCompleted}
                      onMarkNoShow={handleMarkNoShow}
                      onCancel={handleCancel}
                      onAddNote={handleAddNote}
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
                    onPress={() => setSelectedDayAppointments(null)}
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
                    onMarkCompleted={handleMarkCompleted}
                    onMarkNoShow={handleMarkNoShow}
                    onCancel={handleCancel}
                    onAddNote={handleAddNote}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  todayCountText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  // ─── Appointment Card ───────────────────────────────────────────────────
  cardWrapper: {
    marginHorizontal: theme.spacing.lg,
  },
  cardBody: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  cardBodyMuted: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAvatarCol: {
    marginLeft: theme.spacing.md,
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
    marginRight: theme.spacing.sm,
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
    marginLeft: theme.spacing.md,
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
    marginRight: theme.spacing.sm,
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
