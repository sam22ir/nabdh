import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../src/lib/theme';
import type { UserRole } from '../../src/lib/types';

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

interface Slide {
  icon: string;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: '⚡',
    title: 'احجز في ثوانٍ',
    body: 'شوف الأطباء المتاحين واحجز موعدك في أقل من دقيقة. لا اتصالات، لا طوابير، لا انتظار.',
  },
  {
    icon: '📋',
    title: 'شفافية كاملة',
    body: 'شوف تقييمات المرضى، أسعار الكشف، وعناوين العيادات. كل شيء واضح قبل ما تحجز.',
  },
  {
    icon: '🔔',
    title: 'تذكير بالموعد',
    body: 'ما تنساش موعدك. رح نوصلك تذكير قبل 24 ساعة وساعتين من الموعد.',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isLastSlide = currentIndex === slides.length - 1;

  const handleNextSlide = useCallback(() => {
    const nextIndex = Math.min(currentIndex + 1, slides.length - 1);

    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  }, [currentIndex]);

  const handleRoleSelect = useCallback(
    (role: UserRole) => {
      router.replace({ pathname: '/(auth)/register', params: { role } });
    },
    [router],
  );

  const renderSlide = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={[styles.slide, { width }]}>
        <Text style={styles.icon}>{item.icon}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    ),
    [width],
  );

  const keyExtractor = useCallback((_item: Slide, index: number) => String(index), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEnabled={false}
        />

        {/* Pagination dots */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentIndex && styles.activeDot]}
            />
          ))}
        </View>

        {isLastSlide ? (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.patientButton]}
              activeOpacity={0.85}
              onPress={() => handleRoleSelect('patient')}
            >
              <Text style={styles.patientButtonText}>
                {'أنا مريض'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.doctorButton]}
              activeOpacity={0.85}
              onPress={() => handleRoleSelect('doctor')}
            >
              <Text style={styles.doctorButtonText}>
                {'أنا طبيب'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.button, styles.patientButton]}
              activeOpacity={0.85}
              onPress={handleNextSlide}
              accessibilityRole="button"
              accessibilityLabel="الشريحة التالية"
            >
              <Text style={styles.patientButtonText}>التالي</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['3xl'],
    paddingBottom: theme.spacing['5xl'],
  },

  icon: {
    fontSize: 72,
    marginBottom: theme.spacing['3xl'],
  },

  title: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    writingDirection: 'rtl',
  },

  body: {
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: theme.spacing.sm,
    writingDirection: 'rtl',
  },

  // ─── Pagination ────────────────────────────────────────────────────────

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing['3xl'],
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
    marginHorizontal: 5,
  },

  activeDot: {
    width: 28,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },

  // ─── Role buttons ──────────────────────────────────────────────────────

  buttonsContainer: {
    width: '100%',
    paddingHorizontal: theme.spacing['3xl'],
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },

  button: {
    width: '100%',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  patientButton: {
    backgroundColor: theme.colors.primary,
  },

  patientButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.white,
  },

  doctorButton: {
    backgroundColor: theme.colors.secondary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },

  doctorButtonText: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 18,
    color: theme.colors.primary,
  },
});
