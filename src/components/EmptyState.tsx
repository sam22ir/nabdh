import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Panel } from '@/components/ui';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActionButton {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  /** Ionicons name is preferred; emoji strings are still supported for old call sites. */
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
  const isIonicon = icon && icon in Ionicons.glyphMap;

  return (
    <View style={styles.container} accessibilityRole="text">
      <Panel style={styles.panel}>
        {icon ? (
          <View style={styles.iconFrame}>
            {isIonicon ? (
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={theme.colors.official}
              />
            ) : (
              <Text style={styles.iconFallback}>{icon}</Text>
            )}
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {action ? (
          <Button
            label={action.label}
            onPress={action.onPress}
            icon="arrow-back"
            style={styles.actionButton}
          />
        ) : null}
      </Panel>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['3xl'],
  },
  panel: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
  },
  iconFrame: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconFallback: {
    fontSize: 24,
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
    alignSelf: 'stretch',
  },
});

export default EmptyState;
