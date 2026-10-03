import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useQuery } from 'convex/react';
import { Link, useRouter } from 'expo-router';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import ClerkCaptcha from '../../../src/components/ClerkCaptcha';
import EmailVerificationPanel from '../../../src/components/EmailVerificationPanel';
import AuthBackButton from '../../../src/components/AuthBackButton';
import LegalConsent from '../../../src/components/LegalConsent';
import WilayaPicker from '../../../src/components/WilayaPicker';
import {
  validateClinicRegistration,
  weakPasswordMessage,
} from '../../../src/lib/authFormValidation';
import {
  describeClerkSignUpState,
  isClerkIdentifierExistsError,
  isClerkWeakPasswordError,
} from '../../../src/lib/clerkErrors';
import { savePendingRegistration } from '../../../src/lib/pendingRegistration';
import { createLegalAcceptanceEvidence } from '../../../src/lib/legal';
import {
  buildClerkPasswordIdentifier,
  buildClerkPasswordIdentifierFromLoginKey,
  buildPhoneIdentity,
  buildUniquePhoneLoginKey,
} from '../../../src/lib/phone';
import { setStoredAuthRole } from '../../../src/lib/roleSelection';
import { captureAuthException } from '../../../src/lib/sentry';
import { theme } from '../../../src/lib/theme';

export default function ClinicRegisterScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { isSignedIn, signOut } = useAuth();
  const wilayas = useQuery(api.locations.listWilayas, {});
  const [clinicName, setClinicName] = useState('');
  const [wilayaId, setWilayaId] = useState<Id<'wilayas'> | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const completeVerifiedRegistration = async (sessionId: string) => {
    await setActive({ session: sessionId });
    await setStoredAuthRole('clinic');
    router.replace('/(auth)/finalize-registration');
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !privacyAccepted) {
      setError('يجب الموافقة على شروط الاستخدام والإقرار بقراءة سياسة الخصوصية.');
      return;
    }
    const legalEvidence = createLegalAcceptanceEvidence();
    const errors = validateClinicRegistration({
      clinicName,
      phone,
      email,
      wilayaId,
      address,
      mapUrl,
      password,
      confirmPassword,
    });
    if (Object.keys(errors).length > 0 || !isLoaded || !isSignInLoaded || !wilayaId) {
      setError(Object.values(errors)[0] ?? 'تحقق من البيانات');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (isSignedIn) {
        await signOut();
      }
      let phoneLoginKey = buildPhoneIdentity(phone).phoneLoginKey;
      const clerkIdentifier = buildClerkPasswordIdentifier(phone);
      let sessionId: string | null | undefined;
      try {
        const created = await signUp.create({
          username: clerkIdentifier,
          emailAddress: email.trim().toLowerCase(),
          password,
        });
        if (created.status !== 'complete') {
          await savePendingRegistration({
            role: 'clinic', clinicName, phone, phoneLoginKey, email,
            wilayaId, address, mapUrl, ...legalEvidence,
          });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setAwaitingEmailVerification(true);
          return;
        }
        sessionId = created.createdSessionId;
      } catch (signUpError) {
        if (!isClerkIdentifierExistsError(signUpError)) {
          throw signUpError;
        }
        try {
          const result = await signIn.create({
            identifier: clerkIdentifier,
            password,
          });
          if (result.status !== 'complete') {
            throw new Error('Invalid login state');
          }
          sessionId = result.createdSessionId;
        } catch {
          phoneLoginKey = buildUniquePhoneLoginKey(phone);
          const created = await signUp.create({
            username: buildClerkPasswordIdentifierFromLoginKey(phoneLoginKey),
            emailAddress: email.trim().toLowerCase(),
            password,
          });
          if (created.status !== 'complete') {
            await savePendingRegistration({
              role: 'clinic', clinicName, phone, phoneLoginKey, email,
              wilayaId, address, mapUrl, ...legalEvidence,
            });
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setAwaitingEmailVerification(true);
            return;
          }
          sessionId = created.createdSessionId;
        }
      }

      await savePendingRegistration({
        role: 'clinic',
        clinicName,
        phone,
        phoneLoginKey,
        email,
        wilayaId,
        address,
        mapUrl,
        ...legalEvidence,
      });
      if (!sessionId) throw new Error('Missing Clerk session');
      await completeVerifiedRegistration(sessionId);
    } catch (caughtError) {
      captureAuthException(caughtError, {
        flow: 'register',
        role: 'clinic',
      });
      if (isClerkWeakPasswordError(caughtError)) {
        setError(weakPasswordMessage);
        return;
      }
      setError('تعذر إنشاء الحساب. تأكد أن الهاتف أو البريد غير مستخدمين من قبل.');
    } finally {
      setSubmitting(false);
    }
  };

  if (awaitingEmailVerification) {
    return (
      <EmailVerificationPanel
        email={email}
        signUp={signUp}
        onBack={() => setAwaitingEmailVerification(false)}
        onVerified={completeVerifiedRegistration}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <AuthBackButton />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>إنشاء حساب مركز</Text>
      <TextInput
        value={clinicName}
        onChangeText={setClinicName}
        placeholder="اسم المركز"
        style={styles.input}
      />
      <WilayaPicker
        options={wilayas ?? []}
        value={wilayaId}
        onChange={setWilayaId}
        disabled={wilayas === undefined}
      />
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="رقم الهاتف"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="البريد الإلكتروني"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="العنوان اختياري"
        style={styles.input}
      />
      <TextInput
        value={mapUrl}
        onChangeText={setMapUrl}
        placeholder="رابط Google Maps اختياري"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="كلمة المرور"
        secureTextEntry
        style={styles.input}
      />
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="تأكيد كلمة المرور"
        secureTextEntry
        style={styles.input}
      />
      <LegalConsent
        termsAccepted={termsAccepted}
        privacyAccepted={privacyAccepted}
        onTermsChange={setTermsAccepted}
        onPrivacyChange={setPrivacyAccepted}
      />
      <ClerkCaptcha />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={() => void handleSubmit()}>
        {submitting ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.buttonText}>إنشاء الحساب</Text>
        )}
      </Pressable>
      <Link href="/(auth)/clinic/login" style={styles.link}>
        لدي حساب مركز
      </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: 88,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: 'Cairo-Bold',
    fontSize: 24,
    color: theme.colors.textPrimary,
    textAlign: 'center',
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
  wilayaList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  wilayaListContent: {
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  wilayaRow: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
  },
  optionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  optionText: {
    fontFamily: 'Cairo-Bold',
    color: theme.colors.textPrimary,
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
