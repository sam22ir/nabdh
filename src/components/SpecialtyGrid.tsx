import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpecialtyItem {
  id: string;
  nameAr: string;
  icon: string;
}

export interface SpecialtyGridProps {
  /** Array of specialties to display. */
  specialties: SpecialtyItem[];
  /** Called when a specialty chip is tapped. */
  onSelect?: (specialty: SpecialtyItem) => void;
  /** Whether to render in compact chip mode for filter/search. Default false. */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SpecialtyGrid: React.FC<SpecialtyGridProps> = ({
  specialties,
  onSelect,
  compact = false,
}) => {
  const handlePress = useCallback(
    (specialty: SpecialtyItem) => {
      onSelect?.(specialty);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: SpecialtyItem }) => {
      const iconName = (
        item.icon in Ionicons.glyphMap ? item.icon : 'medical-outline'
      ) as keyof typeof Ionicons.glyphMap;

      return (
        <Pressable
          style={({ pressed }) => [
            styles.itemWrapper,
            compact && styles.itemWrapperCompact,
            pressed && styles.itemPressed,
          ]}
          onPress={() => handlePress(item)}
          accessibilityRole="button"
          accessibilityLabel={item.nameAr}
        >
          <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
            <Ionicons
              name={iconName}
              size={compact ? ICON_SIZE_COMPACT : ICON_SIZE}
              color={theme.colors.official}
            />
          </View>
          <Text
            style={[styles.label, compact && styles.labelCompact]}
            numberOfLines={1}
          >
            {item.nameAr}
          </Text>
        </Pressable>
      );
    },
    [compact, handlePress],
  );

  const keyExtractor = useCallback((item: SpecialtyItem) => item.id, []);

  return (
    <FlatList
      style={styles.list}
      data={specialties}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal
      scrollEnabled={specialties.length > 1}
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.contentContainer}
    />
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 64;
const CIRCLE_SIZE_COMPACT = 48;
const ICON_SIZE = 26;
const ICON_SIZE_COMPACT = 20;

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
    width: '100%',
    minHeight: CIRCLE_SIZE + theme.spacing.sm + theme.spacing.md * 2 + 18,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  itemWrapper: {
    alignItems: 'center',
    width: 80,
  },
  itemWrapperCompact: {
    width: 64,
  },
  itemPressed: {
    opacity: 0.75,
  },
  iconCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconCircleCompact: {
    width: CIRCLE_SIZE_COMPACT,
    height: CIRCLE_SIZE_COMPACT,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
});

export default SpecialtyGrid;
