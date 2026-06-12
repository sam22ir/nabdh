import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  I18nManager,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

// ─── Constants ──────────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 52;
const ANIMATION_DURATION = 350;

// ─── Component ──────────────────────────────────────────────────────────────────

const NetworkBanner: React.FC = () => {
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const isVisible = useRef(false);

  const slideIn = useCallback(() => {
    if (isVisible.current) return;
    isVisible.current = true;
    Animated.timing(translateY, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const slideOut = useCallback(() => {
    if (!isVisible.current) return;
    isVisible.current = false;
    Animated.timing(translateY, {
      toValue: -BANNER_HEIGHT,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true;
      if (connected) {
        slideOut();
      } else {
        slideIn();
      }
    });

    return () => unsubscribe();
  }, [slideIn, slideOut]);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.colors.warning}
        />
        <Ionicons
          name="wifi-outline"
          size={20}
          color={theme.colors.white}
          style={styles.icon}
        />
        <Text style={styles.text}>لا يوجد اتصال بالإنترنت</Text>
      </SafeAreaView>
    </Animated.View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    backgroundColor: '#E67E22',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  safeArea: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: BANNER_HEIGHT,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight ?? 0,
    paddingHorizontal: theme.spacing.lg,
  },
  icon: {
    marginRight: I18nManager.isRTL ? 0 : theme.spacing.sm,
    marginLeft: I18nManager.isRTL ? theme.spacing.sm : 0,
  },
  text: {
    fontFamily: theme.typography.fontFamily.arabicBold,
    fontSize: 14,
    color: theme.colors.white,
    textAlign: 'center',
  },
});

export default NetworkBanner;
