import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';
import type { Appointment, AppointmentStatus } from '../lib/types';

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

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string; backgroundColor: string }
> = {
  confirmed: {
    label: 'مؤكد',
    color: theme.colors.success,
    backgroundColor: '#E8F8EE',
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
// Helpers
// =============================================================================

/** Format YYYY-MM-DD to DD/MM/YYYY with Arabic weekday name. */
function formatArabicDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayName = ARABIC_DAYS[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy} ${dayName}`;
}

// =============================================================================
// Types
// =============================================================================

export interface AppointmentCardProps {
  /** The raw appointment object. */
  appointment: Appointment;
  /** Display name of the doctor (without prefix). */
  doctorName: string;
  /** Specialty display name in Arabic. */
  specialty: string;
  /** Clinic display name. */
  clinicName: string;
  /** Whether the user has already submitted a review (only relevant when status is completed). */
  hasReview?: boolean;
  /** Called when the card itself is pressed. */
  onPress?: () => void;
  /** Called when the user taps "إلغاء". */
  onCancel?: () => void;
  /** Called when the user taps "تأجيل". */
  onReschedule?: () => void;
  /** Called when the user taps "احجز مرة أخرى". */
  onBookAgain?: () => void;
  /** Called when the user taps "قيم الطبيب". */
  onReview?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function AppointmentCard({
  appointment,
  doctorName,
  specialty,
  clinicName,
  hasReview = false,
  onPress,
  onCancel,
  onReschedule,
  onBookAgain,
  onReview,
}: AppointmentCardProps) {
  const { status, appointmentDate, appointmentTime } = appointment;
  const statusCfg = STATUS_CONFIG[status];

  const isConfirmedUpcoming = status === 'confirmed';
  const isCompleted = status === 'completed';
  const showActions = isConfirmedUpcoming || isCompleted;
  const showReviewButton = isCompleted && !hasReview;

  const handleCancel = useCallback(() => onCancel?.(), [onCancel]);
  const handleReschedule = useCallback(() => onReschedule?.(), [onReschedule]);
  const handleBookAgain = useCallback(() => onBookAgain?.(), [onBookAgain]);
  const handleReview = useCallback(() => onReview?.(), [onReview]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`موعد مع الدكتور ${doctorName}`}
    >
      {/* Header: Doctor name + status badge */}
      <View style={styles.header}>
        <Text style={styles.doctorName} numberOfLines={1}>
          د. {doctorName}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: statusCfg.backgroundColor },
          ]}
        >
          <Text style={[styles.badgeText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Specialty */}
      <Text style={styles.specialty} numberOfLines={1}>
        {specialty}
      </Text>

      {/* Clinic */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>العيادة: </Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {clinicName}
        </Text>
      </View>

      {/* Date & time */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>التاريخ: </Text>
        <Text style={styles.infoValue}>{formatArabicDate(appointmentDate)}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>الوقت: </Text>
        <Text style={styles.infoValue}>{appointmentTime}</Text>
      </View>

      {/* Action buttons */}
      {showActions && (
        <View style={styles.actions}>
          {isConfirmedUpcoming && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionOutlineDanger,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="إلغاء الموعد"
              >
                <Text style={[styles.actionText, styles.actionTextDanger]}>
                  إلغاء
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionOutlinePrimary,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleReschedule}
                accessibilityRole="button"
                accessibilityLabel="تأجيل الموعد"
              >
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  تأجيل
                </Text>
              </Pressable>
            </>
          )}
          {isCompleted && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionPrimary,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleBookAgain}
                accessibilityRole="button"
                accessibilityLabel="احجز مرة أخرى"
              >
                <Text style={styles.actionTextPrimaryInverse}>
                  احجز مرة أخرى
                </Text>
              </Pressable>
              {showReviewButton && (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionOutlinePrimary,
                    pressed && styles.actionPressed,
                  ]}
                  onPress={handleReview}
                  accessibilityRole="button"
                  accessibilityLabel="قيم الطبيب"
                >
                  <Text style={[styles.actionText, styles.actionTextPrimary]}>
                    قيم الطبيب
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
    writingDirection: 'rtl',
  },

  cardPressed: {
    opacity: 0.9,
  },

  // ─── Header ────────────────────────────────────────────────────────────

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },

  doctorName: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginEnd: theme.spacing.sm,
  },

  badge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },

  badgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
  },

  // ─── Info rows ─────────────────────────────────────────────────────────

  specialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },

  infoLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  infoValue: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },

  // ─── Actions ───────────────────────────────────────────────────────────

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  actionButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionPressed: {
    opacity: 0.75,
  },

  // Solid primary button
  actionPrimary: {
    backgroundColor: theme.colors.primary,
  },

  // Outlined danger button
  actionOutlineDanger: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    backgroundColor: 'transparent',
  },

  // Outlined primary button
  actionOutlinePrimary: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },

  actionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
  },

  actionTextDanger: {
    color: theme.colors.danger,
  },

  actionTextPrimary: {
    color: theme.colors.primary,
  },

  actionTextPrimaryInverse: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
  },
});
