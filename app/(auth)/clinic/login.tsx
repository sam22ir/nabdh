import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useConvex } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { api } from '../../../convex/_generated/api';
import { validateLogin } from '../../../src/lib/authFormValidation';
import { buildClerkPasswordIdentifierFromLoginKey } from '../../../src/lib/phone';
import { setStoredAuthRole } from '../../../src/lib/roleSelection';
import { theme } from '../../../src/lib/theme';
import AuthBackButton from '../../../src/components/AuthBackButton';

export default function ClinicLoginScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signOut } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const errors = validateLogin({ phone, password });
    if (Object.keys(errors).length > 0 || !isLoaded) {
      setError(Object.values(errors)[0] ?? 'تحقق من البيانات');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const account = await convex.query(api.users.findAccountByIdentifier, {
        phone,
        email: '',
      });
      if (!account.exists) {
        setError('رقم الهاتف غير مسجل');
        return;
      }
      if (account.role !== 'clinic') {
        setError('هذا الحساب ليس حساب عيادة');
        return;
      }
      const result = await signIn.create({
        identifier: buildClerkPasswordIdentifierFromLoginKey(account.phoneLoginKey),
        password,
      });
      if (result.status !== 'complete') {
        throw new Error('Invalid login state');
      }
      await setActive({ session: result.createdSessionId });
      const resolution = await convex.query(api.users.getLoginResolution, {
        role: 'clinic',
        phone: phone.trim(),
      });
      if (!resolution.ok) {
        await signOut();
        setError(
          resolution.reason === 'role_mismatch'
            ? 'هذا الحساب ليس حساب عيادة'
            : 'استخدم نفس رقم الهاتف المسجل',
        );
        return;
      }
      await setStoredAuthRole('clinic');
      router.replace('/(clinic)/dashboard');
    } catch {
      setError('رقم الهاتف أو كلمة المرور غير صحيحة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuthBackButton />
      <Text style={styles.title}>دخول العيادة</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="رقم الهاتف"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="كلمة المرور"
        secureTextEntry
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={() => void handleSubmit()}>
        {submitting ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.buttonText}>دخول</Text>
        )}
      </Pressable>
      <Link href={{ pathname: '/(auth)/forgot-password', params: { role: 'clinic' } }} style={styles.link}>
        نسيت كلمة المرور؟
      </Link>
      <Link href="/(auth)/clinic/register" style={styles.link}>
        إنشاء حساب عيادة
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: 'Cairo-Bold',
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    backgroundColor: theme.colors.surface,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontFamily: 'Cairo-Bold',
    color: theme.colors.white,
    fontSize: 16,
  },
  error: {
    fontFamily: 'Cairo-Regular',
    color: theme.colors.danger,
    textAlign: 'right',
  },
  link: {
    fontFamily: 'Cairo-Bold',
    color: theme.colors.primary,
    textAlign: 'center',
  },
});
