// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import {
  AppointmentWorkItem,
  DoctorHeader,
  DoctorSection,
  MetricStrip,
  SegmentedControl,
  type MetricItem,
} from '@/components/doctor-ui';
import SearchBar from '@/components/SearchBar';
import { Badge, Button, Panel } from '@/components/ui';
import { stripArabicDoctorTitle } from '@/lib/doctorNames';
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
    label: 'في الانتظار',
    color: theme.colors.status.warning.text,
    backgroundColor: theme.colors.status.warning.background,
  },
  present: {
    label: 'حاضر',
    color: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  in_room: {
    label: 'داخل عند الطبيب',
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

interface ClinicMembershipCard {
  _id: Id<'clinicMemberships'>;
  clinicId: Id<'clinics'>;
  doctorId: Id<'doctors'>;
  clinicName: string;
  clinic?: {
    phone?: string;
    address?: string;
    wilaya?: { nameAr?: string | null } | null;
  } | null;
}

interface ClinicSearchCard {
  _id: Id<'clinics'>;
  name: string;
  nameAr?: string;
  phone?: string;
  address?: string;
  isBookable?: boolean;
  acceptedDoctorCount?: number;
  wilaya?: { nameAr?: string | null } | null;
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
    .filter((a) => a.status === 'confirmed' || a.status === 'present' || a.status === 'in_room')
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  return confirmed.length > 0 ? confirmed[0] : null;
}

/** Return appointments to show in today's list (confirmed + completed, sorted by time). */
function getTodayListAppointments(appointments: DashboardAppointment[]): DashboardAppointment[] {
  return appointments
    .filter((a) =>
      a.status === 'confirmed' ||
      a.status === 'present' ||
      a.status === 'in_room' ||
      a.status === 'completed',
    )
    .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
}

function getStatusTone(status: AppointmentStatus): MetricItem['tone'] {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'confirmed' || status === 'no_show') return 'warning';
  return 'info';
}

// ── Appointment Detail Modal ────────────────────────────────────────────────

interface AppointmentDetailModalProps {
  visible: boolean;
  appointment: DashboardAppointment | null;
  onClose: () => void;
  onMarkCompleted: (appointmentId: Id<'bookings'>) => Promise<void>;
  onMarkNoShow: (appointmentId: Id<'bookings'>) => Promise<void>;
  onCancelAppointment: (appointmentId: Id<'bookings'>, reason: string) => Promise<void>;
  onSaveNote: (appointmentId: Id<'bookings'>, note: string) => Promise<void>;
}

const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  visible,
  appointment,
  onClose,
  onMarkCompleted,
  onMarkNoShow,
  onCancelAppointment,
  onSaveNote,
}) => {
  const [doctorNote, setDoctorNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (visible && appointment) {
      setDoctorNote(appointment.doctorNote ?? '');
      setNoteSaved(false);
      setShowCancelReason(false);
      setCancelReason('');
    }
  }, [visible, appointment]);

  const handleSaveNote = useCallback(async () => {
    if (appointment) {
      await onSaveNote(appointment.id, doctorNote);
      setNoteSaved(true);
    }
  }, [appointment, doctorNote, onSaveNote]);

  const handleConfirmCancel = useCallback(async () => {
    if (!appointment || !cancelReason.trim()) return;
    await onCancelAppointment(appointment.id, cancelReason.trim());
    setShowCancelReason(false);
    setCancelReason('');
  }, [appointment, cancelReason, onCancelAppointment]);

  if (!appointment) return null;

  const statusCfg = STATUS_CONFIG[appointment.status];
  const isConfirmed =
    appointment.status === 'confirmed' ||
    appointment.status === 'present' ||
    appointment.status === 'in_room';
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

const TodayPatientsEmptyState: React.FC = () => (
  <View style={styles.todayEmptyPanel} accessibilityRole="text">
    <View style={styles.todayEmptyIconFrame}>
      <Ionicons
        name="checkmark-done-outline"
        size={24}
        color={theme.colors.status.success.text}
      />
    </View>

    <View style={styles.todayEmptyCopy}>
      <Text style={styles.todayEmptyTitle}>لا توجد مواعيد متبقية اليوم</Text>
      <Text style={styles.todayEmptySubtitle}>
        ستظهر المواعيد القادمة هنا تلقائياً عند تأكيد الحجز.
      </Text>
    </View>

    <View style={styles.todayEmptyPill}>
      <Ionicons
        name="time-outline"
        size={14}
        color={theme.colors.status.neutral.text}
      />
      <Text style={styles.todayEmptyPillText}>اليوم هادئ</Text>
    </View>
  </View>
);

function getArabicError(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    return typeof error.message === 'string' ? error.message : fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

type ClinicMembershipMode = 'search' | 'invites' | 'requests';

function DoctorClinicMembershipPanel({
  mode,
  onModeChange,
  searchText,
  onSearchTextChange,
  clinics,
  acceptedClinic,
  invites,
  requests,
  activeClinicId,
  activeMembershipId,
  onRequestClinic,
  onAcceptInvite,
  onRejectInvite,
  onCancelRequest,
  onLeaveClinic,
}: {
  mode: ClinicMembershipMode;
  onModeChange: (mode: ClinicMembershipMode) => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  clinics: ClinicSearchCard[];
  acceptedClinic: ClinicMembershipCard | null | undefined;
  invites: ClinicMembershipCard[];
  requests: ClinicMembershipCard[];
  activeClinicId: string | null;
  activeMembershipId: string | null;
  onRequestClinic: (clinicId: Id<'clinics'>) => Promise<void>;
  onAcceptInvite: (membershipId: Id<'clinicMemberships'>) => Promise<void>;
  onRejectInvite: (membershipId: Id<'clinicMemberships'>) => Promise<void>;
  onCancelRequest: (membershipId: Id<'clinicMemberships'>) => Promise<void>;
  onLeaveClinic: () => Promise<void>;
}) {
  const pendingInviteByClinicId = useMemo(
    () => new Map(invites.map((membership) => [membership.clinicId, membership])),
    [invites],
  );
  const pendingRequestByClinicId = useMemo(
    () => new Map(requests.map((membership) => [membership.clinicId, membership])),
    [requests],
  );

  return (
    <DoctorSection
      title="الانضمام إلى عيادة"
      subtitle="ابحث عن العيادات أو راجع الدعوات والطلبات المعلقة."
    >
      <SegmentedControl
        options={[
          { key: 'search', label: 'البحث', icon: 'search-outline' },
          { key: 'invites', label: 'الدعوات', icon: 'mail-open-outline' },
          { key: 'requests', label: 'طلباتي', icon: 'send-outline' },
        ]}
        value={mode}
        onChange={onModeChange}
      />

      {acceptedClinic ? (
        <Panel style={styles.clinicMembershipCard}>
          <View style={styles.clinicMembershipHeader}>
            <View style={styles.clinicMembershipCopy}>
              <Text style={styles.clinicMembershipTitle}>{acceptedClinic.clinicName}</Text>
              <Text style={styles.clinicMembershipSubtitle}>
                {acceptedClinic.clinic?.phone ||
                  acceptedClinic.clinic?.address ||
                  'أنت عضو فعّال في هذه العيادة'}
              </Text>
            </View>
            <Badge label="عضو حالي" tone="success" />
          </View>
          <Button
            label="مغادرة العيادة"
            variant="secondary"
            icon="exit-outline"
            loading={activeMembershipId === 'leave-clinic'}
            onPress={() => void onLeaveClinic()}
          />
        </Panel>
      ) : null}

      {mode === 'search' ? (
        <>
          <SearchBar
            value={searchText}
            onChangeText={onSearchTextChange}
            placeholder="ابحث عن عيادة بالاسم أو العنوان"
            containerStyle={styles.dashboardSearchBar}
          />

          {clinics.length > 0 ? (
            clinics.map((clinic) => {
              const pendingInvite = pendingInviteByClinicId.get(clinic._id);
              const pendingRequest = pendingRequestByClinicId.get(clinic._id);
              const isAccepted = acceptedClinic?.clinicId === clinic._id;

              return (
                <Panel key={clinic._id} style={styles.clinicMembershipCard}>
                  <View style={styles.clinicMembershipHeader}>
                    <View style={styles.clinicMembershipCopy}>
                      <Text style={styles.clinicMembershipTitle}>
                        {clinic.nameAr ?? clinic.name}
                      </Text>
                      <Text style={styles.clinicMembershipSubtitle}>
                        {clinic.address ||
                          clinic.wilaya?.nameAr ||
                          clinic.phone ||
                          'العيادة متاحة للانضمام'}
                      </Text>
                    </View>
                    {isAccepted ? (
                      <Badge label="عضو حالي" tone="success" />
                    ) : pendingInvite ? (
                      <Badge label="دعوة واردة" tone="warning" />
                    ) : pendingRequest ? (
                      <Badge label="طلب مرسل" tone="info" />
                    ) : clinic.isBookable ? (
                      <Badge label="نشطة" tone="success" />
                    ) : (
                      <Badge label="مرئية" tone="neutral" />
                    )}
                  </View>

                  <Text style={styles.clinicMembershipMeta}>
                    {clinic.acceptedDoctorCount ?? 0} أطباء داخل العيادة
                  </Text>

                  {isAccepted ? null : pendingInvite ? (
                    <View style={styles.clinicMembershipActions}>
                      <Button
                        label="قبول الدعوة"
                        icon="checkmark-circle-outline"
                        loading={activeMembershipId === pendingInvite._id}
                        onPress={() => void onAcceptInvite(pendingInvite._id)}
                      />
                      <Button
                        label="رفض"
                        variant="secondary"
                        icon="close-circle-outline"
                        loading={activeMembershipId === pendingInvite._id}
                        onPress={() => void onRejectInvite(pendingInvite._id)}
                      />
                    </View>
                  ) : pendingRequest ? (
                    <View style={styles.clinicMembershipActions}>
                      <Button
                        label="إلغاء الطلب"
                        variant="secondary"
                        icon="close-outline"
                        loading={activeMembershipId === pendingRequest._id}
                        onPress={() => void onCancelRequest(pendingRequest._id)}
                      />
                    </View>
                  ) : (
                    <View style={styles.clinicMembershipActions}>
                      <Button
                        label="طلب الانضمام"
                        icon="send-outline"
                        disabled={Boolean(acceptedClinic)}
                        loading={activeClinicId === clinic._id}
                        onPress={() => void onRequestClinic(clinic._id)}
                      />
                    </View>
                  )}
                </Panel>
              );
            })
          ) : (
            <Text style={styles.dashboardEmptyText}>لا توجد عيادات مطابقة حالياً</Text>
          )}
        </>
      ) : null}

      {mode === 'invites' ? (
        invites.length > 0 ? (
          invites.map((membership) => (
            <Panel key={membership._id} style={styles.clinicMembershipCard}>
              <View style={styles.clinicMembershipHeader}>
                <View style={styles.clinicMembershipCopy}>
                  <Text style={styles.clinicMembershipTitle}>{membership.clinicName}</Text>
                  <Text style={styles.clinicMembershipSubtitle}>
                    {membership.clinic?.phone ||
                      membership.clinic?.address ||
                      'دعوة بانتظار قرارك'}
                  </Text>
                </View>
                <Badge label="دعوة معلقة" tone="warning" />
              </View>
              <View style={styles.clinicMembershipActions}>
                <Button
                  label="قبول"
                  icon="checkmark-circle-outline"
                  loading={activeMembershipId === membership._id}
                  onPress={() => void onAcceptInvite(membership._id)}
                />
                <Button
                  label="رفض"
                  variant="secondary"
                  icon="close-circle-outline"
                  loading={activeMembershipId === membership._id}
                  onPress={() => void onRejectInvite(membership._id)}
                />
              </View>
            </Panel>
          ))
        ) : (
          <Text style={styles.dashboardEmptyText}>لا توجد دعوات حالياً</Text>
        )
      ) : null}

      {mode === 'requests' ? (
        requests.length > 0 ? (
          requests.map((membership) => (
            <Panel key={membership._id} style={styles.clinicMembershipCard}>
              <View style={styles.clinicMembershipHeader}>
                <View style={styles.clinicMembershipCopy}>
                  <Text style={styles.clinicMembershipTitle}>{membership.clinicName}</Text>
                  <Text style={styles.clinicMembershipSubtitle}>
                    {membership.clinic?.phone ||
                      membership.clinic?.address ||
                      'بانتظار رد العيادة'}
                  </Text>
                </View>
                <Badge label="طلب مرسل" tone="info" />
              </View>
              <View style={styles.clinicMembershipActions}>
                <Button
                  label="إلغاء الطلب"
                  variant="secondary"
                  icon="close-outline"
                  loading={activeMembershipId === membership._id}
                  onPress={() => void onCancelRequest(membership._id)}
                />
              </View>
            </Panel>
          ))
        ) : (
          <Text style={styles.dashboardEmptyText}>لا توجد طلبات مرسلة</Text>
        )
      ) : null}
    </DoctorSection>
  );
}

// =============================================================================
// Main Dashboard Screen
// =============================================================================

export default function DoctorDashboardScreen() {
  const me = useQuery(api.users.me, {});
  const homeData = useQuery(api.bookings.getHomeDataDoctor, {});
  const acceptedClinic = useQuery(api.clinicMemberships.getMyAcceptedClinic, {}) as ClinicMembershipCard | null | undefined;
  const doctorInvites = useQuery(api.clinicMemberships.listMyDoctorInvites, {}) as ClinicMembershipCard[] | undefined;
  const doctorRequests = useQuery(api.clinicMemberships.listMyDoctorRequests, {}) as ClinicMembershipCard[] | undefined;
  const markCompleted = useMutation(api.bookings.markCompleted);
  const markNoShow = useMutation(api.bookings.markNoShow);
  const cancelBooking = useMutation(api.bookings.cancel);
  const updateDoctorNote = useMutation(api.bookings.updateDoctorNote);
  const requestToJoinClinic = useMutation(api.clinicMemberships.requestToJoinClinic);
  const acceptMembership = useMutation(api.clinicMemberships.accept);
  const rejectMembership = useMutation(api.clinicMemberships.reject);
  const cancelMembership = useMutation(api.clinicMemberships.cancel);
  const leaveClinic = useMutation(api.clinicMemberships.leaveClinic);

  // ── State ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [clinicSearchText, setClinicSearchText] = useState('');
  const [membershipMode, setMembershipMode] = useState<ClinicMembershipMode>('search');
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);

  const { results: clinicSearchResults } = usePaginatedQuery(
    api.clinics.listPublic,
    {
      search: clinicSearchText.trim() || undefined,
    },
    { initialNumItems: 12 },
  );

  // ── Derived values ─────────────────────────────────────────────────────
  const todayArabic = useMemo(() => formatTodayArabic(), []);
  const doctorName =
    me?.role === 'doctor' ? (me.fullName ?? 'الطبيب') : 'الطبيب';
  const doctorTitleName = stripArabicDoctorTitle(doctorName);
  const appointments = useMemo(
    () =>
      ((homeData?.todayAppointments ?? []) as ConvexDoctorBooking[]).map(
        toDashboardAppointment,
      ),
    [homeData?.todayAppointments],
  );

  const metricItems = useMemo((): MetricItem[] => [
    {
      label: 'اليوم',
      value: homeData?.todayStats.total ?? 0,
      icon: 'calendar',
      tone: 'info',
    },
    {
      label: 'في الانتظار',
      value: homeData?.todayStats.confirmed ?? 0,
      icon: 'checkmark-circle',
      tone: 'warning',
    },
    {
      label: 'مكتمل',
      value: homeData?.todayStats.completed ?? 0,
      icon: 'checkmark-done',
      tone: 'neutral',
    },
    {
      label: 'ملغى',
      value: homeData?.todayStats.cancelled ?? 0,
      icon: 'close-circle',
      tone: 'danger',
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
  const clinics = (clinicSearchResults ?? []) as ClinicSearchCard[];

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

  const handleCancelAppointment = useCallback(
    async (appointmentId: Id<'bookings'>, reason: string) => {
      await cancelBooking({
        bookingId: appointmentId,
        cancellationReason: reason,
      });
      setSelectedAppointment((prev) =>
        prev?.id === appointmentId
          ? {
              ...prev,
              status: 'cancelled' as AppointmentStatus,
              cancelledBy: 'doctor',
              cancellationReason: reason,
            }
          : prev,
      );
    },
    [cancelBooking],
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

  const handleRequestClinic = useCallback(async (clinicId: Id<'clinics'>) => {
    try {
      setActiveClinicId(clinicId);
      await requestToJoinClinic({ clinicId });
      setMembershipMode('requests');
    } catch (error) {
      Alert.alert('تعذر إرسال الطلب', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveClinicId(null);
    }
  }, [requestToJoinClinic]);

  const handleAcceptInvite = useCallback(async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await acceptMembership({ membershipId });
      setMembershipMode('search');
    } catch (error) {
      Alert.alert('تعذر قبول الدعوة', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  }, [acceptMembership]);

  const handleRejectInvite = useCallback(async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await rejectMembership({ membershipId });
    } catch (error) {
      Alert.alert('تعذر رفض الدعوة', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  }, [rejectMembership]);

  const handleCancelRequest = useCallback(async (membershipId: Id<'clinicMemberships'>) => {
    try {
      setActiveMembershipId(membershipId);
      await cancelMembership({ membershipId });
    } catch (error) {
      Alert.alert('تعذر إلغاء الطلب', getArabicError(error, 'حاول مرة أخرى.'));
    } finally {
      setActiveMembershipId(null);
    }
  }, [cancelMembership]);

  const handleLeaveClinic = useCallback(async () => {
    Alert.alert(
      'مغادرة العيادة',
      'سيتم إلغاء المواعيد المستقبلية المرتبطة بعضويتك في هذه العيادة.',
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'مغادرة',
          style: 'destructive',
          onPress: async () => {
            try {
              setActiveMembershipId('leave-clinic');
              await leaveClinic({});
            } catch (error) {
              Alert.alert('تعذر مغادرة العيادة', getArabicError(error, 'حاول مرة أخرى.'));
            } finally {
              setActiveMembershipId(null);
            }
          },
        },
      ],
    );
  }, [leaveClinic]);

  // ── Render today appointment item ──────────────────────────────────────
  const renderTodayItem = useCallback(
    ({ item }: ListRenderItemInfo<DashboardAppointment>) => (
      <AppointmentWorkItem
        time={item.appointmentTime}
        patientName={item.patientName}
        meta={VISIT_TYPE_LABELS[item.visitType]}
        statusLabel={STATUS_CONFIG[item.status].label}
        tone={getStatusTone(item.status)}
        showIcon={false}
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
        <DoctorHeader
          title={`د. ${doctorTitleName}`}
          titleContent={
            <View style={styles.dashboardGreetingBlock}>
              <Text style={styles.dashboardGreetingHello}>مرحباً</Text>
              <Text style={styles.dashboardGreetingName} numberOfLines={1}>
                د. {doctorTitleName}
              </Text>
            </View>
          }
          icon="pulse-outline"
        />

        <View style={styles.dashboardDatePanel}>
          <View style={styles.dashboardDatePill}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={theme.colors.official}
            />
            <Text style={styles.dashboardDatePillText}>{todayArabic}</Text>
          </View>
        </View>

        <MetricStrip items={metricItems} columns={2} />

        {acceptedClinic === null ? (
          <DoctorClinicMembershipPanel
            mode={membershipMode}
            onModeChange={setMembershipMode}
            searchText={clinicSearchText}
            onSearchTextChange={setClinicSearchText}
            clinics={clinics}
            acceptedClinic={acceptedClinic}
            invites={doctorInvites ?? []}
            requests={doctorRequests ?? []}
            activeClinicId={activeClinicId}
            activeMembershipId={activeMembershipId}
            onRequestClinic={handleRequestClinic}
            onAcceptInvite={handleAcceptInvite}
            onRejectInvite={handleRejectInvite}
            onCancelRequest={handleCancelRequest}
            onLeaveClinic={handleLeaveClinic}
          />
        ) : null}

        <DoctorSection
          title="المريض القادم"
          subtitle="أول موعد في الانتظار يحتاج انتباهك الآن"
        >
          {nextAppointment ? (
            <AppointmentWorkItem
              time={nextAppointment.appointmentTime}
              patientName={nextAppointment.patientName}
              meta={VISIT_TYPE_LABELS[nextAppointment.visitType]}
              statusLabel={STATUS_CONFIG[nextAppointment.status].label}
              tone={getStatusTone(nextAppointment.status)}
              icon="person-circle-outline"
              showIcon={false}
              onPress={() => openDetailModal(nextAppointment)}
            />
          ) : (
            <View style={styles.emptyNextPatient}>
              <Ionicons name="checkmark-done-circle" size={32} color={theme.colors.success} />
              <Text style={styles.emptyNextPatientText}>
                لا يوجد مرضى في الانتظار
              </Text>
            </View>
          )}
        </DoctorSection>

        <DoctorSection
          title="قائمة مرضى اليوم"
          subtitle="المواعيد في الانتظار والمكتملة مرتبة حسب الوقت"
        >
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
            <TodayPatientsEmptyState />
          )}
        </DoctorSection>

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
        onCancelAppointment={handleCancelAppointment}
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
  dashboardDatePanel: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dashboardDatePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dashboardDatePillText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.official,
    textAlign: rtlTextAlign(),
  },
  dashboardGreetingBlock: {
    minWidth: 0,
    gap: 2,
  },
  dashboardGreetingHello: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.76)',
    textAlign: rtlTextAlign(),
  },
  dashboardGreetingName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    lineHeight: 29,
    color: theme.colors.white,
    textAlign: rtlTextAlign(),
  },
  dashboardSearchBar: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  clinicMembershipCard: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  clinicMembershipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  clinicMembershipCopy: {
    flex: 1,
    minWidth: 0,
  },
  clinicMembershipTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  clinicMembershipSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  clinicMembershipMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  clinicMembershipActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  dashboardEmptyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginTop: theme.spacing.sm,
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
    marginEnd: theme.spacing.md,
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
    marginStart: theme.spacing.xs,
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
    marginStart: theme.spacing.sm,
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
    marginStart: theme.spacing.sm,
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
  todayEmptyPanel: {
    minHeight: 132,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  todayEmptyIconFrame: {
    width: 46,
    height: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.status.success.background,
    borderWidth: 1,
    borderColor: theme.colors.status.success.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayEmptyCopy: {
    flex: 1,
    minWidth: 0,
  },
  todayEmptyTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },
  todayEmptySubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  todayEmptyPill: {
    minHeight: 30,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.status.neutral.background,
    borderWidth: 1,
    borderColor: theme.colors.status.neutral.border,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  todayEmptyPillText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.status.neutral.text,
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
    marginEnd: theme.spacing.md,
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
    marginStart: theme.spacing.xs,
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
    marginStart: theme.spacing.md,
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
  modalActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
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
    marginStart: theme.spacing.sm,
  },
  modalCancelActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
  },
  modalCancelActionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.danger,
    marginStart: theme.spacing.sm,
  },
  modalCancelReasonPanel: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.status.danger.border,
    backgroundColor: theme.colors.status.danger.background,
    padding: theme.spacing.md,
  },
  modalCancelReasonTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.status.danger.text,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },
  modalCancelReasonSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.sm,
  },
  modalCancelReasonInput: {
    minHeight: 84,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.status.danger.border,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  modalCancelReasonActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modalCancelReasonButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
  },
  modalCancelReasonSecondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalCancelReasonDanger: {
    backgroundColor: theme.colors.danger,
  },
  modalCancelReasonDisabled: {
    opacity: 0.5,
  },
  modalCancelReasonSecondaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  modalCancelReasonDangerText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
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
    marginStart: theme.spacing.sm,
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
    marginStart: theme.spacing.sm,
  },
  modalNoteSaveTextSaved: {
    color: theme.colors.success,
  },
});
