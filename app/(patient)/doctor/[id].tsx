// =============================================================================
// Doctor Profile Screen
// Route: /(patient)/doctor/[id]
// Displays full doctor profile with clinics, reviews, and booking CTA.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import { routeParamString } from '@/lib/routeParams';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types – mirrors the Convex return shapes
// =============================================================================

/** Clinic info shape from Convex api.doctors.getById. */
interface ConvexClinic {
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
}

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

/** Review shape from Convex api.reviews.listByDoctor. */
interface ConvexReview {
  _id: Id<'reviews'>;
  _creationTime: number;
  doctorId: Id<'doctors'>;
  overallRating: number;
  punctualityRating: number;
  diagnosisRating: number;
  professionalismRating: number;
  cleanlinessRating: number;
  comment?: string;
  isAnonymous: boolean;
  doctorReply?: string;
}

/** Review stats from Convex api.reviews.getStats. */
interface ReviewStats {
  totalCount: number;
  avgOverall: number;
  avgPunctuality: number;
  avgDiagnosis: number;
  avgProfessionalism: number;
  avgCleanliness: number;
  starDistribution: Array<{
    stars: number;
    count: number;
    percentage: number;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const DAY_NAMES_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// =============================================================================
// Helpers
// =============================================================================

/** Extract Arabic initials (first 2 characters) for the avatar placeholder. */
function getInitials(nameAr: string | null): string {
  if (!nameAr) return 'د';
  const parts = nameAr.trim().split(/\s+/);
  if (parts.length === 0) return 'د';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return (parts[0][0] ?? '') + (parts[1][0] ?? '');
}

/** Render 5 star icons for a given average. */
function StarsRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;

  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        let iconName: keyof typeof Ionicons.glyphMap;
        if (star <= full) iconName = 'star';
        else if (star === full + 1 && hasHalf) iconName = 'star-half';
        else iconName = 'star-outline';

        return (
          <Ionicons
            key={star}
            name={iconName}
            size={size}
            color={theme.colors.warning}
            style={styles.starIcon}
          />
        );
      })}
    </View>
  );
}

/** Format an ISO timestamp to an Arabic date string. */
function formatArabicDate(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.toLocaleDateString('ar-SA', { month: 'long' });
    const day = d.getDate();
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '';
  }
}

/** Format consultation_fee (numeric) to Arabic currency string. */
function formatFee(fee: number | null): string {
  if (fee === null || fee === undefined) return '---';
  return `${Number(fee).toLocaleString('ar-SA')} د.ج`;
}

/**
 * Group schedules by matching (start_time, end_time) and produce a
 * human-readable working-days summary.
 */
function summarizeWorkingHours(
  schedules: ConvexSchedule[],
): { dayRange: string; hours: string }[] {
  if (!schedules.length) return [];

  // Sort by day_of_week
  const sorted = [...schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  // Group consecutive days with same hours
  const groups: { days: number[]; hours: string }[] = [];
  for (const s of sorted) {
    const hours = `${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)}`;
    const last = groups[groups.length - 1];
    if (last && last.hours === hours && s.dayOfWeek === (last.days[last.days.length - 1] ?? -1) + 1) {
      last.days.push(s.dayOfWeek);
    } else {
      groups.push({ days: [s.dayOfWeek], hours });
    }
  }

  return groups.map((g) => {
    const dayRange =
      g.days.length === 1
        ? DAY_NAMES_FULL[g.days[0]]
        : `${DAY_NAMES_FULL[g.days[0]]} - ${DAY_NAMES_FULL[g.days[g.days.length - 1]]}`;
    return { dayRange, hours: g.hours };
  });
}

/**
 * Given clinic schedules, compute the next N available time slots.
 * Simplified – returns schedule-based suggestions without full booking overlap check.
 */
function computeNextSlots(
  schedules: ConvexSchedule[],
  limit = 3,
): { clinicId: string; dayName: string; time: string }[] {
  if (!schedules.length) return [];

  const now = new Date();
  const todayDow = now.getDay();

  const candidates: { dayOffset: number; dow: number; clinicId: string; start: string }[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const targetDow = (todayDow + offset) % 7;
    const daySchedules = schedules.filter((s) => s.dayOfWeek === targetDow);
    for (const sc of daySchedules) {
      if (offset === 0 && sc.startTime <= now.toTimeString().slice(0, 5)) continue;
      candidates.push({
        dayOffset: offset,
        dow: targetDow,
        clinicId: sc.clinicId,
        start: sc.startTime.slice(0, 5),
      });
    }
  }

  candidates.sort((a, b) => a.dayOffset - b.dayOffset || a.start.localeCompare(b.start));

  return candidates.slice(0, limit).map((c) => {
    const dayName =
      c.dayOffset === 0 ? 'اليوم' : c.dayOffset === 1 ? 'غداً' : DAY_NAMES_FULL[c.dow];
    return { clinicId: c.clinicId, dayName, time: c.start };
  });
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Doctor Header ───────────────────────────────────────────────────────────

function DoctorHeader({
  fullNameAr,
  specialtyNameAr,
  avgRating,
  totalReviews,
  isVerified,
  isFavorite,
  isFavoriteLoading,
  onToggleFavorite,
}: {
  fullNameAr: string | null;
  specialtyNameAr: string;
  avgRating: number;
  totalReviews: number;
  isVerified: boolean;
  isFavorite: boolean;
  isFavoriteLoading: boolean;
  onToggleFavorite: () => void;
}) {
  const initials = getInitials(fullNameAr);

  return (
    <View style={styles.headerCard}>
      {/* Avatar circle */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Name & specialty */}
      <Text style={styles.doctorName}>{fullNameAr ?? 'طبيب'}</Text>
      <Text style={styles.specialtyText}>{specialtyNameAr}</Text>

      {/* Rating row */}
      <View style={styles.ratingRow}>
        <StarsRow rating={avgRating} size={18} />
        {totalReviews > 0 && (
          <Text style={styles.ratingLabel}>
            {avgRating.toFixed(1)} ({totalReviews})
          </Text>
        )}
      </View>

      {/* Verification badge */}
      {isVerified ? (
        <View style={styles.verifiedBadge}>
          <Ionicons name="shield-checkmark" size={18} color={theme.colors.white} />
          <Text style={styles.verifiedText}>موثق</Text>
        </View>
      ) : (
        <View style={styles.unverifiedBadge}>
          <Ionicons name="warning" size={14} color={theme.colors.warning} />
          <Text style={styles.unverifiedLabel}>غير موثق</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.favoriteToggle,
          isFavorite && styles.favoriteToggleActive,
          pressed && styles.favoriteTogglePressed,
        ]}
        onPress={onToggleFavorite}
        disabled={isFavoriteLoading}
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        accessibilityState={{ disabled: isFavoriteLoading, selected: isFavorite }}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={18}
          color={isFavorite ? theme.colors.danger : theme.colors.primary}
        />
        <Text
          style={[
            styles.favoriteToggleText,
            isFavorite && styles.favoriteToggleTextActive,
          ]}
        >
          {isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Stats Row ───────────────────────────────────────────────────────────────

function StatsRow({
  experienceYears,
  totalReviews,
  patientCount,
}: {
  experienceYears: number | null;
  totalReviews: number;
  patientCount: number;
}) {
  const items: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      label: 'سنوات الخبرة',
      value: experienceYears != null ? `${experienceYears}+` : '---',
      icon: 'medkit-outline',
    },
    {
      label: 'إجمالي التقييمات',
      value: totalReviews > 0 ? `${totalReviews}` : '---',
      icon: 'chatbubbles-outline',
    },
    {
      label: 'المرضى',
      value: patientCount > 0 ? `${patientCount}` : '---',
      icon: 'people-outline',
    },
  ];

  return (
    <View style={styles.statsRow}>
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          {idx > 0 && <View style={styles.statDivider} />}
          <View style={styles.statItem}>
            <Ionicons name={item.icon} size={20} color={theme.colors.primary} />
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── Bio Section ─────────────────────────────────────────────────────────────

function BioSection({ text }: { text: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>نبذة عن الطبيب</Text>
      <Text style={styles.bioText}>{text}</Text>
    </View>
  );
}

// ─── Clinics Section ─────────────────────────────────────────────────────────

function ClinicsSection({
  clinics,
  schedules,
}: {
  clinics: ConvexClinic[];
  schedules: ConvexSchedule[];
}) {
  if (clinics.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>العيادات</Text>
      {clinics.map((clinic) => {
        const clinicSchedules = schedules.filter((s) => s.clinicId === clinic._id);
        const hoursSummary = summarizeWorkingHours(clinicSchedules);

        return (
          <View key={clinic._id} style={styles.clinicCard}>
            <Text style={styles.clinicName}>{clinic.name}</Text>

            {/* Address */}
            <View style={styles.clinicDetailRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.clinicDetailText}>{clinic.address}</Text>
            </View>

            {/* Phone */}
            {clinic.phone && (
              <View style={styles.clinicDetailRow}>
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={theme.colors.textSecondary}
                />
                <Text style={[styles.clinicDetailText, { writingDirection: 'ltr' }]}>
                  {clinic.phone}
                </Text>
              </View>
            )}

            {/* Working hours */}
            {hoursSummary.length > 0 && (
              <View style={styles.hoursContainer}>
                {hoursSummary.map((h, i) => (
                  <View key={i} style={styles.hoursRow}>
                    <Text style={styles.hoursDay}>{h.dayRange}</Text>
                    <Text style={styles.hoursTime}>{h.hours}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Missing days indicator */}
            {clinicSchedules.length < 7 && clinicSchedules.length > 0 && (
              <Text style={styles.closedDayHint}>
                الأيام غير المذكورة: عطلة
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Pricing Section ─────────────────────────────────────────────────────────

function PricingSection({ consultationFee }: { consultationFee: number | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>الأسعار</Text>
      <View style={styles.pricingCard}>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>الكشفية</Text>
          <Text style={styles.pricingValue}>{formatFee(consultationFee)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Reviews Section ─────────────────────────────────────────────────────────

function ReviewsSection({
  reviews,
  distribution,
  totalReviews,
  avgRating,
}: {
  reviews: ConvexReview[];
  distribution: Record<number, number>;
  totalReviews: number;
  avgRating: number;
}) {
  const latestReviews = reviews.slice(0, 3);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>التقييمات</Text>

      {totalReviews === 0 ? (
        <View style={styles.emptyReviews}>
          <Ionicons
            name="star-outline"
            size={40}
            color={theme.colors.border}
          />
          <Text style={styles.emptyReviewsText}>
            لا توجد تقييمات بعد
          </Text>
        </View>
      ) : (
        <>
          {/* Average rating summary */}
          <View style={styles.ratingSummaryCard}>
            <View style={styles.ratingSummaryLeft}>
              <Text style={styles.ratingBig}>{avgRating.toFixed(1)}</Text>
              <StarsRow rating={avgRating} size={14} />
              <Text style={styles.ratingTotalText}>
                {totalReviews} تقييم{totalReviews !== 1 ? 'ات' : ''}
              </Text>
            </View>

            {/* Star distribution bars */}
            <View style={styles.distributionBars}>
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = distribution[star] ?? 0;
                const pct =
                  totalReviews > 0
                    ? Math.round((count / totalReviews) * 100)
                    : 0;
                return (
                  <View key={star} style={styles.distRow}>
                    <Text style={styles.distLabel}>
                      {'★'.repeat(star).padEnd(5, '☆')}
                    </Text>
                    <View style={styles.distBarTrack}>
                      <View
                        style={[
                          styles.distBarFill,
                          { width: `${pct}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.distPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Latest 3 reviews */}
          {latestReviews.map((review) => (
            <View key={review._id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatarSmall}>
                  <Ionicons
                    name="person"
                    size={14}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <View style={styles.reviewAuthorRow}>
                  <Text style={styles.reviewAuthor}>مريض</Text>
                  <StarsRow rating={review.overallRating} size={12} />
                </View>
                <Text style={styles.reviewDate}>
                  {formatArabicDate(new Date(review._creationTime).toISOString())}
                </Text>
              </View>

              {review.comment ? (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              ) : null}
            </View>
          ))}

          {reviews.length > 3 && (
            <Text style={styles.moreReviewsHint}>
              وعرض {reviews.length - 3} تقييمات أخرى...
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ─── Sticky Booking Button ───────────────────────────────────────────────────

function BookingButton({
  doctorId,
  clinics,
  schedules,
}: {
  doctorId: string;
  clinics: ConvexClinic[];
  schedules: ConvexSchedule[];
}) {
  const router = useRouter();

  const nextSlots = useMemo(
    () => computeNextSlots(schedules, 3),
    [schedules],
  );

  const handleBook = () => {
    router.push({
      pathname: '/(patient)/booking/clinic',
      params: { doctorId },
    } as any);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomBarSafe}>
      <View style={styles.bottomBar}>
        {/* Nearest available slots */}
        {nextSlots.length > 0 && (
          <View style={styles.slotsRow}>
            <Text style={styles.slotsLabel}>المواعيد المتاحة:</Text>
            {nextSlots.map((slot, i) => (
              <Pressable
                key={i}
                style={styles.slotChip}
                onPress={handleBook}
              >
                <Text style={styles.slotChipText}>
                  {slot.dayName} {slot.time}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {nextSlots.length === 0 && clinics.length > 0 && (
          <Text style={styles.noSlotsHint}>
            لا توجد مواعيد متاحة حالياً
          </Text>
        )}

        {/* Main CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.bookButton,
            pressed && styles.bookButtonPressed,
          ]}
          onPress={handleBook}
          accessibilityRole="button"
          accessibilityLabel="احجز موعداً"
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={theme.colors.white}
            style={{ marginLeft: 8 }}
          />
          <Text style={styles.bookButtonText}>احجز موعداً</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// =============================================================================
// Loading / Error components
// =============================================================================

function LoadingScreen() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>جاري تحميل الملف الطبي...</Text>
    </View>
  );
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.centerContainer}>
      <Ionicons
        name="alert-circle-outline"
        size={56}
        color={theme.colors.danger}
      />
      <Text style={styles.errorTitle}>عذراً، حدث خطأ</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.retryButton,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}

function NotFoundScreen() {
  return (
    <View style={styles.centerContainer}>
      <Ionicons
        name="person-remove-outline"
        size={56}
        color={theme.colors.textSecondary}
      />
      <Text style={styles.errorTitle}>لم يتم العثور على الطبيب</Text>
      <Text style={styles.errorMessage}>
        قد يكون الحساب غير متاح أو تم حذفه.
      </Text>
    </View>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function DoctorProfileScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = routeParamString(rawId);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // ── Doctor + clinics via single query ─────────────────────────────────────
  const doctorRaw = useQuery(
    api.doctors.getById,
    id ? { doctorId: id as Id<'doctors'> } : 'skip',
  );
  const doctorLoading = doctorRaw === undefined;

  const doctor = doctorRaw as {
    _id: Id<'doctors'>;
    _creationTime: number;
    userId: Id<'users'>;
    specialtyId: Id<'specialties'>;
    subSpecialties: Id<'specialties'>[];
    bioAr: string;
    bioFr: string;
    yearsOfExperience: number;
    languages: string[];
    orderRegistrationNumber: string;
    isVerified: boolean;
    isProfileComplete: boolean;
    consultationFee: number;
    followUpFee: number;
    avgRating: number;
    totalReviews: number;
    user: {
      fullNameAr: string | null;
      phone: string | null;
      fullNameFr: string | null;
      email: string | null;
      image: string | null;
    };
    specialty: {
      nameAr: string;
      nameFr: string;
    };
    clinics: ConvexClinic[];
  } | null | undefined;

  const isFavoriteRaw = useQuery(
    api.doctors.isFavorite,
    id ? { doctorId: id as Id<'doctors'> } : 'skip',
  );
  const me = useQuery(api.users.me, {});
  const toggleFavorite = useMutation(api.doctors.toggleFavorite);

  const handleToggleFavorite = useCallback(async () => {
    if (!id || isTogglingFavorite) return;
    if (me === undefined) return;

    if (!me?.profile) {
      Alert.alert(
        'أكمل ملفك الطبي',
        'يرجى إكمال ملفك الطبي قبل إضافة الطبيب إلى المفضلة.',
      );
      return;
    }

    setIsTogglingFavorite(true);
    try {
      const result = await toggleFavorite({ doctorId: id as Id<'doctors'> });
      if (!result.ok && result.error === 'patient_profile_missing') {
        Alert.alert(
          'أكمل ملفك الطبي',
          'يرجى إكمال ملفك الطبي قبل إضافة الطبيب إلى المفضلة.',
        );
      }
    } catch (error) {
      Alert.alert(
        'تعذر تحديث المفضلة',
        getArabicErrorMessage(
          error,
          'يرجى تسجيل الدخول كمريض ثم المحاولة مرة أخرى.',
        ),
      );
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [id, isTogglingFavorite, me, toggleFavorite]);

  // ── Clinic schedules for all of this doctor's clinics ─────────────────────
  const schedulesRaw = useQuery(
    api.schedules.getByDoctor,
    id ? { doctorId: id as Id<'doctors'> } : 'skip',
  );
  const schedules = (schedulesRaw ?? []) as ConvexSchedule[];

  // ── Reviews stats ────────────────────────────────────────────────────────
  const statsRaw = useQuery(
    api.reviews.getStats,
    id ? { doctorId: id as Id<'doctors'> } : 'skip',
  );
  const stats = statsRaw as ReviewStats | undefined;

  // ── Review list (first 50) ────────────────────────────────────────────────
  const reviewsRaw = useQuery(
    api.reviews.listByDoctor,
    id ? { doctorId: id as Id<'doctors'>, paginationOpts: { numItems: 50, cursor: null } as any } : 'skip',
  );
  const reviews = (reviewsRaw as { page: ConvexReview[] })?.page ?? [];

  // ── Derived state ─────────────────────────────────────────────────────────

  const avgRating = stats?.avgOverall ?? doctor?.avgRating ?? 0;
  const totalReviews = stats?.totalCount ?? doctor?.totalReviews ?? 0;

  const starDistribution = useMemo(() => {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats?.starDistribution) {
      for (const s of stats.starDistribution) {
        dist[s.stars] = s.count;
      }
    }
    return dist;
  }, [stats]);

  // Patient count — use totalReviews as a rough proxy (no dedicated Convex query)
  const patientCount = totalReviews;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!id) {
    return (
      <ErrorScreen
        message="رابط الطبيب غير صالح. يرجى العودة والمحاولة مرة أخرى."
        onRetry={() => {
          // Convex auto-refetches via reactivity.
        }}
      />
    );
  }

  if (doctorLoading) return <LoadingScreen />;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (!doctorRaw && id) {
    return (
      <ErrorScreen
        message="تعذر تحميل معلومات الطبيب. تحقق من اتصالك بالإنترنت."
        onRetry={() => {
          // Convex auto-refetches via reactivity.
        }}
      />
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!doctor) return <NotFoundScreen />;

  // ── Content ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              // Convex auto-refetches via reactivity.
            }}
          />
        }
      >
        {/* Top header */}
        <DoctorHeader
          fullNameAr={doctor.user?.fullNameAr}
          specialtyNameAr={doctor.specialty?.nameAr ?? 'اختصاصي'}
          avgRating={avgRating}
          totalReviews={totalReviews}
          isVerified={doctor.isVerified}
          isFavorite={isFavoriteRaw === true}
          isFavoriteLoading={
            isFavoriteRaw === undefined || me === undefined || isTogglingFavorite
          }
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Stats row */}
        <StatsRow
          experienceYears={doctor.yearsOfExperience}
          totalReviews={totalReviews}
          patientCount={patientCount}
        />

        {/* Bio */}
        {doctor.bioAr ? (
          <BioSection text={doctor.bioAr} />
        ) : null}

        {/* Clinics */}
        {doctor.clinics && doctor.clinics.length > 0 ? (
          <ClinicsSection clinics={doctor.clinics} schedules={schedules} />
        ) : null}

        {/* Pricing */}
        <PricingSection consultationFee={doctor.consultationFee} />

        {/* Reviews */}
        <ReviewsSection
          reviews={reviews}
          distribution={starDistribution}
          totalReviews={totalReviews}
          avgRating={avgRating}
        />

        {/* Extra spacer so bottom bar doesn't overlap content */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky bottom booking bar */}
      <BookingButton
        doctorId={id ?? ''}
        clinics={doctor.clinics ?? []}
        schedules={schedules}
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

  // ── Doctor Header ────────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.md,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 32,
    color: theme.colors.primary,
  },
  doctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  specialtyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginHorizontal: 1,
  },
  ratingLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  verifiedText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.white,
    marginLeft: 6,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  unverifiedLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.warning,
    marginLeft: 6,
  },
  favoriteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
    gap: 6,
  },
  favoriteToggleActive: {
    borderColor: theme.colors.danger,
    backgroundColor: '#FFF1F2',
  },
  favoriteTogglePressed: {
    opacity: 0.8,
  },
  favoriteToggleText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  favoriteToggleTextActive: {
    color: theme.colors.danger,
  },

  // ── Stats Row ────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: theme.colors.border,
  },
  statValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Section ──────────────────────────────────────────────────────────────
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: rtlTextAlign(),
  },
  bioText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
    textAlign: rtlTextAlign(),
  },

  // ── Clinic Card ──────────────────────────────────────────────────────────
  clinicCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  clinicName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 10,
    textAlign: rtlTextAlign(),
  },
  clinicDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  clinicDetailText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    textAlign: rtlTextAlign(),
  },
  hoursContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  hoursDay: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  hoursTime: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 13,
    color: theme.colors.primary,
  },
  closedDayHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: rtlTextAlign(),
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  pricingCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.sm,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  pricingValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.primary,
  },

  // ── Reviews ──────────────────────────────────────────────────────────────
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  emptyReviewsText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  ratingSummaryCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  ratingSummaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    minWidth: 80,
  },
  ratingBig: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 32,
    color: theme.colors.warning,
    lineHeight: 38,
  },
  ratingTotalText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  distributionBars: {
    flex: 1,
    justifyContent: 'center',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  distLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textPrimary,
    width: 55,
    textAlign: 'left',
  },
  distBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  distBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.warning,
  },
  distPct: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 11,
    color: theme.colors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  reviewCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 8,
    ...theme.shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  reviewAuthorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginLeft: 8,
  },
  reviewDate: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  reviewComment: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginTop: 8,
    textAlign: rtlTextAlign(),
  },
  moreReviewsHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Bottom Bar ───────────────────────────────────────────────────────────
  bottomBarSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBar: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  slotsLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  slotChip: {
    backgroundColor: theme.colors.secondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 6,
    marginBottom: 4,
  },
  slotChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.primary,
  },
  noSlotsHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    marginBottom: 8,
  },
  bookButtonPressed: {
    opacity: 0.88,
  },
  bookButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
  },
});
