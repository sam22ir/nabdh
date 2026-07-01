import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import DoctorCard, { DoctorCardData } from '@/components/DoctorCard';
import EmptyState from '@/components/EmptyState';
import SpecialtyGrid, { SpecialtyItem } from '@/components/SpecialtyGrid';
import { AppHeader, Badge, LoadingState, Panel, TrustRow } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Constants
// =============================================================================

/** Common specialties for quick access row. */
const POPULAR_SPECIALTIES: SpecialtyItem[] = [
  { id: '1', nameAr: 'عام', icon: 'medical-outline' },
  { id: '2', nameAr: 'أسنان', icon: 'medkit-outline' },
  { id: '3', nameAr: 'قلب', icon: 'fitness-outline' },
  { id: '4', nameAr: 'عيون', icon: 'eye-outline' },
  { id: '5', nameAr: 'جلدية', icon: 'body-outline' },
  { id: '6', nameAr: 'أطفال', icon: 'people-outline' },
  { id: '7', nameAr: 'نساء', icon: 'woman-outline' },
  { id: '8', nameAr: 'عظام', icon: 'walk-outline' },
];

function getSpecialtyIcon(nameAr: string, seedIcon?: string | null): string {
  if (seedIcon && seedIcon in Ionicons.glyphMap) {
    return seedIcon;
  }

  if (nameAr.includes('قلب')) return 'fitness-outline';
  if (nameAr.includes('جلد')) return 'body-outline';
  if (nameAr.includes('أطفال')) return 'people-outline';
  if (nameAr.includes('نساء')) return 'woman-outline';
  if (nameAr.includes('عظام')) return 'walk-outline';
  if (nameAr.includes('عيون')) return 'eye-outline';
  if (nameAr.includes('أنف') || nameAr.includes('أذن')) return 'medical-outline';
  if (nameAr.includes('أعصاب')) return 'pulse-outline';
  if (nameAr.includes('أسنان')) return 'medkit-outline';

  return 'medical-outline';
}

interface UpcomingAppointment extends Omit<Appointment, 'id' | 'profileId' | 'patientNote' | 'reason' | 'cancelledBy' | 'cancellationReason' | 'createdAt'> {
  id: Id<'bookings'>;
  profileId: Id<'patientProfiles'> | null;
  reason?: string;
  patientNote?: string;
  status: AppointmentStatus;
  cancelledBy?: 'patient' | 'doctor' | 'system';
  cancellationReason?: string;
  createdAt: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
}

// =============================================================================
// Helpers
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

function formatArabicDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayName = ARABIC_DAYS[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy} - ${dayName}`;
}

/** Compute a greeting based on the current hour. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء الخير';
}

// =============================================================================
// Section Header Component
// =============================================================================

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {actionLabel && onAction ? (
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [
          styles.sectionAction,
          pressed && styles.sectionActionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.sectionActionText}>{actionLabel}</Text>
        <Ionicons
          name="arrow-back"
          size={14}
          color={theme.colors.primary}
          style={styles.sectionActionIcon}
        />
      </Pressable>
    ) : null}
  </View>
);

// =============================================================================
// Upcoming Appointment Card Component
// =============================================================================

interface UpcomingAppointmentCardProps {
  appointment: UpcomingAppointment;
  onPress?: () => void;
}

const UpcomingAppointmentCard: React.FC<UpcomingAppointmentCardProps> = ({
  appointment,
  onPress,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.upcomingCard,
      pressed && styles.upcomingCardPressed,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`موعدك القادم مع الدكتور ${appointment.doctorName}`}
  >
    <Panel style={styles.upcomingPanel}>
      {/* Card header */}
      <View style={styles.upcomingHeader}>
        <View style={styles.upcomingHeaderLeft}>
          <Ionicons name="calendar" size={18} color={theme.colors.primary} />
          <Text style={styles.upcomingHeaderTitle}>موعدك القادم</Text>
        </View>
        <Badge label="مؤكد" tone="success" icon="checkmark-circle-outline" />
      </View>

      {/* Doctor name & specialty */}
      <Text style={styles.upcomingDoctorName}>د. {appointment.doctorName}</Text>
      <Text style={styles.upcomingSpecialty}>{appointment.specialty}</Text>

      {/* Divider */}
      <View style={styles.upcomingDivider} />

      {/* Details row: date, time, clinic */}
      <View style={styles.upcomingDetails}>
        <TrustRow
          icon="calendar-outline"
          label="التاريخ"
          value={formatArabicDate(appointment.appointmentDate)}
        />
        <TrustRow
          icon="time-outline"
          label="الوقت"
          value={appointment.appointmentTime}
        />
        <TrustRow
          icon="location-outline"
          label="العيادة"
          value={appointment.clinicName}
        />
      </View>
    </Panel>
  </Pressable>
);

// =============================================================================
// Mapping helpers
// =============================================================================

/** Map the nearby doctor shape from getHomeData to DoctorCardData. */
function nearbyToDoctorCard(item: {
  doctorId: string;
  doctorName: string;
  specialtyNameAr: string;
  avgRating: number;
  totalReviews: number;
}): DoctorCardData {
  return {
    id: item.doctorId,
    fullNameAr: item.doctorName,
    specialty: { nameAr: item.specialtyNameAr },
    avgRating: item.avgRating,
    totalReviews: item.totalReviews,
    wilaya: { nameAr: '' },
    isVerified: true,
    avatarUrl: null,
  };
}

// =============================================================================
// Main Home Screen
// =============================================================================

export default function PatientHomeScreen() {
  const router = useRouter();

  // ── Convex queries ──────────────────────────────────────────────────────
  const me = useQuery(api.users.me, {});
  const homeData = useQuery(api.bookings.getHomeData, {});

  const isLoading = me === undefined || homeData === undefined;

  // ── Derived values ─────────────────────────────────────────────────────
  const greeting = useMemo(() => getGreeting(), []);
  const patientName = me?.fullNameAr ?? 'مستخدم';

  const doctorsNearby: DoctorCardData[] = useMemo(() => {
    if (homeData?.nearbyDoctors && homeData.nearbyDoctors.length > 0) {
      return homeData.nearbyDoctors.map(nearbyToDoctorCard);
    }
    return [];
  }, [homeData]);

  const upcomingAppointment = useMemo<UpcomingAppointment | null>(() => {
    if (homeData?.nextAppointment) {
      return {
        id: homeData.nextAppointment._id,
        patientId: homeData.nextAppointment.patientId,
        doctorId: homeData.nextAppointment.doctorId,
        clinicId: homeData.nextAppointment.clinicId,
        profileId: homeData.nextAppointment.profileId ?? null,
        appointmentDate: homeData.nextAppointment.appointmentDate,
        appointmentTime: homeData.nextAppointment.appointmentTime,
        appointmentDuration: homeData.nextAppointment.appointmentDuration,
        visitType: homeData.nextAppointment.visitType,
        reason: homeData.nextAppointment.reason ?? '',
        patientNote: homeData.nextAppointment.patientNote ?? null,
        status: homeData.nextAppointment.status,
        cancelledBy: homeData.nextAppointment.cancelledBy ?? null,
        cancellationReason: homeData.nextAppointment.cancellationReason ?? null,
        createdAt: new Date(homeData.nextAppointment._creationTime).toISOString(),
        doctorName: homeData.nextAppointment.doctorName,
        specialty: homeData.nextAppointment.doctorSpecialtyNameAr,
        clinicName: homeData.nextAppointment.clinicName,
      };
    }
    return null;
  }, [homeData]);

  // Build specialties from Convex data, fall back to hardcoded
  const specialties: SpecialtyItem[] = useMemo(() => {
    if (homeData?.commonSpecialties && homeData.commonSpecialties.length > 0) {
      return homeData.commonSpecialties.map((s: any) => ({
        id: s._id,
        nameAr: s.nameAr,
        icon: getSpecialtyIcon(s.nameAr, s.icon),
      }));
    }
    return POPULAR_SPECIALTIES;
  }, [homeData]);

  // ── Navigation callbacks ───────────────────────────────────────────────
  const handleSpecialtySelect = useCallback(
    (specialty: SpecialtyItem) => {
      router.push(`/(patient)/search?specialty=${encodeURIComponent(specialty.id)}`);
    },
    [router],
  );

  const handleAppointmentPress = useCallback(() => {
    router.push('/(patient)/appointments');
  }, [router]);

  const handleDoctorPress = useCallback(
    (doctorId: string) => {
      router.push(`/(patient)/doctor/${encodeURIComponent(doctorId)}`);
    },
    [router],
  );

  const handleViewAllDoctors = useCallback(() => {
    router.push('/(patient)/search');
  }, [router]);

  const handleViewAllAppointments = useCallback(() => {
    router.push('/(patient)/appointments');
  }, [router]);

  const handleBookAppointment = useCallback(() => {
    router.push('/(patient)/search');
  }, [router]);

  // ── Render doctor item ──────────────────────────────────────────────────
  const renderDoctorItem = useCallback(
    ({ item }: ListRenderItemInfo<DoctorCardData>) => (
      <DoctorCard
        doctor={item}
        isAvailableToday={item.avgRating >= 4.5}
        onPress={() => handleDoctorPress(item.id)}
      />
    ),
    [handleDoctorPress],
  );

  const keyExtractorDoctor = useCallback(
    (item: DoctorCardData) => item.id,
    [],
  );

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="جاري تحميل الصفحة الرئيسية..." />
      </SafeAreaView>
    );
  }

  // ── Main content ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
      >
        <AppHeader
          eyebrow={greeting}
          title={patientName}
          subtitle="ابحث عن طبيب، راجع موعدك القادم، أو ابدأ حجزا جديدا."
          icon="person-circle-outline"
          action={
            <View style={styles.greetingNotification}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={theme.colors.official}
              />
            </View>
          }
        />

        {/* ── Upcoming Appointment Section ─────────────────────── */}
        <SectionHeader
          title="موعدك القادم"
          actionLabel={upcomingAppointment ? 'عرض الكل' : undefined}
          onAction={upcomingAppointment ? handleViewAllAppointments : undefined}
        />
        {upcomingAppointment ? (
          <UpcomingAppointmentCard
            appointment={upcomingAppointment}
            onPress={handleAppointmentPress}
          />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="لا يوجد موعد قادم"
            subtitle="احجز موعدك مع أحد الأطباء لبدء رحلة علاجك"
            action={{ label: 'احجز موعد', onPress: handleBookAppointment }}
          />
        )}

        {/* ── Popular Specialties Section ────────────────────────── */}
        <SectionHeader title="التخصصات الشائعة" />
        <SpecialtyGrid
          specialties={specialties}
          onSelect={handleSpecialtySelect}
        />

        {/* ── Doctors Near You Section ───────────────────────────── */}
        <SectionHeader
          title="أطباء بالقرب منك"
          actionLabel="عرض الكل"
          onAction={handleViewAllDoctors}
        />
        {doctorsNearby.length > 0 ? (
          <View style={styles.doctorsListContainer}>
            <FlatList
              data={doctorsNearby}
              renderItem={renderDoctorItem}
              keyExtractor={keyExtractorDoctor}
              scrollEnabled={false}
              ItemSeparatorComponent={Separator}
            />
          </View>
        ) : (
          <EmptyState
            icon="medical-outline"
            title="لا يوجد أطباء قريبون"
            subtitle="جرّب البحث لاختيار طبيب حسب التخصص أو الولاية"
            action={{ label: 'ابحث عن طبيب', onPress: handleViewAllDoctors }}
          />
        )}

        {/* Bottom spacer for safe area */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// Separator
// =============================================================================

const Separator: React.FC = () => <View style={styles.separator} />;

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
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },
  separator: {
    height: theme.spacing.xs,
  },

  greetingNotification: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Section Header ──────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionActionPressed: {
    opacity: 0.7,
  },
  sectionActionText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.primary,
  },
  sectionActionIcon: {
    marginRight: theme.spacing.xs,
  },

  // ─── Upcoming Appointment Card ───────────────────────────────────────────
  upcomingCard: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
  },
  upcomingCardPressed: {
    opacity: 0.92,
  },
  upcomingPanel: {
    gap: theme.spacing.md,
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  upcomingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingHeaderTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
    marginRight: theme.spacing.sm,
  },
  upcomingDoctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  upcomingSpecialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    textAlign: rtlTextAlign(),
  },
  upcomingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  upcomingDetails: {
    gap: theme.spacing.sm,
  },

  // ─── Doctors List ────────────────────────────────────────────────────────
  doctorsListContainer: {
    paddingBottom: theme.spacing.md,
  },
});
