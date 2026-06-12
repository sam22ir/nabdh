import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
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

// =============================================================================
// Types
// =============================================================================

/** Appointment with denormalized patient info for the doctor dashboard. */
interface DashboardAppointment extends Omit<Appointment, 'id' | 'profileId' | 'patientNote' | 'doctorNote' | 'reason' | 'cancelledBy' | 'cancellationReason' | 'createdAt'> {
  id: Id<'bookings'>;
  profileId?: Id<'patientProfiles'>;
  patientNote?: string;
  doctorNote?: string;
  reason?: string;
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

/** Stats card data. */
interface StatCardData {
  label: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTodayArabic(): string {
  const d = new Date();
  const dayName = ARABIC_DAYS[d.getDay()];
  const dayNum = d.getDate();
  const month = ARABIC_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}، ${dayNum} ${month} ${year}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء الخير';
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

/** Return the next upcoming (earliest confirmed) appointment. */
function getNextAppointment(appointments: DashboardAppointment[]): DashboardAppointment | null {
  const confirmed = appointments
    .filter((a) => a.status === 'confirmed')
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  return confirmed.length > 0 ? confirmed[0] : null;
}

/** Return appointments to show in today's list (confirmed + completed, sorted by time). */
function getTodayListAppointments(appointments: DashboardAppointment[]): DashboardAppointment[] {
  return appointments
    .filter((a) => a.status === 'confirmed' || a.status === 'completed')
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
}

// =============================================================================
// Sub-components
// =============================================================================

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  data: StatCardData;
}

const StatCard: React.FC<StatCardProps> = ({ data }) => (
  <View style={[styles.statCard, { backgroundColor: data.backgroundColor }]}>
    <View style={[styles.statIconContainer, { backgroundColor: data.color }]}>
      <Ionicons name={data.icon} size={18} color={theme.colors.white} />
    </View>
    <Text style={[styles.statCount, { color: data.color }]}>{data.count}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {data.label}
    </Text>
  </View>
);

// ── Section Header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ── Next Patient Card ───────────────────────────────────────────────────────

interface NextPatientCardProps {
  appointment: DashboardAppointment;
}

const NextPatientCard: React.FC<NextPatientCardProps> = ({ appointment }) => (
  <View style={styles.nextPatientCard}>
    {/* Card header */}
    <View style={styles.nextPatientHeader}>
      <View style={styles.nextPatientHeaderLeft}>
        <Ionicons name="person" size={16} color={theme.colors.primary} />
        <Text style={styles.nextPatientHeaderTitle}>المريض القادم</Text>
      </View>
      <View style={styles.nextPatientBadge}>
        <Text style={styles.nextPatientBadgeText}>
          {VISIT_TYPE_LABELS[appointment.visitType]}
        </Text>
      </View>
    </View>

    {/* Patient name */}
    <Text style={styles.nextPatientName}>{appointment.patientName}</Text>

    {/* Divider */}
    <View style={styles.divider} />

    {/* Details */}
    <View style={styles.nextPatientDetails}>
      <View style={styles.nextPatientDetailRow}>
        <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.nextPatientDetailText}>
          {appointment.appointmentTime}
        </Text>
      </View>
      <View style={styles.nextPatientDetailRow}>
        <Ionicons name="medical-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.nextPatientDetailText}>
          {VISIT_TYPE_LABELS[appointment.visitType]}
        </Text>
      </View>
      <View style={styles.nextPatientDetailRow}>
        <Ionicons name="chatbubble-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.nextPatientDetailText} numberOfLines={2}>
          {appointment.reason}
        </Text>
      </View>
    </View>
  </View>
);

// ── Today Appointment Item ──────────────────────────────────────────────────

interface TodayAppointmentItemProps {
  appointment: DashboardAppointment;
  onPress: () => void;
}

const TodayAppointmentItem: React.FC<TodayAppointmentItemProps> = ({
  appointment,
  onPress,
}) => {
  const statusCfg = STATUS_CONFIG[appointment.status];
  const isCompleted = appointment.status === 'completed';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.todayItem,
        isCompleted && styles.todayItemCompleted,
        pressed && styles.todayItemPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`اضغط لعرض تفاصيل موعد ${appointment.patientName}`}
    >
      {/* Avatar column */}
      <View style={styles.todayItemAvatar}>
        <View
          style={[
            styles.todayItemAvatarCircle,
            { backgroundColor: isCompleted ? theme.colors.border : theme.colors.secondary },
          ]}
        >
          <Text
            style={[
              styles.todayItemAvatarText,
              { color: isCompleted ? theme.colors.textSecondary : theme.colors.primary },
            ]}
          >
            {appointment.patientName.charAt(0)}
          </Text>
        </View>
      </View>

      {/* Info column */}
      <View style={styles.todayItemInfo}>
        <Text
          style={[
            styles.todayItemName,
            isCompleted && styles.todayItemTextMuted,
          ]}
          numberOfLines={1}
        >
          {appointment.patientName}
        </Text>
        <View style={styles.todayItemMeta}>
          <Text style={styles.todayItemTime}>{appointment.appointmentTime}</Text>
          <Text style={styles.todayItemDot}>·</Text>
          <Text style={styles.todayItemType}>
            {VISIT_TYPE_LABELS[appointment.visitType]}
          </Text>
        </View>
      </View>

      {/* Status badge */}
      <View
        style={[
          styles.todayItemBadge,
          { backgroundColor: statusCfg.backgroundColor },
        ]}
      >
        <Text style={[styles.todayItemBadgeText, { color: statusCfg.color }]}>
          {statusCfg.label}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.colors.textSecondary}
        style={styles.todayItemChevron}
      />
    </Pressable>
  );
};

// ── Appointment Detail Modal ────────────────────────────────────────────────

interface AppointmentDetailModalProps {
  visible: boolean;
  appointment: DashboardAppointment | null;
  onClose: () => void;
  onMarkCompleted: (appointmentId: Id<'bookings'>) => Promise<void>;
  onMarkNoShow: (appointmentId: Id<'bookings'>) => Promise<void>;
  onSaveNote: (appointmentId: Id<'bookings'>, note: string) => Promise<void>;
}

const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  visible,
  appointment,
  onClose,
  onMarkCompleted,
  onMarkNoShow,
  onSaveNote,
}) => {
  const [doctorNote, setDoctorNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    if (visible && appointment) {
      setDoctorNote(appointment.doctorNote ?? '');
      setNoteSaved(false);
    }
  }, [visible, appointment]);

  const handleSaveNote = useCallback(async () => {
    if (appointment) {
      await onSaveNote(appointment.id, doctorNote);
      setNoteSaved(true);
    }
  }, [appointment, doctorNote, onSaveNote]);

  if (!appointment) return null;

  const statusCfg = STATUS_CONFIG[appointment.status];
  const isConfirmed = appointment.status === 'confirmed';
  const isCompleted = appointment.status === 'completed';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />
          <View style={styles.modalHandleBar} />

          {/* Scrollable content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>
                    {appointment.patientName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.modalHeaderInfo}>
                  <Text style={styles.modalPatientName}>
                    {appointment.patientName}
                  </Text>
                  <Text style={styles.modalPatientMeta}>
                    {appointment.patientPhone ?? 'بدون رقم هاتف'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.modalCloseButtonPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* Status badge */}
            <View style={styles.modalStatusRow}>
              <View
                style={[
                  styles.modalStatusBadge,
                  { backgroundColor: statusCfg.backgroundColor },
                ]}
              >
                <Text style={[styles.modalStatusText, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={styles.modalDetailsCard}>
              <DetailRow
                icon="time-outline"
                label="الوقت"
                value={appointment.appointmentTime}
              />
              <DetailRow
                icon="calendar-outline"
                label="التاريخ"
                value={appointment.appointmentDate}
              />
              <DetailRow
                icon="medical-outline"
                label="نوع الزيارة"
                value={VISIT_TYPE_LABELS[appointment.visitType]}
              />
              <DetailRow
                icon="chatbubble-outline"
                label="السبب"
                value={appointment.reason ?? 'غير محدد'}
                isLast
              />

              {appointment.cancellationReason && (
                <DetailRow
                  icon="information-circle-outline"
                  label="سبب الإلغاء"
                  value={appointment.cancellationReason}
                  isLast
                  valueColor={theme.colors.danger}
                />
              )}
            </View>

            {/* Actions for confirmed appointments */}
            {isConfirmed && (
              <View style={styles.modalActions}>
                <Text style={styles.modalActionsTitle}>إجراءات الموعد</Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    styles.modalActionCompleted,
                    pressed && styles.modalActionPressed,
                  ]}
                  onPress={() => void onMarkCompleted(appointment.id)}
                  accessibilityRole="button"
                  accessibilityLabel="تأكيد الحضور"
                >
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                  <Text style={styles.modalActionText}>تأكيد الحضور</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.modalActionButton,
                    styles.modalActionNoShow,
                    pressed && styles.modalActionPressed,
                  ]}
                  onPress={() => void onMarkNoShow(appointment.id)}
                  accessibilityRole="button"
                  accessibilityLabel="لم يحضر"
                >
                  <Ionicons name="close-circle" size={20} color={theme.colors.warning} />
                  <Text style={[styles.modalActionText, { color: theme.colors.warning }]}>
                    لم يحضر
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Completed info */}
            {isCompleted && (
              <View style={styles.modalCompletedBanner}>
                <Ionicons name="checkmark-done-circle" size={20} color={theme.colors.success} />
                <Text style={styles.modalCompletedText}>
                  تم تسجيل حضور المريض
                </Text>
              </View>
            )}

            {/* Doctor note */}
            <View style={styles.modalNoteSection}>
              <Text style={styles.modalNoteTitle}>ملاحظة الطبيب</Text>
              <TextInput
                style={styles.modalNoteInput}
                value={doctorNote}
                onChangeText={setDoctorNote}
                placeholder="أضف ملاحظة عن المريض..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                textAlignVertical="top"
                textAlign="right"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.modalNoteSaveButton,
                  pressed && styles.modalActionPressed,
                  noteSaved && styles.modalNoteSaveButtonSaved,
                ]}
                onPress={() => void handleSaveNote()}
                accessibilityRole="button"
                accessibilityLabel="حفظ الملاحظة"
              >
                <Ionicons
                  name={noteSaved ? 'checkmark' : 'save-outline'}
                  size={18}
                  color={noteSaved ? theme.colors.success : theme.colors.white}
                />
                <Text
                  style={[
                    styles.modalNoteSaveText,
                    noteSaved && styles.modalNoteSaveTextSaved,
                  ]}
                >
                  {noteSaved ? 'تم الحفظ' : 'حفظ الملاحظة'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Detail Row ──────────────────────────────────────────────────────────────

interface DetailRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
  valueColor?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({
  icon,
  label,
  value,
  isLast = false,
  valueColor,
}) => (
  <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
    <Ionicons name={icon} size={18} color={theme.colors.textSecondary} />
    <View style={styles.detailRowContent}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text
        style={[
          styles.detailRowValue,
          valueColor ? { color: valueColor } : undefined,
        ]}
        numberOfLines={3}
      >
        {value}
      </Text>
    </View>
  </View>
);

// ── Separator ───────────────────────────────────────────────────────────────

const Separator: React.FC = () => <View style={styles.separator} />;

// =============================================================================
// Main Dashboard Screen
// =============================================================================

export default function DoctorDashboardScreen() {
  const me = useQuery(api.users.me, {});
  const homeData = useQuery(api.bookings.getHomeDataDoctor, {});
  const markCompleted = useMutation(api.bookings.markCompleted);
  const markNoShow = useMutation(api.bookings.markNoShow);
  const updateDoctorNote = useMutation(api.bookings.updateDoctorNote);

  // ── State ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ── Derived values ─────────────────────────────────────────────────────
  const greeting = useMemo(() => getGreeting(), []);
  const todayArabic = useMemo(() => formatTodayArabic(), []);
  const doctorName =
    me?.role === 'doctor' ? (me.fullNameAr ?? me.name ?? 'الطبيب') : 'الطبيب';
  const appointments = useMemo(
    () =>
      ((homeData?.todayAppointments ?? []) as ConvexDoctorBooking[]).map(
        toDashboardAppointment,
      ),
    [homeData?.todayAppointments],
  );

  const statsCards = useMemo((): StatCardData[] => [
    {
      label: 'اليوم',
      count: homeData?.todayStats.total ?? 0,
      icon: 'calendar',
      color: theme.colors.primary,
      backgroundColor: '#E8F4FD',
    },
    {
      label: 'مؤكد',
      count: homeData?.todayStats.confirmed ?? 0,
      icon: 'checkmark-circle',
      color: theme.colors.success,
      backgroundColor: '#E8F8EE',
    },
    {
      label: 'مكتمل',
      count: homeData?.todayStats.completed ?? 0,
      icon: 'checkmark-done',
      color: theme.colors.textSecondary,
      backgroundColor: '#F3F4F6',
    },
    {
      label: 'ملغى',
      count: homeData?.todayStats.cancelled ?? 0,
      icon: 'close-circle',
      color: theme.colors.danger,
      backgroundColor: '#FDEDEC',
    },
  ], [homeData?.todayStats]);

  const nextAppointment = useMemo(
    () =>
      homeData?.nextPatient
        ? toDashboardAppointment(homeData.nextPatient as ConvexDoctorBooking)
        : getNextAppointment(appointments),
    [appointments, homeData?.nextPatient],
  );

  const todayAppointments = useMemo(
    () => getTodayListAppointments(appointments),
    [appointments],
  );

  // ── Pull-to-refresh ────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    queueMicrotask(() => setRefreshing(false));
  }, []);

  // ── Modal handlers ─────────────────────────────────────────────────────
  const openDetailModal = useCallback((appointment: DashboardAppointment) => {
    setSelectedAppointment(appointment);
    setModalVisible(true);
  }, []);

  const closeDetailModal = useCallback(() => {
    setModalVisible(false);
    setSelectedAppointment(null);
  }, []);

  const handleMarkCompleted = useCallback(
    async (appointmentId: Id<'bookings'>) => {
      await markCompleted({ bookingId: appointmentId });
      setSelectedAppointment((prev) =>
        prev?.id === appointmentId
          ? { ...prev, status: 'completed' as AppointmentStatus }
          : prev,
      );
    },
    [markCompleted],
  );

  const handleMarkNoShow = useCallback(
    async (appointmentId: Id<'bookings'>) => {
      await markNoShow({ bookingId: appointmentId });
      setSelectedAppointment((prev) =>
        prev?.id === appointmentId
          ? { ...prev, status: 'no_show' as AppointmentStatus }
          : prev,
      );
    },
    [markNoShow],
  );

  const handleSaveNote = useCallback(
    async (appointmentId: Id<'bookings'>, note: string) => {
      await updateDoctorNote({ bookingId: appointmentId, doctorNote: note });
      setSelectedAppointment((prev) =>
        prev?.id === appointmentId ? { ...prev, doctorNote: note } : prev,
      );
    },
    [updateDoctorNote],
  );

  // ── Render today appointment item ──────────────────────────────────────
  const renderTodayItem = useCallback(
    ({ item }: ListRenderItemInfo<DashboardAppointment>) => (
      <TodayAppointmentItem
        appointment={item}
        onPress={() => openDetailModal(item)}
      />
    ),
    [openDetailModal],
  );

  const keyExtractor = useCallback(
    (item: DashboardAppointment) => item.id,
    [],
  );

  // ── Loading state ──────────────────────────────────────────────────────
  if (homeData === undefined || me === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل لوحة التحكم...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
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
        {/* ── Greeting Section ─────────────────────────────────── */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingEmoji}>👋</Text>
            <View>
              <Text style={styles.greetingText}>
                {greeting}، د.
              </Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {doctorName}
              </Text>
            </View>
          </View>
          <View style={styles.greetingDateContainer}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.greetingDate}>{todayArabic}</Text>
          </View>
        </View>

        {/* ── Stats Cards Row ───────────────────────────────────── */}
        <View style={styles.statsRow}>
          {statsCards.map((card) => (
            <StatCard key={card.label} data={card} />
          ))}
        </View>

        {/* ── Next Patient Section ──────────────────────────────── */}
        <SectionHeader title="المريض القادم" />
        {nextAppointment ? (
          <NextPatientCard appointment={nextAppointment} />
        ) : (
          <View style={styles.emptyNextPatient}>
            <Ionicons name="checkmark-done-circle" size={40} color={theme.colors.success} />
            <Text style={styles.emptyNextPatientText}>
              لا يوجد مرضى في الانتظار
            </Text>
          </View>
        )}

        {/* ── Today's Appointments Section ──────────────────────── */}
        <SectionHeader title="قائمة مرضى اليوم" />

        {todayAppointments.length > 0 ? (
          <View style={styles.todayListContainer}>
            <FlatList
              data={todayAppointments}
              renderItem={renderTodayItem}
              keyExtractor={keyExtractor}
              scrollEnabled={false}
              ItemSeparatorComponent={Separator}
            />
          </View>
        ) : (
          <EmptyState
            icon="📅"
            title="لا يوجد مواعيد اليوم"
            subtitle="ليس لديك أي مواعيد مؤكدة أو مكتملة لهذا اليوم"
          />
        )}

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Detail Modal ────────────────────────────────────────── */}
      <AppointmentDetailModal
        visible={modalVisible}
        appointment={selectedAppointment}
        onClose={closeDetailModal}
        onMarkCompleted={handleMarkCompleted}
        onMarkNoShow={handleMarkNoShow}
        onSaveNote={handleSaveNote}
      />
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },

  // ─── Greeting Section ────────────────────────────────────────────────────
  greetingSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  greetingTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  greetingEmoji: {
    fontSize: 28,
    marginLeft: theme.spacing.md,
  },
  greetingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  greetingName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 24,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  greetingDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingDate: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },

  // ─── Stats Row ───────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  statCount: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // ─── Section Header ──────────────────────────────────────────────────────
  sectionHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Next Patient Card ───────────────────────────────────────────────────
  nextPatientCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    borderStartWidth: 4,
    borderStartColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  nextPatientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  nextPatientHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextPatientHeaderTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
    marginRight: theme.spacing.sm,
  },
  nextPatientBadge: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  nextPatientBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.primary,
  },
  nextPatientName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  nextPatientDetails: {
    gap: theme.spacing.sm,
  },
  nextPatientDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextPatientDetailText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.sm,
  },
  emptyNextPatient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3xl'],
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  emptyNextPatientText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.success,
    marginTop: theme.spacing.sm,
  },

  // ─── Today Appointments List ─────────────────────────────────────────────
  todayListContainer: {
    paddingBottom: theme.spacing.md,
  },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  todayItemCompleted: {
    opacity: 0.75,
  },
  todayItemPressed: {
    opacity: 0.9,
  },
  todayItemAvatar: {
    marginLeft: theme.spacing.md,
  },
  todayItemAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayItemAvatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
  },
  todayItemInfo: {
    flex: 1,
  },
  todayItemName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  todayItemTextMuted: {
    color: theme.colors.textSecondary,
  },
  todayItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayItemTime: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  todayItemDot: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.xs,
  },
  todayItemType: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.primary,
  },
  todayItemBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginHorizontal: theme.spacing.sm,
  },
  todayItemBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 10,
  },
  todayItemChevron: {
    marginRight: theme.spacing.xs,
  },

  // ─── Modal ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    ...theme.shadows.xl,
  },
  modalHandle: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  modalContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  modalAvatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.primary,
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalPatientName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  modalPatientMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonPressed: {
    opacity: 0.7,
  },
  modalStatusRow: {
    marginBottom: theme.spacing.md,
  },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  modalStatusText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
  },

  // ─── Detail Rows ─────────────────────────────────────────────────────────
  modalDetailsCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  detailRowContent: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  detailRowLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  detailRowValue: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },

  // ─── Actions ─────────────────────────────────────────────────────────────
  modalActions: {
    marginBottom: theme.spacing.lg,
  },
  modalActionsTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: rtlTextAlign(),
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  modalActionCompleted: {
    backgroundColor: theme.colors.success,
  },
  modalActionNoShow: {
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.warning,
  },
  modalActionPressed: {
    opacity: 0.8,
  },
  modalActionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
    marginRight: theme.spacing.sm,
  },

  // ─── Completed banner ───────────────────────────────────────────────────
  modalCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F8EE',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  modalCompletedText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.success,
    marginRight: theme.spacing.sm,
  },

  // ─── Doctor Note ────────────────────────────────────────────────────────
  modalNoteSection: {
    marginBottom: theme.spacing.lg,
  },
  modalNoteTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: rtlTextAlign(),
  },
  modalNoteInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 90,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  modalNoteSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  modalNoteSaveButtonSaved: {
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.success,
  },
  modalNoteSaveText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
    marginRight: theme.spacing.sm,
  },
  modalNoteSaveTextSaved: {
    color: theme.colors.success,
  },
});
