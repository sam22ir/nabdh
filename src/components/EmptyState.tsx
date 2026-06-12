import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionButton {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  /** Emoji string rendered as the icon. */
  icon?: string;
  /** Primary title displayed in Arabic. */
  title: string;
  /** Secondary subtitle displayed in Arabic. */
  subtitle: string;
  /** Optional action button shown below the subtitle. */
  action?: ActionButton;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => {
  return (
    <View style={styles.container} accessibilityRole="text">
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {action ? (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['5xl'],
  },
  icon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    lineHeight: 22,
  },
  actionButton: {
    marginTop: theme.spacing['2xl'],
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
    textAlign: 'center',
  },
});

export default EmptyState;
