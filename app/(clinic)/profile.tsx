import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useMutation, useQuery } from '@/lib/backend';

import { api } from '@/lib/backend/api';
import type { Id } from '@/lib/backend/types';
import ClinicDoctorsManager from '@/components/ClinicDoctorsManager';
import { DoctorHeader, DoctorSection } from '@/components/doctor-ui';
import { theme } from '@/lib/theme';

type ClinicProfileView = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  mapUrl?: string;
  wilayaId?: Id<'wilayas'>;
};

type InputKeyboard = 'default' | 'phone-pad' | 'email-address';

export default function ClinicProfileScreen() {
  const me = useQuery(api.users.me, {});
  const wilayasQuery = useQuery(api.locations.listWilayas, {});
  const updateMyClinicProfile = useMutation(api.users.updateMyClinicProfile);

  const profile =
    me?.role === 'clinic'
      ? (me.profile as ClinicProfileView | null | undefined)
      : null;
  const wilayas = wilayasQuery ?? [];

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [wilayaPickerVisible, setWilayaPickerVisible] = useState(false);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [wilayaId, setWilayaId] = useState<Id<'wilayas'> | null>(null);

  useEffect(() => {
    if (!editModalVisible) {
      setClinicName(profile?.name ?? me?.fullName ?? '');
      setPhone(profile?.phone ?? me?.phone ?? '');
      setEmail(profile?.email ?? me?.email ?? '');
      setAddress(profile?.address ?? '');
      setMapUrl(profile?.mapUrl ?? '');
      setWilayaId(profile?.wilayaId ?? null);
    }
  }, [editModalVisible, me?.email, me?.fullName, me?.phone, profile]);

  const currentWilayaName = useMemo(() => {
    const activeWilayaId = editModalVisible ? wilayaId : (profile?.wilayaId ?? null);
    if (!activeWilayaId) return 'غير محددة';
    return wilayas.find((item) => item._id === activeWilayaId)?.name ?? 'غير محددة';
  }, [editModalVisible, profile?.wilayaId, wilayaId, wilayas]);

  const filteredWilayas = useMemo(() => {
    const query = wilayaSearch.trim();
    if (!query) return wilayas;
    return wilayas.filter((wilaya) => wilaya.name.includes(query));
  }, [wilayaSearch, wilayas]);

  const infoTiles = useMemo(
    () => [
      {
        label: 'اسم المركز',
        value: profile?.name ?? me?.fullName ?? '',
        icon: 'business-outline' as const,
      },
      {
        label: 'رقم الهاتف',
        value: profile?.phone ?? me?.phone ?? '',
        icon: 'call-outline' as const,
      },
      {
        label: 'البريد الإلكتروني',
        value: profile?.email ?? me?.email ?? 'اختياري',
        icon: 'mail-outline' as const,
      },
      {
        label: 'الولاية',
        value: currentWilayaName,
        icon: 'location-outline' as const,
      },
      {
        label: 'العنوان',
        value: profile?.address ?? 'اختياري',
        icon: 'pin-outline' as const,
      },
      {
        label: 'رابط Google Maps',
        value: profile?.mapUrl ?? 'اختياري',
        icon: 'map-outline' as const,
      },
    ],
    [
      currentWilayaName,
      me?.email,
      me?.fullName,
      me?.phone,
      profile?.address,
      profile?.email,
      profile?.mapUrl,
      profile?.name,
      profile?.phone,
    ],
  );

  const closeEditModal = () => {
    if (isSaving) return;
    setEditModalVisible(false);
    setWilayaPickerVisible(false);
    setWilayaSearch('');
  };

  const handleSave = async () => {
    if (!clinicName.trim() || !phone.trim() || !wilayaId) {
      Alert.alert('البيانات غير مكتملة', 'اسم المركز ورقم الهاتف والولاية مطلوبة.');
      return;
    }

    try {
      setIsSaving(true);
      await updateMyClinicProfile({
        clinicName,
        phone,
        email,
        wilayaId,
        address,
        mapUrl,
      });
      setEditModalVisible(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'تعذر حفظ معلومات المركز.';
      Alert.alert('تعذر الحفظ', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <DoctorHeader title="ملف المركز" icon="business-outline" centerTitle />

        <DoctorSection
          title="معلومات أساسية"
          subtitle="عرض سريع لبيانات المركز التي يعتمد عليها العملاء عند الحجز"
          action={
            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.editButtonPressed,
              ]}
              onPress={() => setEditModalVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>تعديل</Text>
            </Pressable>
          }
        >
          <View style={styles.summaryGrid}>
            {infoTiles.map((tile) => (
              <View key={tile.label} style={styles.infoTile}>
                <View style={styles.infoTileHeader}>
                  <View style={styles.infoTileIcon}>
                    <Ionicons name={tile.icon} size={15} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.infoTileLabel}>{tile.label}</Text>
                </View>
                <Text style={styles.infoTileValue} numberOfLines={2}>
                  {tile.value}
                </Text>
              </View>
            ))}
          </View>
        </DoctorSection>

        <ClinicDoctorsManager />
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeEditModal} />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle}>
              <View style={styles.sheetHandleBar} />
            </View>

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>تعديل بيانات المركز</Text>
                <Text style={styles.sheetSubtitle}>
                  حرر البيانات في مساحة واحدة واضحة ثم احفظها دفعة واحدة.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.sheetCloseButton,
                  pressed && styles.sheetCloseButtonPressed,
                ]}
                onPress={closeEditModal}
                disabled={isSaving}
              >
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <EditField
                label="اسم المركز"
                value={clinicName}
                onChangeText={setClinicName}
                placeholder="اسم المركز"
              />
              <EditField
                label="رقم الهاتف"
                value={phone}
                onChangeText={setPhone}
                placeholder="رقم الهاتف"
                keyboardType="phone-pad"
              />
              <EditField
                label="البريد الإلكتروني"
                value={email}
                onChangeText={setEmail}
                placeholder="البريد الإلكتروني اختياري"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>الولاية</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.wilayaSelector,
                    pressed && styles.wilayaSelectorPressed,
                  ]}
                  onPress={() => setWilayaPickerVisible(true)}
                >
                  <View style={styles.wilayaSelectorTextWrap}>
                    <Text style={styles.wilayaSelectorLabel}>اختر الولاية</Text>
                    <Text style={styles.wilayaSelectorValue}>
                      {currentWilayaName}
                    </Text>
                  </View>
                  <View style={styles.wilayaSelectorIcon}>
                    <Ionicons name="search-outline" size={18} color={theme.colors.primary} />
                  </View>
                </Pressable>
              </View>

              <EditField
                label="العنوان"
                value={address}
                onChangeText={setAddress}
                placeholder="العنوان اختياري"
              />
              <EditField
                label="رابط Google Maps"
                value={mapUrl}
                onChangeText={setMapUrl}
                placeholder="رابط Google Maps اختياري"
                autoCapitalize="none"
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={closeEditModal}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  isSaving && styles.primaryButtonDisabled,
                ]}
                onPress={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={wilayaPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWilayaPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setWilayaPickerVisible(false)}
          />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={styles.pickerTitle}>اختيار الولاية</Text>
                <Text style={styles.pickerSubtitle}>
                  ابحث سريعاً ثم اختر الولاية المناسبة للمركز.
                </Text>
              </View>
              <Pressable
                style={styles.pickerCloseButton}
                onPress={() => setWilayaPickerVisible(false)}
              >
                <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={16} color={theme.colors.textSecondary} />
              <TextInput
                value={wilayaSearch}
                onChangeText={setWilayaSearch}
                placeholder="ابحث عن الولاية"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
                textAlign="right"
              />
            </View>

            <ScrollView
              style={styles.wilayaPickerList}
              contentContainerStyle={styles.wilayaListContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredWilayas.map((wilaya) => {
                const selected = wilayaId === wilaya._id;
                return (
                  <Pressable
                    key={wilaya._id}
                    onPress={() => {
                      setWilayaId(wilaya._id);
                      setWilayaPickerVisible(false);
                      setWilayaSearch('');
                    }}
                    style={[
                      styles.wilayaOption,
                      selected && styles.wilayaOptionActive,
                    ]}
                  >
                    <View style={styles.wilayaOptionContent}>
                      <Text
                        style={[
                          styles.wilayaOptionText,
                          selected && styles.wilayaOptionTextActive,
                        ]}
                      >
                        {wilaya.name}
                      </Text>
                      <Text style={styles.wilayaOptionHint}>ولاية</Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={theme.colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: InputKeyboard;
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        textAlign="right"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  summaryGrid: {
    gap: theme.spacing.sm,
  },
  infoTile: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceRaised,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  infoTileIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTileLabel: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  infoTileValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  editButton: {
    minHeight: 34,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  editButtonPressed: {
    opacity: 0.84,
  },
  editButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlay,
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.surfaceRaised,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sheetHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
  },
  sheetHandleBar: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.borderStrong,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  sheetSubtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'right',
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseButtonPressed: {
    opacity: 0.82,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  fieldBlock: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceRaised,
  },
  wilayaListContent: {
    gap: theme.spacing.xs,
  },
  wilayaSelector: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  wilayaSelectorPressed: {
    opacity: 0.86,
  },
  wilayaSelectorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  wilayaSelectorLabel: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: 'right',
  },
  wilayaSelectorValue: {
    marginTop: 2,
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 15,
    textAlign: 'right',
  },
  wilayaSelectorIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wilayaOption: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  wilayaOptionContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  wilayaOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.secondary,
  },
  wilayaOptionText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  wilayaOptionTextActive: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  wilayaOptionHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: 'right',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    padding: theme.spacing.lg,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  pickerCard: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  pickerHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  pickerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
    fontSize: 18,
    textAlign: 'right',
  },
  pickerSubtitle: {
    marginTop: 4,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
  },
  pickerCloseButton: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchField: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    color: theme.colors.textPrimary,
  },
  wilayaPickerList: {
    flexGrow: 0,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.white,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.textPrimary,
  },
});
