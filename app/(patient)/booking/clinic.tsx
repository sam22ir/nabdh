// =============================================================================
// Clinic Selection Screen – Step 1 of Booking Flow
// Route: /(patient)/booking/clinic?doctorId=<id>
// Shows doctor name, lists clinics with selection, proceeds to date-time step.
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
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
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { routeParamString } from '@/lib/routeParams';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types – mirrors the Convex shape returned by api.doctors.getById
// =============================================================================

/** Clinic info from the doctor's clinic list. */
interface ClinicInfo {
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

/** Doctor detail from Convex api.doctors.getById. */
interface DoctorDetail {
  _id: Id<'doctors'>;
  _creationTime: number;
  userId: Id<'users'>;
  specialtyId: Id<'specialties'>;
  user: {
    fullNameAr: string | null;
    phone: string | null;
  };
  clinics: ClinicInfo[];
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Loading Screen ─────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>جاري تحميل معلومات العيادة...</Text>
    </View>
  );
}

// ─── Error Screen ───────────────────────────────────────────────────────────

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
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
      {onRetry && (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Empty Clinics ──────────────────────────────────────────────────────────

function EmptyClinics({ onGoBack }: { onGoBack: () => void }) {
  return (
    <View style={styles.centerContainer}>
      <Ionicons
        name="business-outline"
        size={56}
        color={theme.colors.textSecondary}
      />
      <Text style={styles.emptyTitle}>لا توجد عيادات متاحة</Text>
      <Text style={styles.emptyMessage}>
        هذا الطبيب لا يملك عيادات نشطة حالياً. يرجى العودة لاحقاً أو اختيار طبيب
        آخر.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.retryButton,
          pressed && { opacity: 0.85 },
        ]}
        onPress={onGoBack}
      >
        <Text style={styles.retryButtonText}>العودة</Text>
      </Pressable>
    </View>
  );
}

// ─── Clinic Card (selectable) ───────────────────────────────────────────────

function ClinicCard({
  clinic,
  isSelected,
  onSelect,
}: {
  clinic: ClinicInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.clinicCard,
        isSelected && styles.clinicCardSelected,
        pressed && !isSelected && styles.clinicCardPressed,
      ]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`اختيار عيادة ${clinic.name}`}
    >
      {/* Selection indicator */}
      <View style={styles.clinicCardTop}>
        <Text style={styles.clinicCardName}>{clinic.name}</Text>
        <View
          style={[
            styles.radioCircle,
            isSelected && styles.radioCircleSelected,
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={14} color={theme.colors.white} />
          )}
        </View>
      </View>

      {/* Address */}
      <View style={styles.clinicDetailRow}>
        <Ionicons
          name="location-outline"
          size={16}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.clinicDetailText} numberOfLines={2}>
          {clinic.address}
        </Text>
      </View>

      {/* Distance placeholder */}
      <View style={styles.clinicDetailRow}>
        <Ionicons
          name="navigate-outline"
          size={16}
          color={theme.colors.textSecondary}
        />
        <Text style={styles.clinicDetailText}>-- كم</Text>
      </View>

      {/* Phone (if available) */}
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
    </Pressable>
  );
}

// ─── Single Clinic Detail (auto-selected) ──────────────────────────────────

function SingleClinicDetail({ clinic }: { clinic: ClinicInfo }) {
  return (
    <View style={styles.singleClinicContainer}>
      {/* Confirmation banner */}
      <View style={styles.autoSelectBanner}>
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={theme.colors.success}
        />
        <Text style={styles.autoSelectText}>تم اختيار العيادة تلقائياً</Text>
      </View>

      {/* Clinic details card */}
      <View style={styles.clinicCard}>
        <Text style={styles.clinicCardName}>{clinic.name}</Text>

        <View style={styles.clinicDetailRow}>
          <Ionicons
            name="location-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.clinicDetailText} numberOfLines={3}>
            {clinic.address}
          </Text>
        </View>

        <View style={styles.clinicDetailRow}>
          <Ionicons
            name="navigate-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.clinicDetailText}>-- كم</Text>
        </View>

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
      </View>
    </View>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function ClinicSelectionScreen() {
  const { doctorId: rawDoctorId } =
    useLocalSearchParams<{ doctorId?: string | string[] }>();
  const doctorId = routeParamString(rawDoctorId);
  const router = useRouter();

  const doctorData = useQuery(
    api.doctors.getById,
    doctorId ? { doctorId: doctorId as Id<'doctors'> } : 'skip',
  ) as DoctorDetail | null | undefined;

  const isLoading = doctorData === undefined;
  const doctor = doctorData ?? null;

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // Auto-select when only one clinic is available
  useEffect(() => {
    if (doctor?.clinics && doctor.clinics.length === 1) {
      setSelectedClinicId(doctor.clinics[0]._id);
    }
  }, [doctor?.clinics]);

  // Reset selection when clinics data changes
  useEffect(() => {
    if (!doctor?.clinics || doctor.clinics.length === 0) {
      setSelectedClinicId(null);
    }
  }, [doctor?.clinics]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const clinics = doctor?.clinics ?? [];
  const isMultiClinic = clinics.length > 1;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRetry = () => {
    // Convex auto-refetches; no manual action needed.
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleNext = () => {
    if (!selectedClinicId) return;

    router.push({
      pathname: '/(patient)/booking/datetime',
      params: { doctorId, clinicId: selectedClinicId },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Missing doctorId
  if (!doctorId) {
    return (
      <ErrorScreen
        message="معرف الطبيب غير موجود. يرجى العودة والمحاولة مرة أخرى."
        onRetry={handleGoBack}
      />
    );
  }

  // Loading state
  if (isLoading) return <LoadingScreen />;

  // Error state
  if (!doctor) {
    return (
      <ErrorScreen
        message="تعذر تحميل معلومات الطبيب."
        onRetry={handleRetry}
      />
    );
  }

  // No clinics
  if (!clinics || clinics.length === 0) {
    return <EmptyClinics onGoBack={handleGoBack} />;
  }

  const canProceed = selectedClinicId !== null;
  const doctorName = doctor.user?.fullNameAr ?? 'طبيب';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={handleGoBack}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <Ionicons
              name="arrow-forward"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>اختيار العيادة</Text>
            <Text style={styles.headerSubtitle}>الخطوة 1 من 3</Text>
          </View>
        </View>

        {/* ── Doctor Info ─────────────────────────────────────────────────── */}
        <View style={styles.doctorInfoCard}>
          <View style={styles.doctorIconCircle}>
            <Ionicons
              name="medical"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.doctorInfoText}>
            <Text style={styles.doctorInfoLabel}>الطبيب</Text>
            <Text style={styles.doctorName}>
              {doctorName}
            </Text>
          </View>
        </View>

        {/* ── Progress Steps ──────────────────────────────────────────────── */}
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
              {step < 3 && (
                <View
                  style={[
                    styles.stepLine,
                    step === 1 && styles.stepLineActive,
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>
        <View style={styles.stepsLabelRow}>
          <Text style={[styles.stepLabel, styles.stepLabelActive]}>العيادة</Text>
          <Text style={styles.stepLabel}>الموعد</Text>
          <Text style={styles.stepLabel}>التأكيد</Text>
        </View>

        {/* ── Clinic Selection ────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRetry}
            />
          }
        >
          {isMultiClinic ? (
            <>
              <Text style={styles.sectionHint}>
                اختر العيادة التي ترغب في زيارتها
              </Text>
              {clinics.map((clinic) => (
                <ClinicCard
                  key={clinic._id}
                  clinic={clinic}
                  isSelected={selectedClinicId === clinic._id}
                  onSelect={() => setSelectedClinicId(clinic._id)}
                />
              ))}
            </>
          ) : (
            <SingleClinicDetail clinic={clinics[0]} />
          )}

          {/* Spacer for bottom button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Bottom Bar ──────────────────────────────────────────────────── */}
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

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ───────────────────────────────────────────────────────────────
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // ── Loading / Error / Empty ──────────────────────────────────────────────
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
  emptyTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },

  // ── Doctor Info ──────────────────────────────────────────────────────────
  doctorInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  doctorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  doctorInfoText: {
    flex: 1,
  },
  doctorInfoLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  doctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },

  // ── Progress Steps ───────────────────────────────────────────────────────
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

  // ── Section Hint ─────────────────────────────────────────────────────────
  sectionHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginBottom: 12,
  },

  // ── Clinic Card (selectable) ─────────────────────────────────────────────
  clinicCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  clinicCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0F8FF',
  },
  clinicCardPressed: {
    opacity: 0.92,
  },
  clinicCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clinicCardName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    flex: 1,
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
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
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

  // ── Single Clinic (auto-selected) ────────────────────────────────────────
  singleClinicContainer: {
    marginTop: 4,
  },
  autoSelectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8E8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: 14,
  },
  autoSelectText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.success,
    marginRight: 8,
    flex: 1,
  },

  // ── Bottom Bar ───────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    ...theme.shadows.lg,
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
    marginLeft: 8,
  },
  nextButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
});
