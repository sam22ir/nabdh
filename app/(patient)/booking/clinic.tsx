// =============================================================================
// Booking – Clinic And Doctor Selection Screen (Step 1)
// Route: /(patient)/booking/clinic?clinicId=<id>&doctorId=<optional id>
// Starts from the clinic, then selects one accepted doctor before date/time.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import AppAvatar from '@/components/AppAvatar';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { routeParamString } from '@/lib/routeParams';
import type { Id } from '@/convex/_generated/dataModel';

interface BookingClinic {
  _id: Id<'clinics'>;
  name: string;
  nameAr?: string;
  phone?: string;
  address?: string | null;
  isBookable?: boolean;
  wilaya?: { nameAr?: string | null } | null;
}

interface BookingDoctor {
  _id: Id<'doctors'>;
  fullNameAr?: string | null;
  fullName?: string | null;
  specialty?: { nameAr?: string | null; name?: string | null } | null;
  avgRating?: number;
  totalReviews?: number;
  isPreselected?: boolean;
}

interface BookingContext {
  clinic: BookingClinic;
  doctors: BookingDoctor[];
}

function LoadingScreen() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>جاري تحميل معلومات المركز...</Text>
    </View>
  );
}

function ErrorScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
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
        onPress={onBack}
      >
        <Text style={styles.retryButtonText}>العودة</Text>
      </Pressable>
    </View>
  );
}

function ClinicSummary({ clinic }: { clinic: BookingClinic }) {
  return (
    <View style={styles.clinicSummary}>
      <View style={styles.clinicIcon}>
        <Ionicons
          name="business-outline"
          size={24}
          color={theme.colors.official}
        />
      </View>
      <View style={styles.clinicCopy}>
        <Text style={styles.clinicLabel}>المركز</Text>
        <Text style={styles.clinicName} numberOfLines={1}>
          {clinic.nameAr ?? clinic.name}
        </Text>
        <Text style={styles.clinicMeta} numberOfLines={2}>
          {clinic.address || clinic.wilaya?.nameAr || 'العنوان غير محدد'}
        </Text>
      </View>
    </View>
  );
}

function DoctorChoiceCard({
  doctor,
  selected,
  onSelect,
}: {
  doctor: BookingDoctor;
  selected: boolean;
  onSelect: () => void;
}) {
  const doctorName = doctor.fullNameAr ?? doctor.fullName ?? 'مختص';
  const specialtyName =
    doctor.specialty?.nameAr ?? doctor.specialty?.name ?? 'اختصاصي';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.doctorCard,
        selected && styles.doctorCardSelected,
        pressed && !selected && styles.doctorCardPressed,
      ]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`اختيار المختص ${doctorName}`}
    >
      <AppAvatar name={doctorName} size={44} />
      <View style={styles.doctorCopy}>
        <Text style={styles.doctorName} numberOfLines={1}>
          {doctorName}
        </Text>
        <Text style={styles.doctorSpecialty} numberOfLines={1}>
          {specialtyName}
        </Text>
        <Text style={styles.doctorMeta}>
          {(doctor.avgRating ?? 0).toFixed(1)} · {doctor.totalReviews ?? 0} تقييمات
        </Text>
      </View>
      <View
        style={[
          styles.radioCircle,
          selected && styles.radioCircleSelected,
        ]}
      >
        {selected ? (
          <Ionicons name="checkmark" size={14} color={theme.colors.white} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ClinicSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    clinicId?: string | string[];
    doctorId?: string | string[];
  }>();
  const clinicId = routeParamString(params.clinicId);
  const doctorId = routeParamString(params.doctorId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    doctorId ?? null,
  );

  const bookingContext = useQuery(
    api.clinics.getBookingContext,
    clinicId
      ? {
          clinicId: clinicId as Id<'clinics'>,
          doctorId: doctorId ? (doctorId as Id<'doctors'>) : undefined,
        }
      : 'skip',
  ) as BookingContext | null | undefined;

  const clinic = bookingContext?.clinic ?? null;
  const doctors = useMemo(
    () => bookingContext?.doctors ?? [],
    [bookingContext?.doctors],
  );

  useEffect(() => {
    if (!doctors.length) {
      setSelectedDoctorId(null);
      return;
    }

    const preselectedDoctor = doctors.find(
      (doctor) => doctor.isPreselected || doctor._id === doctorId,
    );
    const selectedStillExists = doctors.some(
      (doctor) => doctor._id === selectedDoctorId,
    );

    if (preselectedDoctor) {
      setSelectedDoctorId(preselectedDoctor._id);
    } else if (!selectedStillExists && doctors.length === 1) {
      setSelectedDoctorId(doctors[0]._id);
    } else if (!selectedStillExists) {
      setSelectedDoctorId(null);
    }
  }, [doctorId, doctors, selectedDoctorId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(patient)/search');
    }
  }, [router]);

  const handleNext = useCallback(() => {
    if (!clinicId || !selectedDoctorId) return;
    router.push({
      pathname: '/(patient)/booking/datetime',
      params: {
        clinicId,
        doctorId: selectedDoctorId,
      },
    });
  }, [clinicId, router, selectedDoctorId]);

  if (!clinicId) {
    return (
      <ErrorScreen
        message="معرف المركز غير موجود. يرجى العودة والمحاولة مرة أخرى."
        onBack={handleBack}
      />
    );
  }

  if (bookingContext === undefined) return <LoadingScreen />;

  if (!bookingContext || !clinic) {
    return (
      <ErrorScreen
        message="تعذر تحميل معلومات المركز."
        onBack={handleBack}
      />
    );
  }

  const canProceed = Boolean(selectedDoctorId);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
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

        <View style={styles.stepsRow}>
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <View
                style={[
                  styles.stepDot,
                  step === 1 && styles.stepDotActive,
                  step > 1 && styles.stepDotInactive,
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    step === 1 && styles.stepDotTextActive,
                    step > 1 && styles.stepDotTextInactive,
                  ]}
                >
                  {step}
                </Text>
              </View>
              {step < 3 ? (
                <View
                  style={[
                    styles.stepLine,
                    step === 1 && styles.stepLineActive,
                  ]}
                />
              ) : null}
            </React.Fragment>
          ))}
        </View>
        <View style={styles.stepsLabelRow}>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>المختص</Text>
          <Text style={styles.stepLabel}>الموعد</Text>
          <Text style={styles.stepLabel}>التأكيد</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => undefined} />
          }
        >
          <ClinicSummary clinic={clinic} />

          <Text style={styles.sectionTitle}>اختيار المختص</Text>
          <Text style={styles.sectionHint}>
            اختر المختص داخل المركز لعرض مواعيده المتاحة.
          </Text>

          {doctors.length > 0 ? (
            doctors.map((doctor) => (
              <DoctorChoiceCard
                key={doctor._id}
                doctor={doctor}
                selected={selectedDoctorId === doctor._id}
                onSelect={() => setSelectedDoctorId(doctor._id)}
              />
            ))
          ) : (
            <View style={styles.emptyDoctors}>
              <Ionicons
                name="calendar-outline"
                size={40}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>لا توجد مواعيد متاحة حالياً</Text>
              <Text style={styles.emptyMessage}>
                يظهر المركز في البحث، لكن لا يوجد مختصون متاحون للحجز الآن.
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              !canProceed && styles.nextButtonDisabled,
              pressed && canProceed && styles.nextButtonPressed,
            ]}
            onPress={handleNext}
            disabled={!canProceed}
            accessibilityRole="button"
            accessibilityLabel="التالي"
            accessibilityState={{ disabled: !canProceed }}
          >
            <Text
              style={[
                styles.nextButtonText,
                !canProceed && styles.nextButtonTextDisabled,
              ]}
            >
              التالي
            </Text>
            <Ionicons
              name="arrow-back"
              size={20}
              color={
                canProceed ? theme.colors.white : theme.colors.textSecondary
              }
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 32,
  },
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: theme.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
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
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginHorizontal: 48,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary,
  },
  stepDotInactive: {
    backgroundColor: theme.colors.border,
  },
  stepDotText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
  },
  stepDotTextActive: {
    color: theme.colors.white,
  },
  stepDotTextInactive: {
    color: theme.colors.textSecondary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary,
  },
  stepsLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 40,
    marginTop: 6,
    marginBottom: 8,
  },
  stepLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  clinicSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
  },
  clinicIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 14,
  },
  clinicCopy: {
    flex: 1,
    minWidth: 0,
  },
  clinicLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  clinicName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },
  clinicMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: rtlTextAlign(),
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  sectionHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginTop: 4,
    marginBottom: 12,
  },
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
  },
  doctorCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  doctorCardPressed: {
    opacity: 0.92,
  },
  doctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  doctorCopy: {
    flex: 1,
    minWidth: 0,
  },
  doctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  doctorSpecialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.primary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },
  doctorMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: rtlTextAlign(),
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 8,
  },
  radioCircleSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  emptyDoctors: {
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 24,
    marginTop: 8,
  },
  emptyTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
  bottomBar: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
  },
  nextButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  nextButtonPressed: {
    opacity: 0.88,
  },
  nextButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
    marginEnd: 8,
  },
  nextButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
});
