import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
    ({ item }: { item: SpecialtyItem }) => (
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
          <Text style={[styles.iconEmoji, compact && styles.iconEmojiCompact]}>
            {item.icon}
          </Text>
        </View>
        <Text
          style={[styles.label, compact && styles.labelCompact]}
          numberOfLines={1}
        >
          {item.nameAr}
        </Text>
      </Pressable>
    ),
    [compact, handlePress],
  );

  const keyExtractor = useCallback((item: SpecialtyItem) => item.id, []);

  return (
    <FlatList
      data={specialties}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 64;
const CIRCLE_SIZE_COMPACT = 48;
const EMOJI_SIZE = 28;
const EMOJI_SIZE_COMPACT = 22;

const styles = StyleSheet.create({
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
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  iconCircleCompact: {
    width: CIRCLE_SIZE_COMPACT,
    height: CIRCLE_SIZE_COMPACT,
    borderRadius: CIRCLE_SIZE_COMPACT / 2,
    marginBottom: theme.spacing.xs,
  },
  iconEmoji: {
    fontSize: EMOJI_SIZE,
  },
  iconEmojiCompact: {
    fontSize: EMOJI_SIZE_COMPACT,
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
