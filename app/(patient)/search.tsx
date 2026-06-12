// =============================================================================
// Imports
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

import DoctorCard, { DoctorCardData } from '@/components/DoctorCard';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { routeParamString } from '@/lib/routeParams';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types
// =============================================================================

/** A picker option extracted from doctor data. */
interface FlatOption {
  id: string;
  nameAr: string;
}

type GenderValue = 'male' | 'female';

// =============================================================================
// Mapping
// =============================================================================

/** Map the Convex doctor card shape to DoctorCardData. */
function toDoctorCardData(r: {
  _id: string;
  user: { fullNameAr: string | null };
  specialty: { nameAr: string };
  avgRating: number;
  totalReviews: number;
  isVerified: boolean;
}): DoctorCardData {
  return {
    id: r._id,
    fullNameAr: r.user.fullNameAr ?? '',
    specialty: { nameAr: r.specialty.nameAr },
    avgRating: r.avgRating,
    totalReviews: r.totalReviews,
    wilaya: { nameAr: '' },
    isVerified: r.isVerified,
    avatarUrl: null,
  };
}

// =============================================================================
// Dropdown Picker (Modal)
// =============================================================================

interface DropdownPickerProps {
  visible: boolean;
  title: string;
  options: FlatOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
}

function DropdownPicker({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: DropdownPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
        />
        <View
          style={styles.modalContent}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
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

          {/* Options list */}
          <ScrollView
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
          >
            {/* "All" option — clears the filter */}
            <TouchableOpacity
              style={[
                styles.modalOption,
                selectedValue === null && styles.modalOptionSelected,
              ]}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="الكل"
            >
              <Text
                style={[
                  styles.modalOptionText,
                  selectedValue === null && styles.modalOptionTextSelected,
                ]}
              >
                الكل
              </Text>
              {selectedValue === null && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>

            {options.map((opt) => {
              const isSelected = selectedValue === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.modalOption,
                    isSelected && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onSelect(opt.id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={opt.nameAr}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextSelected,
                    ]}
                  >
                    {opt.nameAr}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Doctor Row Separator
// =============================================================================

const ItemSeparator: React.FC = () => <View style={styles.separator} />;

// =============================================================================
// Main Screen
// =============================================================================

export default function PatientSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ specialty?: string | string[] }>();
  const specialtyParam = routeParamString(params.specialty);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [selectedWilayaId, setSelectedWilayaId] =
    useState<Id<'wilayas'> | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<
    Id<'specialties'> | undefined
  >((specialtyParam ?? undefined) as Id<'specialties'> | undefined);
  const [genderFilter, setGenderFilter] = useState<GenderValue | null>(null);
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ── Dropdown visibility ───────────────────────────────────────────────────
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showWilayaPicker, setShowWilayaPicker] = useState(false);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const specialties = useQuery(api.specialties.list, {});
  const wilayas = useQuery(api.locations.listWilayas, {});
  const specialtyOptions: FlatOption[] = useMemo(
    () =>
      specialties?.map((specialty) => ({
        id: specialty._id,
        nameAr: specialty.nameAr,
      })) ?? [],
    [specialties],
  );
  const wilayaOptions: FlatOption[] = useMemo(
    () =>
      wilayas?.map((wilaya) => ({
        id: wilaya._id,
        nameAr: wilaya.nameAr,
      })) ?? [],
    [wilayas],
  );

  useEffect(() => {
    setSelectedSpecialtyId(
      (specialtyParam ?? undefined) as Id<'specialties'> | undefined,
    );
  }, [specialtyParam]);

  // Load doctors with optional structural filters
  // Uses Convex paginated query — loads initial page, can load more
  const {
    results: allResults,
    status: paginatedStatus,
    isLoading: paginatedLoading,
    loadMore,
  } = usePaginatedQuery(
    api.doctors.listPublic,
    {
      specialtyId: selectedSpecialtyId,
      wilayaId: selectedWilayaId ?? undefined,
      gender: genderFilter ?? undefined,
      language: undefined,
      availableToday: availableTodayOnly || undefined,
    },
    { initialNumItems: 20 },
  );

  // When search text is entered, use the search endpoint
  const searchQueryText = isSearching && searchText.trim() ? searchText.trim() : '';

  const {
    results: searchResults,
    status: searchStatus,
    isLoading: searchLoading,
  } = usePaginatedQuery(
    api.doctors.search,
    searchQueryText
      ? {
          query: searchQueryText,
          specialtyId: selectedSpecialtyId,
          wilayaId: selectedWilayaId ?? undefined,
          gender: genderFilter ?? undefined,
          language: undefined,
          availableToday: availableTodayOnly || undefined,
        }
      : 'skip',
    { initialNumItems: 20 },
  );

  // ── Determine which data source to render ───────────────────────────────
  const isLoading = paginatedLoading || searchLoading;
  const dataSource = isSearching && searchQueryText ? searchResults : allResults;
  const listStatus = isSearching && searchQueryText ? searchStatus : paginatedStatus;

  // ── Client-side text filter (applied on top of server data) ──────────────
  const selectedSpecialty = useMemo(
    () => specialtyOptions.find((s) => s.id === selectedSpecialtyId),
    [selectedSpecialtyId, specialtyOptions],
  );
  const selectedWilaya = useMemo(
    () => wilayaOptions.find((w) => w.id === selectedWilayaId),
    [selectedWilayaId, wilayaOptions],
  );

  const filteredDoctors = useMemo(() => {
    if (!dataSource) return [];

    return dataSource.filter((d: any) => {
      if (selectedSpecialtyId && d.specialtyId !== selectedSpecialtyId) {
        return false;
      }

      // Free-text search (always client-side for instant feedback)
      if (searchText) {
        const q = searchText.trim();
        const nameHit = (d.user?.fullNameAr ?? '').includes(q);
        const specHit = (d.specialty?.nameAr ?? '').includes(q);
        if (!nameHit && !specHit) return false;
      }
      return true;
    });
  }, [dataSource, searchText, selectedSpecialtyId]);

  // ── Derived display values ────────────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (selectedWilayaId) n++;
    if (selectedSpecialtyId) n++;
    if (genderFilter) n++;
    if (availableTodayOnly) n++;
    return n;
  }, [selectedWilayaId, selectedSpecialtyId, genderFilter, availableTodayOnly]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    setIsSearching(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedWilayaId(null);
    setSelectedSpecialtyId(undefined);
    setGenderFilter(null);
    setAvailableTodayOnly(false);
    setSearchText('');
    setIsSearching(false);
  }, []);

  const handleDoctorPress = useCallback(
    (id: string) => {
      router.push(`/(patient)/doctor/${id}`);
    },
    [router],
  );

  const handleSpecialtySelect = useCallback((val: string | null) => {
    setSelectedSpecialtyId((val ?? undefined) as Id<'specialties'> | undefined);
    setSearchText('');
  }, []);

  const handleWilayaSelect = useCallback((val: string | null) => {
    setSelectedWilayaId(val as Id<'wilayas'> | null);
    setSearchText('');
  }, []);

  const handleGenderToggle = useCallback(() => {
    setGenderFilter((prev) => {
      if (prev === null) return 'male';
      if (prev === 'male') return 'female';
      return null;
    });
  }, []);

  const handleAvailableTodayToggle = useCallback(() => {
    setAvailableTodayOnly((prev) => !prev);
  }, []);

  // ── List renderers ────────────────────────────────────────────────────────
  const renderDoctor = useCallback(
    ({ item }: ListRenderItemInfo<any>) => (
      <DoctorCard
        doctor={toDoctorCardData(item)}
        isAvailableToday={item.isAvailableToday}
        onPress={() => handleDoctorPress(item._id)}
      />
    ),
    [handleDoctorPress],
  );

  const keyExtractor = useCallback(
    (item: any) => item._id,
    [],
  );

  // ── Full-screen loading ───────────────────────────────────────────────────
  if (isLoading && !dataSource) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل الأطباء...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Search Bar */}
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        onSubmit={handleSubmit}
        onFilterPress={() => setFilterModalVisible(true)}
      />

      {/* Filter chips row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsRow}
        contentContainerStyle={styles.chipsContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Specialty chip */}
        <TouchableOpacity
          style={[
            styles.chip,
            selectedSpecialtyId !== undefined && styles.chipActive,
          ]}
          onPress={() => setShowSpecialtyPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="تصفية حسب التخصص"
        >
          <Text
            style={[
              styles.chipText,
              selectedSpecialtyId !== undefined && styles.chipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedSpecialtyId !== undefined
              ? selectedSpecialty?.nameAr ?? 'التخصص'
              : 'التخصص'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={
              selectedSpecialtyId !== undefined
                ? theme.colors.white
                : theme.colors.textSecondary
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.chip,
            selectedWilayaId !== null && styles.chipActive,
          ]}
          onPress={() => setShowWilayaPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="تصفية حسب الولاية"
        >
          <Text
            style={[
              styles.chipText,
              selectedWilayaId !== null && styles.chipTextActive,
            ]}
            numberOfLines={1}
          >
            {selectedWilayaId !== null
              ? selectedWilaya?.nameAr ?? 'الولاية'
              : 'الولاية'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={
              selectedWilayaId !== null
                ? theme.colors.white
                : theme.colors.textSecondary
            }
          />
        </TouchableOpacity>

        {/* Gender toggle */}
        <TouchableOpacity
          style={[styles.chip, genderFilter !== null && styles.chipActive]}
          onPress={handleGenderToggle}
          accessibilityRole="button"
          accessibilityLabel="تصفية حسب الجنس"
        >
          <Ionicons
            name={
              genderFilter === 'male'
                ? 'male'
                : genderFilter === 'female'
                  ? 'female'
                  : 'people-outline'
            }
            size={16}
            color={
              genderFilter !== null
                ? theme.colors.white
                : theme.colors.textSecondary
            }
          />
          <Text
            style={[
              styles.chipText,
              genderFilter !== null && styles.chipTextActive,
            ]}
            numberOfLines={1}
          >
            {genderFilter === 'male'
              ? 'ذكر'
              : genderFilter === 'female'
                ? 'أنثى'
                : 'الجنس'}
          </Text>
        </TouchableOpacity>

        {/* Clear-all button — visible when any filter is active */}
        {activeFiltersCount > 0 && (
          <TouchableOpacity
            style={styles.clearChip}
            onPress={handleClearFilters}
            accessibilityRole="button"
            accessibilityLabel="إزالة الفلترة"
          >
            <Ionicons
              name="close-circle"
              size={16}
              color={theme.colors.danger}
            />
            <Text style={styles.clearChipText}>إزالة</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Results count summary */}
      {dataSource && (
        <View style={styles.resultsInfo}>
          <Text style={styles.resultsCount}>
            {filteredDoctors.length}{' '}
            {filteredDoctors.length === 1 ? 'طبيب' : 'أطباء'}
          </Text>
        </View>
      )}

      {/* Results list or empty state */}
      {filteredDoctors.length > 0 ? (
        <FlatList
          data={filteredDoctors}
          renderItem={renderDoctor}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Load more when nearing the end
          onEndReached={() => {
            if (listStatus === 'CanLoadMore') {
              loadMore(20);
            }
          }}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={ItemSeparator}
        />
      ) : !isLoading ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="🔍"
            title="لا يوجد أطباء مطابقين لبحثك"
            subtitle="حاول تغيير كلمات البحث أو تصفح التخصصات من الصفحة الرئيسية"
          />
        </View>
      ) : null}

      {/* Dropdowns */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="إغلاق الفلاتر"
          />
          <View
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تصفية النتائج</Text>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
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

            <View style={styles.filterPanelBody}>
              <TouchableOpacity
                style={styles.filterPanelRow}
                onPress={() => {
                  setFilterModalVisible(false);
                  setShowSpecialtyPicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب التخصص"
              >
                <Text style={styles.filterPanelLabel}>التخصص</Text>
                <Text style={styles.filterPanelValue}>
                  {selectedSpecialtyId
                    ? selectedSpecialty?.nameAr ?? 'مختار'
                    : 'الكل'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterPanelRow}
                onPress={() => {
                  setFilterModalVisible(false);
                  setShowWilayaPicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب الولاية"
              >
                <Text style={styles.filterPanelLabel}>الولاية</Text>
                <Text style={styles.filterPanelValue}>
                  {selectedWilayaId
                    ? selectedWilaya?.nameAr ?? 'مختارة'
                    : 'الكل'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterPanelRow}
                onPress={handleGenderToggle}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب الجنس"
              >
                <Text style={styles.filterPanelLabel}>الجنس</Text>
                <Text style={styles.filterPanelValue}>
                  {genderFilter === 'male'
                    ? 'ذكر'
                    : genderFilter === 'female'
                      ? 'أنثى'
                      : 'الكل'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterPanelRow}
                onPress={handleAvailableTodayToggle}
                accessibilityRole="button"
                accessibilityLabel="متاح اليوم"
              >
                <Text style={styles.filterPanelLabel}>متاح اليوم</Text>
                <Text style={styles.filterPanelValue}>
                  {availableTodayOnly ? 'مفعل' : 'غير مفعل'}
                </Text>
              </TouchableOpacity>

              <View style={styles.filterPanelActions}>
                <TouchableOpacity
                  style={styles.filterPanelSecondaryButton}
                  onPress={handleClearFilters}
                  accessibilityRole="button"
                  accessibilityLabel="إزالة الفلترة"
                >
                  <Text style={styles.filterPanelSecondaryText}>إزالة</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterPanelPrimaryButton}
                  onPress={() => setFilterModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel="تطبيق الفلاتر"
                >
                  <Text style={styles.filterPanelPrimaryText}>تطبيق</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <DropdownPicker
        visible={showSpecialtyPicker}
        title="اختر التخصص"
        options={specialtyOptions}
        selectedValue={selectedSpecialtyId ?? null}
        onSelect={handleSpecialtySelect}
        onClose={() => setShowSpecialtyPicker(false)}
      />

      <DropdownPicker
        visible={showWilayaPicker}
        title="اختر الولاية"
        options={wilayaOptions}
        selectedValue={selectedWilayaId}
        onSelect={handleWilayaSelect}
        onClose={() => setShowWilayaPicker(false)}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3xl'],
  },

  // ── Loading ─────────────────────────────────────────────────────────────────
  loadingText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },

  // ── Filter chips ────────────────────────────────────────────────────────────
  chipsRow: {
    maxHeight: 48,
    marginTop: theme.spacing.xs,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.white,
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  clearChipText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.danger,
  },

  // ── Results info ────────────────────────────────────────────────────────────
  resultsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  resultsCount: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },

  // ── List ────────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  separator: {
    height: theme.spacing.xs,
  },

  // ── Empty state wrapper ─────────────────────────────────────────────────────
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Modal ───────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
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
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  modalList: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalOptionSelected: {
    backgroundColor: theme.colors.secondary,
  },
  modalOptionText: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  modalOptionTextSelected: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    color: theme.colors.primary,
  },
  filterPanelBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  filterPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  filterPanelLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  filterPanelValue: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.primary,
  },
  filterPanelActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  filterPanelPrimaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
  },
  filterPanelPrimaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
  },
  filterPanelSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  filterPanelSecondaryText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});
