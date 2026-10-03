import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { useAuthStore } from '@/stores/authStore';

interface OptionRowProps {
  label: string;
  value?: string;
  onPress: () => void;
}

interface DestructiveRowProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

// =============================================================================
// Sub-components
// =============================================================================

// ── Option Row (pressable, chevron) ─────────────────────────────────────────

const OptionRow: React.FC<OptionRowProps> = ({ label, value, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.row,
      styles.optionRow,
      pressed && styles.rowPressed,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.rowLabel}>{label}</Text>
    <View style={styles.optionRowRight}>
      {value ? <Text style={styles.optionRowValue}>{value}</Text> : null}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.colors.textSecondary}
        style={styles.optionRowChevron}
      />
    </View>
  </Pressable>
);

// ── Destructive Row ─────────────────────────────────────────────────────────

const DestructiveRow: React.FC<DestructiveRowProps> = ({ label, icon, onPress }) => (
  <Pressable
    style={({ pressed }) => [
      styles.destructiveRow,
      pressed && styles.destructiveRowPressed,
    ]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={icon} size={20} color={theme.colors.danger} />
    <Text style={styles.destructiveRowLabel}>{label}</Text>
  </Pressable>
);

interface ActionModalProps {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  title,
  children,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="إغلاق"
      />
      <View
        style={styles.modalContent}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable
            onPress={onClose}
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
        {children}
      </View>
    </View>
  </Modal>
);

// =============================================================================
// Main Settings Screen
// =============================================================================

export default function DoctorSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const clearUser = useAuthStore((s) => s.clearUser);
  const me = useQuery(api.users.me, {});
  const setActiveMode = useMutation(api.users.setActiveMode);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const handleSwitchToCenter = useCallback(async () => {
    await setActiveMode({ mode: 'clinic' });
    router.replace('/');
  }, [router, setActiveMode]);

  const handleConfirmLogout = useCallback(async () => {
    await signOut();
    clearUser();
    setLogoutModalVisible(false);
    router.replace('/');
  }, [clearUser, router, signOut]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DoctorHeader
          title="الإعدادات"
          icon="settings-outline"
          centerTitle
        />

        <DoctorSection>
          <View style={styles.sectionCard}>
            <OptionRow
              label="إعدادات الحساب"
              onPress={() => router.push('/(doctor)/account-settings')}
            />
            {me?.canSwitchRole ? (
              <OptionRow
                label="التبديل إلى حساب المركز"
                onPress={() => void handleSwitchToCenter()}
              />
            ) : null}
          </View>
        </DoctorSection>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Logout                                                   */}
        {/* ──────────────────────────────────────────────────────── */}
        <View style={styles.logoutSection}>
          <DestructiveRow
            label="تسجيل الخروج"
            icon="log-out-outline"
            onPress={handleLogout}
          />
        </View>

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ActionModal
        visible={logoutModalVisible}
        title="تسجيل الخروج"
        onClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            هل أنت متأكد من تسجيل الخروج من حساب المختص؟
          </Text>
          <View style={styles.logoutActions}>
            <Pressable
              onPress={() => setLogoutModalVisible(false)}
              style={({ pressed }) => [
                styles.modalSecondaryButton,
                pressed && styles.modalButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="إلغاء تسجيل الخروج"
            >
              <Text style={styles.modalSecondaryButtonText}>إلغاء</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmLogout}
              style={({ pressed }) => [
                styles.modalDangerButton,
                pressed && styles.modalButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تأكيد تسجيل الخروج"
            >
              <Text style={styles.modalDangerButtonText}>تسجيل الخروج</Text>
            </Pressable>
          </View>
        </View>
      </ActionModal>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },

  // ─── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Section ─────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  sectionHeaderIcon: {
    marginEnd: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.shadows.sm,
  },

  // ─── Rows ────────────────────────────────────────────────────────────────
  row: {
    paddingVertical: theme.spacing.sm,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  rowLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },

  // ─── Option Row ──────────────────────────────────────────────────────────
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionRowValue: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.primary,
  },
  optionRowChevron: {
    marginStart: theme.spacing.xs,
  },

  // ─── Destructive Row ─────────────────────────────────────────────────────
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    ...theme.shadows.sm,
  },
  destructiveRowPressed: {
    opacity: 0.7,
  },
  destructiveRowLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.danger,
    marginStart: theme.spacing.sm,
  },

  // ─── Logout Section ──────────────────────────────────────────────────────
  logoutSection: {
    marginTop: theme.spacing.xl,
  },

  // ─── Modals ──────────────────────────────────────────────────────────────
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
    maxHeight: '75%',
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
    textAlign: rtlTextAlign(),
  },
  modalBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  modalText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.lg,
  },
  modalPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  modalPrimaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
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
    opacity: 0.75,
  },
  logoutActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
