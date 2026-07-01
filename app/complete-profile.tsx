import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import { normalizePhoneForAuth } from '../src/lib/authIdentifiers';
import { theme } from '../src/lib/theme';
import type { Gender, UserRole } from '../src/lib/types';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const context = useQuery(api.users.getProfileCompletionContext, {});
  const registerUser = useMutation(api.users.register);
  const wilayas = useQuery(api.locations.listWilayas, {});
  const specialties = useQuery(api.specialties.list, {});

  const googleEmail =
    context?.email ?? user?.primaryEmailAddress?.emailAddress ?? '';
  const googleName = context?.name ?? user?.fullName ?? '';

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullNameAr, setFullNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayaId, setWilayaId] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [specialtyId, setSpecialtyId] = useState('');
  const [orderRegistrationNumber, setOrderRegistrationNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const communes = useQuery(
    api.locations.listCommunesByWilaya,
    wilayaId ? { wilayaId: wilayaId as Id<'wilayas'> } : 'skip',
  );

  const duplicateEmailMessage =
    'هذا البريد مسجل من قبل. سجّل الدخول بكلمة المرور أو أعد تعيينها، أو استخدم حساب Google آخر.';

  useEffect(() => {
    if (fullNameAr.length === 0 && googleName.length > 0) {
      setFullNameAr(googleName);
    }
  }, [fullNameAr.length, googleName]);

  useEffect(() => {
    if (context === undefined) return;
    if (!context.isAuthenticated) {
      router.replace('/(auth)/onboarding');
      return;
    }
    if (context.existingUser?.role === 'patient') {
      router.replace('/(patient)');
    } else if (context.existingUser?.role === 'doctor') {
      router.replace('/(doctor)/dashboard');
    }
  }, [context, router]);

  const canSubmit = useMemo(() => {
    if (
      !selectedRole ||
      !fullNameAr.trim() ||
      !phone.trim() ||
      !wilayaId ||
      !googleEmail
    ) {
      return false;
    }

    if (selectedRole === 'patient') {
      return Boolean(communeId && dateOfBirth && gender);
    }

    return Boolean(specialtyId && orderRegistrationNumber.trim().length >= 3);
  }, [
    communeId,
    dateOfBirth,
    fullNameAr,
    gender,
    googleEmail,
    orderRegistrationNumber,
    phone,
    selectedRole,
    specialtyId,
    wilayaId,
  ]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/onboarding');
  }, [router, signOut]);

  const handleSubmit = useCallback(async () => {
    if (!selectedRole) {
      setError('اختر نوع الحساب أولا.');
      return;
    }
    if (context?.emailBelongsToAnotherUser) {
      setError(duplicateEmailMessage);
      return;
    }
    if (!canSubmit) {
      setError('أكمل كل الحقول المطلوبة قبل المتابعة.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await registerUser({
        fullNameAr: fullNameAr.trim(),
        phone: normalizePhoneForAuth(phone),
        email: googleEmail,
        role: selectedRole,
        wilayaId: wilayaId as Id<'wilayas'>,
        communeId:
          selectedRole === 'patient'
            ? (communeId as Id<'communes'>)
            : undefined,
        dateOfBirth: selectedRole === 'patient' ? dateOfBirth : undefined,
        gender: selectedRole === 'patient' ? gender : undefined,
        specialtyId:
          selectedRole === 'doctor'
            ? (specialtyId as Id<'specialties'>)
            : undefined,
        orderRegistrationNumber:
          selectedRole === 'doctor'
            ? orderRegistrationNumber.trim()
            : undefined,
      });
      router.replace('/');
    } catch {
      setError('تعذر إكمال الملف. تحقق من البيانات ثم حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    communeId,
    context?.emailBelongsToAnotherUser,
    dateOfBirth,
    duplicateEmailMessage,
    fullNameAr,
    gender,
    googleEmail,
    orderRegistrationNumber,
    phone,
    registerUser,
    router,
    selectedRole,
    specialtyId,
    wilayaId,
  ]);

  if (context === undefined || wilayas === undefined || specialties === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.official} />
      </View>
    );
  }

  if (!context.isAuthenticated || context.existingUser) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>أكمل ملفك في نبض</Text>
          <Text style={styles.subtitle}>
            اختر نوع الحساب وأكمل البيانات المطلوبة للمتابعة.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {context.emailBelongsToAnotherUser ? (
          <Text style={styles.errorText}>{duplicateEmailMessage}</Text>
        ) : null}

        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              selectedRole === 'patient' && styles.roleButtonActive,
            ]}
            onPress={() => setSelectedRole('patient')}
          >
            <Text
              style={[
                styles.roleText,
                selectedRole === 'patient' && styles.roleTextActive,
              ]}
            >
              أنا مريض
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.roleButton,
              selectedRole === 'doctor' && styles.roleButtonActive,
            ]}
            onPress={() => setSelectedRole('doctor')}
          >
            <Text
              style={[
                styles.roleText,
                selectedRole === 'doctor' && styles.roleTextActive,
              ]}
            >
              أنا طبيب
            </Text>
          </TouchableOpacity>
        </View>

        <FieldLabel>البريد الإلكتروني</FieldLabel>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={googleEmail}
          editable={false}
          textAlign="right"
        />

        <FieldLabel>الاسم الكامل</FieldLabel>
        <TextInput
          style={styles.input}
          value={fullNameAr}
          onChangeText={setFullNameAr}
          placeholder="الاسم الكامل"
          textAlign="right"
        />

        <FieldLabel>رقم الهاتف</FieldLabel>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="0555 12 34 56"
          keyboardType="phone-pad"
          textAlign="right"
        />

        <FieldLabel>الولاية</FieldLabel>
        <OptionList
          options={wilayas.map((wilaya) => ({
            id: wilaya._id,
            label: wilaya.nameAr,
          }))}
          selectedId={wilayaId}
          onSelect={(id) => {
            setWilayaId(id);
            setCommuneId('');
          }}
        />

        {selectedRole === 'patient' ? (
          <>
            <FieldLabel>البلدية</FieldLabel>
            <OptionList
              options={(communes ?? []).map((commune) => ({
                id: commune._id,
                label: commune.nameAr,
              }))}
              selectedId={communeId}
              onSelect={setCommuneId}
              emptyText={
                wilayaId ? 'لا توجد بلديات' : 'اختر الولاية أولا'
              }
            />

            <FieldLabel>تاريخ الميلاد</FieldLabel>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              textAlign="right"
            />

            <FieldLabel>الجنس</FieldLabel>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  gender === 'male' && styles.roleButtonActive,
                ]}
                onPress={() => setGender('male')}
              >
                <Text
                  style={[
                    styles.roleText,
                    gender === 'male' && styles.roleTextActive,
                  ]}
                >
                  ذكر
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  gender === 'female' && styles.roleButtonActive,
                ]}
                onPress={() => setGender('female')}
              >
                <Text
                  style={[
                    styles.roleText,
                    gender === 'female' && styles.roleTextActive,
                  ]}
                >
                  أنثى
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {selectedRole === 'doctor' ? (
          <>
            <FieldLabel>التخصص</FieldLabel>
            <OptionList
              options={specialties.map((specialty) => ({
                id: specialty._id,
                label: specialty.nameAr,
              }))}
              selectedId={specialtyId}
              onSelect={setSpecialtyId}
            />

            <FieldLabel>رقم التسجيل في النقابة</FieldLabel>
            <TextInput
              style={styles.input}
              value={orderRegistrationNumber}
              onChangeText={setOrderRegistrationNumber}
              placeholder="مثال: DOC-12345"
              textAlign="right"
            />
          </>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit ||
              submitting ||
              context.emailBelongsToAnotherUser) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            !canSubmit || submitting || context.emailBelongsToAnotherUser
          }
        >
          <Text style={styles.submitText}>
            {submitting ? 'جار الحفظ...' : 'إكمال الملف'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function OptionList({
  emptyText = 'لا توجد خيارات',
  onSelect,
  options,
  selectedId,
}: {
  emptyText?: string;
  onSelect: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  selectedId: string;
}) {
  if (options.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.optionList}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.option,
            selectedId === option.id && styles.optionActive,
          ]}
          onPress={() => onSelect(option.id)}
        >
          <Text
            style={[
              styles.optionText,
              selectedId === option.id && styles.optionTextActive,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing['2xl'],
    paddingTop: theme.spacing['4xl'],
    gap: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.official,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    lineHeight: 24,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  roleRow: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
  },
  roleButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.md,
  },
  roleButtonActive: {
    backgroundColor: theme.colors.official,
    borderColor: theme.colors.official,
  },
  roleText: {
    color: theme.colors.official,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    textAlign: 'center',
  },
  roleTextActive: {
    color: theme.colors.white,
  },
  label: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    textAlign: 'right',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    paddingHorizontal: theme.spacing.lg,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textMuted,
  },
  optionList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
  },
  optionActive: {
    backgroundColor: theme.colors.secondary,
  },
  optionText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    textAlign: 'right',
  },
  optionTextActive: {
    color: theme.colors.official,
    fontFamily: theme.typography.fontFamily.arabicBold,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    textAlign: 'right',
  },
  errorText: {
    color: theme.colors.status.danger.text,
    backgroundColor: theme.colors.status.danger.background,
    borderColor: theme.colors.status.danger.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    padding: theme.spacing.md,
    textAlign: 'right',
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.official,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
  },
  logoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  logoutText: {
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
  },
});
