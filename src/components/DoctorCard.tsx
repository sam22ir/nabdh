import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      {/* Top row: Avatar placeholder + name/specialty + verification */}
      <View style={styles.topRow}>
        {/* Avatar placeholder */}
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {doctor.fullNameAr}
          </Text>
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

        {/* Verification badge */}
        {doctor.isVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={18} color={theme.colors.success} />
          </View>
        ) : (
          <View style={styles.unverifiedBadge}>
            <Ionicons name="warning" size={14} color={theme.colors.warning} />
            <Text style={styles.unverifiedText}>غير موثق</Text>
          </View>
        )}
      </View>

      {/* Bottom row: Wilaya + availability */}
      <View style={styles.bottomRow}>
        <View style={styles.wilayaContainer}>
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.wilayaText} numberOfLines={1}>
            {doctor.wilaya.nameAr}
          </Text>
        </View>

        {isAvailableToday && (
          <View style={styles.availableBadge}>
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.white} />
            <Text style={styles.availableText}>متاح اليوم</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    ...theme.shadows.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  specialty: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
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
  verifiedBadge: {
    marginLeft: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.sm,
  },
  unverifiedText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.warning,
    marginLeft: theme.spacing.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  wilayaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wilayaText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  availableText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 11,
    color: theme.colors.white,
    marginLeft: theme.spacing.xs,
  },
});

export default DoctorCard;
