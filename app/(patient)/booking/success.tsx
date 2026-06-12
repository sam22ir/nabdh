// =============================================================================
// Booking – Success Screen
// Route: /(patient)/booking/success
// Celebratory screen shown after a booking is confirmed.
// Displays a checkmark, success message, booking summary, reference ID,
// and two call-to-action buttons (appointments / home).
// RTL layout – Arabic‑first.
// =============================================================================

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/lib/theme';

// =============================================================================
// Constants
// =============================================================================

const CONFETTI_COLORS = ['#1A7BC4', '#27AE60', '#F39C12', '#E74C3C', '#9B59B6'];

// =============================================================================
// Helpers
// =============================================================================

/** Format a YYYY-MM-DD date string into a full Arabic‑locale date. */
function formatArabicDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Generate a simple human-readable booking reference from a UUID. */
function shortReference(uuid: string): string {
  // Take the first two hyphen-separated groups and uppercase them.
  const parts = uuid.split('-');
  return `#${parts[0].toUpperCase()}-${parts[1]?.toUpperCase() ?? 'XXXX'}`;
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Confetti Dots (decorative) ─────────────────────────────────────────────

function ConfettiDots() {
  return (
    <View style={styles.confettiRow}>
      {CONFETTI_COLORS.map((color, idx) => (
        <View
          key={idx}
          style={[
            styles.confettiDot,
            { backgroundColor: color },
            idx % 2 === 0 ? styles.confettiDotUp : styles.confettiDotDown,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Success Icon ───────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <View style={styles.iconWrapper}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={48} color={theme.colors.white} />
      </View>
    </View>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({
  doctor,
  clinic,
  date,
  time,
  referenceId,
}: {
  doctor: string;
  clinic: string;
  date: string;
  time: string;
  referenceId: string;
}) {
  const rows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }[] = [
    { icon: 'medical-outline', label: 'الطبيب', value: doctor },
    { icon: 'business-outline', label: 'العيادة', value: clinic },
    { icon: 'calendar-outline', label: 'التاريخ', value: date },
    { icon: 'time-outline', label: 'الوقت', value: time },
  ];

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>ملخص الحجز</Text>
      {rows.map((item, idx) => (
        <View
          key={item.label}
          style={[
            styles.summaryRow,
            idx < rows.length - 1 && styles.summaryRowBorder,
          ]}
        >
          <View style={styles.summaryIconContainer}>
            <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        </View>
      ))}

      {/* Reference ID */}
      <View style={styles.referenceRow}>
        <View style={styles.referenceDivider} />
        <View style={styles.referenceContent}>
          <Ionicons
            name="receipt-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.referenceLabel}>رقم الحجز</Text>
          <Text style={[styles.referenceValue, { writingDirection: 'ltr' }]}>
            {shortReference(referenceId)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Action Buttons ─────────────────────────────────────────────────────────

function ActionButtons({
  onViewAppointments,
  onGoHome,
}: {
  onViewAppointments: () => void;
  onGoHome: () => void;
}) {
  return (
    <View style={styles.buttonsContainer}>
      <Pressable
        onPress={onViewAppointments}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="عرض مواعيدي"
      >
        <Ionicons name="calendar" size={20} color={theme.colors.white} />
        <Text style={styles.primaryButtonText}>عرض مواعيدي</Text>
      </Pressable>

      <Pressable
        onPress={onGoHome}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.secondaryButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="العودة للرئيسية"
      >
        <Ionicons name="home-outline" size={20} color={theme.colors.primary} />
        <Text style={styles.secondaryButtonText}>العودة للرئيسية</Text>
      </Pressable>
    </View>
  );
}

// =============================================================================
// Main Screen Component
// =============================================================================

export default function BookingSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    doctor: string;
    clinic: string;
    date: string;
    time: string;
    referenceId: string;
  }>();

  const { doctor, clinic, date, time, referenceId } = params;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleViewAppointments = () => {
    router.replace('/(patient)/appointments');
  };

  const handleGoHome = () => {
    router.replace('/(patient)');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const formattedDate = date ? formatArabicDate(date) : '';

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Decorative confetti */}
        <ConfettiDots />

        {/* Success icon */}
        <SuccessIcon />

        {/* Title */}
        <Text style={styles.title}>تم الحجز بنجاح!</Text>
        <Text style={styles.subtitle}>
          تم تأكيد موعدك. يمكنك الاطلاع على التفاصيل أدناه.
        </Text>

        {/* Summary card with reference */}
        {doctor && clinic && date && time && referenceId ? (
          <SummaryCard
            doctor={doctor}
            clinic={clinic}
            date={formattedDate}
            time={time}
            referenceId={referenceId}
          />
        ) : (
          <View style={styles.missingDataCard}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.missingDataText}>
              تم الحجز بنجاح. يمكنك عرض التفاصيل في مواعيدي.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <ActionButtons
          onViewAppointments={handleViewAppointments}
          onGoHome={handleGoHome}
        />

        {/* Extra bottom padding */}
        <View style={{ height: 24 }} />
      </ScrollView>
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
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  // ── Confetti ─────────────────────────────────────────────────────────────
  confettiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  confettiDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confettiDotUp: {
    marginTop: -8,
  },
  confettiDotDown: {
    marginBottom: -8,
  },

  // ── Success Icon ─────────────────────────────────────────────────────────
  iconWrapper: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },

  // ── Title ────────────────────────────────────────────────────────────────
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // ── Summary Card ─────────────────────────────────────────────────────────
  summaryCard: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 28,
    ...theme.shadows.sm,
  },
  summaryTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  summaryValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginTop: 2,
  },

  // ── Reference ID ─────────────────────────────────────────────────────────
  referenceRow: {
    marginTop: 14,
  },
  referenceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  referenceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  referenceLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  referenceValue: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 15,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },

  // ── Missing Data Fallback ────────────────────────────────────────────────
  missingDataCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 28,
    gap: 10,
  },
  missingDataText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    lineHeight: 22,
  },

  // ── Action Buttons ───────────────────────────────────────────────────────
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    gap: 8,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.white,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    gap: 8,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.colors.secondary,
  },
  secondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.primary,
  },
});
