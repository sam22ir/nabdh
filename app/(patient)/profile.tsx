// @ts-nocheck
// =============================================================================
// Patient Profile Screen
// Route: /(patient)/profile
// Shows user info, family profiles, settings, privacy policy, and logout.
// RTL layout - Arabic-first.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClerk } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { DoctorHeader } from '@/components/doctor-ui';
import { LoadingState, Panel } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { getArabicErrorMessage } from '@/lib/errorMessages';
import { useAuthStore } from '@/stores/authStore';
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

function displayName(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? '';
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
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <View style={styles.sectionContainer}>
    {title ? (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
    ) : null}
    <Panel style={styles.sectionCard}>{children}</Panel>
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
  const { signOut } = useClerk();
  const me = useQuery(api.users.me, {});
  const familyProfilesQuery = useQuery(api.patientProfiles.listMy, {});
  const wilayasQuery = useQuery(api.locations.listWilayas, {});
  const updateProfile = useMutation(api.users.updateProfile);
  const completePatientProfile = useMutation(api.users.completePatientProfile);
  const createFamilyProfile = useMutation(api.patientProfiles.create);
  const user = me?.role === 'patient' ? me : null;
  const clearUser = useAuthStore((s) => s.clearUser);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [completeProfileModalVisible, setCompleteProfileModalVisible] =
    useState(false);
  const [familyModalVisible, setFamilyModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [completionDateOfBirth, setCompletionDateOfBirth] = useState('');
  const [completionGender, setCompletionGender] = useState<'male' | 'female'>(
    'male',
  );
  const [completionWilayaId, setCompletionWilayaId] =
    useState<Id<'wilayas'> | null>(null);
  const [completionCommuneId, setCompletionCommuneId] =
    useState<Id<'communes'> | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [familyDateOfBirth, setFamilyDateOfBirth] = useState('');
  const [familyGender, setFamilyGender] = useState<'male' | 'female'>('male');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const communesQuery = useQuery(
    api.locations.listCommunesByWilaya,
    completionWilayaId ? { wilayaId: completionWilayaId } : 'skip',
  );
  const familyProfiles = useMemo(
    () => (familyProfilesQuery ?? []).map(toFamilyProfile),
    [familyProfilesQuery],
  );
  const wilayas = wilayasQuery ?? [];
  const communes = communesQuery ?? [];
  // ── Handlers ────────────────────────────────────────────────────────────

  const handleEditProfile = useCallback(() => {
    setProfileName(displayName(user?.fullNameAr, user?.fullName, user?.name));
    setProfileEmail(user?.email ?? '');
    setProfilePhone(user?.phone ?? '');
    setModalError(null);
    setEditModalVisible(true);
  }, [user?.email, user?.fullNameAr, user?.name, user?.phone]);

  const handleAddFamilyMember = useCallback(() => {
    setFamilyName('');
    setFamilyDateOfBirth('');
    setFamilyGender('male');
    setModalError(null);
    setFamilyModalVisible(true);
  }, []);

  const handleCompletePatientProfile = useCallback(() => {
    setCompletionDateOfBirth('');
    setCompletionGender((user?.gender as 'male' | 'female' | undefined) ?? 'male');
    setCompletionWilayaId((user?.wilayaId as Id<'wilayas'> | undefined) ?? null);
    setCompletionCommuneId(null);
    setModalError(null);
    setCompleteProfileModalVisible(true);
  }, [user?.gender, user?.wilayaId]);

  const handleLogout = useCallback(() => {
    setLogoutModalVisible(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    await signOut();
    clearUser();
    setLogoutModalVisible(false);
    router.replace('/');
  }, [clearUser, router, signOut]);

  const handleSaveProfile = useCallback(async () => {
    const fullNameAr = profileName.trim();
    if (!fullNameAr) {
      setModalError('الاسم مطلوب');
      return;
    }
    const email = profileEmail.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setModalError('البريد الإلكتروني غير صحيح');
      return;
    }

    setSavingProfile(true);
    setModalError(null);
    try {
      await updateProfile({
        fullName: fullNameAr,
        phone: profilePhone.trim() || undefined,
        email: email || undefined,
      });
      setEditModalVisible(false);
    } catch (error) {
      setModalError(getArabicErrorMessage(error, 'تعذر حفظ المعلومات'));
    } finally {
      setSavingProfile(false);
    }
  }, [profileEmail, profileName, profilePhone, updateProfile]);

  const handleSavePatientProfile = useCallback(async () => {
    const dateOfBirth = completionDateOfBirth.trim();
    if (!dateOfBirth || !completionCommuneId) {
      setModalError('تاريخ الميلاد والبلدية مطلوبان');
      return;
    }

    setSavingCompletion(true);
    setModalError(null);
    try {
      await completePatientProfile({
        dateOfBirth,
        gender: completionGender,
        communeId: completionCommuneId,
      });
      setCompleteProfileModalVisible(false);
    } catch (error) {
      setModalError(getArabicErrorMessage(error, 'تعذر إكمال الملف الطبي'));
    } finally {
      setSavingCompletion(false);
    }
  }, [
    completePatientProfile,
    completionCommuneId,
    completionDateOfBirth,
    completionGender,
  ]);

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
    } catch (error) {
      setModalError(getArabicErrorMessage(error, 'تعذر إضافة فرد العائلة'));
    } finally {
      setSavingFamily(false);
    }
  }, [createFamilyProfile, familyDateOfBirth, familyGender, familyName]);

  // ── Guard: missing user ─────────────────────────────────────────────────
  if (me === undefined || familyProfilesQuery === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <DoctorHeader
          title="ملفي"
          icon="person-outline"
          centerTitle
          iconPosition="end"
        />
        <LoadingState label="جاري تحميل الملف..." />
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
            onPress={() => router.replace('/')}
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
        <DoctorHeader
          title="ملفي"
          titleContent={
            <View style={styles.profileHeroRow}>
              <View style={styles.profileGreetingBlock}>
                <Text style={styles.profileGreetingName} numberOfLines={1}>
                  ملفي
                </Text>
              </View>
              <View style={styles.profileHeroIcon}>
                <Ionicons
                  name="person-outline"
                  size={28}
                  color={theme.colors.white}
                />
              </View>
            </View>
          }
          icon={null}
        />

        {!user.profile ? (
          <View style={styles.completeProfileCard}>
            <View style={styles.completeProfileIcon}>
              <Ionicons
                name="medical-outline"
                size={24}
                color={theme.colors.warning}
              />
            </View>
            <View style={styles.completeProfileTextArea}>
              <Text style={styles.completeProfileTitle}>أكمل ملفك الطبي</Text>
              <Text style={styles.completeProfileDescription}>
                أكمل تاريخ الميلاد والبلدية حتى تتمكن من الحجز وإضافة الأطباء
                إلى المفضلة.
              </Text>
            </View>
            <Pressable
              onPress={handleCompletePatientProfile}
              style={({ pressed }) => [
                styles.completeProfileButton,
                pressed && styles.editButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="أكمل ملفك الطبي"
            >
              <Text style={styles.completeProfileButtonText}>إكمال</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Personal Info Section ───────────────────────────── */}
        <ProfileSection
          title="معلوماتي الشخصية"
          action={
            <Pressable
              onPress={handleEditProfile}
              style={({ pressed }) => [
                styles.sectionEditButton,
                pressed && styles.sectionEditButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="تعديل المعلومات الشخصية"
            >
              <Ionicons name="create-outline" size={15} color={theme.colors.primary} />
              <Text style={styles.sectionEditButtonText}>تعديل</Text>
            </Pressable>
          }
        >
          <ProfileRow
            icon="person-outline"
            label="الاسم"
            value={displayName(user.fullNameAr, user.fullName, user.name)}
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
            isLast
          />
        </ProfileSection>

        {/* ── Family Profiles Section ─────────────────────────── */}
        <ProfileSection
          title="أفراد العائلة"
          action={
            <View style={styles.familyComingSoonBadge}>
              <Text style={styles.familyComingSoonBadgeText}>قريباً</Text>
            </View>
          }
        >
          <View style={styles.familyComingSoonContent}>
            <View style={styles.familyComingSoonIcon}>
              <Ionicons
                name="people-outline"
                size={28}
                color={theme.colors.official}
              />
            </View>
            <Text style={styles.familyComingSoonTitle}>ملفات أفراد العائلة</Text>
            <Text style={styles.familyComingSoonText}>
              ستتمكن قريباً من إضافة أفراد عائلتك والحجز نيابة عنهم من حسابك.
            </Text>
          </View>
        </ProfileSection>

        {/* ── Settings Section ────────────────────────────────── */}
        <ProfileSection title="الإعدادات">
          <ProfileRow
            icon="language-outline"
            label="اللغة"
            value="العربية"
            rightElement={
              <View style={styles.settingsUnavailableBadge}>
                <Text style={styles.settingsUnavailableBadgeText}>قريباً</Text>
              </View>
            }
          />
          <ProfileRow
            icon="moon-outline"
            label="الوضع المظلم"
            rightElement={
              <View style={styles.settingsUnavailableBadge}>
                <Text style={styles.settingsUnavailableBadgeText}>قريباً</Text>
              </View>
            }
            isLast
          />
        </ProfileSection>

        {/* ── Account Settings ───────────────────────────────── */}
        <ProfileSection>
          <ProfileRow
            icon="settings-outline"
            label="إعدادات الحساب"
            isLink
            onPress={() => router.push('/(patient)/account-settings')}
            isLast
          />
        </ProfileSection>

        {/* ── Logout ──────────────────────────────────────────── */}
        <ProfileSection>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutAction,
              pressed && styles.logoutActionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
          >
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
            </View>
            <View style={styles.logoutCopy}>
              <Text style={styles.logoutTitle}>تسجيل الخروج</Text>
              <Text style={styles.logoutDescription}>
                إنهاء جلسة الدخول على هذا الجهاز
              </Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={theme.colors.danger} />
          </Pressable>
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
          <Text style={styles.modalFieldLabel}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.modalInput}
            value={profileEmail}
            onChangeText={setProfileEmail}
            placeholder="البريد الإلكتروني"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
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
        visible={completeProfileModalVisible}
        title="أكمل ملفك الطبي"
        onClose={() => setCompleteProfileModalVisible(false)}
      >
        <View style={styles.modalBody}>
          {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}

          <Text style={styles.modalFieldLabel}>تاريخ الميلاد</Text>
          <TextInput
            style={styles.modalInput}
            value={completionDateOfBirth}
            onChangeText={setCompletionDateOfBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.textSecondary}
            textAlign="right"
          />

          <Text style={styles.modalFieldLabel}>الجنس</Text>
          <View style={styles.genderRow}>
            <Pressable
              onPress={() => setCompletionGender('male')}
              style={[
                styles.genderChip,
                completionGender === 'male' && styles.genderChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="ذكر"
            >
              <Text
                style={[
                  styles.genderChipText,
                  completionGender === 'male' && styles.genderChipTextActive,
                ]}
              >
                ذكر
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCompletionGender('female')}
              style={[
                styles.genderChip,
                completionGender === 'female' && styles.genderChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="أنثى"
            >
              <Text
                style={[
                  styles.genderChipText,
                  completionGender === 'female' && styles.genderChipTextActive,
                ]}
              >
                أنثى
              </Text>
            </Pressable>
          </View>

          <Text style={styles.modalFieldLabel}>الولاية</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.optionChipsRow}
          >
            {wilayas.map((wilaya) => {
              const isSelected = completionWilayaId === wilaya._id;
              return (
                <Pressable
                  key={wilaya._id}
                  onPress={() => {
                    setCompletionWilayaId(wilaya._id);
                    setCompletionCommuneId(null);
                  }}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={wilaya.nameAr}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      isSelected && styles.optionChipTextActive,
                    ]}
                  >
                    {wilaya.nameAr}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.modalFieldLabel}>البلدية</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.optionChipsRow}
          >
            {communes.map((commune) => {
              const isSelected = completionCommuneId === commune._id;
              return (
                <Pressable
                  key={commune._id}
                  onPress={() => setCompletionCommuneId(commune._id)}
                  style={[
                    styles.optionChip,
                    isSelected && styles.optionChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={commune.nameAr}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      isSelected && styles.optionChipTextActive,
                    ]}
                  >
                    {commune.nameAr}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={handleSavePatientProfile}
            disabled={savingCompletion}
            style={({ pressed }) => [
              styles.modalPrimaryButton,
              (pressed || savingCompletion) && styles.modalButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="حفظ الملف الطبي"
          >
            <Text style={styles.modalPrimaryButtonText}>
              {savingCompletion ? 'جاري الحفظ...' : 'حفظ الملف الطبي'}
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
  profileHeroRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileGreetingBlock: {
    alignItems: 'center',
  },
  profileGreetingName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 28,
    lineHeight: 38,
    color: theme.colors.white,
    textAlign: 'center',
  },
  profileHeroIcon: {
    position: 'absolute',
    right: 0,
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  completeProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#F8D47A',
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  completeProfileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: theme.spacing.md,
  },
  completeProfileTextArea: {
    flex: 1,
  },
  completeProfileTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  completeProfileDescription: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
    textAlign: rtlTextAlign(),
  },
  completeProfileButton: {
    backgroundColor: theme.colors.warning,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginStart: theme.spacing.sm,
  },
  completeProfileButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.white,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  sectionEditButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
  },
  sectionEditButtonPressed: {
    opacity: 0.72,
  },
  sectionEditButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  sectionCard: {
    marginHorizontal: theme.spacing.lg,
    padding: 0,
  },

  // ── Row ──────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingStart: theme.spacing.sm,
    paddingEnd: theme.spacing.lg,
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
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: theme.spacing.md,
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
    marginStart: theme.spacing.sm,
  },

  // ── Logout Action ───────────────────────────────────────────────────────
  logoutAction: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#FFF5F4',
    borderWidth: 1,
    borderColor: '#F1C6C1',
  },
  logoutActionPressed: {
    opacity: 0.78,
    backgroundColor: '#FDEDEC',
  },
  logoutIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDEDEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  logoutTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.danger,
    textAlign: 'right',
  },
  logoutDescription: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.status.danger.text,
    textAlign: 'right',
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
    marginEnd: theme.spacing.md,
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

  // ── Family profiles (coming soon) ────────────────────────────────────────
  familyComingSoonContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.lg,
  },
  familyComingSoonIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  familyComingSoonTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  familyComingSoonText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: theme.spacing.sm,
  },
  familyComingSoonBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  familyComingSoonBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 11,
    color: theme.colors.primary,
  },

  // ── Disabled Settings ────────────────────────────────────────────────────
  settingsUnavailableBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingsUnavailableBadgeText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  // ── Modals ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
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
  optionChipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.white,
  },
  optionChipActive: {
    backgroundColor: theme.colors.secondary,
    borderColor: theme.colors.primary,
  },
  optionChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  optionChipTextActive: {
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
