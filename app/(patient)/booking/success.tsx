// =============================================================================
// Booking – Success Screen
// Route: /(patient)/booking/success
// Celebratory screen shown after a booking is saved.
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

// =============================================================================
// Helpers
// =============================================================================

const ALGERIAN_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ALGERIAN_MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** Format a YYYY-MM-DD date as an Algerian Gregorian date. */
function formatArabicDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateStr;
  return `${ALGERIAN_DAYS[date.getUTCDay()]} ${day} ${ALGERIAN_MONTHS[month - 1]} ${year}`;
}

// =============================================================================
// Sub-components
// =============================================================================

// ─── Success Icon ───────────────────────────────────────────────────────────

function SuccessIcon() {
  return (
    <View style={styles.iconWrapper}>
      <View style={styles.iconCircle}>
        <Ionicons name="calendar" size={34} color={theme.colors.white} />
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
}: {
  doctor: string;
  clinic: string;
  date: string;
  time: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
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
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        style={({ pressed }) => [styles.summaryHeading, pressed && styles.summaryHeadingPressed]}
        accessibilityRole="button"
        accessibilityLabel="تفاصيل الموعد"
        accessibilityState={{ expanded: isExpanded }}
      >
        <Text style={styles.summaryTitle}>تفاصيل الموعد</Text>
        <View style={styles.summaryHeadingEnd}>
          <View style={styles.summaryHeadingIcon}>
            <Ionicons name="receipt-outline" size={17} color={theme.colors.official} />
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors.textSecondary}
          />
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.summaryDetails}>
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
        </View>
      ) : null}
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
  }>();

  const { doctor, clinic, date, time } = params;

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
        {/* Success icon */}
        <SuccessIcon />

        {/* Title */}
        <Text style={styles.title}>اكتمل حجز موعدك</Text>
        <Text style={styles.subtitle}>
          أحسنت! تم تأكيد الموعد وحفظ تفاصيله في مواعيدك.
        </Text>

        {/* Summary card with reference */}
        {doctor && clinic && date && time ? (
          <SummaryCard
            doctor={doctor}
            clinic={clinic}
            date={formattedDate}
            time={time}
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

  // ── Success Icon ─────────────────────────────────────────────────────────
  iconWrapper: {
    marginBottom: theme.spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.official,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },

  // ── Title ────────────────────────────────────────────────────────────────
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 23,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // ── Summary Card ─────────────────────────────────────────────────────────
  summaryCard: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    minHeight: 44,
    justifyContent: 'space-between',
  },
  summaryHeadingPressed: { opacity: 0.72 },
  summaryHeadingEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryHeadingIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
  },
  summaryTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: 0,
  },
  summaryDetails: { marginTop: theme.spacing.xs },
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
    marginStart: 12,
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

  // ── Missing Data Fallback ────────────────────────────────────────────────
  missingDataCard: {
    width: '100%',
    flexDirection: 'row',
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
