import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';

import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { useAuthStore } from '@/stores/authStore';

// =============================================================================
// Constants
// =============================================================================

const MIN_HOURS_OPTIONS: Array<{ label: string; value: number }> = [
  { label: 'ساعة واحدة', value: 1 },
  { label: 'ساعتين', value: 2 },
  { label: '3 ساعات', value: 3 },
  { label: '6 ساعات', value: 6 },
  { label: '12 ساعة', value: 12 },
  { label: '24 ساعة', value: 24 },
  { label: '48 ساعة', value: 48 },
];

// =============================================================================
// Types
// =============================================================================

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  disabledBadge?: string;
}

interface OptionRowProps {
  label: string;
  value: string;
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

// ── Section Header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon }) => (
  <View style={styles.sectionHeader}>
    {icon ? (
      <Ionicons
        name={icon}
        size={18}
        color={theme.colors.primary}
        style={styles.sectionHeaderIcon}
      />
    ) : null}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// ── Toggle Row ──────────────────────────────────────────────────────────────

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  value,
  onValueChange,
  disabled = false,
  disabledBadge,
}) => (
  <View
    style={[
      styles.row,
      styles.toggleRow,
      disabled && styles.rowDisabled,
    ]}
  >
    <View style={styles.rowLabelContainer}>
      <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
        {label}
      </Text>
      {disabled && disabledBadge ? (
        <View style={styles.comingSoonBadge}>
          <Ionicons name="time-outline" size={12} color={theme.colors.primary} />
          <Text style={styles.comingSoonBadgeText}>{disabledBadge}</Text>
        </View>
      ) : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{
        false: theme.colors.border,
        true: theme.colors.primary,
      }}
      thumbColor={theme.colors.white}
      ios_backgroundColor={theme.colors.border}
      accessibilityLabel={label}
    />
  </View>
);

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
      <Text style={styles.optionRowValue}>{value}</Text>
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
    <Pressable
      style={styles.modalOverlay}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="إغلاق"
    >
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
    </Pressable>
  </Modal>
);

// ── Hours Picker (inline selectable chips) ──────────────────────────────────

interface HoursPickerProps {
  options: typeof MIN_HOURS_OPTIONS;
  selectedValue: number;
  onSelect: (value: number) => void;
}

const HoursPicker: React.FC<HoursPickerProps> = ({
  options,
  selectedValue,
  onSelect,
}) => (
  <View style={styles.hoursPickerContainer}>
    <Text style={styles.hoursPickerLabel}>الحد الأدنى لإشعار الإلغاء</Text>
    <View style={styles.hoursChipsRow}>
      {options.map((opt) => {
        const isSelected = opt.value === selectedValue;
        return (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.hoursChip,
              isSelected && styles.hoursChipSelected,
              pressed && styles.hoursChipPressed,
            ]}
            onPress={() => onSelect(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text
              style={[
                styles.hoursChipText,
                isSelected && styles.hoursChipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

// =============================================================================
// Main Settings Screen
// =============================================================================

export default function DoctorSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const clearUser = useAuthStore((s) => s.clearUser);

  // ── Notification toggles ──────────────────────────────────────────────────
  const [newBookingAlerts, setNewBookingAlerts] = useState(true);
  const [cancellationAlerts, setCancellationAlerts] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  // ── Booking settings ──────────────────────────────────────────────────────
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [minCancelHours, setMinCancelHours] = useState(6);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePrivacyPolicy = useCallback(() => {
    setPrivacyModalVisible(true);
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    await signOut();
    clearUser();
    setLogoutModalVisible(false);
    router.replace('/(auth)/login');
  }, [clearUser, router, signOut]);

  const formatHoursLabel = useCallback(
    (hours: number) => {
      const opt = MIN_HOURS_OPTIONS.find((o) => o.value === hours);
      return opt?.label ?? `${hours} ساعة`;
    },
    [],
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإعدادات</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ──────────────────────────────────────────────────────── */}
        {/* Notification Settings Section                            */}
        {/* ──────────────────────────────────────────────────────── */}
        <SectionHeader title="إعدادات الإشعارات" icon="notifications-outline" />

        <View style={styles.sectionCard}>
          <ToggleRow
            label="تنبيهات الحجوزات الجديدة"
            value={newBookingAlerts}
            onValueChange={setNewBookingAlerts}
          />
          <View style={styles.rowDivider} />
          <ToggleRow
            label="تنبيهات الإلغاء"
            value={cancellationAlerts}
            onValueChange={setCancellationAlerts}
          />
          <View style={styles.rowDivider} />
          <ToggleRow
            label="الملخص اليومي"
            value={dailySummary}
            onValueChange={setDailySummary}
          />
        </View>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Booking Settings Section                                 */}
        {/* ──────────────────────────────────────────────────────── */}
        <SectionHeader title="إعدادات الحجز" icon="calendar-outline" />

        <View style={styles.sectionCard}>
          <ToggleRow
            label="التأكيد التلقائي للحجوزات"
            value={autoConfirm}
            onValueChange={setAutoConfirm}
            disabled
            disabledBadge="قريباً"
          />

          <View style={styles.rowDivider} />

          <HoursPicker
            options={MIN_HOURS_OPTIONS}
            selectedValue={minCancelHours}
            onSelect={setMinCancelHours}
          />
        </View>

        {/* ──────────────────────────────────────────────────────── */}
        {/* Privacy Policy                                          */}
        {/* ──────────────────────────────────────────────────────── */}
        <SectionHeader title="سياسة الخصوصية" icon="shield-checkmark-outline" />

        <View style={styles.sectionCard}>
          <OptionRow
            label="سياسة الخصوصية"
            value="عرض"
            onPress={handlePrivacyPolicy}
          />
        </View>

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
        visible={privacyModalVisible}
        title="سياسة الخصوصية"
        onClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            يستخدم نبد بيانات الطبيب والعيادات والمواعيد لتشغيل خدمات الحجز
            والمتابعة فقط. لا تظهر بياناتك المهنية إلا في حدود المعلومات التي
            اخترت نشرها للمرضى، ويمكنك تحديث إعداداتك أو تسجيل الخروج في أي وقت.
          </Text>
          <Pressable
            onPress={() => setPrivacyModalVisible(false)}
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              pressed && styles.modalButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="إغلاق سياسة الخصوصية"
          >
            <Text style={styles.modalPrimaryButtonText}>حسناً</Text>
          </Pressable>
        </View>
      </ActionModal>

      <ActionModal
        visible={logoutModalVisible}
        title="تسجيل الخروج"
        onClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalText}>
            هل أنت متأكد من تسجيل الخروج من حساب الطبيب؟
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
    marginLeft: theme.spacing.sm,
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
  rowDisabled: {
    opacity: 0.55,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  rowLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  rowLabelDisabled: {
    color: theme.colors.textSecondary,
  },

  // ─── Toggle Row ───────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ─── Coming Soon Badge ───────────────────────────────────────────────────
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm,
  },
  comingSoonBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 10,
    color: theme.colors.primary,
    marginRight: theme.spacing.xs,
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
    marginRight: theme.spacing.xs,
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
    marginRight: theme.spacing.sm,
  },

  // ─── Logout Section ──────────────────────────────────────────────────────
  logoutSection: {
    marginTop: theme.spacing.xl,
  },

  // ─── Hours Picker ────────────────────────────────────────────────────────
  hoursPickerContainer: {
    paddingVertical: theme.spacing.sm,
  },
  hoursPickerLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: rtlTextAlign(),
  },
  hoursChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  hoursChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  hoursChipSelected: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.primary,
  },
  hoursChipPressed: {
    opacity: 0.75,
  },
  hoursChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  hoursChipTextSelected: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },

  // ─── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
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
