import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthActions } from '@convex-dev/auth/react';
import { theme } from '../../src/lib/theme';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signIn('password', {
        email: email.trim().toLowerCase(),
        password,
        flow: 'signIn',
      });
      router.replace('/');
    } catch (err) {
      setError(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, router, signIn]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* ─── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.title}>نبد</Text>
            <Text style={styles.subtitle}>تسجيل الدخول إلى حسابك</Text>
          </View>

          {/* ─── Form ────────────────────────────────────────────────────── */}
          <View style={styles.form}>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textAlign="right"
              editable={!loading}
            />

            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              textAlign="right"
              editable={!loading}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              activeOpacity={0.7}
              onPress={() => {
                // Placeholder — password reset handled via Convex Auth
              }}
            >
              <Text style={styles.forgotPasswordText}>
                نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.buttonText}>تسجيل الدخول</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Footer ──────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ما عندكش حساب؟</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(auth)/register')}
            >
              <Text style={styles.footerLink}>سجل هنا</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: theme.spacing['3xl'],
    justifyContent: 'center',
  },

  // ─── Header ────────────────────────────────────────────────────────────

  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['5xl'],
  },

  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 32,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },

  subtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 16,
    color: theme.colors.textSecondary,
    writingDirection: 'rtl',
  },

  // ─── Form ──────────────────────────────────────────────────────────────

  form: {
    width: '100%',
  },

  errorText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    writingDirection: 'rtl',
  },

  label: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    writingDirection: 'rtl',
  },

  input: {
    width: '100%',
    height: 48,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
    writingDirection: 'rtl',
  },

  forgotPassword: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing['2xl'],
  },

  forgotPasswordText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },

  button: {
    width: '100%',
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.white,
  },

  // ─── Footer ────────────────────────────────────────────────────────────

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing['4xl'],
    gap: theme.spacing.xs,
  },

  footerText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    writingDirection: 'rtl',
  },

  footerLink: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
    writingDirection: 'rtl',
  },
});
