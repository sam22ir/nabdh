// @ts-nocheck
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, usePaginatedQuery } from '@/lib/backend';
import { api } from '@/lib/backend/api';

import DoctorCard, { DoctorCardData } from '@/components/DoctorCard';
import SearchBar from '@/components/SearchBar';
import EmptyState from '@/components/EmptyState';
import { DoctorHeader } from '@/components/doctor-ui';
import { Badge, Button, LoadingState } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import { routeParamAllowedValue, routeParamString } from '@/lib/routeParams';
import type { Id } from '@/lib/backend/types';

// =============================================================================
// Types
// =============================================================================

/** A picker option extracted from doctor data. */
interface FlatOption {
  id: string;
  nameAr: string;
}

type SearchMode = 'doctors' | 'clinics';

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
  nextAvailableInDays?: number | null;
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
    nextAvailableInDays: r.nextAvailableInDays ?? null,
  };
}

interface ClinicSearchResult {
  _id: Id<'clinics'>;
  name: string;
  nameAr?: string;
  phone?: string;
  address?: string | null;
  wilaya?: { nameAr?: string | null } | null;
  acceptedDoctorCount?: number;
  isBookable?: boolean;
}

function ClinicResultCard({
  clinic,
  onPress,
}: {
  clinic: ClinicSearchResult;
  onPress: () => void;
}) {
  const isBookable = clinic.isBookable === true;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.clinicResultCard,
        pressed && isBookable && styles.clinicResultCardPressed,
        !isBookable && styles.clinicResultCardDisabled,
      ]}
      onPress={onPress}
      disabled={!isBookable}
      accessibilityRole="button"
      accessibilityLabel={`${clinic.nameAr ?? clinic.name}، ${isBookable ? 'متاحة للحجز' : 'غير متاحة للحجز'}`}
      accessibilityState={{ disabled: !isBookable }}
    >
      <View style={styles.clinicResultTop}>
        <View style={styles.clinicResultIcon}>
          <Ionicons
            name="business-outline"
            size={22}
            color={theme.colors.official}
          />
        </View>
        <View style={styles.clinicResultCopy}>
          <Text style={styles.clinicResultName} numberOfLines={1}>
            {clinic.nameAr ?? clinic.name}
          </Text>
          <Text style={styles.clinicResultMeta} numberOfLines={1}>
            {clinic.wilaya?.nameAr ?? 'الولاية غير محددة'}
          </Text>
        </View>
        <Badge
          label={isBookable ? 'متاحة' : 'ملف فقط'}
          tone={isBookable ? 'success' : 'neutral'}
          icon={isBookable ? 'checkmark-circle-outline' : 'information-circle-outline'}
        />
      </View>

      {clinic.address ? (
        <View style={styles.clinicResultRow}>
          <Ionicons
            name="location-outline"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.clinicResultRowText} numberOfLines={2}>
            {clinic.address}
          </Text>
        </View>
      ) : null}

      <View style={styles.clinicResultFooter}>
        <Text style={styles.clinicResultDoctorCount}>
          {clinic.acceptedDoctorCount ?? 0} مختصين
        </Text>
        {isBookable ? (
          <View style={styles.clinicResultAction}>
            <Text style={styles.clinicResultActionText}>اختيار المركز</Text>
            <Ionicons
              name="arrow-back"
              size={16}
              color={theme.colors.primary}
            />
          </View>
        ) : (
          <Text style={styles.clinicResultUnavailable}>
            لا توجد مواعيد عبر المركز حالياً
          </Text>
        )}
      </View>
    </Pressable>
  );
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
  const [query, setQuery] = useState('');
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLocaleLowerCase('ar')
      .replace(/[إأآ]/g, 'ا')
      .replace(/ة/g, 'ه');
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.nameAr
        .toLocaleLowerCase('ar')
        .replace(/[إأآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

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

          <View style={styles.pickerSearch}>
            <Ionicons name="search" size={19} color={theme.colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث في القائمة..."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.pickerSearchInput}
              textAlign="right"
              autoCapitalize="none"
              accessibilityLabel={`بحث في ${title}`}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="مسح البحث"
              >
                <Ionicons name="close-circle" size={19} color={theme.colors.textSecondary} />
              </Pressable>
            ) : null}
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

            {filteredOptions.map((opt) => {
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
            {filteredOptions.length === 0 ? (
              <Text style={styles.pickerNoResults}>لا توجد نتائج مطابقة</Text>
            ) : null}
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
  const [searchMode, setSearchMode] = useState<SearchMode>('doctors');
  const [searchText, setSearchText] = useState('');
  const [selectedWilayaId, setSelectedWilayaId] =
    useState<Id<'wilayas'> | null>(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<
    Id<'specialties'> | undefined
  >(undefined);
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const lastResultsScrollYRef = useRef(0);

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
        nameAr: specialty.nameAr ?? specialty.name,
      })) ?? [],
    [specialties],
  );
  const wilayaOptions: FlatOption[] = useMemo(
    () =>
      wilayas?.map((wilaya) => ({
        id: wilaya._id,
        nameAr: wilaya.nameAr ?? wilaya.name,
      })) ?? [],
    [wilayas],
  );
  const allowedSpecialtyIds = useMemo(
    () => specialtyOptions.map((specialty) => specialty.id as Id<'specialties'>),
    [specialtyOptions],
  );
  const routeSpecialtyId = useMemo(
    () => routeParamAllowedValue(specialtyParam, allowedSpecialtyIds),
    [specialtyParam, allowedSpecialtyIds],
  );

  useEffect(() => {
    setSelectedSpecialtyId(routeSpecialtyId);
  }, [routeSpecialtyId]);

  // When search text is entered, use the search endpoint
  const searchQueryText = isSearching && searchText.trim() ? searchText.trim() : '';

  // Load doctors with optional structural filters
  // Uses Convex paginated query — loads initial page, can load more
  const {
    results: allResults,
    status: paginatedStatus,
    isLoading: paginatedLoading,
    loadMore: loadMoreDoctors,
  } = usePaginatedQuery(
    api.doctors.listPublic,
    searchMode === 'doctors'
      ? {
        specialtyId: selectedSpecialtyId,
        wilayaId: selectedWilayaId ?? undefined,
        availableToday: availableTodayOnly || undefined,
      }
      : 'skip',
    { initialNumItems: 20 },
  );

  const {
    results: searchResults,
    status: searchStatus,
    isLoading: searchLoading,
  } = usePaginatedQuery(
    api.doctors.search,
    searchMode === 'doctors' && searchQueryText
      ? {
          query: searchQueryText,
          specialtyId: selectedSpecialtyId,
          wilayaId: selectedWilayaId ?? undefined,
          availableToday: availableTodayOnly || undefined,
        }
      : 'skip',
    { initialNumItems: 20 },
  );

  const {
    results: clinicResults,
    status: clinicStatus,
    isLoading: clinicLoading,
    loadMore: loadMoreClinics,
  } = usePaginatedQuery(
    api.clinics.listPublic,
    searchMode === 'clinics'
      ? {
          search: searchQueryText || undefined,
          wilayaId: selectedWilayaId ?? undefined,
        }
      : 'skip',
    { initialNumItems: 20 },
  );

  // ── Determine which data source to render ───────────────────────────────
  const doctorDataSource = isSearching && searchQueryText ? searchResults : allResults;
  const isDoctorLoading = paginatedLoading || searchLoading;
  const isClinicLoading = clinicLoading;
  const isLoading = searchMode === 'doctors' ? isDoctorLoading : isClinicLoading;
  const dataSource = searchMode === 'doctors' ? doctorDataSource : clinicResults;
  const listStatus =
    searchMode === 'doctors'
      ? isSearching && searchQueryText
        ? searchStatus
        : paginatedStatus
      : clinicStatus;
  const doctors = (doctorDataSource ?? []) as any[];
  const clinics = (clinicResults ?? []) as ClinicSearchResult[];
  const resultCount = searchMode === 'doctors' ? doctors.length : clinics.length;

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
    if (searchMode === 'doctors') {
      if (selectedSpecialtyId) n++;
      if (availableTodayOnly) n++;
    }
    return n;
  }, [
    selectedWilayaId,
    selectedSpecialtyId,
    availableTodayOnly,
    searchMode,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    setIsSearching(true);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedWilayaId(null);
    setSelectedSpecialtyId(undefined);
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

  const handleClinicPress = useCallback(
    (clinic: ClinicSearchResult) => {
      if (!clinic.isBookable) return;
      router.push({
        pathname: '/(patient)/booking/clinic',
        params: { clinicId: clinic._id },
      } as any);
    },
    [router],
  );

  const handleSpecialtySelect = useCallback((val: string | null) => {
    setSelectedSpecialtyId((val ?? undefined) as Id<'specialties'> | undefined);
  }, []);

  const handleWilayaSelect = useCallback((val: string | null) => {
    setSelectedWilayaId(val as Id<'wilayas'> | null);
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
    ({ item }: ListRenderItemInfo<any>) => {
      const isBookable = Boolean(item.isBookable && item.acceptedClinicId);

      return (
        <DoctorCard
          doctor={toDoctorCardData(item)}
          isAvailableToday={item.isAvailableToday}
          bookingMode={isBookable ? 'clinic' : 'profile'}
          onPress={() => handleDoctorPress(item._id)}
        />
      );
    },
    [handleDoctorPress],
  );

  const renderClinic = useCallback(
    ({ item }: ListRenderItemInfo<ClinicSearchResult>) => (
      <ClinicResultCard
        clinic={item}
        onPress={() => handleClinicPress(item)}
      />
    ),
    [handleClinicPress],
  );

  const keyExtractor = useCallback(
    (item: any) => item._id,
    [],
  );

  // ── Full-screen loading ───────────────────────────────────────────────────
  if (isLoading && !dataSource) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="جاري تحميل المختصين..." />
      </SafeAreaView>
    );
  }

  const searchListHeader = (
    <>
      <View style={styles.searchHeader}>
        <DoctorHeader
          title="ابحث عن مختص أو مركز"
          titleContent={
            <View style={styles.searchGreetingBlock}>
              <View style={styles.searchHeroIcon}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={theme.colors.white}
                />
              </View>
              <Text style={styles.searchGreetingTitle} numberOfLines={1}>
                ابحث عن مختص أو مركز
              </Text>
              <View style={styles.searchGreetingSpacer} />
            </View>
          }
          icon={null}
          style={styles.searchHeroHeader}
        />

        <View style={styles.searchControls}>
          <View style={styles.searchModeTabs}>
            {([
              { value: 'doctors', label: 'المختصين' },
              { value: 'clinics', label: 'المراكز' },
            ] as const).map((mode) => {
              const selected = searchMode === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  style={[
                    styles.searchModeTab,
                    selected && styles.searchModeTabActive,
                  ]}
                  onPress={() => {
                    setSearchMode(mode.value);
                    setFiltersCollapsed(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`عرض ${mode.label}`}
                >
                  <Text
                    style={[
                      styles.searchModeTabText,
                      selected && styles.searchModeTabTextActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={handleSubmit}
            onFilterPress={() => setFilterModalVisible(true)}
            containerStyle={styles.searchBarEmbedded}
          />

          {selectedSpecialty ? (
            <View style={styles.appliedFilterRow}>
              <View style={styles.appliedFilterIcon}>
                <Ionicons name="briefcase-outline" size={15} color={theme.colors.official} />
              </View>
              <Text style={styles.appliedFilterText}>
                التخصص: {selectedSpecialty.nameAr}
              </Text>
              <Pressable
                onPress={() => setSelectedSpecialtyId(undefined)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="إزالة تصفية التخصص"
                style={styles.appliedFilterClear}
              >
                <Ionicons name="close" size={16} color={theme.colors.official} />
              </Pressable>
            </View>
          ) : null}

        </View>
      </View>

      <View style={styles.resultsInfo}>
        <Text style={styles.resultsCountText}>
          {`إجمالي نتائج ${searchMode === 'doctors' ? 'المختصين' : 'المراكز'} ${resultCount}`}
        </Text>
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
          data={searchMode === 'doctors' ? doctors : clinics}
          renderItem={searchMode === 'doctors' ? renderDoctor : renderClinic}
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
                  title={
                    searchMode === 'doctors'
                      ? 'لا يوجد مختصون مطابقون لبحثك'
                      : 'لا توجد مراكز مطابقة لبحثك'
                  }
                  subtitle="حاول تغيير كلمات البحث أو الولاية"
                />
              </View>
            ) : null
          }
          onScroll={handleResultsScroll}
          scrollEventThrottle={16}
          // Load more when nearing the end
          onEndReached={() => {
            if (listStatus === 'CanLoadMore') {
              if (searchMode === 'doctors') {
                loadMoreDoctors(20);
              } else {
                loadMoreClinics(20);
              }
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
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>تصفية النتائج</Text>
                <Text style={styles.modalSubtitle}>
                  اختر ما يساعدك على الوصول للمختص المناسب بسرعة.
                </Text>
              </View>
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
              <Pressable
                style={({ pressed }) => [
                  styles.filterPanelCard,
                  pressed && styles.filterPanelCardPressed,
                ]}
                onPress={() => {
                  setFilterModalVisible(false);
                  setShowSpecialtyPicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب التخصص"
              >
                <View style={styles.filterPanelCardIcon}>
                  <Ionicons
                    name="briefcase-outline"
                    size={18}
                    color={theme.colors.official}
                  />
                </View>
                <View style={styles.filterPanelCardBody}>
                  <Text style={styles.filterPanelLabel}>التخصص</Text>
                  <Text style={styles.filterPanelHint}>اختر التخصص أو اتركه شاملاً</Text>
                </View>
                <View style={styles.filterPanelCardValueGroup}>
                  <Text style={styles.filterPanelValue}>
                    {selectedSpecialtyId
                      ? selectedSpecialty?.nameAr ?? 'مختار'
                      : 'الكل'}
                  </Text>
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.filterPanelCard,
                  pressed && styles.filterPanelCardPressed,
                ]}
                onPress={() => {
                  setFilterModalVisible(false);
                  setShowWilayaPicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="تصفية حسب الولاية"
              >
                <View style={styles.filterPanelCardIcon}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={theme.colors.official}
                  />
                </View>
                <View style={styles.filterPanelCardBody}>
                  <Text style={styles.filterPanelLabel}>الولاية</Text>
                  <Text style={styles.filterPanelHint}>حدد الولاية لتقليل النتائج</Text>
                </View>
                <View style={styles.filterPanelCardValueGroup}>
                  <Text style={styles.filterPanelValue}>
                    {selectedWilayaId
                      ? selectedWilaya?.nameAr ?? 'مختارة'
                      : 'الكل'}
                  </Text>
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.filterPanelCard,
                  styles.filterPanelToggleCard,
                  pressed && styles.filterPanelCardPressed,
                ]}
                onPress={handleAvailableTodayToggle}
                accessibilityRole="button"
                accessibilityLabel="متاح اليوم"
              >
                <View style={styles.filterPanelCardIcon}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={theme.colors.official}
                  />
                </View>
                <View style={styles.filterPanelCardBody}>
                  <Text style={styles.filterPanelLabel}>متاح اليوم</Text>
                  <Text style={styles.filterPanelHint}>
                    اعرض المختصين الذين لديهم مواعيد متاحة الآن.
                  </Text>
                </View>
                <View
                  style={[
                    styles.filterPanelToggle,
                    availableTodayOnly && styles.filterPanelToggleActive,
                  ]}
                >
                  <View
                    style={[
                      styles.filterPanelToggleThumb,
                      availableTodayOnly && styles.filterPanelToggleThumbActive,
                    ]}
                  />
                </View>
              </Pressable>

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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  appliedFilterRow: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
  },
  appliedFilterIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedFilterText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.official,
    textAlign: 'right',
  },
  appliedFilterClear: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHeroHeader: {
    minHeight: 88,
    paddingVertical: theme.spacing.lg,
  },
  searchGreetingBlock: {
    width: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  searchGreetingSpacer: {
    width: 34,
    height: 34,
  },
  searchGreetingTitle: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 21,
    lineHeight: 30,
    lineHeight: 32,
    color: theme.colors.white,
    textAlign: 'center',
  },
  searchHeroIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    marginHorizontal: 0,
    marginVertical: 0,
    backgroundColor: theme.colors.background,
  },
  searchModeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.borderRadius.md,
    padding: 3,
    gap: 3,
  },
  searchModeTab: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
  },
  searchModeTabActive: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchModeTabText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  searchModeTabTextActive: {
    color: theme.colors.official,
  },
  chipsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  collapsedFiltersButton: {
    minHeight: 38,
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  resultsCountText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
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
  clinicResultCard: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  clinicResultCardPressed: {
    opacity: 0.92,
  },
  clinicResultCardDisabled: {
    opacity: 0.82,
  },
  clinicResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  clinicResultIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicResultCopy: {
    flex: 1,
    minWidth: 0,
  },
  clinicResultName: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  clinicResultMeta: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: rtlTextAlign(),
  },
  clinicResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  clinicResultRowText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  clinicResultFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  clinicResultDoctorCount: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  clinicResultAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  clinicResultActionText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.primary,
  },
  clinicResultUnavailable: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'right',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  modalTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  modalSubtitle: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: rtlTextAlign(),
  },
  modalList: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  pickerSearch: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  pickerSearchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
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
  pickerNoResults: {
    padding: theme.spacing.xl,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  filterPanelBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterPanelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  filterPanelCardPressed: {
    opacity: 0.9,
  },
  filterPanelCardIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanelCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  filterPanelCardValueGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginStart: theme.spacing.sm,
  },
  filterPanelToggleCard: {
    alignItems: 'center',
  },
  filterPanelLabel: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  filterPanelHint: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textMuted,
    textAlign: rtlTextAlign(),
  },
  filterPanelValue: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.primary,
    textAlign: rtlTextAlign(),
  },
  filterPanelToggle: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    padding: 3,
    justifyContent: 'center',
  },
  filterPanelToggleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterPanelToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: theme.colors.white,
  },
  filterPanelToggleThumbActive: {
    alignSelf: 'flex-end',
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
