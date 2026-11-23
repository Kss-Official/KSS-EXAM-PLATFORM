import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Shadow } from '../constants/theme';
import { loadCandidateSession } from '../services/sessionStorage';
import CandidateLoginScreen from './candidate/login';

export default function Index() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  // Smooth staggered cinematic animation sequence
  const emblemScale = useRef(new Animated.Value(0.85)).current;
  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(12)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslate = useRef(new Animated.Value(8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance animation: Emblem -> Title -> Animated Tagline
    Animated.sequence([
      Animated.parallel([
        Animated.spring(emblemScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Subtle breathing pulse on the emblem
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // 2. Check for ongoing proctored session & auto-resume or go to login
    const timer = setTimeout(async () => {
      try {
        const session = await loadCandidateSession();
        if (session && !session.isSubmitted && session.backendAttemptId) {
          router.replace('/candidate/exam');
          return;
        }
      } catch { }
      setShowSplash(false);
    }, 1800);

    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, []);

  if (!showSplash) {
    return <CandidateLoginScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Ambient background glow orb */}
      <View style={styles.glowOrb} />

      <View style={styles.centerStage}>
        {/* Modern Minimalist Splash Emblem */}
        <Animated.View
          style={[
            styles.emblemWrapper,
            {
              opacity: emblemOpacity,
              transform: [{ scale: Animated.multiply(emblemScale, pulseAnim) }],
            },
          ]}
        >
          <View style={styles.emblemOuterRing}>
            <View style={styles.emblemGlass}>
              <Ionicons name="shield-checkmark" size={42} color="#86EFAC" />
            </View>
          </View>
        </Animated.View>

        {/* Clean, Stylish Brand Typography */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>
            Exam<Text style={styles.brandHighlight}>Secure</Text>
          </Text>
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>PRO</Text>
          </View>
        </Animated.View>

        {/* Animated Stylish Tagline */}
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslate }],
            },
          ]}
        >
          <View style={styles.taglineDecorator}>
            <View style={styles.taglineLine} />
            <View style={styles.taglineDot} />
            <View style={styles.taglineLine} />
          </View>

          <Text style={styles.taglineText}>
            HIGHLY SECURED · ENTERPRISE PROCTORING
          </Text>
        </Animated.View>

        {/* Sleek Minimalist Loading Pill */}
        <Animated.View style={[styles.statusPill, { opacity: taglineOpacity }]}>
          <ActivityIndicator size="small" color="#86EFAC" style={{ transform: [{ scale: 0.8 }] }} />
          <Text style={styles.statusPillText}>Initializing secure environment</Text>
        </Animated.View>
      </View>

      {/* Discrete Corporate Attribution */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Kalpanaaa Software Solutions</Text>
        <Text style={styles.footerVersion}>Enterprise Assessment Platform v2.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    top: '30%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(1, 120, 70, 0.35)',
    filter: 'blur(60px)',
    opacity: 0.6,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  /* Splash Emblem */
  emblemWrapper: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: 'rgba(134, 239, 172, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    ...Shadow.lg,
  },
  emblemGlass: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  /* Brand Typography */
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  brandHighlight: {
    color: '#86EFAC',
    fontWeight: '900',
  },
  proPill: {
    backgroundColor: 'rgba(134, 239, 172, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(134, 239, 172, 0.35)',
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#86EFAC',
    letterSpacing: 0.8,
  },

  /* Animated Stylish Tagline */
  taglineContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  taglineDecorator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    width: 140,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(134, 239, 172, 0.3)',
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#86EFAC',
  },
  taglineText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.82)',
    letterSpacing: 1.8,
    textAlign: 'center',
  },

  /* Sleek Status Pill */
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.3,
  },

  /* Footer */
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 0.4,
  },
  footerVersion: {
    fontSize: 9.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 3,
    letterSpacing: 0.3,

  },
});
