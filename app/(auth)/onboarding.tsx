import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  useWindowDimensions,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Panel } from '@/components/ui';
import { theme } from '../../src/lib/theme';
import type { UserRole } from '../../src/lib/types';

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  headerTitle: string;
  headerSubtitle: string;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: 'flash-outline',
    headerTitle: 'احجز موعدك بدون انتظار',
    headerSubtitle: 'اختر طبيبا متاحا، راجع التفاصيل، وأكمل الحجز في مسار قصير.',
    title: 'احجز في ثوانٍ',
    body: 'شوف الأطباء المتاحين واحجز موعدك في أقل من دقيقة. لا اتصالات، لا طوابير، لا انتظار.',
  },
  {
    icon: 'document-text-outline',
    headerTitle: 'قرار أوضح قبل الحجز',
    headerSubtitle: 'قارن التخصص، العيادة، السعر، والتقييمات قبل اختيار الطبيب المناسب.',
    title: 'شفافية كاملة',
    body: 'شوف تقييمات المرضى، أسعار الكشف، وعناوين العيادات. كل شيء واضح قبل ما تحجز.',
  },
  {
    icon: 'notifications-outline',
    headerTitle: 'متابعة هادئة للموعد',
    headerSubtitle: 'تبقى تفاصيل الحجز والتنبيهات في مكان واحد حتى يوم الزيارة.',
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
  const flatListRef = useRef<FlatList<Slide>>(null);

  const isLastSlide = currentIndex === slides.length - 1;

  const handleNextSlide = useCallback(() => {
    const nextIndex = Math.min(currentIndex + 1, slides.length - 1);

    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  }, [currentIndex]);

  const handleSlideScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      setCurrentIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
    },
    [width],
  );

  const handleRoleSelect = useCallback(
    (role: UserRole) => {
      router.replace({ pathname: '/(auth)/register', params: { role } });
    },
    [router],
  );

  const renderSlide = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={[styles.slide, { width }]}>
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Ionicons name="pulse-outline" size={16} color={theme.colors.official} />
            <Text style={styles.headerEyebrow}>نَبْض</Text>
          </View>
          <Text style={styles.headerTitle}>{item.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{item.headerSubtitle}</Text>
        </View>

        <Panel style={styles.slidePanel}>
          <View style={styles.iconFrame}>
            <Ionicons name={item.icon} size={28} color={theme.colors.official} />
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </Panel>
      </View>
    ),
    [width],
  );

  const keyExtractor = useCallback((_item: Slide, index: number) => String(index), []);
  const getSlideLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

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
          onMomentumScrollEnd={handleSlideScrollEnd}
          getItemLayout={getSlideLayout}
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
            <Button
              label="أنا مريض"
              icon="person-outline"
              onPress={() => handleRoleSelect('patient')}
            />
            <Button
              label="أنا طبيب"
              icon="medical-outline"
              variant="secondary"
              onPress={() => handleRoleSelect('doctor')}
            />
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <Button
              label="التالي"
              icon="arrow-back"
              onPress={handleNextSlide}
              accessibilityLabel="الشريحة التالية"
            />
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
  },

  header: {
    minHeight: 166,
    paddingTop: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  headerBrand: {
    minHeight: 28,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },

  headerEyebrow: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 12,
    color: theme.colors.official,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  headerTitle: {
    maxWidth: 330,
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 23,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  headerSubtitle: {
    maxWidth: 340,
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily.arabic,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  slide: {
    flex: 1,
    paddingHorizontal: theme.spacing['3xl'],
    paddingBottom: theme.spacing['3xl'],
    paddingTop: theme.spacing.md,
  },

  slidePanel: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
  },

  iconFrame: {
    width: 58,
    height: 58,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing['2xl'],
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
});
