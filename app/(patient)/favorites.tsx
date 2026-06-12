// =============================================================================
// Favorites Screen
// Lists the patient's favorited doctors with the ability to unfavorite,
// and an empty state with a "تصفح الأطباء" CTA when no favorites exist.
// =============================================================================

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
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
  subSpecialties: Id<'specialties'>[];
  bioAr: string;
  bioFr: string;
  yearsOfExperience: number;
  languages: string[];
  orderRegistrationNumber: string;
  isVerified: boolean;
  isProfileComplete: boolean;
  consultationFee: number;
  followUpFee: number;
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
    wilayaNameAr: '',
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
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المفضلة...</Text>
        </View>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>المفضلة</Text>
        {favDoctors.length > 0 && (
          <Text style={styles.headerCount}>
            {favDoctors.length}{' '}
            {favDoctors.length === 1 ? 'طبيب' : 'أطباء'}
          </Text>
        )}
      </View>

      {/* Results list or empty state */}
      {favDoctors.length > 0 ? (
        <FlatList
          data={favDoctors}
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
        />
      ) : (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon="💔"
            title="لم تقم بإضافة أطباء للمفضلة بعد"
            subtitle="ابحث عن الأطباء وأضفهم إلى مفضلتك للوصول السريع"
            action={{
              label: 'تصفح الأطباء',
              onPress: handleBrowseDoctors,
            }}
          />
        </View>
      )}
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
    marginLeft: theme.spacing.sm,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  headerTitle: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: rtlTextAlign(),
  },
  headerCount: {
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

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Card wrapper with unfavorite button ─────────────────────────────────────
  cardWrapper: {
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: theme.spacing.lg + 4,
    right: theme.spacing.lg + 4,
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
});
