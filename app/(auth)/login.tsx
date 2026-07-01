import { useState, useCallback } from 'react';
import {
  Alert,
  Modal,
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
import { makeRedirectUri } from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSSO, useSignIn } from '@clerk/clerk-expo';
import { theme } from '../../src/lib/theme';
import { normalizeEmailForAuth } from '../../src/lib/authIdentifiers';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();
  const googleRedirectUrl = makeRedirectUri({ path: 'sso-callback' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!isLoaded || !signIn) {
        throw new Error('Clerk sign-in is not ready.');
      }
      const emailAuthIdentifier = normalizeEmailForAuth(email);
      const signInAttempt = await signIn.create({
        identifier: emailAuthIdentifier,
        password,
        strategy: 'password',
      });
      if (
        signInAttempt.status !== 'complete' ||
        !signInAttempt.createdSessionId
      ) {
        throw new Error('Sign in did not complete.');
      }
      await setActive({ session: signInAttempt.createdSessionId });
      router.replace('/');
    } catch (err) {
      setError(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      );
    } finally {
      setLoading(false);
    }
  }, [email, isLoaded, password, router, setActive, signIn]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    setError(null);

    try {
      const {
        createdSessionId,
        setActive: activateOAuthSession,
      } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: googleRedirectUrl,
      });
      const activateSession = activateOAuthSession ?? setActive;

      if (!createdSessionId || !activateSession) {
        throw new Error('Google sign-in did not complete.');
      }

      await activateSession({ session: createdSessionId });
      router.replace('/');
    } catch (err) {
      setError('تعذر تسجيل الدخول باستخدام Google. حاول مرة أخرى.');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleRedirectUrl, router, setActive, startSSOFlow]);

  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) {
      setError('أدخل بريدك الإلكتروني أولا لإرسال رمز إعادة التعيين');
      return;
    }

    setResetLoading(true);
    setError(null);

    try {
      if (!isLoaded || !signIn) {
        throw new Error('Clerk sign-in is not ready.');
      }
      const emailAuthIdentifier = normalizeEmailForAuth(email);
      await signIn.create({
        identifier: emailAuthIdentifier,
        strategy: 'reset_password_email_code',
      });
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setResetModalVisible(true);
      Alert.alert(
        'تم إرسال رمز إعادة التعيين',
        'تحقق من بريدك الإلكتروني وأدخل الرمز لتغيير كلمة المرور.',
      );
    } catch (err) {
      setError('تعذر إرسال رمز إعادة التعيين لهذا البريد الإلكتروني');
    } finally {
      setResetLoading(false);
    }
  }, [email, isLoaded, signIn]);

  const handleSubmitPasswordReset = useCallback(async () => {
    if (!resetCode.trim() || !newPassword.trim()) {
      setError('أدخل رمز إعادة التعيين وكلمة المرور الجديدة');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setResetLoading(true);
    setError(null);

    try {
      if (!isLoaded || !signIn) {
        throw new Error('Clerk sign-in is not ready.');
      }
      const resetAttempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode.trim(),
        password: newPassword,
      });
      if (
        resetAttempt.status === 'complete' &&
        resetAttempt.createdSessionId
      ) {
        await setActive({ session: resetAttempt.createdSessionId });
      }
      setResetModalVisible(false);
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      router.replace('/');
    } catch (err) {
      setError('رمز إعادة التعيين غير صحيح أو منتهي الصلاحية');
    } finally {
      setResetLoading(false);
    }
  }, [
    confirmNewPassword,
    isLoaded,
    newPassword,
    resetCode,
    router,
    setActive,
    signIn,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* ─── Header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.title}>نبض</Text>
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
              autoCorrect={false}
              textAlign="right"
              editable={!loading && !googleLoading}
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
              editable={!loading && !googleLoading}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              activeOpacity={0.7}
              onPress={handleForgotPassword}
              disabled={loading || resetLoading || googleLoading}
            >
              <Text style={styles.forgotPasswordText}>
                نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.buttonText}>تسجيل الدخول</Text>
              )}
            </TouchableOpacity>

            <View style={styles.oauthDivider}>
              <View style={styles.oauthDividerLine} />
              <Text style={styles.oauthDividerText}>أو</Text>
              <View style={styles.oauthDividerLine} />
            </View>

            <TouchableOpacity
              style={[
                styles.googleButton,
                googleLoading && styles.buttonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleGoogleSignIn}
              disabled={loading || resetLoading || googleLoading}
              accessibilityRole="button"
              accessibilityLabel="المتابعة باستخدام Google"
            >
              {googleLoading ? (
                <ActivityIndicator color={theme.colors.official} />
              ) : (
                <>
                  <View style={styles.googleMark}>
                    <Text style={styles.googleMarkText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>
                    المتابعة باستخدام Google
                  </Text>
                </>
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
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>إعادة تعيين كلمة المرور</Text>
                <Text style={styles.modalSubtitle}>
                  أدخل الرمز الذي وصل إلى بريدك الإلكتروني وكلمة المرور الجديدة
                </Text>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <Text style={styles.label}>رمز إعادة التعيين</Text>
                <TextInput
                  style={styles.input}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="123456"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="number-pad"
                  textAlign="right"
                  editable={!resetLoading}
                />

                <Text style={styles.label}>كلمة المرور الجديدة</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="كلمة المرور الجديدة"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  textAlign="right"
                  editable={!resetLoading}
                />

                <Text style={styles.label}>تأكيد كلمة المرور الجديدة</Text>
                <TextInput
                  style={styles.input}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholder="أعد كتابة كلمة المرور"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  textAlign="right"
                  editable={!resetLoading}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={() => setResetModalVisible(false)}
                    disabled={resetLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalSecondaryButtonText}>إلغاء</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalPrimaryButton,
                      resetLoading && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmitPasswordReset}
                    disabled={resetLoading}
                    activeOpacity={0.8}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color={theme.colors.white} />
                    ) : (
                      <Text style={styles.buttonText}>تغيير كلمة المرور</Text>
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
    color: theme.colors.official,
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
    color: theme.colors.official,
    writingDirection: 'rtl',
  },

  button: {
    width: '100%',
    height: 50,
    backgroundColor: theme.colors.official,
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

  oauthDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginVertical: theme.spacing.lg,
  },

  oauthDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderStrong,
  },

  oauthDividerText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  googleButton: {
    width: '100%',
    height: 50,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.official,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
  },

  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleMarkText: {
    fontFamily: theme.typography.fontFamily.latinMedium,
    fontSize: 14,
    color: theme.colors.official,
  },

  googleButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.official,
    writingDirection: 'rtl',
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
    color: theme.colors.official,
    writingDirection: 'rtl',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },

  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
  },

  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.sm,
  },

  modalSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.lg,
  },

  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },

  modalPrimaryButton: {
    flex: 1.4,
    height: 50,
    backgroundColor: theme.colors.official,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalSecondaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalSecondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },

});
