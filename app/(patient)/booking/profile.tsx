// =============================================================================
// Booking – Profile Selection Screen (Step between datetime and confirmation)
// Route: /(patient)/booking/profile
// Shows "من سيزور الطبيب؟" with the user and their family sub-profiles.
// Selection is passed to the confirmation screen.
//
// RTL layout – Arabic‑first.
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { isIsoDateParam, isTimeParam, routeParamString } from '@/lib/routeParams';

// =============================================================================
// Constants
// =============================================================================

/** Sentinel value used internally for "myself".  Converted to `null` on submit. */
const SELF_PROFILE_ID = '__self__';

// =============================================================================
// Sub-components
// =============================================================================

// ─── Profile Radio Item ───────────────────────────────────────────────────────

function ProfileRadioItem({
  label,
  subtitle,
  icon,
  isSelected,
  onSelect,
}: {
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.radioItem,
        isSelected && styles.radioItemSelected,
        pressed && !isSelected && styles.radioItemPressed,
      ]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}
    >
      {/* Icon */}
      <View style={styles.radioIconContainer}>
        <Ionicons
          name={icon}
          size={22}
          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>

      {/* Text */}
      <View style={styles.radioTextContainer}>
        <Text
          style={[
            styles.radioLabel,
            isSelected && styles.radioLabelSelected,
          ]}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={styles.radioSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Selection circle */}
      <View
        style={[
          styles.radioCircle,
          isSelected && styles.radioCircleSelected,
        ]}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={14} color={theme.colors.white} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Bottom Button ────────────────────────────────────────────────────────────

function BottomButton({ onPress }: { onPress: () => void }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.nextButton,
          pressed && styles.nextButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="التالي"
      >
        <Text style={styles.nextButtonText}>التالي</Text>
        <Ionicons
          name="arrow-back"
          size={20}
          color={theme.colors.white}
          style={styles.nextButtonIcon}
        />
      </Pressable>
    </SafeAreaView>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function BookingProfileScreen() {
  const router = useRouter();
  const params =
    useLocalSearchParams<{
      doctorId?: string | string[];
      clinicId?: string | string[];
      date?: string | string[];
      time?: string | string[];
      rescheduleBookingId?: string | string[];
    }>();
  const doctorId = routeParamString(params.doctorId);
  const clinicId = routeParamString(params.clinicId);
  const date = routeParamString(params.date);
  const time = routeParamString(params.time);
  const rescheduleBookingId = routeParamString(params.rescheduleBookingId);
  const hasValidBookingParams =
    Boolean(doctorId && clinicId) && isIsoDateParam(date) && isTimeParam(time);

  // ── Fetch current user via Convex ────────────────────────────────────────
  const me = useQuery(api.users.me);
  const familyProfiles = useQuery(api.patientProfiles.listMy, {});
  const isLoading = me === undefined || familyProfiles === undefined;

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedProfileId, setSelectedProfileId] =
    useState<string>(SELF_PROFILE_ID);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleNext = useCallback(() => {
    const profileId =
      selectedProfileId === SELF_PROFILE_ID ? null : selectedProfileId;

    router.push({
      pathname: '/(patient)/booking/confirm' as any,
      params: {
        doctorId,
        clinicId,
        date,
        time,
        profileId,
        rescheduleBookingId,
      },
    } as any);
  }, [
    router,
    doctorId,
    clinicId,
    date,
    time,
    selectedProfileId,
    rescheduleBookingId,
  ]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل الملفات الشخصية...</Text>
      </View>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (!me) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={theme.colors.danger}
        />
        <Text style={styles.errorTitle}>عذراً، حدث خطأ</Text>
        <Text style={styles.errorMessage}>
          تعذر تحميل الملفات الشخصية. يرجى المحاولة مرة أخرى.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            // Convex auto-refetches via reactivity.
          }}
        >
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  // ── Missing required params ─────────────────────────────────────────────
  if (!hasValidBookingParams) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={56}
          color={theme.colors.danger}
        />
        <Text style={styles.errorTitle}>عذراً، حدث خطأ</Text>
        <Text style={styles.errorMessage}>
          بيانات الحجز غير مكتملة. يرجى العودة والمحاولة مرة أخرى.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleBack}
        >
          <Text style={styles.retryButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Ionicons
            name="arrow-forward"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>اختيار الملف</Text>
        </View>
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question title */}
        <Text style={styles.questionTitle}>من سيزور الطبيب؟</Text>

        {/* "Myself" option – always shown */}
        <ProfileRadioItem
          label="نفسي"
          subtitle={me.fullNameAr ?? me.name ?? ''}
          icon="person"
          isSelected={selectedProfileId === SELF_PROFILE_ID}
          onSelect={() => setSelectedProfileId(SELF_PROFILE_ID)}
        />

        {familyProfiles.map((profile) => (
          <ProfileRadioItem
            key={profile._id}
            label={profile.fullNameAr}
            subtitle={profile.gender === 'female' ? 'فرد عائلة' : 'فرد عائلة'}
            icon={profile.gender === 'female' ? 'woman' : 'man'}
            isSelected={selectedProfileId === profile._id}
            onSelect={() => setSelectedProfileId(profile._id)}
          />
        ))}

        {/* Spacer so the bottom button doesn't overlap */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom "التالي" button ─────────────────────────────────────── */}
      <BottomButton onPress={handleNext} />
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
    paddingHorizontal: 16,
    paddingTop: 8,
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

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    ...theme.shadows.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: theme.colors.background,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },

  // ── Question ─────────────────────────────────────────────────────────────
  questionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 20,
  },

  // ── Radio Item ───────────────────────────────────────────────────────────
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.white,
    ...theme.shadows.sm,
  },
  radioItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0F8FF',
  },
  radioItemPressed: {
    opacity: 0.92,
  },
  radioIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  radioLabelSelected: {
    color: theme.colors.primary,
  },
  radioSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'right',
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

  // ── Bottom Button ────────────────────────────────────────────────────────
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  nextButtonPressed: {
    opacity: 0.88,
  },
  nextButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
  },
  nextButtonIcon: {
    marginRight: 8,
  },
});
