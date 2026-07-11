import { Platform } from 'react-native';

const createShadow = (
  offsetY: number,
  blurRadius: number,
  opacity: number,
  elevation: number,
) =>
  Platform.select({
    web: {
      boxShadow: `0 ${offsetY}px ${blurRadius}px rgba(0, 0, 0, ${opacity})`,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blurRadius,
      elevation,
    },
  });

export const theme = {
  colors: {
    official: '#123C55',
    primary: '#1A7BC4',
    primaryPressed: '#166A8F',
    secondary: '#E8F4FD',
    success: '#27AE60',
    danger: '#E74C3C',
    warning: '#F39C12',
    info: '#2E637C',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#6B7D86',
    background: '#F8FAFC',
    surface: '#FBFCFC',
    surfaceRaised: '#FFFFFF',
    surfaceMuted: '#EAF0F2',
    white: '#FFFFFF',
    border: '#E5E7EB',
    borderStrong: '#B8C8CF',
    focus: '#73B8D5',
    overlay: 'rgba(12, 31, 42, 0.48)',
    status: {
      success: {
        text: '#1E6B43',
        background: '#E5F5EC',
        border: '#B8DEC8',
      },
      danger: {
        text: '#A83A2F',
        background: '#FCEDEA',
        border: '#F1B8B0',
      },
      warning: {
        text: '#8A5511',
        background: '#FFF3D8',
        border: '#E8CB88',
      },
      info: {
        text: '#245B73',
        background: '#E3F1F6',
        border: '#B6D8E4',
      },
      neutral: {
        text: '#536874',
        background: '#EEF3F5',
        border: '#D4E0E5',
      },
    },
  } as const,

  typography: {
    fontFamily: {
      arabic: 'Cairo-Regular',
      arabicBold: 'Cairo-Bold',
      latin: 'Inter-Regular',
      latinMedium: 'Inter-Medium',
    },
  } as const,

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  } as const,

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  } as const,

  shadows: {
    sm: createShadow(1, 2, 0.05, 1),
    md: createShadow(2, 4, 0.1, 3),
    lg: createShadow(4, 8, 0.15, 5),
    xl: createShadow(6, 12, 0.2, 8),
  } as const,
} as const;

export type Theme = typeof theme;
export default theme;
