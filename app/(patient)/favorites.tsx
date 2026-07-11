// @ts-nocheck
// =============================================================================
// Favorites Screen
// Lists the patient's favorited doctors with the ability to unfavorite,
// and an empty state with a "تصفح الأطباء" CTA when no favorites exist.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'convex/react';

import { api } from '@/convex/_generated/api';
import DoctorCard, { DoctorCardData } from '@/components/DoctorCard';
import EmptyState from '@/components/EmptyState';
import SearchBar from '@/components/SearchBar';
import { DoctorHeader } from '@/components/doctor-ui';
import { LoadingState } from '@/components/ui';
import { theme } from '@/lib/theme';
import { rtlTextAlign } from '@/lib/rtl';
import type { Id } from '@/convex/_generated/dataModel';

// =============================================================================
// Types
// =============================================================================

/** Doctor card shape as returned by Convex api.doctors.getFavorites. */
interface ConvexFavoriteDoctor {
  _id: Id<'doctors'>;
  _creationTime: number;
  userId: Id<'users'>;
  specialtyId: Id<'specialties'>;
  bioAr: string;
  yearsOfExperience: number;
  isVerified: boolean;
  isProfileComplete: boolean;
  consultationFee?: number;
  followUpFee?: number;
  avgRating: number;
  totalReviews: number;
  user: {
    fullNameAr: string | null;
    phone: string | null;
  };
  specialty: {
    nameAr: string;
    nameFr: string;
  };
  wilaya?: {
    nameAr?: string;
    name?: string;
  } | null;
}

/** Flattened favorite doctor record for DoctorCardData mapping. */
interface FavoriteDoctorResult {
  id: string;
  fullNameAr: string;
  specialtyNameAr: string;
  wilayaNameAr: string;
  avgRating: number;
  totalReviews: number;
  isVerified: boolean;
  avatarUrl: string | null;
}

// =============================================================================
// Mapping
// =============================================================================

function toFavoriteResult(doc: ConvexFavoriteDoctor): FavoriteDoctorResult {
  return {
    id: doc._id,
    fullNameAr: doc.user.fullNameAr ?? '',
    specialtyNameAr: doc.specialty.nameAr,
    wilayaNameAr: doc.wilaya?.nameAr ?? doc.wilaya?.name ?? '',
    avgRating: doc.avgRating,
    totalReviews: doc.totalReviews,
    isVerified: doc.isVerified,
    avatarUrl: null,
  };
}

function toDoctorCardData(r: FavoriteDoctorResult): DoctorCardData {
  return {
    id: r.id,
    fullNameAr: r.fullNameAr,
    specialty: { nameAr: r.specialtyNameAr },
    avgRating: r.avgRating,
    totalReviews: r.totalReviews,
    wilaya: { nameAr: r.wilayaNameAr },
    isVerified: r.isVerified,
    avatarUrl: r.avatarUrl,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

// =============================================================================
// Separator
// =============================================================================

const ItemSeparator: React.FC = () => <View style={styles.separator} />;

// =============================================================================
// Main Screen
// =============================================================================

export default function FavoritesScreen() {
  const router = useRouter();

  // ── Data query via Convex ────────────────────────────────────────────────
  const favDoctorsRaw = useQuery(api.doctors.getFavorites);
  const isLoading = favDoctorsRaw === undefined;

  const favDoctors: FavoriteDoctorResult[] | undefined = favDoctorsRaw
    ? (favDoctorsRaw as ConvexFavoriteDoctor[]).map(toFavoriteResult)
    : undefined;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const specialties = useMemo(() => {
    if (!favDoctors) return [];
    return [...new Set(favDoctors.map((doctor) => doctor.specialtyNameAr))].sort(
      (a, b) => a.localeCompare(b, 'ar'),
    );
  }, [favDoctors]);

  const filteredDoctors = useMemo(() => {
    if (!favDoctors) return undefined;

    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return favDoctors;

    return favDoctors.filter((doctor) => {
      const searchableText = normalizeSearchText(
        `${doctor.fullNameAr} ${doctor.specialtyNameAr}`,
      );
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesSpecialty =
        !selectedSpecialty || doctor.specialtyNameAr === selectedSpecialty;
      return matchesSearch && matchesSpecialty;
    });
  }, [favDoctors, searchQuery, selectedSpecialty]);

  // ── Remove-favorite mutation via Convex ──────────────────────────────────
  const toggleFavorite = useMutation(api.doctors.toggleFavorite);
  const [isRemoving, setIsRemoving] = React.useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleDoctorPress = useCallback(
    (id: string) => {
      router.push(`/(patient)/doctor/${id}`);
    },
    [router],
  );

  const handleBrowseDoctors = useCallback(() => {
    router.push('/(patient)/search');
  }, [router]);

  const handleUnfavorite = useCallback(
    (doctorId: string) => {
      setIsRemoving(true);
      toggleFavorite({ doctorId: doctorId as Id<'doctors'> })
        .catch(() => {
          // Convex auto-refetches; no state invalidation needed.
        })
        .finally(() => {
          setIsRemoving(false);
        });
    },
    [toggleFavorite],
  );

  // ── List renderers ──────────────────────────────────────────────────────
  const renderDoctor = useCallback(
    ({ item }: ListRenderItemInfo<FavoriteDoctorResult>) => (
      <View style={styles.cardWrapper}>
        <DoctorCard
          doctor={toDoctorCardData(item)}
          onPress={() => handleDoctorPress(item.id)}
          showAvailability={false}
        />
        {/* Floating filled-heart button to unfavorite */}
        <Pressable
          style={({ pressed }) => [
            styles.favoriteButton,
            pressed && styles.favoriteButtonPressed,
          ]}
          onPress={() => handleUnfavorite(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`إزالة ${item.fullNameAr} من المفضلة`}
        >
          <Ionicons name="heart" size={20} color={theme.colors.danger} />
        </Pressable>
      </View>
    ),
    [handleDoctorPress, handleUnfavorite],
  );

  const keyExtractor = useCallback(
    (item: FavoriteDoctorResult) => item.id,
    [],
  );

  // ── Full-screen loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <DoctorHeader
          title="المفضلة"
          icon="heart-outline"
          centerTitle
          iconPosition="end"
        />
        <LoadingState label="جاري تحميل المفضلة..." />
      </SafeAreaView>
    );
  }

  // ── Full-screen error (no data returned) ─────────────────────────────────
  if (!favDoctors) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={48}
            color={theme.colors.danger}
          />
          <Text style={styles.errorTitle}>حدث خطأ</Text>
          <Text style={styles.errorMessage}>
            تعذر الاتصال بالخادم
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              // Convex auto-refetches; this re-mounts the intent.
            }}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
          >
            <Ionicons name="refresh" size={18} color={theme.colors.white} />
            <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <DoctorHeader
        title="المفضلة"
        icon="heart-outline"
        centerTitle
        iconPosition="end"
      />

      {/* Results list or empty state */}
      {favDoctors.length > 0 ? (
        <>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFilterPress={() => setFilterModalVisible(true)}
            placeholder="ابحث في أطبائك المفضلين..."
            containerStyle={styles.searchBar}
          />
          {selectedSpecialty ? (
            <View style={styles.activeFilterRow}>
              <Text style={styles.activeFilterText}>التخصص: {selectedSpecialty}</Text>
              <Pressable
                onPress={() => setSelectedSpecialty(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="إزالة تصفية التخصص"
                style={styles.clearFilterButton}
              >
                <Ionicons name="close" size={16} color={theme.colors.official} />
              </Pressable>
            </View>
          ) : null}
          <FlatList
            data={filteredDoctors}
            renderItem={renderDoctor}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRemoving}
                onRefresh={() => {
                  // Convex auto-refetches via reactivity.
                }}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
            ItemSeparatorComponent={ItemSeparator}
            ListEmptyComponent={
              <View style={styles.noResultsWrapper}>
                <Ionicons
                  name="search-outline"
                  size={42}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.noResultsTitle}>لا توجد نتائج</Text>
                <Text style={styles.noResultsMessage}>
                  جرّب البحث باسم الطبيب أو تخصصه، أو غيّر التصفية
                </Text>
              </View>
            }
          />
        </>
      ) : (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="heart-outline"
            title="لم تقم بإضافة أطباء للمفضلة بعد"
            subtitle="ابحث عن الأطباء وأضفهم إلى مفضلتك للوصول السريع"
            action={{
              label: 'تصفح الأطباء',
              onPress: handleBrowseDoctors,
            }}
          />
        </View>
      )}

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setFilterModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="إغلاق التصفية"
          />
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>تصفية حسب التخصص</Text>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.filterOptions}>
              <Pressable
                onPress={() => {
                  setSelectedSpecialty(null);
                  setFilterModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.filterOption,
                  !selectedSpecialty && styles.filterOptionSelected,
                  pressed && styles.filterOptionPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: !selectedSpecialty }}
              >
                <Text style={styles.filterOptionText}>كل التخصصات</Text>
                {!selectedSpecialty ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
              </Pressable>
              {specialties.map((specialty) => {
                const isSelected = specialty === selectedSpecialty;
                return (
                  <Pressable
                    key={specialty}
                    onPress={() => {
                      setSelectedSpecialty(specialty);
                      setFilterModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.filterOption,
                      isSelected && styles.filterOptionSelected,
                      pressed && styles.filterOptionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={styles.filterOptionText}>{specialty}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={20} color={theme.colors.primary} /> : null}
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

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3xl'],
  },

  // ── Error ───────────────────────────────────────────────────────────────────
  errorTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    textAlign: rtlTextAlign(),
  },
  errorMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing['2xl'],
  },
  retryButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
    marginEnd: theme.spacing.sm,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: theme.spacing['4xl'],
  },
  searchBar: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  activeFilterRow: {
    minHeight: 34,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.sm,
  },
  activeFilterText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 13,
    color: theme.colors.official,
  },
  clearFilterButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: theme.spacing.xs,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  noResultsWrapper: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3xl'],
    paddingTop: theme.spacing['4xl'],
  },
  noResultsTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  noResultsMessage: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },

  // ── Card wrapper with unfavorite button ─────────────────────────────────────
  cardWrapper: {
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: theme.spacing.lg + 4,
    end: theme.spacing.lg + 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...theme.shadows.sm,
  },
  favoriteButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
  },
  filterModal: {
    maxHeight: '75%',
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceRaised,
    paddingBottom: theme.spacing['3xl'],
  },
  filterHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  filterOptions: { paddingBottom: theme.spacing.lg },
  filterTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 17,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  filterOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  filterOptionSelected: { backgroundColor: theme.colors.secondary },
  filterOptionPressed: { opacity: 0.72 },
  filterOptionText: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
});
