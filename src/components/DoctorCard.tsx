import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Panel, TrustRow } from '@/components/ui';
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
}

export interface DoctorCardProps {
  doctor: DoctorCardData;
  isAvailableToday?: boolean;
  onPress?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  isAvailableToday = false,
  onPress,
}) => {
  const renderStars = () => {
    const full = Math.floor(doctor.avgRating);
    const hasHalf = doctor.avgRating - full >= 0.5;

    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          let iconColor: string;

          if (star <= full) {
            iconName = 'star';
            iconColor = theme.colors.warning;
          } else if (star === full + 1 && hasHalf) {
            iconName = 'star-half';
            iconColor = theme.colors.warning;
          } else {
            iconName = 'star-outline';
            iconColor = theme.colors.border;
          }

          return (
            <Ionicons
              key={star}
              name={iconName}
              size={14}
              color={iconColor}
              style={styles.starIcon}
            />
          );
        })}
      </View>
    );
  };

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
        {/* Top row: Avatar placeholder + name/specialty + verification */}
        <View style={styles.topRow}>
          {/* Avatar placeholder */}
          <View style={styles.avatar}>
            <Ionicons
              name="person"
              size={24}
              color={theme.colors.official}
            />
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {doctor.fullNameAr}
              </Text>
              <Badge
                label={doctor.isVerified ? 'موثق' : 'غير موثق'}
                tone={doctor.isVerified ? 'success' : 'warning'}
                icon={
                  doctor.isVerified
                    ? 'shield-checkmark-outline'
                    : 'alert-circle-outline'
                }
              />
            </View>
            <Text style={styles.specialty} numberOfLines={1}>
              {doctor.specialty.nameAr}
            </Text>

            {/* Rating */}
            <View style={styles.ratingRow}>
              {renderStars()}
              <Text style={styles.ratingText}>
                {doctor.avgRating.toFixed(1)}
              </Text>
              <Text style={styles.reviewCount}>
                ({doctor.totalReviews})
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom row: Wilaya + availability */}
        <View style={styles.bottomRow}>
          <TrustRow
            icon="location-outline"
            label="الولاية"
            value={doctor.wilaya.nameAr || 'غير محددة'}
          />

          {isAvailableToday && (
            <Badge
              label="متاح اليوم"
              tone="success"
              icon="checkmark-circle-outline"
            />
          )}
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
    gap: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  specialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginHorizontal: 1,
  },
  ratingText: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.xs,
  },
  reviewCount: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.md,
  },
});

export default DoctorCard;
