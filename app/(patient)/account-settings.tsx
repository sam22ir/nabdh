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
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery } from '@/lib/backend';

import { api } from '@/lib/backend/api';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import LegalDocumentsLinks from '@/components/LegalDocumentsLinks';
import { theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

export default function PatientAccountSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useQuery(api.users.me, {});
  const clearUser = useAuthStore((s) => s.clearUser);
  const deletePatientAccount = useMutation(api.users.deleteMyPatientAccount);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDeleteAccount = confirmText.trim() === 'حذف' && !isDeleting;

  const openDeleteModal = useCallback(() => {
    setConfirmText('');
    setDeleteError(null);
    setDeleteModalVisible(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (isDeleting) return;
    setDeleteModalVisible(false);
  }, [isDeleting]);

  const handleDeleteAccount = useCallback(async () => {
    if (!canDeleteAccount) {
      setDeleteError('اكتب كلمة «حذف» للمتابعة.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePatientAccount({});
      await signOut();
      clearUser();
      router.replace('/');
    } catch {
      setDeleteError('تعذر حذف الحساب. حاول مرة أخرى.');
      setIsDeleting(false);
    }
  }, [canDeleteAccount, clearUser, deletePatientAccount, router, signOut]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <DoctorHeader
          title="إعدادات الحساب"
          icon={null}
          centerTitle
          action={(
            <Pressable
              onPress={() => router.push('/(patient)/profile')}
              hitSlop={8}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
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
            >
              <View style={styles.deleteHeader}>
                <View style={styles.deleteIcon}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </View>
                <View style={styles.deleteTitleBlock}>
                  <Text style={styles.deleteTitle}>حذف الحساب</Text>
                  <Text style={styles.deleteDescription}>
                    سيؤدي هذا الإجراء إلى حذف حساب العميل وبياناته المرتبطة نهائياً.
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
        </DoctorSection>
      </ScrollView>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={closeDeleteModal}>
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
                سيؤدي حذف الحساب إلى إزالة بيانات العميل والمواعيد والمفضلة ثم حذف حساب تسجيل الدخول نهائياً.
              </Text>
              <View style={styles.confirmationBlock}>
                <Text style={styles.confirmationLabel}>اكتب «حذف» للتأكيد</Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="حذف"
                  editable={!isDeleting}
                  style={styles.confirmPhoneInput}
                  placeholderTextColor={theme.colors.textMuted}
                  textAlign="right"
                />
              </View>
              {deleteError ? <Text style={styles.modalErrorText}>{deleteError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeDeleteModal}
                  style={({ pressed }) => [styles.modalSecondaryButton, pressed && styles.modalButtonPressed]}
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
  privacyLink: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  privacyLinkPressed: { opacity: 0.72 },
  privacyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyLinkText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
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
  modalPrimaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
  },
  modalPrimaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
});
