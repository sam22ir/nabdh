import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';

import { theme } from '@/lib/theme';

type SignUpResource = NonNullable<ReturnType<typeof useSignUp>['signUp']>;

type Props = {
  email: string;
  signUp: SignUpResource;
  onVerified: (sessionId: string) => Promise<void>;
  onBack: () => void;
};

export default function EmailVerificationPanel({ email, signUp, onVerified, onBack }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verify = async () => {
    if (code.trim().length < 6) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== 'complete' || !result.createdSessionId) {
        setError('تعذر التحقق من البريد. أعد المحاولة.');
        return;
      }
      await onVerified(result.createdSessionId);
    } catch {
      setError('رمز التحقق غير صحيح أو انتهت صلاحيته.');
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setSubmitting(true);
    setError('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch {
      setError('تعذر إعادة إرسال الرمز حالياً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>تحقق من بريدك الإلكتروني</Text>
      <Text style={styles.copy}>أرسلنا رمزاً من 6 أرقام إلى {email.trim().toLowerCase()}.</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="رمز التحقق"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
        style={styles.input}
        textAlign="center"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={() => void verify()}>
        {submitting ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>تأكيد البريد</Text>}
      </Pressable>
      <Pressable disabled={submitting} onPress={() => void resend()}>
        <Text style={styles.link}>إعادة إرسال الرمز</Text>
      </Pressable>
      <Pressable disabled={submitting} onPress={onBack}>
        <Text style={styles.link}>تعديل البريد الإلكتروني</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 24, color: theme.colors.textPrimary, textAlign: 'right' },
  copy: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, lineHeight: 23, color: theme.colors.textSecondary, textAlign: 'right' },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.surfaceRaised, fontFamily: theme.typography.fontFamily.latinMedium, fontSize: 18, color: theme.colors.textPrimary },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primary },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 16, color: theme.colors.white },
  error: { fontFamily: theme.typography.fontFamily.arabic, color: theme.colors.danger, textAlign: 'right' },
  link: { fontFamily: theme.typography.fontFamily.arabicBold, color: theme.colors.primary, textAlign: 'center' },
});
