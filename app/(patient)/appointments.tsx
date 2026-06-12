// =============================================================================
// My Appointments Screen
// Route: /(patient)/appointments
// Three tab segments: القادمة (upcoming), السابقة (past), الملغاة (cancelled)
// Each shows a FlatList of AppointmentCard filtered by status.
// RTL layout -- Arabic-first.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';

import { api } from '@/convex/_generated/api';
import AppointmentCard from '@/components/AppointmentCard';
import EmptyState from '@/components/EmptyState';
import { theme } from '@/lib/theme';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import type { AppointmentStatus } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types
// =============================================================================

/** Shape returned by the Convex booking list queries. */
interface ConvexBookingEntry {
  _id: Id<'bookings'>;
  _creationTime: number;
  patientId: Id<'patients'>;
  doctorId: Id<'doctors'>;
  clinicId: Id<'clinics'>;
  profileId: Id<'patientProfiles'> | null;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDuration: number;
  visitType: string;
  reason: string | null;
  patientNote: string | null;
  doctorNote: string | null;
  status: AppointmentStatus;
  cancelledBy: 'patient' | 'doctor' | 'system' | null;
  cancellationReason: string | null;
  confirmedAt: number | null;
  cancelledAt: number | null;
  completedAt: number | null;
  doctorName: string;
  doctorSpecialtyNameFr: string;
  doctorSpecialtyNameAr: string;
  consultationFee: number;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
}

/** Enriched appointment with resolved display names. */
interface EnrichedAppointment {
  id: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  profileId: string | null;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDuration: number;
  visitType: string;
  reason: string;
  patientNote: string | null;
  status: AppointmentStatus;
  cancelledBy: 'patient' | 'doctor' | 'system' | null;
  cancellationReason: string | null;
  createdAt: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
}

interface PendingReviewEntry {
  bookingId: Id<'bookings'>;
  appointmentDate: string;
  appointmentTime: string;
  appointmentDuration: number;
  visitType: string;
  doctorId: Id<'doctors'>;
  doctorName: string;
  clinicId: Id<'clinics'>;
  clinicName: string;
  completedAt?: number;
}

// =============================================================================
// Constants
// =============================================================================

type TabKey = 'upcoming' | 'past' | 'cancelled';

interface TabConfig {
  key: TabKey;
  label: string;
}

const TABS: TabConfig[] = [
  { key: 'upcoming', label: 'القادمة' },
  { key: 'past', label: 'السابقة' },
  { key: 'cancelled', label: 'الملغاة' },
];

const CANCEL_REASONS: { key: string; label: string }[] = [
  { key: 'change_plans', label: 'تغيير في الخطط' },
  { key: 'found_other_doctor', label: 'وجدت طبيباً آخر' },
  { key: 'transport_issue', label: 'مشكلة في المواصلات' },
  { key: 'other', label: 'سبب آخر' },
];

const EMPTY_MESSAGES: Record<
  TabKey,
  { icon: string; title: string; subtitle: string }
> = {
  upcoming: {
    icon: '📅',
    title: 'لا يوجد مواعيد قادمة',
    subtitle: 'احجز موعداً جديداً مع أحد الأطباء',
  },
  past: {
    icon: '📋',
    title: 'لا يوجد مواعيد سابقة',
    subtitle: 'سجل مواعيدك السابقة سيظهر هنا',
  },
  cancelled: {
    icon: '🚫',
    title: 'لا يوجد مواعيد ملغاة',
    subtitle: 'المواعيد التي تم إلغاؤها ستظهر هنا',
  },
};

// =============================================================================
// Helpers
// =============================================================================

function getTodayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Format a YYYY-MM-DD string to a short Arabic date for display. */
function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.toLocaleDateString('ar-SA', { weekday: 'short' });
    const num = d.getDate();
    const month = d.toLocaleDateString('ar-SA', { month: 'short' });
    return `${day} ${num} ${month}`;
  } catch {
    return dateStr;
  }
}

// =============================================================================
// Filter + sort functions per tab
// =============================================================================

function filterUpcoming(items: EnrichedAppointment[]): EnrichedAppointment[] {
  const today = getTodayDateStr();
  return items
    .filter((a) => a.status === 'confirmed' && a.appointmentDate >= today)
    .sort((a, b) => {
      const dc = a.appointmentDate.localeCompare(b.appointmentDate);
      if (dc !== 0) return dc;
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });
}

function filterPast(items: EnrichedAppointment[]): EnrichedAppointment[] {
  return items
    .filter((a) => a.status === 'completed')
    .sort((a, b) => {
      const dc = b.appointmentDate.localeCompare(a.appointmentDate);
      if (dc !== 0) return dc;
      return b.appointmentTime.localeCompare(a.appointmentTime);
    });
}

function filterCancelled(items: EnrichedAppointment[]): EnrichedAppointment[] {
  return items
    .filter((a) => a.status === 'cancelled')
    .sort((a, b) => {
      const dc = b.appointmentDate.localeCompare(a.appointmentDate);
      if (dc !== 0) return dc;
      return b.appointmentTime.localeCompare(a.appointmentTime);
    });
}

const FILTER_MAP: Record<
  TabKey,
  (items: EnrichedAppointment[]) => EnrichedAppointment[]
> = {
  upcoming: filterUpcoming,
  past: filterPast,
  cancelled: filterCancelled,
};

/** Map a Convex booking entry to the EnrichedAppointment shape used by the UI. */
function toEnrichedAppointment(item: ConvexBookingEntry): EnrichedAppointment {
  return {
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    clinicId: item.clinicId,
    profileId: item.profileId ?? null,
    appointmentDate: item.appointmentDate,
    appointmentTime: item.appointmentTime,
    appointmentDuration: item.appointmentDuration,
    visitType: item.visitType,
    reason: item.reason ?? '',
    patientNote: item.patientNote ?? null,
    status: item.status,
    cancelledBy: item.cancelledBy ?? null,
    cancellationReason: item.cancellationReason ?? null,
    createdAt: new Date(item._creationTime).toISOString(),
    doctorName: item.doctorName,
    specialty: item.doctorSpecialtyNameAr,
    clinicName: item.clinicName,
  };
}

// =============================================================================
// Cancel Modal
// =============================================================================

interface CancelModalProps {
  visible: boolean;
  appointmentName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function CancelModal({
  visible,
  appointmentName,
  loading,
  onClose,
  onConfirm,
}: CancelModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherDetails, setOtherDetails] = useState('');

  React.useEffect(() => {
    if (visible) {
      setSelectedReason(null);
      setOtherDetails('');
    }
  }, [visible]);

  const isConfirmDisabled =
    !selectedReason ||
    (selectedReason === 'other' && !otherDetails.trim()) ||
    loading;

  const handleConfirm = useCallback(() => {
    if (!selectedReason) return;
    const matched = CANCEL_REASONS.find((r) => r.key === selectedReason);
    let fullReason = selectedReason;
    if (selectedReason === 'other') {
      fullReason = otherDetails.trim();
    } else if (matched) {
      fullReason = matched.label;
    }
    onConfirm(fullReason);
  }, [selectedReason, otherDetails, onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Title */}
          <Text style={styles.modalTitle}>اختر سبب الإلغاء</Text>
          <Text style={styles.modalAppointmentName}>
            {appointmentName}
          </Text>

          {/* Reason options */}
          {CANCEL_REASONS.map((reason) => {
            const isSelected = selectedReason === reason.key;
            return (
              <Pressable
                key={reason.key}
                style={[
                  styles.reasonOption,
                  isSelected && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={reason.label}
              >
                <View style={styles.radioOuter}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
              </Pressable>
            );
          })}

          {/* Free-text input for "سبب آخر" */}
          {selectedReason === 'other' && (
            <TextInput
              style={styles.otherInput}
              placeholder="اذكر السبب..."
              placeholderTextColor={theme.colors.textSecondary}
              value={otherDetails}
              onChangeText={setOtherDetails}
              textAlign="right"
              textAlignVertical="top"
              multiline
              maxLength={200}
            />
          )}

          {/* Action buttons */}
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonSecondary,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="رجوع"
            >
              <Text style={styles.modalButtonSecondaryText}>رجوع</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonDanger,
                isConfirmDisabled && styles.modalButtonDisabled,
                pressed && !isConfirmDisabled && styles.modalButtonPressed,
              ]}
              onPress={handleConfirm}
              disabled={isConfirmDisabled}
              accessibilityRole="button"
              accessibilityLabel="إلغاء الموعد"
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.modalButtonDangerText}>إلغاء الموعد</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ReviewModalProps {
  visible: boolean;
  appointmentName: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string, isAnonymous: boolean) => void;
}

function ReviewModal({
  visible,
  appointmentName,
  loading,
  onClose,
  onSubmit,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setRating(5);
      setComment('');
      setIsAnonymous(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>قيم الطبيب</Text>
          <Text style={styles.modalAppointmentName}>{appointmentName}</Text>

          <View style={styles.ratingPicker}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isSelected = star <= rating;
              return (
                <Pressable
                  key={star}
                  style={({ pressed }) => [
                    styles.starButton,
                    pressed && styles.starButtonPressed,
                  ]}
                  onPress={() => setRating(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} نجوم`}
                >
                  <Text
                    style={[
                      styles.starText,
                      isSelected && styles.starTextSelected,
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={styles.reviewInput}
            placeholder="اكتب ملاحظتك للطبيب..."
            placeholderTextColor={theme.colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            textAlign="right"
            textAlignVertical="top"
            multiline
            maxLength={500}
            editable={!loading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.anonymousOption,
              isAnonymous && styles.anonymousOptionSelected,
              pressed && styles.modalButtonPressed,
            ]}
            onPress={() => setIsAnonymous((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isAnonymous }}
            accessibilityLabel="إرسال التقييم بدون إظهار الاسم"
          >
            <View
              style={[
                styles.checkbox,
                isAnonymous && styles.checkboxSelected,
              ]}
            >
              {isAnonymous ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.anonymousText}>إرسال بدون إظهار الاسم</Text>
          </Pressable>

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonSecondary,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={onClose}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="إلغاء"
            >
              <Text style={styles.modalButtonSecondaryText}>إلغاء</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonPrimary,
                pressed && !loading && styles.modalButtonPressed,
                loading && styles.modalButtonDisabled,
              ]}
              onPress={() => onSubmit(rating, comment, isAnonymous)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="إرسال التقييم"
            >
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>إرسال التقييم</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function AppointmentsScreen() {
  const router = useRouter();

  // ── Local state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<EnrichedAppointment | null>(
    null,
  );
  const [reviewTarget, setReviewTarget] = useState<EnrichedAppointment | null>(
    null,
  );

  // ── Data fetching via Convex ─────────────────────────────────────────────
  const upcomingQuery = useQuery(api.bookings.listMyUpcoming);
  const pastQuery = useQuery(api.bookings.listMyPast);
  const cancelledQuery = useQuery(api.bookings.listMyCancelled);
  const pendingReviewsQuery = useQuery(api.reviews.getMyPending, {});

  const isLoading =
    upcomingQuery === undefined ||
    pastQuery === undefined ||
    cancelledQuery === undefined ||
    pendingReviewsQuery === undefined;

  // ── Merge all three lists into one enriched array ────────────────────────
  const allAppointments: EnrichedAppointment[] = useMemo(() => {
    const upcoming = (upcomingQuery ?? []) as ConvexBookingEntry[];
    const past = (pastQuery ?? []) as ConvexBookingEntry[];
    const cancelled = (cancelledQuery ?? []) as ConvexBookingEntry[];
    return [...upcoming, ...past, ...cancelled].map(toEnrichedAppointment);
  }, [upcomingQuery, pastQuery, cancelledQuery]);

  // ── Derived: filtered items for active tab ───────────────────────────────
  const filteredItems = useMemo(
    () => FILTER_MAP[activeTab](allAppointments),
    [activeTab, allAppointments],
  );

  const pendingReviewBookingIds = useMemo(() => {
    const pending = (pendingReviewsQuery ?? []) as PendingReviewEntry[];
    return new Set(pending.map((entry) => entry.bookingId));
  }, [pendingReviewsQuery]);

  // ── Cancel mutation ─────────────────────────────────────────────────────
  const cancelBooking = useMutation(api.bookings.cancel);
  const createReview = useMutation(api.reviews.create);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const handleRefresh = useCallback(() => {
    // Conquez useQuery auto-refetches; no manual refetch needed.
    // This keeps the RefreshControl working as a visual trigger.
  }, []);

  // Card press: show action sheet with contextual options
  const handleCardPress = useCallback(
    (item: EnrichedAppointment) => {
      const dateStr = formatDateShort(item.appointmentDate);
      const title = `د. ${item.doctorName}`;
      const message = `${dateStr} - ${item.appointmentTime}\n${item.clinicName}`;

      if (item.status === 'confirmed') {
        Alert.alert(title, message, [
          {
            text: 'عرض صفحة الطبيب',
            onPress: () => {
              router.push(
                `/(patient)/doctor/${encodeURIComponent(item.doctorId)}` as any,
              );
            },
          },
          {
            text: 'إلغاء الموعد',
            style: 'destructive',
            onPress: () => setCancelTarget(item),
          },
          {
            text: 'تأجيل الموعد',
            onPress: () => {
              router.push({
                pathname: '/(patient)/booking/datetime',
                params: {
                  doctorId: item.doctorId,
                  clinicId: item.clinicId,
                },
              } as any);
            },
          },
          { text: 'إغلاق', style: 'cancel' },
        ]);
      } else {
        Alert.alert(title, message, [
          { text: 'إغلاق', style: 'cancel' },
        ]);
      }
    },
    [router],
  );

  const handleCancelPress = useCallback(
    (item: EnrichedAppointment) => {
      setCancelTarget(item);
    },
    [],
  );

  const handleConfirmCancel = useCallback(
    (reason: string) => {
      if (!cancelTarget) return;
      setIsCancelling(true);
      cancelBooking({
        bookingId: cancelTarget.id as Id<'bookings'>,
        cancellationReason: reason,
      })
        .then(() => {
          setCancelTarget(null);
        })
        .catch((err: Error) => {
          Alert.alert(
            'خطأ',
            getArabicErrorMessage(
              err,
              'حدث خطأ أثناء إلغاء الموعد. يرجى المحاولة مرة أخرى.',
            ),
          );
        })
        .finally(() => {
          setIsCancelling(false);
        });
    },
    [cancelTarget, cancelBooking],
  );

  const handleReschedule = useCallback(
    (item: EnrichedAppointment) => {
      router.push({
        pathname: '/(patient)/booking/datetime',
        params: {
          doctorId: item.doctorId,
          clinicId: item.clinicId,
        },
      } as any);
    },
    [router],
  );

  const handleBookAgain = useCallback(
    (item: EnrichedAppointment) => {
      router.push({
        pathname: '/(patient)/booking/datetime',
        params: {
          doctorId: item.doctorId,
          clinicId: item.clinicId,
        },
      } as any);
    },
    [router],
  );

  const handleReview = useCallback((item: EnrichedAppointment) => {
    setReviewTarget(item);
  }, []);

  const handleSubmitReview = useCallback(
    (rating: number, comment: string, isAnonymous: boolean) => {
      if (!reviewTarget) return;

      const trimmedComment = comment.trim();
      setIsReviewSubmitting(true);
      createReview({
        bookingId: reviewTarget.id as Id<'bookings'>,
        overallRating: rating,
        punctualityRating: rating,
        diagnosisRating: rating,
        professionalismRating: rating,
        cleanlinessRating: rating,
        isAnonymous,
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      })
        .then(() => {
          setReviewTarget(null);
          Alert.alert('تم إرسال التقييم', 'شكراً لك على مشاركة تجربتك.');
        })
        .catch((err: Error) => {
          Alert.alert(
            'تعذر إرسال التقييم',
            getArabicErrorMessage(
              err,
              'حدث خطأ أثناء إرسال التقييم. يرجى المحاولة مرة أخرى.',
            ),
          );
        })
        .finally(() => {
          setIsReviewSubmitting(false);
        });
    },
    [createReview, reviewTarget],
  );

  // ── Render appointment card ─────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: EnrichedAppointment }) => (
      <AppointmentCard
        appointment={{
          id: item.id,
          patientId: item.patientId,
          doctorId: item.doctorId,
          clinicId: item.clinicId,
          profileId: item.profileId,
          appointmentDate: item.appointmentDate,
          appointmentTime: item.appointmentTime,
          appointmentDuration: item.appointmentDuration,
          visitType: item.visitType as any,
          reason: item.reason,
          patientNote: item.patientNote,
          status: item.status,
          cancelledBy: item.cancelledBy,
          cancellationReason: item.cancellationReason,
          createdAt: item.createdAt,
        }}
        doctorName={item.doctorName}
        specialty={item.specialty}
        clinicName={item.clinicName}
        hasReview={
          item.status === 'completed' && !pendingReviewBookingIds.has(item.id as Id<'bookings'>)
        }
        onPress={() => handleCardPress(item)}
        onCancel={() => handleCancelPress(item)}
        onReschedule={() => handleReschedule(item)}
        onBookAgain={() => handleBookAgain(item)}
        onReview={() => handleReview(item)}
      />
    ),
    [
      handleCardPress,
      handleCancelPress,
      handleReschedule,
      handleBookAgain,
      handleReview,
      pendingReviewBookingIds,
    ],
  );

  const keyExtractor = useCallback(
    (item: EnrichedAppointment) => item.id,
    [],
  );

  // ── Loading state ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>مواعيدي</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المواعيد...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const emptyMessage = EMPTY_MESSAGES[activeTab];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مواعيدي</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Appointment list */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          filteredItems.length === 0
            ? styles.emptyListContainer
            : styles.listContainer
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={emptyMessage.icon}
            title={emptyMessage.title}
            subtitle={emptyMessage.subtitle}
          />
        }
      />

      {/* Cancel reason modal */}
      <CancelModal
        visible={cancelTarget !== null}
        appointmentName={
          cancelTarget ? `د. ${cancelTarget.doctorName}` : ''
        }
        loading={isCancelling}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />

      <ReviewModal
        visible={reviewTarget !== null}
        appointmentName={
          reviewTarget ? `د. ${reviewTarget.doctorName}` : ''
        }
        loading={isReviewSubmitting}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleSubmitReview}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },

  // ── Tab Bar ─────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },

  // ── List ────────────────────────────────────────────────────────────────
  listContainer: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing['4xl'],
  },
  emptyListContainer: {
    flexGrow: 1,
  },

  // ── Loading ─────────────────────────────────────────────────────────────
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },

  // ── Modal ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.xs,
  },
  modalAppointmentName: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginBottom: theme.spacing.xl,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  reasonOptionSelected: {
    backgroundColor: theme.colors.secondary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },
  reasonLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  otherInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 80,
    marginBottom: theme.spacing.lg,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonPressed: {
    opacity: 0.85,
  },
  modalButtonSecondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonSecondaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  modalButtonDanger: {
    backgroundColor: theme.colors.danger,
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonDangerText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
  modalButtonPrimaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  ratingPicker: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  starButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  starButtonPressed: {
    backgroundColor: theme.colors.background,
  },
  starText: {
    fontSize: 32,
    color: theme.colors.border,
  },
  starTextSelected: {
    color: theme.colors.warning,
  },
  reviewInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 96,
    marginBottom: theme.spacing.lg,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  anonymousOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  anonymousOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxMark: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  anonymousText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
