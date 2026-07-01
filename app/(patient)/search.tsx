// =============================================================================
// Imports
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
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
import { Badge, Button, LoadingState } from '@/components/ui';
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
  wilaya?: { nameAr: string } | null;
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
    wilaya: { nameAr: r.wilaya?.nameAr ?? '' },
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

const genderOptions: FlatOption[] = [
  { id: 'male', nameAr: 'ذكر' },
  { id: 'female', nameAr: 'أنثى' },
];

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
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const lastResultsScrollYRef = useRef(0);

  // ── Dropdown visibility ───────────────────────────────────────────────────
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showWilayaPicker, setShowWilayaPicker] = useState(false);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);

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
  const doctors = dataSource ?? [];

  const selectedSpecialty = useMemo(
    () => specialtyOptions.find((s) => s.id === selectedSpecialtyId),
    [selectedSpecialtyId, specialtyOptions],
  );
  const selectedWilaya = useMemo(
    () => wilayaOptions.find((w) => w.id === selectedWilayaId),
    [selectedWilayaId, wilayaOptions],
  );

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
  }, []);

  const handleWilayaSelect = useCallback((val: string | null) => {
    setSelectedWilayaId(val as Id<'wilayas'> | null);
  }, []);

  const handleGenderSelect = useCallback((val: string | null) => {
    setGenderFilter(val as GenderValue | null);
  }, []);

  const handleAvailableTodayToggle = useCallback(() => {
    setAvailableTodayOnly((prev) => !prev);
  }, []);

  const handleResultsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
      const previousY = lastResultsScrollYRef.current;
      const deltaY = currentY - previousY;

      if (currentY <= 12) {
        setFiltersCollapsed(false);
      } else if (deltaY > 16) {
        setFiltersCollapsed(true);
      } else if (deltaY < -16) {
        setFiltersCollapsed(false);
      }

      lastResultsScrollYRef.current = currentY;
    },
    [],
  );

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
        <LoadingState label="جاري تحميل الأطباء..." />
      </SafeAreaView>
    );
  }

  const searchListHeader = (
    <>
      <View style={styles.searchHeader}>
        <View style={styles.headerMeta}>
          <View style={styles.headerIcon}>
            <Ionicons
              name="search-outline"
              size={18}
              color={theme.colors.official}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>دليل الأطباء</Text>
            <Text style={styles.headerTitle}>ابحث عن طبيب</Text>
            <Text style={styles.headerSubtitle}>
              اختر التخصص والولاية ثم قارن الأطباء المتاحين.
            </Text>
          </View>
        </View>

        <View style={styles.searchControls}>
          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={handleSubmit}
            onFilterPress={() => setFilterModalVisible(true)}
            containerStyle={styles.searchBarEmbedded}
          />

          {filtersCollapsed ? (
            <TouchableOpacity
              style={styles.collapsedFiltersButton}
              onPress={() => setFiltersCollapsed(false)}
              accessibilityRole="button"
              accessibilityLabel="إظهار الفلاتر"
            >
              <View style={styles.collapsedFiltersCopy}>
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={theme.colors.official}
                />
                <Text style={styles.collapsedFiltersText}>إظهار الفلاتر</Text>
              </View>
              <Text style={styles.collapsedFiltersMeta}>
                {activeFiltersCount > 0
                  ? `${activeFiltersCount} مفعلة`
                  : 'كل النتائج'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chipsContent}>
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
                <Badge
                  label={
                    selectedSpecialtyId !== undefined
                      ? selectedSpecialty?.nameAr ?? 'التخصص'
                      : 'التخصص'
                  }
                  tone={selectedSpecialtyId !== undefined ? 'info' : 'neutral'}
                />
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
                <Badge
                  label={
                    selectedWilayaId !== null
                      ? selectedWilaya?.nameAr ?? 'الولاية'
                      : 'الولاية'
                  }
                  tone={selectedWilayaId !== null ? 'info' : 'neutral'}
                />
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
                onPress={() => setShowGenderPicker(true)}
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
                <Badge
                  label={
                    genderFilter === 'male'
                      ? 'ذكر'
                      : genderFilter === 'female'
                        ? 'أنثى'
                        : 'الجنس'
                  }
                  tone={genderFilter !== null ? 'info' : 'neutral'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chip,
                  availableTodayOnly && styles.chipActive,
                ]}
                onPress={handleAvailableTodayToggle}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب الأطباء المتاحين اليوم"
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={
                    availableTodayOnly
                      ? theme.colors.white
                      : theme.colors.textSecondary
                  }
                />
                <Badge
                  label="متاح اليوم"
                  tone={availableTodayOnly ? 'info' : 'neutral'}
                />
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
            </View>
          )}
        </View>
      </View>

      <View style={styles.resultsInfo}>
        <Badge
          label={`${doctors.length} ${
            doctors.length === 1 ? 'طبيب' : 'أطباء'
          }`}
          tone={activeFiltersCount > 0 ? 'info' : 'neutral'}
          icon="list-outline"
        />
        {activeFiltersCount > 0 ? (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={handleClearFilters}
            accessibilityRole="button"
            accessibilityLabel="إزالة الفلترة"
          >
            <Text style={styles.clearChipText}>إزالة الفلاتر</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {dataSource ? (
        <FlatList
          data={doctors}
          renderItem={renderDoctor}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={searchListHeader}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyWrapper}>
                <EmptyState
                  icon="search-outline"
                  title="لا يوجد أطباء مطابقين لبحثك"
                  subtitle="حاول تغيير كلمات البحث أو تصفح التخصصات من الصفحة الرئيسية"
                />
              </View>
            ) : null
          }
          onScroll={handleResultsScroll}
          scrollEventThrottle={16}
          // Load more when nearing the end
          onEndReached={() => {
            if (listStatus === 'CanLoadMore') {
              loadMore(20);
            }
          }}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={ItemSeparator}
        />
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
                onPress={() => {
                  setFilterModalVisible(false);
                  setShowGenderPicker(true);
                }}
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
                <Button
                  label="إزالة"
                  variant="secondary"
                  icon="close-circle-outline"
                  onPress={handleClearFilters}
                  accessibilityLabel="إزالة الفلترة"
                  style={styles.filterPanelButton}
                />
                <Button
                  label="تطبيق"
                  icon="checkmark-circle-outline"
                  onPress={() => setFilterModalVisible(false)}
                  accessibilityLabel="تطبيق الفلاتر"
                  style={styles.filterPanelButton}
                />
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

      <DropdownPicker
        visible={showGenderPicker}
        title="اختر الجنس"
        options={genderOptions}
        selectedValue={genderFilter}
        onSelect={handleGenderSelect}
        onClose={() => setShowGenderPicker(false)}
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
  },

  // ── Search header ───────────────────────────────────────────────────────────
  searchHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
    marginBottom: theme.spacing.xs,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 24,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  headerSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
    marginTop: theme.spacing.xs,
  },
  searchControls: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  searchBarEmbedded: {
    flexDirection: 'row-reverse',
    marginHorizontal: 0,
    marginVertical: 0,
    backgroundColor: theme.colors.background,
  },
  chipsContent: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  collapsedFiltersButton: {
    minHeight: 38,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  collapsedFiltersCopy: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  collapsedFiltersText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.official,
    textAlign: rtlTextAlign(),
  },
  collapsedFiltersMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
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
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  clearFiltersButton: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  listContent: {
    flexGrow: 1,
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
  filterPanelButton: {
    flex: 1,
  },
});
