import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';
import { rtlTextAlign } from '../lib/rtl';

// ─── Props / State ───────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /** Override the default fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Called when an error is caught (useful for logging). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

// ─── Component ────────────────────────────────────────────────────────────────────

/**
 * Catches rendering errors thrown by Convex queries (or any child component)
 * and displays a recoverable fallback UI.
 *
 * Convex hooks such as `useQuery` throw synchronously during render when the
 * server returns an error or the client encounters a network / auth failure.
 * This boundary catches those errors and presents a friendly retry screen.
 */
class BackendErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) {
        return fallback(error, this.handleRetry);
      }

      return (
        <View style={styles.container}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.danger}
          />
          <Text style={styles.title}>حدث خطأ ما</Text>
          <Text style={styles.subtitle}>
            تعذر تحميل البيانات. يرجى التحقق من اتصالك والمحاولة مرة أخرى.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={theme.colors.white}
              style={styles.retryIcon}
            />
            <Text style={styles.retryLabel}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      );
    }

    return children;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['5xl'],
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    lineHeight: 22,
    marginBottom: theme.spacing['2xl'],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonPressed: {
    opacity: 0.85,
  },
  retryIcon: {
    marginStart: theme.spacing.sm,
  },
  retryLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
    textAlign: 'center',
  },
});

export default BackendErrorBoundary;
