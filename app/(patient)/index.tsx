// @ts-nocheck
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
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
import AppAvatar from '@/components/AppAvatar';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import DoctorCard, { DoctorCardData } from '@/components/DoctorCard';
import EmptyState from '@/components/EmptyState';
import SpecialtyGrid, { SpecialtyItem } from '@/components/SpecialtyGrid';
import { DoctorHeader } from '@/components/doctor-ui';
import { LoadingState, Panel } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { getClinicMapUrl } from '@/lib/clinicMapLink';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Constants
// =============================================================================

const POPULAR_SPECIALTY_NAMES = [
  'استشارة عامة',
  'الأسنان',
  'القلب',
  'العيون',
  'الجلدية',
  'الأطفال',
  'النساء',
  'جراحة العظام',
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
  if (nameAr.includes('أنف') || nameAr.includes('أذن')) return 'person-outline';
  if (nameAr.includes('أعصاب')) return 'pulse-outline';
  if (nameAr.includes('أسنان')) return 'briefcase-outline';

  return 'person-outline';
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
  clinicMapUrl: string | null;
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

function formatArabicDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayName = ARABIC_DAYS[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy} - ${dayName}`;
}

function getArabicTimePeriod(timeStr: string): string {
  const [hourText] = timeStr.split(':');
  const hour = Number(hourText);
  return hour >= 12 ? 'مساءً' : 'صباحاً';
}

function getAppointmentDateParts(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: ARABIC_MONTHS[date.getMonth()],
    year: String(date.getFullYear()),
  };
}

function getAppointmentClinicMapUrl(appointment: {
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinic?: {
    name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mapUrl?: string | null;
  } | null;
}): string | null {
  const savedMapUrl = appointment.clinic
    ? getClinicMapUrl({
        latitude: appointment.clinic.latitude ?? undefined,
        longitude: appointment.clinic.longitude ?? undefined,
        mapUrl: appointment.clinic.mapUrl,
      })
    : null;

  if (savedMapUrl) return savedMapUrl;

  const query = [
    appointment.clinicName,
    appointment.clinic?.name,
    appointment.clinicAddress,
    appointment.clinic?.address,
  ]
    .filter((value): value is string => !!value?.trim())
    .join(' ');

  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
}) => {
  const appointmentDateLabel = formatArabicDate(appointment.appointmentDate);
  const clinicDisplayName = appointment.clinicName?.trim() || 'المختص ليس في مركز';
  const handleOpenClinicLocation = useCallback(() => {
    if (!appointment.clinicMapUrl) return;

    Linking.openURL(appointment.clinicMapUrl).catch(() => {
      Alert.alert(
        'تعذر فتح الموقع',
        'لم نتمكن من فتح موقع المركز على خرائط Google.',
      );
    });
  }, [appointment.clinicMapUrl]);

  return (
    <View style={styles.upcomingCard}>
      <Panel elevated style={styles.upcomingPanel}>
        <Pressable
          style={({ pressed }) => [
            styles.upcomingAppointmentBody,
            pressed && styles.upcomingCardPressed,
          ]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`موعدك القادم مع ${appointment.doctorName}`}
        >
          <View style={styles.upcomingStatusRow}>
            <View style={styles.upcomingStatus}>
              <Ionicons name="checkmark-circle" size={15} color={theme.colors.status.success.text} />
              <Text style={styles.upcomingStatusText}>موعد مؤكد</Text>
            </View>
            <Text style={styles.upcomingHint}>اضغط لعرض تفاصيل الموعد</Text>
          </View>

          <View style={styles.upcomingDoctorRow}>
            <AppAvatar name={appointment.doctorName} size={52} />
            <View style={styles.upcomingDoctorCopy}>
              <Text style={styles.upcomingDoctorEyebrow}>المختص</Text>
              <Text style={styles.upcomingDoctorName}>{appointment.doctorName}</Text>
              <Text style={styles.upcomingSpecialty}>{appointment.specialty}</Text>
            </View>
          </View>

          <View style={styles.upcomingScheduleRow}>
            <View style={styles.upcomingScheduleItem}>
              <Ionicons name="calendar-outline" size={17} color={theme.colors.primary} />
              <View style={styles.upcomingScheduleCopy}>
                <Text style={styles.upcomingDetailLabel}>التاريخ</Text>
                <Text style={styles.upcomingDetailValue}>{appointmentDateLabel}</Text>
              </View>
            </View>
            <View style={styles.upcomingScheduleDivider} />
            <View style={styles.upcomingScheduleItem}>
              <Ionicons name="time-outline" size={17} color={theme.colors.primary} />
              <View style={styles.upcomingScheduleCopy}>
                <Text style={styles.upcomingDetailLabel}>الوقت</Text>
                <Text style={styles.upcomingDetailValue}>{appointment.appointmentTime}</Text>
              </View>
            </View>
          </View>

          <View style={styles.upcomingClinicRow}>
            <Ionicons name="location-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.upcomingClinicName} numberOfLines={1}>
              {clinicDisplayName}
            </Text>
          </View>
        </Pressable>

        {appointment.clinicMapUrl ? (
          <Pressable
            style={({ pressed }) => [
              styles.upcomingLocationButton,
              pressed && styles.upcomingLocationButtonPressed,
            ]}
            onPress={handleOpenClinicLocation}
            accessibilityRole="button"
            accessibilityLabel="فتح موقع المركز على خرائط Google"
          >
            <Ionicons
              name="navigate-outline"
              size={17}
              color={theme.colors.official}
            />
            <Text style={styles.upcomingLocationButtonText}>موقع المركز</Text>
          </Pressable>
        ) : null}
      </Panel>
    </View>
  );
};

interface UpcomingAppointmentModalProps {
  appointment: UpcomingAppointment | null;
  visible: boolean;
  onClose: () => void;
}

const UpcomingAppointmentModal: React.FC<UpcomingAppointmentModalProps> = ({
  appointment,
  visible,
  onClose,
}) => {
  if (!appointment) return null;

  const timePeriod = getArabicTimePeriod(appointment.appointmentTime);
  const dateParts = getAppointmentDateParts(appointment.appointmentDate);
  const clinicDisplayName = appointment.clinicName?.trim() || 'المختص ليس في مركز';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.ticketModalOverlay}>
        <Pressable
          style={styles.ticketModalBackdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="إغلاق تفاصيل الموعد"
        />
        <View style={styles.ticketModalShell}>
          <View style={styles.ticketModalHeader}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="إغلاق تفاصيل الموعد"
              style={({ pressed }) => [
                styles.ticketModalCloseButton,
                pressed && styles.ticketModalCloseButtonPressed,
              ]}
            >
              <Ionicons name="close" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.ticketCard}>
            <View style={styles.ticketTopRow}>
              <View style={styles.ticketDateRail}>
                <Text style={styles.ticketDateDay}>{dateParts.day}</Text>
                <Text style={styles.ticketDateMonth}>{dateParts.month}</Text>
                <Text style={styles.ticketDateYear}>{dateParts.year}</Text>
                <View style={styles.ticketDateDivider} />
                <Text style={styles.ticketTimeValue}>{appointment.appointmentTime}</Text>
                <Text style={styles.ticketTimePeriod}>{timePeriod}</Text>
              </View>

              <View style={styles.ticketMainBody}>
                <View style={styles.ticketDoctorRow}>
                  <View style={styles.ticketDoctorAvatar}>
                    <Ionicons
                      name="person-outline"
                      size={30}
                      color={theme.colors.official}
                    />
                  </View>

                  <View style={styles.ticketDoctorCopy}>
                    <Text style={styles.ticketDoctorLabel}>المختص</Text>
                    <Text style={styles.ticketDoctorName}>
                      {appointment.doctorName}
                    </Text>
                  </View>
                </View>

                <View style={styles.ticketInfoBlock}>
                  <View style={styles.ticketInlineRow}>
                    <View style={styles.ticketInlineIcon}>
                      <Ionicons
                        name="briefcase-outline"
                        size={16}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.ticketInlineCopy}>
                      <Text style={styles.ticketInlineLabel}>التخصص</Text>
                      <Text style={styles.ticketInlineValue}>{appointment.specialty}</Text>
                    </View>
                  </View>

                  <View style={styles.ticketInlineRow}>
                    <View style={styles.ticketInlineIcon}>
                      <Ionicons
                        name="business-outline"
                        size={16}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.ticketInlineCopy}>
                      <Text style={styles.ticketInlineLabel}>المركز</Text>
                      <Text style={styles.ticketInlineValue}>{clinicDisplayName}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.ticketFooter}>
              <View style={styles.ticketFooterCopy}>
                <View style={styles.ticketReminderRow}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={theme.colors.official}
                  />
                  <Text style={styles.ticketReminderText}>
                    يرجى الحضور قبل 15 دقيقة من الموعد
                  </Text>
                </View>
              </View>

              <View style={styles.ticketQrPanel}>
                <View style={styles.ticketQrPlaceholder}>
                  <Ionicons
                    name="qr-code-outline"
                    size={42}
                    color={theme.colors.textMuted}
                  />
                </View>
                <Text style={styles.ticketQrLabel}>مكان رمز QR</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// Mapping helpers
// =============================================================================

type HomeDoctorCard = DoctorCardData & { specialtyId: string };

function publicDoctorToHomeCard(item: {
  _id: string;
  specialtyId: string;
  user: { fullNameAr?: string | null; fullName?: string | null };
  specialty: { nameAr?: string; name?: string };
  wilaya?: { nameAr?: string } | null;
  avgRating: number;
  totalReviews: number;
  isVerified: boolean;
  nextAvailableInDays?: number | null;
}): HomeDoctorCard {
  return {
    id: item._id,
    specialtyId: item.specialtyId,
    fullNameAr: item.user.fullNameAr ?? item.user.fullName ?? '',
    specialty: { nameAr: item.specialty.nameAr ?? item.specialty.name ?? '' },
    avgRating: item.avgRating,
    totalReviews: item.totalReviews,
    wilaya: { nameAr: item.wilaya?.nameAr ?? '' },
    isVerified: item.isVerified,
    avatarUrl: null,
    nextAvailableInDays: item.nextAvailableInDays ?? null,
  };
}

function normalizeSpecialtyName(value: string) {
  return value
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// Main Home Screen
// =============================================================================

export default function PatientHomeScreen() {
  const router = useRouter();
  const [isUpcomingModalVisible, setIsUpcomingModalVisible] = useState(false);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | null>(null);

  // ── Convex queries ──────────────────────────────────────────────────────
  const me = useQuery(api.users.me, {});
  const homeData = useQuery(api.bookings.getHomeData, {});
  const specialtiesQuery = useQuery(api.specialties.list, {});
  const { results: nearbyDoctorResults, status: nearbyDoctorsStatus } = usePaginatedQuery(
    api.doctors.listPublic,
    {},
    { initialNumItems: 6 },
  );

  const isLoading =
    me === undefined ||
    homeData === undefined ||
    specialtiesQuery === undefined ||
    nearbyDoctorsStatus === 'LoadingFirstPage';

  // ── Derived values ─────────────────────────────────────────────────────
  const greeting = useMemo(() => 'مرحباً', []);
  const patientName = me?.fullName ?? me?.fullNameAr ?? 'مستخدم';

  const doctorsNearby: HomeDoctorCard[] = useMemo(
    () => (nearbyDoctorResults ?? []).map(publicDoctorToHomeCard),
    [nearbyDoctorResults],
  );

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
        clinicMapUrl: getAppointmentClinicMapUrl(homeData.nextAppointment),
      };
    }
    return null;
  }, [homeData]);

  // Nearby specialties come first so a tile can filter the visible list in place.
  const specialties: SpecialtyItem[] = useMemo(() => {
    const availableSpecialties = specialtiesQuery ?? [];
    const byId = new Map(availableSpecialties.map((specialty) => [specialty._id, specialty]));
    const nearby = doctorsNearby.flatMap((doctor) => {
      const specialty = byId.get(doctor.specialtyId);
      if (!specialty) return [];
      return [{
        id: specialty._id,
        nameAr: specialty.name,
        icon: getSpecialtyIcon(specialty.name, specialty.icon),
      }];
    });
    const popular = POPULAR_SPECIALTY_NAMES.flatMap((popularName) => {
      const exactMatch = availableSpecialties.find(
        (specialty) => normalizeSpecialtyName(specialty.name) === normalizeSpecialtyName(popularName),
      );
      if (!exactMatch) return [];
      return [{
        id: exactMatch._id,
        nameAr: exactMatch.name,
        icon: getSpecialtyIcon(exactMatch.name, exactMatch.icon),
      }];
    });
    return [...nearby, ...popular]
      .filter((specialty, index, list) =>
        list.findIndex((candidate) => candidate.id === specialty.id) === index,
      )
      .slice(0, 8);
  }, [doctorsNearby, specialtiesQuery]);

  const filteredDoctorsNearby = useMemo(
    () =>
      selectedSpecialtyId
        ? doctorsNearby.filter((doctor) => doctor.specialtyId === selectedSpecialtyId)
        : doctorsNearby,
    [doctorsNearby, selectedSpecialtyId],
  );

  const selectedSpecialty = useMemo(
    () => specialties.find((specialty) => specialty.id === selectedSpecialtyId) ?? null,
    [selectedSpecialtyId, specialties],
  );

  // ── Navigation callbacks ───────────────────────────────────────────────
  const handleSpecialtySelect = useCallback(
    (specialty: SpecialtyItem) => {
      const hasNearbyMatch = doctorsNearby.some(
        (doctor) => doctor.specialtyId === specialty.id,
      );
      if (hasNearbyMatch) {
        setSelectedSpecialtyId((current) =>
          current === specialty.id ? null : specialty.id,
        );
        return;
      }
      router.push(`/(patient)/search?specialty=${encodeURIComponent(specialty.id)}`);
    },
    [doctorsNearby, router],
  );

  const handleAppointmentPress = useCallback(() => {
    setIsUpcomingModalVisible(true);
  }, []);

  const handleCloseUpcomingModal = useCallback(() => {
    setIsUpcomingModalVisible(false);
  }, []);

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
    ({ item }: ListRenderItemInfo<HomeDoctorCard>) => (
      <DoctorCard
        doctor={item}
        isAvailableToday={item.nextAvailableInDays === 0}
        onPress={() => handleDoctorPress(item.id)}
      />
    ),
    [handleDoctorPress],
  );

  const keyExtractorDoctor = useCallback((item: HomeDoctorCard) => item.id, []);

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
        <DoctorHeader
          title={patientName}
          titleContent={
            <View style={styles.dashboardHeroRow}>
              <View style={styles.dashboardHeroIcon}>
                <Ionicons
                  name="person-outline"
                  size={28}
                  color={theme.colors.white}
                />
              </View>
              <View style={styles.dashboardGreetingBlock}>
                <Text style={styles.dashboardGreetingHello}>{greeting}</Text>
                <Text style={styles.dashboardGreetingName} numberOfLines={1}>
                  {patientName}
                </Text>
              </View>
            </View>
          }
          icon={null}
        />

        <Panel style={styles.dashboardIntroPanel}>
          <View style={styles.dashboardIntroRow}>
            <View style={styles.dashboardIntroIcon}>
              <Ionicons
                name="compass-outline"
                size={15}
                color={theme.colors.official}
              />
            </View>
            <Text style={styles.dashboardIntroText}>
              ابحث عن مختص، راجع موعدك القادم، أو ابدأ حجزا جديدا.
            </Text>
          </View>
        </Panel>

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
            subtitle="احجز موعدك مع أحد المختصين لبدء رحلتك"
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
          title={
            selectedSpecialty
              ? `مختصين بالقرب منك - ${selectedSpecialty.nameAr}`
              : 'مختصين بالقرب منك'
          }
          actionLabel={selectedSpecialty ? 'إلغاء التصفية' : 'عرض الكل'}
          onAction={
            selectedSpecialty
              ? () => setSelectedSpecialtyId(null)
              : handleViewAllDoctors
          }
        />
        {filteredDoctorsNearby.length > 0 ? (
          <View style={styles.doctorsListContainer}>
            <FlatList
              data={filteredDoctorsNearby}
              renderItem={renderDoctorItem}
              keyExtractor={keyExtractorDoctor}
              scrollEnabled={false}
              ItemSeparatorComponent={Separator}
            />
          </View>
        ) : (
          <EmptyState
            icon="person-outline"
            title={
              selectedSpecialty
                ? `لا يوجد مختصون قريبون في تخصص ${selectedSpecialty.nameAr}`
                : 'لا يوجد مختصون قريبون'
            }
            subtitle="جرّب البحث لاختيار مختص حسب التخصص أو الولاية"
            action={{
              label: 'ابحث عن مختص',
              onPress: () => {
                if (selectedSpecialty) {
                  router.push(
                    `/(patient)/search?specialty=${encodeURIComponent(selectedSpecialty.id)}`,
                  );
                  return;
                }
                handleViewAllDoctors();
              },
            }}
          />
        )}

        {/* Bottom spacer for safe area */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <UpcomingAppointmentModal
        appointment={upcomingAppointment}
        visible={isUpcomingModalVisible}
        onClose={handleCloseUpcomingModal}
      />
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

  dashboardHeroRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  dashboardGreetingBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'flex-end',
  },
  dashboardGreetingHello: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'right',
  },
  dashboardGreetingName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 28,
    lineHeight: 38,
    color: theme.colors.white,
    textAlign: 'right',
  },
  dashboardHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardIntroPanel: {
    marginHorizontal: theme.spacing.lg,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dashboardIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dashboardIntroIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardIntroText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.official,
    textAlign: rtlTextAlign(),
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
    marginStart: theme.spacing.xs,
  },

  // ─── Upcoming Appointment Card ───────────────────────────────────────────
  upcomingCard: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
  },
  upcomingCardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.992 }],
  },
  upcomingPanel: {
    gap: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  upcomingAppointmentBody: {
    gap: theme.spacing.md,
  },
  upcomingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  upcomingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  upcomingStatusText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.status.success.text,
  },
  upcomingHint: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  upcomingDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  upcomingDoctorAvatar: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.official,
  },
  upcomingDoctorAvatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.white,
  },
  upcomingDoctorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  upcomingDoctorEyebrow: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  upcomingDoctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  upcomingSpecialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  upcomingScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  upcomingScheduleItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  upcomingScheduleDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.borderStrong,
  },
  upcomingScheduleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  upcomingClinicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  upcomingClinicName: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  upcomingDetailLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  upcomingDetailValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  upcomingLocationButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#C7E2F3',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  upcomingLocationButtonPressed: {
    opacity: 0.76,
  },
  upcomingLocationButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.official,
    textAlign: rtlTextAlign(),
  },

  ticketModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  ticketModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  ticketModalShell: {
    width: '100%',
    maxWidth: 430,
    gap: theme.spacing.sm,
    zIndex: 1,
  },
  ticketModalHeader: {
    alignItems: 'flex-start',
  },
  ticketModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketModalCloseButtonPressed: {
    opacity: 0.84,
  },
  ticketCard: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  ticketTopRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'stretch',
  },
  ticketDateRail: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    paddingLeft: theme.spacing.md,
    gap: 2,
  },
  ticketDateDay: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 40,
    lineHeight: 52,
    color: theme.colors.official,
  },
  ticketDateMonth: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.official,
  },
  ticketDateYear: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.official,
  },
  ticketDateDivider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  ticketTimeValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 24,
    color: theme.colors.textPrimary,
  },
  ticketTimePeriod: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  ticketMainBody: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.lg,
  },
  ticketDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  ticketDoctorAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
  },
  ticketDoctorCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  ticketDoctorLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  ticketDoctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 23,
    lineHeight: 33,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  ticketDoctorSpecialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 17,
    lineHeight: 26,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  ticketInfoBlock: {
    gap: theme.spacing.sm,
  },
  ticketInlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  ticketInlineIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    marginTop: 2,
  },
  ticketInlineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ticketInlineLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  ticketInlineValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  ticketFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'stretch',
  },
  ticketQrPanel: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ticketQrPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  ticketQrLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  ticketFooterCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  ticketReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ticketReminderText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },

  // ─── Doctors List ────────────────────────────────────────────────────────
  doctorsListContainer: {
    paddingBottom: theme.spacing.md,
  },
});
