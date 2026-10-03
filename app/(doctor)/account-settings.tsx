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
import {
  DoctorHeader,
  DoctorSection,
} from '@/components/doctor-ui';
import LegalDocumentsLinks from '@/components/LegalDocumentsLinks';
import { theme } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';

export default function DoctorAccountSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useQuery(api.users.me, {});
  const clearUser = useAuthStore((s) => s.clearUser);
  const deleteDoctorAccount = useMutation(api.users.deleteMyDoctorAccount);
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
      await deleteDoctorAccount({});
      await signOut();
      clearUser();
      router.replace('/');
    } catch {
      setDeleteError('تعذر حذف الحساب. حاول مرة أخرى.');
      setIsDeleting(false);
    }
  }, [canDeleteAccount, clearUser, deleteDoctorAccount, router, signOut]);

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
          style={styles.headerReversed}
          action={(
            <Pressable
              onPress={() => router.push('/(doctor)/settings')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="الرجوع"
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.textPrimary}
              />
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
              style={({ pressed }) => [
                styles.deletePressable,
                pressed && styles.deletePressablePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="حذف الحساب"
            >
              <View style={styles.deleteHeader}>
                <View style={styles.deleteIcon}>
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={theme.colors.danger}
                  />
                </View>
                <View style={styles.deleteTitleBlock}>
                  <View style={styles.deleteTitleRow}>
                    <Text style={styles.deleteTitle}>حذف الحساب</Text>
                  </View>
                  <Text style={styles.deleteDescription}>
                    سيؤدي هذا الإجراء إلى حذف الحساب من التطبيق وقاعدة البيانات،
                    مع إلغاء المواعيد القادمة وإخفاء الحساب نهائياً.
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
        onRequestClose={() => {
          closeDeleteModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={closeDeleteModal}
            accessibilityRole="button"
            accessibilityLabel="إغلاق"
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تأكيد حذف الحساب</Text>
              <Pressable
                onPress={closeDeleteModal}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                سيؤدي حذف الحساب إلى إزالة بيانات المختص النشطة، وإلغاء المواعيد
                القادمة، ثم حذف حساب تسجيل الدخول نهائياً.
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
              {deleteError ? (
                <Text style={styles.modalErrorText}>{deleteError}</Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeDeleteModal}
                  style={({ pressed }) => [
                    styles.modalSecondaryButton,
                    pressed && styles.modalButtonPressed,
                  ]}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel="إلغاء حذف الحساب"
                >
                  <Text style={styles.modalSecondaryButtonText}>إلغاء</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleDeleteAccount()}
                  style={({ pressed }) => [
                    styles.modalDangerButton,
                    pressed && styles.modalButtonPressed,
                    !canDeleteAccount && styles.modalButtonDisabled,
                  ]}
                  disabled={!canDeleteAccount}
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
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  backButtonPressed: {
    opacity: 0.82,
  },
  headerReversed: {
    flexDirection: 'row',
  },
  sectionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  privacyIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  privacyTitle: {
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
  },
  privacyText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
  },
  deleteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  deletePressable: {
    borderRadius: theme.borderRadius.sm,
  },
  deletePressablePressed: {
    opacity: 0.82,
  },
  deleteIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  deleteTitleBlock: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  deleteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  deleteTitle: {
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
  },
  deleteDescription: {
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
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
    textAlign: 'right',
  },
  modalBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  modalText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
  },
  confirmationBlock: {
    gap: theme.spacing.sm,
  },
  confirmationLabel: {
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
  },
  confirmPhoneInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabic,
    writingDirection: 'rtl',
  },
  confirmPasswordInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily.arabic,
    writingDirection: 'rtl',
  },
  modalErrorText: {
    textAlign: 'right',
    writingDirection: 'rtl',
    color: theme.colors.danger,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  modalSecondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
  modalDangerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  modalDangerButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});
