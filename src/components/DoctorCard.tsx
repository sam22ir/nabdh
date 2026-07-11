import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppAvatar from './AppAvatar';
import { Badge, Panel } from '@/components/ui';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DoctorCardData {
  id: string;
  fullNameAr: string;
  specialty: {
    nameAr: string;
  };
  avgRating: number;
  totalReviews: number;
  wilaya: {
    nameAr: string;
  };
  isVerified: boolean;
  avatarUrl: string | null;
  nextAvailableInDays?: number | null;
}

export interface DoctorCardProps {
  doctor: DoctorCardData;
  isAvailableToday?: boolean;
  showAvailability?: boolean;
  bookingMode?: 'clinic' | 'profile';
  onPress?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  isAvailableToday = false,
  showAvailability = true,
  bookingMode,
  onPress,
}) => {
  const hasReviews = doctor.totalReviews > 0;
  const availabilityLabel = isAvailableToday
    ? 'متاح اليوم'
    : doctor.nextAvailableInDays === 1
      ? 'متاح غداً'
      : typeof doctor.nextAvailableInDays === 'number' &&
          doctor.nextAvailableInDays > 1
        ? `بعد ${doctor.nextAvailableInDays} أيام`
        : 'حسب المواعيد';
  const bookingLabel =
    bookingMode === 'clinic'
      ? 'الحجز عبر العيادة'
      : bookingMode === 'profile'
        ? 'ملف الطبيب فقط'
        : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${doctor.fullNameAr}، ${doctor.specialty.nameAr}`}
    >
      <Panel style={styles.panel}>
        <View style={styles.topRow}>
          <AppAvatar name={doctor.fullNameAr} size={44} />

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.identityBlock}>
                <Text style={styles.name} numberOfLines={1}>
                  {doctor.fullNameAr}
                </Text>
                <Text style={styles.specialty} numberOfLines={1}>
                  {doctor.specialty.nameAr}
                </Text>
              </View>

              {doctor.isVerified ? (
                <Badge
                  label="موثق"
                  tone="success"
                  icon="shield-checkmark-outline"
                  style={styles.statusBadge}
                  textStyle={styles.statusBadgeText}
                />
              ) : null}
            </View>

            <View style={styles.ratingRow}>
              <Ionicons
                name={hasReviews ? 'star' : 'star-outline'}
                size={14}
                color={hasReviews ? theme.colors.warning : theme.colors.textMuted}
              />
              <Text style={styles.ratingText} numberOfLines={1}>
                {hasReviews
                  ? `${doctor.avgRating.toFixed(1)} (${doctor.totalReviews})`
                  : 'لا توجد تقييمات بعد'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={[styles.factItem, styles.locationFact]}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text style={styles.factText} numberOfLines={1}>
                  {doctor.wilaya.nameAr || 'غير محددة'}
                </Text>
              </View>

              {showAvailability ? (
                <View
                  style={[
                    styles.factItem,
                    isAvailableToday ? styles.availableFact : styles.neutralFact,
                  ]}
                >
                  <Ionicons
                    name={isAvailableToday ? 'checkmark-circle-outline' : 'time-outline'}
                    size={14}
                    color={
                      isAvailableToday
                        ? theme.colors.status.success.text
                        : theme.colors.status.neutral.text
                    }
                  />
                  <Text
                    style={[
                      styles.factText,
                      isAvailableToday ? styles.availableFactText : styles.neutralFactText,
                    ]}
                    numberOfLines={1}
                  >
                    {availabilityLabel}
                  </Text>
                </View>
              ) : null}

              {bookingLabel ? (
                <View
                  style={[
                    styles.factItem,
                    bookingMode === 'clinic' ? styles.bookingFact : styles.neutralFact,
                  ]}
                >
                  <Ionicons
                    name={
                      bookingMode === 'clinic'
                        ? 'business-outline'
                        : 'information-circle-outline'
                    }
                    size={13}
                    color={
                      bookingMode === 'clinic'
                        ? theme.colors.status.info.text
                        : theme.colors.status.neutral.text
                    }
                  />
                  <Text
                    style={[
                      styles.factText,
                      bookingMode === 'clinic'
                        ? styles.bookingFactText
                        : styles.neutralFactText,
                    ]}
                    numberOfLines={1}
                  >
                    {bookingLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Panel>
    </Pressable>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
  },
  cardPressed: {
    opacity: 0.92,
  },
  panel: {
    padding: theme.spacing.md,
    minHeight: 124,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.status.info.background,
    borderWidth: 1,
    borderColor: theme.colors.status.info.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.sm,
  },
  headerRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  identityBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    lineHeight: 25,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  specialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primary,
    textAlign: rtlTextAlign(),
  },
  statusBadge: {
    minHeight: 26,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 5,
  },
  ratingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: 6,
    borderRadius: theme.borderRadius.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  factText: {
    flexShrink: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  locationFact: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: '30%',
  },
  availableFact: {
    backgroundColor: theme.colors.status.success.background,
    borderWidth: 1,
    borderColor: theme.colors.status.success.border,
    maxWidth: '32%',
  },
  availableFactText: {
    color: theme.colors.status.success.text,
  },
  bookingFact: {
    backgroundColor: theme.colors.status.info.background,
    borderWidth: 1,
    borderColor: theme.colors.status.info.border,
    maxWidth: '44%',
  },
  bookingFactText: {
    color: theme.colors.status.info.text,
  },
  neutralFact: {
    backgroundColor: theme.colors.status.neutral.background,
    borderWidth: 1,
    borderColor: theme.colors.status.neutral.border,
    maxWidth: '40%',
  },
  neutralFactText: {
    color: theme.colors.status.neutral.text,
  },
});

export default DoctorCard;
