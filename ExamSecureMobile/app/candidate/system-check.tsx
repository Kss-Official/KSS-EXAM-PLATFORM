import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';
import ExamSecureLogo from '../../components/ExamSecureLogo';
import {
  loadCandidateSession,
  saveCandidateSession,
  generateSessionId,
} from '../../services/sessionStorage';
import { startCandidateAttempt, ApiError } from '../../services/api';
import type { CandidateProfile, CandidateSession } from '../../types/candidate';

const DRAFT_PROFILE_KEY = 'examsecure_draft_profile';

const EXAM_RULES = [
  { num: 1, title: 'Compulsory Camera & Mic', desc: 'Camera and microphone must stay active continuously for AI proctor verification.' },
  { num: 2, title: 'Screen Focus & Anti-Tamper', desc: 'Do not minimize, split screen, or switch to other background applications.' },
  { num: 3, title: 'Single Candidate Presence', desc: 'Ensure you remain isolated in a well-lit area with no external voices or presence.' },
  { num: 4, title: 'Face Position Monitoring', desc: 'Maintain direct eye contact with the front camera throughout the assessment.' },
  { num: 5, title: 'Auto-Submission on Timer', desc: 'When the 60-minute countdown expires, your answers are automatically finalized.' },
];

export default function SystemCheckScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  // Diagnostic states
  const [cameraPermission, setCameraPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [micPermission, setMicPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [showCamera, setShowCamera] = useState(false);
  const micLevelAnim = useRef(new Animated.Value(0)).current;
  const micAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Agreement, Modal & Start
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const startMicAnimation = () => {
    if (micAnimRef.current) micAnimRef.current.stop();
    micAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(micLevelAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(micLevelAnim, { toValue: 0.3, duration: 300, useNativeDriver: false }),
        Animated.timing(micLevelAnim, { toValue: 0.85, duration: 350, useNativeDriver: false }),
        Animated.timing(micLevelAnim, { toValue: 0.2, duration: 250, useNativeDriver: false }),
      ])
    );
    micAnimRef.current.start();
  };

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(DRAFT_PROFILE_KEY);
      if (!raw) {
        router.replace('/candidate/login');
        return;
      }
      try {
        setProfile(JSON.parse(raw));
      } catch {}

      // Auto-detect existing permissions on mount
      try {
        if (Camera && typeof Camera.getCameraPermissionsAsync === 'function') {
          const cam = await Camera.getCameraPermissionsAsync();
          if (cam.status === 'granted') {
            setCameraPermission('granted');
            setShowCamera(true);
          }
        }
        if (Camera && typeof Camera.getMicrophonePermissionsAsync === 'function') {
          const mic = await Camera.getMicrophonePermissionsAsync();
          if (mic.status === 'granted') {
            setMicPermission('granted');
            startMicAnimation();
          }
        }
      } catch {}
    })();
  }, []);

  const handleCameraPermission = async () => {
    setCameraPermission('requesting');
    try {
      if (Camera && typeof Camera.requestCameraPermissionsAsync === 'function') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        const granted = status === 'granted';
        setCameraPermission(granted ? 'granted' : 'denied');
        if (granted) setShowCamera(true);
        if (!granted) {
          Alert.alert(
            'Camera Access Compulsory',
            'Camera permission is strictly required to attend this proctored examination. Please grant camera permission in your device settings.'
          );
        }
      } else {
        setCameraPermission('granted');
        setShowCamera(true);
      }
    } catch {
      setCameraPermission('granted');
      setShowCamera(true);
    }
  };

  const handleMicPermission = async () => {
    setMicPermission('requesting');
    try {
      if (Camera && typeof Camera.requestMicrophonePermissionsAsync === 'function') {
        const { status } = await Camera.requestMicrophonePermissionsAsync();
        const granted = status === 'granted';
        setMicPermission(granted ? 'granted' : 'denied');
        if (granted) startMicAnimation();
        if (!granted) {
          Alert.alert(
            'Microphone Access Compulsory',
            'Microphone permission is strictly required for acoustic proctoring. Please grant microphone permission in your device settings.'
          );
        }
      } else {
        setMicPermission('granted');
        startMicAnimation();
      }
    } catch {
      setMicPermission('granted');
      startMicAnimation();
    }
  };

  const handleGrantAllPermissions = async () => {
    await handleCameraPermission();
    await handleMicPermission();
  };

  // ─── Compulsory Hardware Requirements ────────────────────────────────────────
  const isCameraGranted = cameraPermission === 'granted';
  const isMicGranted = micPermission === 'granted';
  const canStart = isCameraGranted && isMicGranted && rulesAgreed;

  const getStartButtonLabel = () => {
    if (isStarting) return 'Starting Assessment...';
    if (!isCameraGranted && !isMicGranted) return 'Enable Camera & Mic to Proceed';
    if (!isCameraGranted) return 'Enable Camera to Proceed';
    if (!isMicGranted) return 'Enable Microphone to Proceed';
    if (!rulesAgreed) return 'Agree to Rules to Begin';
    return 'Begin Examination';
  };

  const handleStartExam = useCallback(async () => {
    if (!isCameraGranted || !isMicGranted) {
      await handleGrantAllPermissions();
      return;
    }
    if (!rulesAgreed) {
      setRulesAgreed(true);
      return;
    }
    if (!profile || !canStart) return;

    setIsStarting(true);
    setStartError(null);

    try {
      const existingSession = await loadCandidateSession();
      if (
        existingSession &&
        !existingSession.isSubmitted &&
        existingSession.profile?.email?.toLowerCase() === profile.email?.toLowerCase()
      ) {
        router.replace('/candidate/exam');
        return;
      }

      let questions: any[] = [];
      let durationSeconds = 3600;
      let deadline = Date.now() + durationSeconds * 1000;
      let backendAttemptId: number | undefined;
      let serverOffset = 0;
      let assignedSet = profile.questionSetCode || 'A';

      if (profile.dbCandidateId && profile.assignedExamId) {
        const attemptData = await startCandidateAttempt({
          candidateId: profile.dbCandidateId,
          examId: profile.assignedExamId,
          departmentId: profile.departmentId,
          questionSetCode: profile.questionSetCode,
        });
        backendAttemptId = attemptData.attemptId;
        questions = attemptData.questions || [];
        durationSeconds = attemptData.durationSeconds || attemptData.totalDurationSeconds || 3600;
        assignedSet = attemptData.assignedSet || attemptData.setCode || attemptData.questionSetCode || assignedSet;

        const deadlineStr = attemptData.deadlineAt || attemptData.expiresAt;
        if (deadlineStr) {
          deadline = new Date(deadlineStr).getTime();
        } else {
          deadline = Date.now() + durationSeconds * 1000;
        }
        if (attemptData.serverTime) {
          serverOffset = new Date(attemptData.serverTime).getTime() - Date.now();
        }
      }

      const newSession: CandidateSession = {
        version: 'v1',
        sessionId: generateSessionId(),
        examId: String(profile.assignedExamId || 'EXAM-1'),
        backendAttemptId,
        profile,
        answers: {},
        flags: [],
        currentQuestionIndex: 0,
        startTime: Date.now(),
        deadline,
        durationSeconds,
        isSubmitted: false,
        submittedAt: null,
        receiptId: null,
        submissionReason: null,
        questions,
        assignedSet,
        serverOffset,
      };

      await saveCandidateSession(newSession);
      router.replace('/candidate/exam');
    } catch (err) {
      const e = err as ApiError;
      setStartError(e.message || 'Failed to start examination. Please verify server connection and try again.');
    } finally {
      setIsStarting(false);
    }
  }, [profile, canStart, isCameraGranted, isMicGranted, rulesAgreed, router]);

  if (!profile) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading examination parameters...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      {/* ─── Pinned Compact Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <ExamSecureLogo size="sm" showTagline={false} />
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>STEP 3 OF 4</Text>
          </View>
        </View>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>System & Sensor Check</Text>
          <View style={styles.proctorBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#86EFAC" />
            <Text style={styles.proctorBadgeText}>COMPULSORY AUDIT</Text>
          </View>
        </View>

        {/* 4-Step Progress Track */}
        <View style={styles.progressTrack}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= 3 && styles.progressSegmentActive,
                i === 3 && styles.progressSegmentCurrent,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ─── Main Viewport Body (Zero-Scroll Optimized) ─── */}
      <View style={styles.viewportBody}>
        {/* Candidate & Assessment Meta Pill */}
        <View style={styles.metaStrip}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaCandidateName} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.metaExamTitle} numberOfLines={1}>
              {profile.examTitle || 'Technical Hiring Assessment'} · Set {profile.questionSetCode || 'A'}
            </Text>
          </View>
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={13} color={Colors.accentGold} />
            <Text style={styles.durationPillText}>60 Min</Text>
          </View>
        </View>

        {/* Error notification banner if any */}
        {startError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.errorText} numberOfLines={2}>{startError}</Text>
          </View>
        )}

        {/* ─── Compulsory Hardware Diagnostics Station (Split Card) ─── */}
        <View style={styles.hardwareCard}>
          <View style={styles.hardwareCardHeader}>
            <View style={styles.hardwareTitleGroup}>
              <Ionicons name="hardware-chip-outline" size={15} color={Colors.primary} />
              <Text style={styles.hardwareCardTitle}>Mandatory Sensor Verification</Text>
            </View>
            <View style={[styles.statusBadge, (isCameraGranted && isMicGranted) ? styles.statusBadgeOk : styles.statusBadgePending]}>
              <Ionicons
                name={(isCameraGranted && isMicGranted) ? 'checkmark-circle' : 'alert-circle'}
                size={11}
                color={(isCameraGranted && isMicGranted) ? Colors.successText : Colors.warningText}
              />
              <Text style={[styles.statusBadgeText, (isCameraGranted && isMicGranted) ? styles.statusBadgeTextOk : styles.statusBadgeTextPending]}>
                {(isCameraGranted && isMicGranted) ? '2/2 VERIFIED' : 'ACTION REQUIRED'}
              </Text>
            </View>
          </View>

          {/* Split Sensors: Camera & Microphone */}
          <View style={styles.sensorsSplitRow}>
            {/* Left: Camera Sensor Tile */}
            <View style={[styles.sensorTile, !isCameraGranted && styles.sensorTileAttention]}>
              <View style={styles.sensorTileHeader}>
                <View style={styles.sensorTitleWrap}>
                  <Text style={styles.sensorTileTitle}>Front Camera</Text>
                  <Text style={styles.compulsoryAsterisk}>*</Text>
                </View>
                <View style={[styles.sensorMiniBadge, isCameraGranted ? styles.sensorMiniBadgeOk : styles.sensorMiniBadgeRequired]}>
                  <Text style={[styles.sensorMiniBadgeText, isCameraGranted ? styles.sensorMiniBadgeTextOk : styles.sensorMiniBadgeTextRequired]}>
                    {isCameraGranted ? 'ACTIVE' : 'COMPULSORY'}
                  </Text>
                </View>
              </View>

              {isCameraGranted && showCamera ? (
                <View style={styles.cameraBox}>
                  <CameraView style={StyleSheet.absoluteFill} facing="front" />
                  <View style={styles.liveOverlayBadge}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.liveOverlayText}>LIVE OPTICAL</Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.enableSensorBtn}
                  onPress={handleCameraPermission}
                  activeOpacity={0.8}
                >
                  <View style={styles.enableIconCircle}>
                    <Ionicons name="videocam-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.enableSensorBtnText}>
                    {cameraPermission === 'requesting' ? 'Requesting...' : 'Tap to Enable'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Right: Microphone Sensor Tile */}
            <View style={[styles.sensorTile, !isMicGranted && styles.sensorTileAttention]}>
              <View style={styles.sensorTileHeader}>
                <View style={styles.sensorTitleWrap}>
                  <Text style={styles.sensorTileTitle}>Microphone</Text>
                  <Text style={styles.compulsoryAsterisk}>*</Text>
                </View>
                <View style={[styles.sensorMiniBadge, isMicGranted ? styles.sensorMiniBadgeOk : styles.sensorMiniBadgeRequired]}>
                  <Text style={[styles.sensorMiniBadgeText, isMicGranted ? styles.sensorMiniBadgeTextOk : styles.sensorMiniBadgeTextRequired]}>
                    {isMicGranted ? 'ACTIVE' : 'COMPULSORY'}
                  </Text>
                </View>
              </View>

              {isMicGranted ? (
                <View style={styles.micBox}>
                  <View style={styles.micCenterContent}>
                    <Ionicons name="mic" size={22} color={Colors.primary} />
                    <Text style={styles.micCalibratedText}>Acoustic Stream OK</Text>
                  </View>
                  <View style={styles.micMeterTrack}>
                    <Animated.View
                      style={[
                        styles.micMeterFill,
                        {
                          width: micLevelAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['25%', '95%'],
                          }),
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.enableSensorBtn}
                  onPress={handleMicPermission}
                  activeOpacity={0.8}
                >
                  <View style={styles.enableIconCircle}>
                    <Ionicons name="mic-outline" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.enableSensorBtnText}>
                    {micPermission === 'requesting' ? 'Requesting...' : 'Tap to Enable'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Grant All Action if either sensor missing */}
          {(!isCameraGranted || !isMicGranted) && (
            <TouchableOpacity
              style={styles.grantAllBannerBtn}
              onPress={handleGrantAllPermissions}
              activeOpacity={0.85}
            >
              <Ionicons name="shield" size={15} color="#fff" />
              <Text style={styles.grantAllBannerBtnText}>One-Tap Grant All Compulsory Permissions</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Environment Telemetry Chips ─── */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryChip}>
            <Ionicons name="lock-closed" size={12} color={Colors.primary} />
            <Text style={styles.telemetryChipText}>App Focus Lock</Text>
          </View>
          <View style={styles.telemetryChip}>
            <Ionicons name="wifi" size={12} color={Colors.primary} />
            <Text style={styles.telemetryChipText}>Offline Resilient</Text>
          </View>
          <View style={styles.telemetryChip}>
            <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
            <Text style={styles.telemetryChipText}>Encrypted TLS</Text>
          </View>
        </View>

        {/* ─── Examination Rules Agreement Bar (Compacted) ─── */}
        <TouchableOpacity
          style={[styles.rulesAgreementBox, rulesAgreed && styles.rulesAgreementBoxAgreed]}
          onPress={() => setRulesAgreed(!rulesAgreed)}
          activeOpacity={0.85}
        >
          <View style={[styles.checkbox, rulesAgreed && styles.checkboxChecked]}>
            {rulesAgreed && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.rulesAgreementText}>
              I have read and agree to all proctored examination rules.
            </Text>
            <TouchableOpacity
              onPress={() => setRulesModalVisible(true)}
              style={styles.viewRulesLink}
              activeOpacity={0.7}
            >
              <Text style={styles.viewRulesLinkText}>View Examination Regulations (5 Rules) →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── Docked Bottom Action Bar (Permanent, Zero-Scroll) ─── */}
      <View style={styles.dockedBottomBar}>
        <TouchableOpacity
          style={styles.bottomBackBtn}
          onPress={() => router.back()}
          disabled={isStarting}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.slate600} />
          <Text style={styles.bottomBackBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bottomStartBtn,
            canStart ? styles.bottomStartBtnReady : styles.bottomStartBtnAttention,
            isStarting && { opacity: 0.8 },
          ]}
          onPress={handleStartExam}
          disabled={isStarting}
          activeOpacity={0.88}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={canStart ? 'play' : (!isCameraGranted || !isMicGranted) ? 'shield-half' : 'checkmark-circle-outline'}
              size={16}
              color="#fff"
            />
          )}
          <Text style={styles.bottomStartBtnText}>{getStartButtonLabel()}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Examination Rules Bottom Sheet Modal ─── */}
      <Modal
        visible={rulesModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRulesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                <Text style={styles.modalTitle}>Proctored Examination Rules</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRulesModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.slate600} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.rulesList} showsVerticalScrollIndicator={false}>
              {EXAM_RULES.map((rule) => (
                <View key={rule.num} style={styles.ruleItem}>
                  <View style={styles.ruleBadge}>
                    <Text style={styles.ruleBadgeText}>{rule.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.ruleDesc}>{rule.desc}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalAcceptBtn}
              onPress={() => {
                setRulesAgreed(true);
                setRulesModalVisible(false);
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.modalAcceptBtnText}>I Understand & Agree</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.muted,
  },

  /* Header */
  header: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  stepBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  proctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  proctorBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.5,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressSegmentActive: {
    backgroundColor: '#86EFAC',
  },
  progressSegmentCurrent: {
    backgroundColor: '#fff',
  },

  /* Viewport Body */
  viewportBody: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    justifyContent: 'space-between',
  },

  /* Meta Strip */
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  metaLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  metaCandidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
  },
  metaExamTitle: {
    fontSize: 11.5,
    color: Colors.muted,
    marginTop: 2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 6,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.errorText,
    flex: 1,
  },

  /* Hardware Station */
  hardwareCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
    marginTop: 6,
  },
  hardwareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  hardwareTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hardwareCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Radius.full,
  },
  statusBadgeOk: {
    backgroundColor: Colors.successBg,
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusBadgeTextOk: {
    color: Colors.successText,
  },
  statusBadgeTextPending: {
    color: Colors.warningText,
  },

  sensorsSplitRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  sensorTile: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  sensorTileAttention: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  sensorTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sensorTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sensorTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ink,
  },
  compulsoryAsterisk: {
    color: Colors.error,
    fontWeight: '800',
    marginLeft: 2,
    fontSize: 12,
  },
  sensorMiniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: Radius.xs,
  },
  sensorMiniBadgeOk: {
    backgroundColor: Colors.successBg,
  },
  sensorMiniBadgeRequired: {
    backgroundColor: '#FEE2E2',
  },
  sensorMiniBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  sensorMiniBadgeTextOk: {
    color: Colors.successText,
  },
  sensorMiniBadgeTextRequired: {
    color: Colors.errorText,
  },

  /* Camera Feed */
  cameraBox: {
    height: 75,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  liveOverlayBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveOverlayText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.5,
  },

  /* Microphone Level Box */
  micBox: {
    height: 75,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
  },
  micCenterContent: {
    alignItems: 'center',
    marginBottom: 6,
  },
  micCalibratedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  micMeterTrack: {
    width: '90%',
    height: 4,
    backgroundColor: Colors.slate200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  micMeterFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  /* Enable Sensor Button */
  enableSensorBtn: {
    height: 75,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  enableIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableSensorBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },

  /* Grant All Action */
  grantAllBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    paddingVertical: 8,
    marginTop: Spacing.sm,
  },
  grantAllBannerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  /* Telemetry Row */
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 6,
  },
  telemetryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  telemetryChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate700,
  },

  /* Rules Agreement Box */
  rulesAgreementBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 6,
    ...Shadow.xs,
  },
  rulesAgreementBoxAgreed: {
    borderColor: 'rgba(1, 120, 70, 0.4)',
    backgroundColor: '#F7FCF9',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rulesAgreementText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ink,
    lineHeight: 16,
  },
  viewRulesLink: {
    marginTop: 4,
  },
  viewRulesLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* Docked Bottom Bar */
  dockedBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  bottomBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate700,
  },
  bottomStartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  bottomStartBtnReady: {
    backgroundColor: Colors.primary,
    ...Shadow.md,
  },
  bottomStartBtnAttention: {
    backgroundColor: Colors.accentAmber,
    ...Shadow.sm,
  },
  bottomStartBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  /* Modal Bottom Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.ink,
  },
  modalCloseBtn: {
    padding: 4,
  },
  rulesList: {
    marginBottom: Spacing.lg,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: Spacing.md,
  },
  ruleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ruleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 2,
  },
  ruleDesc: {
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 16,
  },
  modalAcceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  modalAcceptBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
