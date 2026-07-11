import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';

type IconName = keyof typeof Ionicons.glyphMap;
type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textStyle = [
    styles.buttonText,
    variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary,
    isDisabled && styles.buttonTextDisabled,
  ];
  const iconColor =
    variant === 'primary' ? theme.colors.white : theme.colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.white : theme.colors.primary}
        />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={iconColor} />
      ) : null}
      <Text style={textStyle} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const palette = theme.colors.status[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={palette.text} /> : null}
      <Text style={[styles.badgeText, { color: palette.text }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

interface PanelProps {
  children: React.ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Panel({ children, elevated = false, style }: PanelProps) {
  return (
    <View style={[styles.panel, elevated && styles.panelElevated, style]}>
      {children}
    </View>
  );
}

interface AppHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  action,
  style,
}: AppHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.headerTitleRow}>
          {icon ? (
            <View style={styles.headerIcon}>
              <Ionicons name={icon} size={18} color={theme.colors.official} />
            </View>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.headerSubtitle} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

interface LoadingStateProps {
  label: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

interface TrustRowProps {
  icon: IconName;
  label: string;
  value?: string;
  tone?: BadgeTone;
}

export function TrustRow({
  icon,
  label,
  value,
  tone = 'neutral',
}: TrustRowProps) {
  const palette = theme.colors.status[tone];

  return (
    <View style={styles.trustRow}>
      <View style={[styles.trustIcon, { backgroundColor: palette.background }]}>
        <Ionicons name={icon} size={15} color={palette.text} />
      </View>
      <Text style={styles.trustLabel} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.trustValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: theme.colors.white,
  },
  buttonTextSecondary: {
    color: theme.colors.primary,
  },
  buttonTextDisabled: {
    color: theme.colors.textMuted,
  },
  badge: {
    minHeight: 28,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  badgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
  },
  panel: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  panelElevated: {
    ...theme.shadows.md,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 23,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: rtlTextAlign(),
  },
  headerAction: {
    paddingTop: theme.spacing.xs,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['3xl'],
    gap: theme.spacing.md,
  },
  loadingLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  trustRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  trustIcon: {
    width: 26,
    height: 26,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  trustValue: {
    flexShrink: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
});
