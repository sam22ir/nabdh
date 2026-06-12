// =============================================================================
// Patient Profile Screen
// Route: /(patient)/profile
// Shows user info, family profiles, settings, privacy policy, and logout.
// RTL layout - Arabic-first.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import type { PatientProfile } from '@/lib/types';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Helpers
// =============================================================================

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function toFamilyProfile(profile: {
  _id: Id<'patientProfiles'>;
  parentUserId: Id<'users'>;
  fullNameAr: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  bloodType?: PatientProfile['bloodType'];
  chronicDiseases: string[];
  allergies: string[];
}): PatientProfile {
  return {
    id: profile._id,
    parentUserId: profile.parentUserId,
    fullNameAr: profile.fullNameAr,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    bloodType: profile.bloodType ?? null,
    chronicDiseases: profile.chronicDiseases,
    allergies: profile.allergies,
  };
}

// =============================================================================
// Profile Row
// =============================================================================

interface ProfileRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  isLink?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  isLast?: boolean;
}

const ProfileRow: React.FC<ProfileRowProps> = ({
  icon,
  label,
  value,
  isLink,
  destructive,
  onPress,
  rightElement,
  isLast,
}) => {
  const content = (
    <View style={[styles.row, isLast && styles.rowLast]}>
      {/* Icon */}
      <View
        style={[
          styles.rowIconContainer,
          destructive && styles.rowIconContainerDestructive,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? theme.colors.danger : theme.colors.primary}
        />
      </View>

      {/* Label & value */}
      <View style={styles.rowTextContainer}>
        <Text
          style={[
            styles.rowLabel,
            destructive && styles.rowLabelDestructive,
          ]}
        >
          {label}
        </Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>

      {/* Right element (switch, chevron, etc.) */}
      {rightElement ? (
        <View style={styles.rowRight}>{rightElement}</View>
      ) : isLink ? (
        <Ionicons
          name="chevron-back"
          size={18}
          color={theme.colors.textSecondary}
        />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

// =============================================================================
// Profile Section
// =============================================================================

const ProfileSection: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={styles.sectionContainer}>
    {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

// =============================================================================
// Action Modal
// =============================================================================

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

// =============================================================================
// Family Profile Item
// =============================================================================

interface FamilyProfileItemProps {
  profile: PatientProfile;
  isLast: boolean;
}

const FamilyProfileItem: React.FC<FamilyProfileItemProps> = ({
  profile,
  isLast,
}) => {
  const age = computeAge(profile.dateOfBirth);
  const ageLabel = age === 0 ? 'أقل من سنة' : `${age} سنة`;

  return (
    <View style={[styles.familyItem, isLast && styles.familyItemLast]}>
      <View style={styles.familyAvatar}>
        <Ionicons
          name={profile.gender === 'female' ? 'woman' : 'man'}
          size={20}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.familyInfo}>
        <Text style={styles.familyName}>{profile.fullNameAr}</Text>
        <Text style={styles.familyDetail}>
          {ageLabel}
          {profile.bloodType ? ` - فصيلة ${profile.bloodType}` : ''}
        </Text>
      </View>
      <Ionicons
        name="chevron-back"
        size={18}
        color={theme.colors.textSecondary}
      />
    </View>
  );
};

// =============================================================================
// Main Screen
// =============================================================================

export default function PatientProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me, {});
  const familyProfilesQuery = useQuery(api.patientProfiles.listMy, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const createFamilyProfile = useMutation(api.patientProfiles.create);
  const user = me?.role === 'patient' ? me : null;
  const clearUser = useAuthStore((s) => s.clearUser);
  const { language, setLanguage } = useLanguageStore();
  const [themeEnabled, setThemeEnabled] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [familyDateOfBirth, setFamilyDateOfBirth] = useState('');
  const [familyGender, setFamilyGender] = useState<'male' | 'female'>('male');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const familyProfiles = useMemo(
    () => (familyProfilesQuery ?? []).map(toFamilyProfile),
    [familyProfilesQuery],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleEditProfile = useCallback(() => {
    setProfileName(user?.fullNameAr ?? user?.name ?? '');
    setProfilePhone(user?.phone ?? '');
    setModalError(null);
    setEditModalVisible(true);
  }, [user?.fullNameAr, user?.name, user?.phone]);

  const handleAddFamilyMember = useCallback(() => {
    setFamilyName('');
    setFamilyDateOfBirth('');
    setFamilyGender('male');
    setModalError(null);
    setFamilyModalVisible(true);
  }, []);

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

  const handleSaveProfile = useCallback(async () => {
    const fullNameAr = profileName.trim();
    if (!fullNameAr) {
      setModalError('الاسم مطلوب');
      return;
    }

    setSavingProfile(true);
    setModalError(null);
    try {
      await updateProfile({
        fullNameAr,
        phone: profilePhone.trim() || undefined,
      });
      setEditModalVisible(false);
    } catch (error: any) {
      setModalError(error?.message ?? 'تعذر حفظ المعلومات');
    } finally {
      setSavingProfile(false);
    }
  }, [profileName, profilePhone, updateProfile]);

  const handleSaveFamilyMember = useCallback(async () => {
    const fullNameAr = familyName.trim();
    const dateOfBirth = familyDateOfBirth.trim();
    if (!fullNameAr || !dateOfBirth) {
      setModalError('الاسم وتاريخ الميلاد مطلوبان');
      return;
    }

    setSavingFamily(true);
    setModalError(null);
    try {
      await createFamilyProfile({
        fullNameAr,
        dateOfBirth,
        gender: familyGender,
        chronicDiseases: [],
        allergies: [],
      });
      setFamilyModalVisible(false);
    } catch (error: any) {
      setModalError(error?.message ?? 'تعذر إضافة فرد العائلة');
    } finally {
      setSavingFamily(false);
    }
  }, [createFamilyProfile, familyDateOfBirth, familyGender, familyName]);

  // ── Guard: missing user ─────────────────────────────────────────────────
  if (me === undefined || familyProfilesQuery === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Ionicons
            name="person-circle-outline"
            size={64}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.emptyText}>يرجى تسجيل الدخول</Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={({ pressed }) => [
              styles.loginRedirectButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.loginRedirectText}>تسجيل الدخول</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons
              name="person-circle"
              size={80}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.headerName} numberOfLines={1}>
            {user.fullNameAr}
          </Text>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {user.email ?? ''}
          </Text>
        </View>

        {/* ── Personal Info Section ───────────────────────────── */}
        <ProfileSection title="معلوماتي الشخصية">
          <ProfileRow
            icon="person-outline"
            label="الاسم"
            value={user.fullNameAr ?? user.name ?? ''}
          />
          <ProfileRow
            icon="mail-outline"
            label="البريد الإلكتروني"
            value={user.email ?? ''}
          />
          <ProfileRow
            icon="call-outline"
            label="رقم الهاتف"
            value={user.phone ?? ''}
          />
          <ProfileRow
            icon="location-outline"
            label="الولاية"
            value={user.wilayaId ?? '-'}
            isLast
          />
          <View style={styles.editButtonContainer}>
            <Pressable
              onPress={handleEditProfile}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.editButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تعديل المعلومات الشخصية"
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={theme.colors.white}
                style={{ marginLeft: 6 }}
              />
              <Text style={styles.editButtonText}>تعديل</Text>
            </Pressable>
          </View>
        </ProfileSection>

        {/* ── Family Profiles Section ─────────────────────────── */}
        <ProfileSection title="أفراد العائلة">
          {familyProfiles.length === 0 ? (
            <View style={styles.emptyFamilyContainer}>
              <Ionicons
                name="people-outline"
                size={40}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyFamilyText}>
                لا يوجد أفراد عائلة مضافين. أضف أفراد عائلتك لحجز المواعيد
                نيابة عنهم.
              </Text>
            </View>
          ) : (
            familyProfiles.map((profile, index) => (
              <FamilyProfileItem
                key={profile.id}
                profile={profile}
                isLast={index === familyProfiles.length - 1}
              />
            ))
          )}
          <Pressable
            onPress={handleAddFamilyMember}
            style={({ pressed }) => [
              styles.addFamilyButton,
              pressed && styles.addFamilyButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="إضافة فرد عائلة"
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={theme.colors.primary}
              style={{ marginLeft: 8 }}
            />
            <Text style={styles.addFamilyButtonText}>إضافة فرد جديد</Text>
          </Pressable>
        </ProfileSection>

        {/* ── Settings Section ────────────────────────────────── */}
        <ProfileSection title="الإعدادات">
          <ProfileRow
            icon="language-outline"
            label="اللغة"
            rightElement={
              <View style={styles.languageToggle}>
                <Pressable
                  onPress={() => setLanguage('ar')}
                  style={[
                    styles.languageOption,
                    language === 'ar' && styles.languageOptionActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="العربية"
                >
                  <Text
                    style={[
                      styles.langText,
                      language === 'ar' && styles.langTextActive,
                    ]}
                  >
                    AR
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setLanguage('fr')}
                  style={[
                    styles.languageOption,
                    language === 'fr' && styles.languageOptionActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Français"
                >
                  <Text
                    style={[
                      styles.langText,
                      language === 'fr' && styles.langTextActive,
                    ]}
                  >
                    FR
                  </Text>
                </Pressable>
              </View>
            }
          />
          <ProfileRow
            icon="moon-outline"
            label="الوضع المظلم"
            rightElement={
              <Switch
                value={themeEnabled}
                onValueChange={setThemeEnabled}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                thumbColor={theme.colors.white}
              />
            }
            isLast
          />
        </ProfileSection>

        {/* ── Privacy Policy ──────────────────────────────────── */}
        <ProfileSection>
          <ProfileRow
            icon="shield-checkmark-outline"
            label="سياسة الخصوصية"
            isLink
            onPress={handlePrivacyPolicy}
            isLast
          />
        </ProfileSection>

        {/* ── Logout ──────────────────────────────────────────── */}
        <ProfileSection>
          <ProfileRow
            icon="log-out-outline"
            label="تسجيل الخروج"
            destructive
            isLink
            onPress={handleLogout}
            isLast
          />
        </ProfileSection>

        {/* Bottom spacer for safe area */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ActionModal
        visible={editModalVisible}
        title="تعديل المعلومات الشخصية"
        onClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBody}>
          {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}
          <Text style={styles.modalFieldLabel}>الاسم</Text>
          <TextInput
            style={styles.modalInput}
            value={profileName}
            onChangeText={setProfileName}
            placeholder="الاسم الكامل"
            placeholderTextColor={theme.colors.textSecondary}
            textAlign="right"
          />
          <Text style={styles.modalFieldLabel}>رقم الهاتف</Text>
          <TextInput
            style={styles.modalInput}
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="رقم الهاتف"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="phone-pad"
            textAlign="right"
          />
          <Pressable
            onPress={handleSaveProfile}
            disabled={savingProfile}
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              (pressed || savingProfile) && styles.modalButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="حفظ المعلومات الشخصية"
          >
            <Text style={styles.modalPrimaryButtonText}>
              {savingProfile ? 'جاري الحفظ...' : 'حفظ'}
            </Text>
          </Pressable>
        </View>
      </ActionModal>

      <ActionModal
        visible={familyModalVisible}
        title="إضافة فرد عائلة"
        onClose={() => setFamilyModalVisible(false)}
      >
        <View style={styles.modalBody}>
          {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}
          <Text style={styles.modalFieldLabel}>الاسم</Text>
          <TextInput
            style={styles.modalInput}
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="اسم فرد العائلة"
            placeholderTextColor={theme.colors.textSecondary}
            textAlign="right"
          />
          <Text style={styles.modalFieldLabel}>تاريخ الميلاد</Text>
          <TextInput
            style={styles.modalInput}
            value={familyDateOfBirth}
            onChangeText={setFamilyDateOfBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSecondary}
            textAlign="right"
          />
          <View style={styles.genderRow}>
            <Pressable
              onPress={() => setFamilyGender('male')}
              style={[
                styles.genderChip,
                familyGender === 'male' && styles.genderChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="ذكر"
            >
              <Text
                style={[
                  styles.genderChipText,
                  familyGender === 'male' && styles.genderChipTextActive,
                ]}
              >
                ذكر
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFamilyGender('female')}
              style={[
                styles.genderChip,
                familyGender === 'female' && styles.genderChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="أنثى"
            >
              <Text
                style={[
                  styles.genderChipText,
                  familyGender === 'female' && styles.genderChipTextActive,
                ]}
              >
                أنثى
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleSaveFamilyMember}
            disabled={savingFamily}
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              (pressed || savingFamily) && styles.modalButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="حفظ فرد العائلة"
          >
            <Text style={styles.modalPrimaryButtonText}>
              {savingFamily ? 'جاري الحفظ...' : 'إضافة'}
            </Text>
          </Pressable>
        </View>
      </ActionModal>

      <ActionModal
        visible={privacyModalVisible}
        title="سياسة الخصوصية"
        onClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalBody}>
          <Text style={styles.privacyText}>
            نحافظ على بياناتك الصحية والشخصية داخل نبد ونستخدمها فقط لتقديم
            خدمات الحجز والمتابعة الطبية. لا نشارك معلوماتك مع أي طرف غير
            مصرح له، ويمكنك تسجيل الخروج أو طلب تحديث بياناتك في أي وقت.
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
          <Text style={styles.privacyText}>
            هل أنت متأكد من رغبتك في تسجيل الخروج؟
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
  // ── Layout ───────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  scrollContent: {
    paddingBottom: theme.spacing['2xl'],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  bottomSpacer: {
    height: theme.spacing['4xl'],
  },

  // ── Empty / Error ────────────────────────────────────────────────────────
  emptyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },

  // ── Login redirect (empty state) ─────────────────────────────────────────
  loginRedirectButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  loginRedirectText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing['3xl'],
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  headerName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  headerEmail: {
    fontFamily: theme.typography.fontFamily.latin,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // ── Section ──────────────────────────────────────────────────────────────
  sectionContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  sectionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },

  // ── Row ──────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    opacity: 0.75,
    backgroundColor: theme.colors.secondary,
  },
  rowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  rowIconContainerDestructive: {
    backgroundColor: '#FDEDEC',
  },
  rowTextContainer: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  rowLabelDestructive: {
    color: theme.colors.danger,
  },
  rowValue: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },
  rowRight: {
    marginRight: theme.spacing.sm,
  },

  // ── Edit Button ──────────────────────────────────────────────────────────
  editButtonContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  editButtonPressed: {
    opacity: 0.85,
  },
  editButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ── Family Profile ───────────────────────────────────────────────────────
  familyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  familyItemLast: {
    borderBottomWidth: 0,
  },
  familyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  familyDetail: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },

  // ── Empty Family ─────────────────────────────────────────────────────────
  emptyFamilyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyFamilyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: theme.spacing.sm,
  },

  // ── Add Family Button ────────────────────────────────────────────────────
  addFamilyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  addFamilyButtonPressed: {
    opacity: 0.7,
  },
  addFamilyButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
  },

  // ── Language Toggle ──────────────────────────────────────────────────────
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  languageOption: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  languageOptionActive: {
    backgroundColor: theme.colors.secondary,
  },
  langText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  langTextActive: {
    color: theme.colors.primary,
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },

  // ── Modals ───────────────────────────────────────────────────────────────
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
    maxHeight: '82%',
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
  modalFieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: rtlTextAlign(),
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
    writingDirection: 'rtl',
  },
  modalErrorText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.danger,
    marginBottom: theme.spacing.md,
    textAlign: rtlTextAlign(),
  },
  modalPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
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
  genderRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  genderChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  genderChipActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.primary,
  },
  genderChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  genderChipTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  privacyText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 23,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.lg,
  },
  logoutActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
});
