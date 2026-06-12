import { useState, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
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
  const [resetLoading, setResetLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
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

  const handleForgotPassword = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('أدخل بريدك الإلكتروني أولاً لإعادة تعيين كلمة المرور');
      return;
    }

    setResetLoading(true);
    setError(null);

    try {
      await signIn('password', {
        email: normalizedEmail,
        flow: 'reset',
      });
      setResetModalVisible(true);
      Alert.alert(
        'تم إرسال رمز التحقق',
        'أدخل رمز التحقق وكلمة المرور الجديدة لإكمال العملية.',
      );
    } catch {
      Alert.alert(
        'تعذر إرسال رمز التحقق',
        'تأكد من البريد الإلكتروني ثم حاول مرة أخرى.',
      );
    } finally {
      setResetLoading(false);
    }
  }, [email, signIn]);

  const handleSubmitPasswordReset = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!resetCode.trim()) {
      Alert.alert('رمز التحقق مطلوب', 'أدخل الرمز المرسل إلى بريدك الإلكتروني.');
      return;
    }
    if (resetPassword.length < 8) {
      Alert.alert('كلمة المرور قصيرة', 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      Alert.alert('كلمتا المرور غير متطابقتين', 'أعد إدخال كلمة المرور الجديدة.');
      return;
    }

    setResetLoading(true);
    try {
      await signIn('password', {
        email: normalizedEmail,
        code: resetCode.trim(),
        newPassword: resetPassword,
        flow: 'reset-verification',
      });
      setResetModalVisible(false);
      setResetCode('');
      setResetPassword('');
      setResetPasswordConfirm('');
      Alert.alert('تم تغيير كلمة المرور', 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');
    } catch {
      Alert.alert(
        'تعذر تغيير كلمة المرور',
        'تحقق من الرمز وكلمة المرور الجديدة ثم حاول مرة أخرى.',
      );
    } finally {
      setResetLoading(false);
    }
  }, [email, resetCode, resetPassword, resetPasswordConfirm, signIn]);

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
              onPress={handleForgotPassword}
              disabled={loading || resetLoading}
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

          <Modal
            visible={resetModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setResetModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.resetModal}>
                <Text style={styles.resetTitle}>إعادة تعيين كلمة المرور</Text>
                <Text style={styles.resetDescription}>
                  أدخل رمز التحقق وكلمة المرور الجديدة.
                </Text>

                <Text style={styles.label}>رمز التحقق</Text>
                <TextInput
                  style={styles.input}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="رمز التحقق"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  textAlign="right"
                  editable={!resetLoading}
                />

                <Text style={styles.label}>كلمة المرور الجديدة</Text>
                <TextInput
                  style={styles.input}
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  textAlign="right"
                  editable={!resetLoading}
                />

                <Text style={styles.label}>تأكيد كلمة المرور</Text>
                <TextInput
                  style={styles.input}
                  value={resetPasswordConfirm}
                  onChangeText={setResetPasswordConfirm}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  textAlign="right"
                  editable={!resetLoading}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    activeOpacity={0.8}
                    onPress={() => setResetModalVisible(false)}
                    disabled={resetLoading}
                  >
                    <Text style={styles.modalButtonSecondaryText}>إلغاء</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    activeOpacity={0.8}
                    onPress={handleSubmitPasswordReset}
                    disabled={resetLoading}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color={theme.colors.white} />
                    ) : (
                      <Text style={styles.modalButtonPrimaryText}>تأكيد</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },

  resetModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
  },

  resetTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.sm,
  },

  resetDescription: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginBottom: theme.spacing.lg,
    writingDirection: 'rtl',
  },

  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },

  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalButtonSecondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },

  modalButtonSecondaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },

  modalButtonPrimaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
});
