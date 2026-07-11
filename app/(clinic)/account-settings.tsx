import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useClerk, useSignIn, useUser } from '@clerk/clerk-expo';
import { useConvex, useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import LegalDocumentsLinks from '@/components/LegalDocumentsLinks';
import { buildClerkPasswordIdentifierFromLoginKey } from '@/lib/phone';
import { theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

export default function ClinicAccountSettingsScreen() {
  const router = useRouter();
  const convex = useConvex();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const me = useQuery(api.users.me, {});
  const clearUser = useAuthStore((s) => s.clearUser);
  const deleteClinicAccount = useMutation(api.users.deleteMyClinicAccount);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [enteredPhone, setEnteredPhone] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const canDeleteAccount =
    enteredPhone === me?.phone &&
    deletePassword.trim().length > 0 &&
    !isDeleting;

  const openDeleteModal = useCallback(() => {
    setEnteredPhone('');
    setDeletePassword('');
    setDeleteError(null);
    setDeleteModalVisible(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (isDeleting) return;
    setDeleteModalVisible(false);
  }, [isDeleting]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user?.deleteSelfEnabled) {
      setDeleteError('تعذر حذف الحساب من تسجيل الدخول حالياً.');
      return;
    }
    if (!me?.phone || !isSignInLoaded || !signIn) {
      setDeleteError('تعذر التحقق من الحساب حالياً. حاول مرة أخرى.');
      return;
    }
    if (!canDeleteAccount) {
      setDeleteError('أدخل رقم الهاتف المسجل نفسه وكلمة المرور للمتابعة.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const account = await convex.query(api.users.findAccountByIdentifier, {
        phone: enteredPhone,
        email: '',
      });
      if (!account.exists || account.role !== 'clinic') {
        setDeleteError('رقم الهاتف أو كلمة المرور غير صحيحة');
        setIsDeleting(false);
        return;
      }
      const clerkIdentifier = buildClerkPasswordIdentifierFromLoginKey(
        account.phoneLoginKey,
      );
      const result = await signIn.create({
        identifier: clerkIdentifier,
        password: deletePassword,
      });
      if (result.status !== 'complete') {
        throw new Error('Invalid re-auth state');
      }

      await deleteClinicAccount({});
      await user?.delete();
      await signOut();
      clearUser();
      router.replace('/');
    } catch {
      setDeleteError('رقم الهاتف أو كلمة المرور غير صحيحة');
      setIsDeleting(false);
    }
  }, [
    canDeleteAccount,
    clearUser,
    convex,
    deleteClinicAccount,
    deletePassword,
    enteredPhone,
    isSignInLoaded,
    me?.phone,
    router,
    signIn,
    signOut,
    user,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DoctorHeader
          title="إعدادات الحساب"
          icon={null}
          centerTitle
          action={(
            <Pressable
              onPress={() => router.push('/(clinic)/settings')}
              hitSlop={8}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="الرجوع"
            >
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textPrimary} />
            </Pressable>
          )}
        />

        <DoctorSection title="المستندات القانونية">
          <View style={styles.sectionCard}>
            <LegalDocumentsLinks />
          </View>
        </DoctorSection>

        <DoctorSection title="إدارة الحساب">
          <View style={styles.sectionCard}>
            <Pressable
              onPress={openDeleteModal}
              style={({ pressed }) => [styles.deletePressable, pressed && styles.deletePressablePressed]}
              accessibilityRole="button"
              accessibilityLabel="حذف الحساب"
            >
              <View style={styles.deleteHeader}>
                <View style={styles.deleteIcon}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </View>
                <View style={styles.deleteTitleBlock}>
                  <Text style={styles.deleteTitle}>حذف الحساب</Text>
                  <Text style={styles.deleteDescription}>
                    سيؤدي هذا الإجراء إلى حذف العيادة وإلغاء المواعيد القادمة وحذف الحساب نهائياً.
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </DoctorSection>
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeDeleteModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تأكيد حذف الحساب</Text>
              <Pressable onPress={closeDeleteModal} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                سيؤدي حذف الحساب إلى إزالة بيانات العيادة النشطة، وإلغاء المواعيد
                القادمة، ثم حذف حساب تسجيل الدخول نهائياً.
              </Text>
              <View style={styles.confirmationBlock}>
                <Text style={styles.confirmationLabel}>رقم الهاتف المسجل</Text>
                <TextInput
                  value={enteredPhone}
                  onChangeText={setEnteredPhone}
                  placeholder={me?.phone ?? 'أدخل رقم الهاتف المسجل'}
                  keyboardType="phone-pad"
                  editable={!isDeleting}
                  style={styles.confirmPhoneInput}
                  placeholderTextColor={theme.colors.textMuted}
                  textAlign="right"
                />
              </View>
              <View style={styles.confirmationBlock}>
                <Text style={styles.confirmationLabel}>كلمة المرور</Text>
                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  placeholder="أدخل كلمة المرور"
                  secureTextEntry
                  editable={!isDeleting}
                  style={styles.confirmPasswordInput}
                  placeholderTextColor={theme.colors.textMuted}
                  textAlign="right"
                />
              </View>

              {deleteError ? <Text style={styles.modalErrorText}>{deleteError}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeDeleteModal}
                  style={({ pressed }) => [styles.modalSecondaryButton, pressed && styles.modalButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="إلغاء حذف الحساب"
                >
                  <Text style={styles.modalSecondaryButtonText}>إلغاء</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleDeleteAccount()}
                  disabled={!canDeleteAccount}
                  style={({ pressed }) => [
                    styles.modalDangerButton,
                    (!canDeleteAccount || pressed) && styles.modalButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="تأكيد حذف الحساب"
                >
                  <Text style={styles.modalDangerButtonText}>
                    {isDeleting ? 'جارٍ الحذف...' : 'حذف الحساب'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: theme.spacing['4xl'] },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: { opacity: 0.8 },
  sectionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },
  privacyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  deletePressable: { borderRadius: theme.borderRadius.md },
  deletePressablePressed: { opacity: 0.78 },
  deleteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTitleBlock: { flex: 1, minWidth: 0 },
  deleteTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.danger,
    textAlign: 'right',
  },
  deleteDescription: {
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing['4xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  modalBody: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
  modalText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.lg,
  },
  confirmationBlock: { marginBottom: theme.spacing.md, gap: theme.spacing.xs },
  confirmationLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  confirmPhoneInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
  },
  confirmPasswordInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
  },
  modalErrorText: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.danger,
    textAlign: 'right',
    marginBottom: theme.spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textSecondary,
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
  },
  modalButtonPressed: { opacity: 0.7 },
});
