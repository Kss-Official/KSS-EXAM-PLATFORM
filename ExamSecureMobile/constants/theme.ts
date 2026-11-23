import { Platform } from 'react-native';

/**
 * ExamSecure Enterprise Design System
 * Engineered for Top 1% High-Security Professional Assessment UX
 * Primary Palette: Emerald Security (#017846) + Navy Slate (#0F172A)
 */

export const Colors = {
  // Brand Emerald
  primary: '#017846',
  primaryHover: '#01663C',
  primaryDark: '#014A2B',
  primaryDeep: '#00351E',
  primaryLight: '#E8F5EE',
  primaryPale: '#F2FAF5',
  primaryMuted: 'rgba(1, 120, 70, 0.08)',
  primaryGlow: 'rgba(1, 120, 70, 0.25)',

  // Security Accents
  accentGold: '#D97706',
  accentGoldLight: '#FEF3C7',
  accentBlue: '#2563EB',
  accentBlueLight: '#EFF6FF',
  accentPurple: '#7C3AED',
  accentPurpleLight: '#F3E8FF',

  // Semantics & Text
  ink: '#0F172A',
  inkSecondary: '#334155',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  line: '#E2E8F0',
  lineSubtle: '#EDF2F7',
  border: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  bg: '#F8FAFC',
  backdrop: 'rgba(15, 23, 42, 0.65)',

  // Status Colors
  error: '#DC2626',
  errorLight: '#FEF2F2',
  errorBorder: '#FECACA',
  errorText: '#991B1B',

  warning: '#D97706',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',
  accentAmber: '#D97706',

  success: '#059669',
  successLight: '#ECFDF5',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  successText: '#065F46',

  // Slate Spectrum
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
} as const;

export const Fonts = {
  sans: 'System',
  heading: 'System',
  mono: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  xxxl: 34,
} as const;

export const Shadow = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#017846',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#017846',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 8,
  },
  primaryBtn: {
    shadowColor: '#017846',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;
