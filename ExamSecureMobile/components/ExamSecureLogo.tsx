import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Shadow } from '../constants/theme';

interface ExamSecureLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  inverted?: boolean; // True when on dark green/splash
  showTagline?: boolean;
}

export default function ExamSecureLogo({
  size = 'md',
  inverted = true,
  showTagline = true,
}: ExamSecureLogoProps) {
  const iconSize = size === 'sm' ? 18 : size === 'md' ? 24 : size === 'lg' ? 32 : 44;
  const badgeSize = size === 'sm' ? 34 : size === 'md' ? 48 : size === 'lg' ? 64 : 84;
  const titleSize = size === 'sm' ? 15 : size === 'md' ? 20 : size === 'lg' ? 24 : 30;
  const taglineSize = size === 'sm' ? 9 : size === 'md' ? 10 : size === 'lg' ? 11 : 12;

  const textColor = inverted ? '#FFFFFF' : Colors.ink;
  const subtitleColor = inverted ? 'rgba(255, 255, 255, 0.85)' : Colors.muted;
  const badgeBg = inverted ? 'rgba(255, 255, 255, 0.16)' : Colors.primaryLight;
  const ringBorder = inverted ? 'rgba(255, 255, 255, 0.28)' : 'rgba(1, 120, 70, 0.2)';
  const iconColor = inverted ? '#FFFFFF' : Colors.primary;

  return (
    <View style={styles.container}>
      {/* Emblem Badge with Outer Glow Ring */}
      <View
        style={[
          styles.badgeOuterRing,
          {
            width: badgeSize + 8,
            height: badgeSize + 8,
            borderRadius: (badgeSize + 8) / 2,
            borderColor: ringBorder,
          },
        ]}
      >
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badgeBg,
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={iconSize} color={iconColor} />
        </View>
      </View>

      {/* Brand Title */}
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { fontSize: titleSize, color: textColor }]}>
            Exam<Text style={{ color: inverted ? '#86EFAC' : Colors.primary }}>Secure</Text>
          </Text>
          <View style={[styles.verifiedPill, inverted && styles.verifiedPillInverted]}>
            <Ionicons name="lock-closed" size={taglineSize - 1} color={inverted ? '#86EFAC' : Colors.primary} />
            <Text style={[styles.verifiedText, { fontSize: taglineSize - 1, color: inverted ? '#86EFAC' : Colors.primary }]}>
              PRO
            </Text>
          </View>
        </View>

        {showTagline && (
          <Text style={[styles.tagline, { fontSize: taglineSize, color: subtitleColor }]}>
            HIGHLY SECURED · ENTERPRISE PROCTORING
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOuterRing: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  textWrap: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  verifiedPillInverted: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  verifiedText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
