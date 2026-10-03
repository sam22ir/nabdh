import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useConvex } from 'convex/react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { api } from '@/convex/_generated/api';
import { isPasswordStrongEnough } from '@/lib/phone';
import { setStoredAuthRole, type PublicAuthRole } from '@/lib/roleSelection';
import { theme } from '@/lib/theme';

type Step = 'email' | 'reset';

const ROLE_LABELS: Record<PublicAuthRole, string> = {
  patient: 'العميل',
  doctor: 'المختص',
  clinic: 'المركز',
};

function isRole(value: string | undefined): value is PublicAuthRole {
  return value === 'patient' || value === 'doctor' || value === 'clinic';
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { signIn, setActive, isLoaded } = useSignIn();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = isRole(params.role) ? params.role : null;
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('أدخل بريداً إلكترونياً صحيحاً');
      return;
    }
    if (!role || !isLoaded) {
      setError('تعذر تحديد نوع الحساب. ارجع إلى صفحة الدخول.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const account = await convex.query(api.users.findAccountByIdentifier, {
        phone: '',
        email: normalizedEmail,
      });
      if (!account.exists || account.role !== role) {
        setError(`لا يوجد حساب ${ROLE_LABELS[role]} بهذا البريد الإلكتروني`);
        return;
      }

      const created = await signIn.create({ identifier: normalizedEmail });
      const resetFactor = (created.supportedFirstFactors as Array<{
        strategy: string;
        emailAddressId?: string;
      }> | undefined)?.find(
        (factor) => factor.strategy === 'reset_password_email_code',
      );
      if (!resetFactor?.emailAddressId) {
        setError('استعادة كلمة المرور بالبريد غير مفعلة لهذا الحساب بعد.');
        return;
      }
      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
        emailAddressId: resetFactor.emailAddressId,
      });
      setStep('reset');
    } catch {
      setError('تعذر إرسال رمز الاستعادة. تحقق من البريد وحاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded || !role) return;
    if (code.trim().length < 6) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      setError('اختر كلمة مرور قوية من 8 أحرف على الأقل، تشمل أحرفاً وأرقاماً.');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status !== 'complete' || !result.createdSessionId) {
        setError('لم يكتمل تغيير كلمة المرور. أعد المحاولة.');
        return;
      }
      await setActive({ session: result.createdSessionId });
      await setStoredAuthRole(role);
      router.replace(
        role === 'patient'
          ? '/(patient)'
          : role === 'doctor'
            ? '/(doctor)/dashboard'
            : '/(clinic)/dashboard',
      );
    } catch {
      setError('رمز التحقق أو كلمة المرور غير صحيحين.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginHref = role ? `/(auth)/${role}/login` : '/';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>استعادة كلمة المرور</Text>
      {step === 'email' ? (
        <>
          <Text style={styles.copy}>
            أدخل البريد الإلكتروني المسجل في حسابك لإرسال رمز استعادة آمن.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="البريد الإلكتروني"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            textAlign="right"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            disabled={submitting}
            onPress={() => void sendCode()}
          >
            {submitting ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>إرسال الرمز</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.copy}>أدخل الرمز المرسل إلى {email.trim().toLowerCase()} ثم اختر كلمة مرور جديدة.</Text>
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
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="كلمة المرور الجديدة"
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
            textAlign="right"
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="تأكيد كلمة المرور الجديدة"
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
            textAlign="right"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            disabled={submitting}
            onPress={() => void resetPassword()}
          >
            {submitting ? <ActivityIndicator color={theme.colors.white} /> : <Text style={styles.buttonText}>تغيير كلمة المرور</Text>}
          </Pressable>
          <Pressable disabled={submitting} onPress={() => void sendCode()}>
            <Text style={styles.link}>إعادة إرسال الرمز</Text>
          </Pressable>
        </>
      )}
      <Link href={loginHref as never} style={styles.link}>العودة إلى الدخول</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: theme.spacing.md, padding: theme.spacing.lg, backgroundColor: theme.colors.background },
  title: { fontFamily: theme.typography.fontFamily.arabicBold, fontSize: 24, color: theme.colors.textPrimary, textAlign: 'right' },
  copy: { fontFamily: theme.typography.fontFamily.arabic, fontSize: 14, lineHeight: 23, color: theme.colors.textSecondary, textAlign: 'right' },
  input: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.sm, paddingHorizontal: theme.spacing.md, fontFamily: theme.typography.fontFamily.arabic, color: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceRaised },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.primary },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { fontFamily: theme.typography.fontFamily.arabicBold, color: theme.colors.white, fontSize: 16 },
  error: { fontFamily: theme.typography.fontFamily.arabic, color: theme.colors.danger, textAlign: 'right' },
  link: { fontFamily: theme.typography.fontFamily.arabicBold, color: theme.colors.primary, textAlign: 'center', marginTop: theme.spacing.xs },
});
