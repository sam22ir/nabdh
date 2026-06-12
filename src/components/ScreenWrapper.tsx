import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScreenWrapperProps {
  /** Content rendered inside the safe area. */
  children: React.ReactNode;
  /** Optional title displayed in a header bar at the top of the screen. */
  title?: string;
  /** Background color override (defaults to theme.colors.background). */
  backgroundColor?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  title,
  backgroundColor,
}) => {
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: backgroundColor ?? theme.colors.background },
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}
      {children}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    writingDirection: 'rtl',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
});

export default ScreenWrapper;
