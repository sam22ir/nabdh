import { useCallback } from 'react';
import { Alert, Linking, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppAvatar from './AppAvatar';
import { Panel } from '@/components/ui';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';
import type { Appointment } from '../lib/types';

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
  /** Google Maps URL for the clinic location, when available. */
  clinicMapUrl?: string | null;
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
  /** Called when the user taps "قيم المختص". */
  onReview?: () => void;
}

type AppointmentFactProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'default' | 'primary' | 'danger';
};

// =============================================================================
// Component
// =============================================================================

function AppointmentFact({
  icon,
  label,
  value,
  tone = 'default',
}: AppointmentFactProps) {
  const iconColor =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'primary'
        ? theme.colors.primary
        : theme.colors.info;

  return (
    <View style={styles.factRow}>
      <View
        style={[
          styles.factIcon,
          tone === 'primary' && styles.factIconPrimary,
          tone === 'danger' && styles.factIconDanger,
        ]}
      >
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.factCopy}>
        <Text style={styles.factLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[
            styles.factValue,
            tone === 'danger' && styles.factValueDanger,
          ]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function AppointmentCard({
  appointment,
  doctorName,
  specialty,
  clinicName,
  clinicMapUrl,
  hasReview = false,
  onPress,
  onCancel,
  onReschedule,
  onBookAgain,
  onReview,
}: AppointmentCardProps) {
  const { status, appointmentDate, appointmentTime } = appointment;

  const isConfirmedUpcoming =
    status === 'confirmed' || status === 'present' || status === 'in_room';
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const showActions = isConfirmedUpcoming || isCompleted;
  const showReviewButton = isCompleted && !hasReview;

  const handleCancel = useCallback(() => onCancel?.(), [onCancel]);
  const handleReschedule = useCallback(() => onReschedule?.(), [onReschedule]);
  const handleBookAgain = useCallback(() => onBookAgain?.(), [onBookAgain]);
  const handleReview = useCallback(() => onReview?.(), [onReview]);
  const handleOpenClinicLocation = useCallback(() => {
    if (!clinicMapUrl) return;

    Linking.openURL(clinicMapUrl).catch(() => {
      Alert.alert(
        'تعذر فتح الموقع',
        'لم نتمكن من فتح موقع المركز على خرائط Google.',
      );
    });
  }, [clinicMapUrl]);

  // ── Render ──────────────────────────────────────────────────────────────

  const cardContent = (
    <Panel style={styles.panel}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderText}>موعد مع المختص</Text>
      </View>

      <View style={styles.identityBlock}>
        <AppAvatar name={doctorName} size={48} />
        <View style={styles.identityCopy}>
          <Text style={styles.doctorName} numberOfLines={1}>
            {doctorName}
          </Text>
          <Text style={styles.specialty} numberOfLines={1}>
            {specialty}
          </Text>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <AppointmentFact
          icon="business-outline"
          label="المركز"
          value={clinicName}
          tone="primary"
        />
        <View style={styles.factDivider} />
        <View style={styles.scheduleGrid}>
          <AppointmentFact
            icon="calendar-outline"
            label="التاريخ"
            value={formatArabicDate(appointmentDate)}
          />
          <AppointmentFact
            icon="time-outline"
            label="الوقت"
            value={appointmentTime}
          />
        </View>
        {appointment.doctorNote ? (
          <>
            <View style={styles.factDivider} />
            <AppointmentFact
              icon="document-text-outline"
              label="ملاحظة المختص"
              value={appointment.doctorNote}
            />
          </>
        ) : null}
        {isCancelled && appointment.cancellationReason ? (
          <>
            <View style={styles.factDivider} />
            <AppointmentFact
              icon="information-circle-outline"
              label="سبب الإلغاء"
              value={appointment.cancellationReason}
              tone="danger"
            />
          </>
        ) : null}
      </View>

      {/* Action buttons */}
      {showActions && (
        <View style={styles.actions}>
          {clinicMapUrl ? (
            <Pressable
              style={({ pressed }) => [
                styles.locationButton,
                pressed && styles.actionPressed,
              ]}
              onPress={handleOpenClinicLocation}
              accessibilityRole="button"
              accessibilityLabel="فتح موقع المركز على خرائط Google"
            >
              <Ionicons
                name="navigate-outline"
                size={18}
                color={theme.colors.official}
              />
              <Text style={styles.locationButtonText}>موقع المركز</Text>
            </Pressable>
          ) : null}

          {isConfirmedUpcoming && (
            <View style={styles.primaryActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionDanger,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="إلغاء الموعد"
              >
                <Text style={styles.actionTextInverse}>
                  إلغاء
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionPrimary,
                  pressed && styles.actionPressed,
                ]}
                onPress={handleReschedule}
                accessibilityRole="button"
                accessibilityLabel="تأجيل الموعد"
              >
                <Text style={styles.actionTextInverse}>
                  تأجيل
                </Text>
              </Pressable>
            </View>
          )}
          {isCompleted && (
            <View style={styles.primaryActions}>
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
                  accessibilityLabel="قيم المختص"
                >
                  <Text style={[styles.actionText, styles.actionTextPrimary]}>
                    قيم المختص
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </Panel>
  );

  if (showActions) {
    return <View style={styles.card}>{cardContent}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`موعد مع ${doctorName}`}
    >
      {cardContent}
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },

  cardPressed: {
    opacity: 0.9,
  },

  panel: {
    gap: 0,
    overflow: 'hidden',
  },

  // ─── Header ────────────────────────────────────────────────────────────

  cardHeader: {
    width: '100%',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    backgroundColor: '#F5FAFD',
    borderBottomWidth: 1,
    borderBottomColor: '#E2EEF3',
  },

  cardHeaderText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.official,
    textAlign: 'center',
  },

  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },

  avatarMark: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  identityCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },

  doctorName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    lineHeight: 28,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Info rows ─────────────────────────────────────────────────────────

  specialty: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.primary,
    textAlign: rtlTextAlign(),
  },

  detailsCard: {
    marginHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#DCEAF1',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#F5FAFD',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },

  scheduleGrid: {
    gap: theme.spacing.sm,
  },

  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 48,
  },

  factIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D7E4EA',
  },

  factIconPrimary: {
    backgroundColor: theme.colors.secondary,
    borderColor: '#C7E2F3',
  },

  factIconDanger: {
    backgroundColor: theme.colors.status.danger.background,
    borderColor: theme.colors.status.danger.border,
  },

  factCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 1,
  },

  factLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },

  factValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  factValueDanger: {
    color: theme.colors.status.danger.text,
  },

  factDivider: {
    height: 1,
    backgroundColor: '#E2EEF3',
  },

  // ─── Actions ───────────────────────────────────────────────────────────

  actions: {
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  primaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },

  locationButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: '#C7E2F3',
  },

  locationButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.official,
  },

  actionButton: {
    minWidth: 96,
    minHeight: 44,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
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

  actionDanger: {
    backgroundColor: theme.colors.danger,
  },

  // Outlined primary button
  actionOutlinePrimary: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },

  actionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
  },

  actionTextPrimary: {
    color: theme.colors.primary,
  },

  actionTextPrimaryInverse: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
  },
  actionTextInverse: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
