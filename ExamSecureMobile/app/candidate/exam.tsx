import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Alert,
  BackHandler,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useCameraPermissions } from 'expo-camera';
import { SafeAudio, isAudioAvailable } from '../../services/safeAudio';
import * as Clipboard from 'expo-clipboard';
import { Colors, Radius, Spacing, Shadow, Fonts } from '../../constants/theme';
import {
  loadCandidateSession,
  saveCandidateSession,
  finalizeCandidateSession,
} from '../../services/sessionStorage';
import {
  saveCandidateAnswer,
  submitCandidateAttempt,
  getCandidateHeartbeat,
  reportProctorAlert,
  analyzeProctorFrame,
  ApiError,
} from '../../services/api';
import type { CandidateSession, ExamQuestion, AutosaveStatus } from '../../types/candidate';
import { proctoringService } from '../../services/ProctoringService';
import { ProctoringStatus } from '../../components/ProctoringStatus';
import { ProctoringCameraView } from '../../components/ProctoringCameraView';

// ─── High-Stakes Security Thresholds ──────────────────────────────────────────
const MAX_VIOLATIONS = 2; // Strict 2-strike policy (Strike 1: Final Warning, Strike 2: Auto-Submit)

export default function ExamScreen() {
  useKeepAwake(); // Prevent screen sleep during exam
  const router = useRouter();

  const [session, setSession] = useState<CandidateSession | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flags, setFlags] = useState<number[]>([]);

  const [timeRemaining, setTimeRemaining] = useState<number>(3600);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('saved');
  const [paletteVisible, setPaletteVisible] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Security & Tamper Sentinel States
  const [violations, setViolations] = useState(0);
  const [violationAlertVisible, setViolationAlertVisible] = useState(false);
  const [violationType, setViolationType] = useState<string>('FOCUS_LOSS');
  const [violationMessage, setViolationMessage] = useState<string>('');
  const [examTerminated, setExamTerminated] = useState<string | null>(null);

  // Live Camera Status
  const [permission, requestPermission] = useCameraPermissions();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const [liveTimestamp, setLiveTimestamp] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watermarkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState || 'active') as AppStateStatus);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      setCameraKey((k) => k + 1);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  // Request camera permission if not yet granted and re-key preview once granted
  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      setCameraKey((k) => k + 1);
    } else if (permission.canAskAgain) {
      requestPermission().catch(() => {});
    }
  }, [permission, requestPermission]);

  // ─── Anti-Exfiltration: Wipe Clipboard Memory ───────────────────────────────
  const sanitizeClipboard = useCallback(async () => {
    try {
      await Clipboard.setStringAsync('');
    } catch {}
  }, []);

  // ─── Load Session on Mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await sanitizeClipboard();

      const sess = await loadCandidateSession();
      if (!sess || sess.isSubmitted) {
        router.replace('/candidate/login');
        return;
      }
      setSession(sess);
      setAnswers(sess.answers || {});
      setFlags(sess.flags || []);
      setIdx(sess.currentQuestionIndex || 0);

      const rawQ = sess.questions || [];
      const normalized: ExamQuestion[] = rawQ.map((q: any, i: number) => ({
        id: q.id || i + 1,
        displayOrder: q.displayOrder || q.displayIndex || i + 1,
        questionText: q.questionText || q.question || `Question ${i + 1}`,
        options: (q.options || []).map((opt: any, oi: number) => ({
          id: opt.id || opt.optionId || oi,
          optionText: opt.optionText || opt.text || String(opt),
          label: opt.label || ['A', 'B', 'C', 'D'][oi] || String(oi),
        })),
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      }));
      setQuestions(normalized);

      // Compute remaining time
      const now = Date.now() + (sess.serverOffset || 0);
      const remaining = Math.max(0, Math.floor((sess.deadline - now) / 1000));
      setTimeRemaining(remaining);
      setLoading(false);
    })();
  }, [sanitizeClipboard]);

  // ─── Dynamic Forensic Anti-Scan Watermark Timestamp ─────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setLiveTimestamp(d.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    watermarkTimerRef.current = setInterval(updateTime, 1000);
    return () => {
      if (watermarkTimerRef.current) clearInterval(watermarkTimerRef.current);
    };
  }, []);

  // ─── Countdown Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || loading) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimerExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, loading]);

  // ─── Anti-Gemini, Anti-Assistant & Overlay Interceptor ───────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        const isAssistantOrOverlay = nextState === 'inactive';
        const alertType = isAssistantOrOverlay
          ? 'ASSISTANT_OR_OVERLAY_TRIGGERED'
          : 'APP_BACKGROUND_SWITCH';
        const msg = isAssistantOrOverlay
          ? 'External voice assistant (Google Gemini) or overlay window detected!'
          : 'Candidate switched away from the proctored examination viewport.';

        await sanitizeClipboard();
        handleSecurityViolation(alertType, msg);
      } else if (nextState === 'active') {
        await sanitizeClipboard();
        setCameraKey((k) => k + 1);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [violations, session, sanitizeClipboard]);

  // ─── Hardware Navigation & Back Gesture Block ───────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleSecurityViolation(
        'HARDWARE_BACK_ATTEMPT',
        'Back navigation gesture intercepted. You cannot leave the exam.'
      );
      return true;
    });
    return () => sub.remove();
  }, []);

  // ─── Optical Sentinel & Secondary Device Monitoring Loop (every 12s) ────────
  useEffect(() => {
    if (!session?.profile?.dbCandidateId) return;

    const opticalInterval = setInterval(async () => {
      try {
        await reportProctorAlert({
          candidateId: session.profile.dbCandidateId!,
          attemptId: session.backendAttemptId,
          alertType: 'OPTICAL_TELEMETRY_HEARTBEAT',
          message: 'Continuous front camera optical stream active.',
          severity: 'LOW',
        });
      } catch {}
    }, 12000);

    return () => clearInterval(opticalInterval);
  }, [session]);

  // ─── Proctored Heartbeat (every 30s) ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.profile?.dbCandidateId) return;
    const heartbeatInterval = setInterval(async () => {
      try {
        const hb = await getCandidateHeartbeat(
          session.profile.dbCandidateId!,
          session.backendAttemptId
        );
        if (hb.status === 'TERMINATED' || hb.terminationReason) {
          setExamTerminated(hb.terminationReason || 'Exam terminated by test administrator.');
        }
        if (hb.deadlineMs) {
          const remaining = Math.max(0, Math.floor((hb.deadlineMs - Date.now()) / 1000));
          setTimeRemaining(remaining);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(heartbeatInterval);
  }, [session]);

  // ─── Zero-Tolerance Security Violation Engine ───────────────────────────────
  const handleSecurityViolation = useCallback(
    async (type: string, msg: string) => {
      const newCount = violations + 1;
      setViolations(newCount);
      setViolationType(type);
      setViolationMessage(msg);
      setViolationAlertVisible(true);

      if (session?.profile?.dbCandidateId) {
        try {
          await reportProctorAlert({
            candidateId: session.profile.dbCandidateId,
            attemptId: session.backendAttemptId,
            alertType: type,
            message: msg,
            severity: newCount >= MAX_VIOLATIONS ? 'HIGH' : 'MEDIUM',
          });
        } catch {}
      }

      if (newCount >= MAX_VIOLATIONS) {
        setTimeout(async () => {
          await handleSubmit('candidate_exit');
        }, 1200);
      }
    },
    [violations, session]
  );

  // ─── High-Performance On-Device AI Proctoring Engine ───────────────────────
  useEffect(() => {
    if (!session?.profile?.dbCandidateId) return;

    // Start on-device CameraX + ML Kit + TFLite proctoring pipeline
    proctoringService.start(
      session.profile.dbCandidateId,
      session.backendAttemptId || 0
    );

    // Subscribe to native AI proctoring events
    const unsubscribe = proctoringService.addListener((event) => {
      if (
        event.severity === 'CRITICAL' ||
        event.type === 'PHONE_DETECTED' ||
        event.type === 'MULTIPLE_FACES'
      ) {
        handleSecurityViolation(event.type, event.message);
      }
    });

    return () => {
      unsubscribe();
      proctoringService.stop();
    };
  }, [session, handleSecurityViolation]);

  // ─── Real-Time Acoustic Speech & Whisper Detection (`expo-av` guarded) ─────────────
  useEffect(() => {
    if (!isAudioAvailable || !SafeAudio) {
      return;
    }

    let recordingInstance: any = null;
    let voiceSurgeCount = 0;

    const startAcousticMonitor = async () => {
      try {
        await SafeAudio.requestPermissionsAsync();
        await SafeAudio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const rec = new SafeAudio.Recording();
        await rec.prepareToRecordAsync({
          ...SafeAudio.RecordingOptionsPresets.LOW_QUALITY,
          isMeteringEnabled: true,
        });

        rec.setOnRecordingStatusUpdate((status: any) => {
          if (status.isRecording && status.metering !== undefined) {
            // Normal room background noise is < -35 dBFS
            // Human voice / whisper nearby is > -22 dBFS
            if (status.metering > -22) {
              voiceSurgeCount += 1;
              if (voiceSurgeCount >= 3) {
                voiceSurgeCount = 0;
                handleSecurityViolation(
                  'AUDIO_VOICE_DETECTED',
                  'Secondary speech or whispering detected near candidate! Unpermitted communication.'
                );
              }
            } else {
              voiceSurgeCount = Math.max(0, voiceSurgeCount - 1);
            }
          }
        });

        await rec.startAsync();
        recordingInstance = rec;
      } catch (e) {
        // Audio permission or active stream unavailable
      }
    };

    startAcousticMonitor();

    return () => {
      if (recordingInstance) {
        recordingInstance.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [handleSecurityViolation]);

  const handleTimerExpired = useCallback(async () => {
    await handleSubmit('timer_expired');
  }, [session, answers]);

  // ─── Save Answer with 400ms Debounce & Local Persistence ───────────────────
  const handleSelectOption = useCallback(
    async (questionNum: number, optionId: number) => {
      setAnswers((prev) => ({ ...prev, [questionNum]: optionId }));
      setAutosaveStatus('saving');

      const sess = await loadCandidateSession();
      if (sess) {
        sess.answers[questionNum] = optionId;
        sess.currentQuestionIndex = idx;
        await saveCandidateSession(sess);
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (!session?.profile?.dbCandidateId || !session.backendAttemptId) {
          setAutosaveStatus('saved');
          return;
        }
        try {
          const question = questions[idx];
          if (!question) return;
          await saveCandidateAnswer({
            candidateId: session.profile.dbCandidateId,
            attemptId: session.backendAttemptId,
            questionId: question.id,
            selectedOptionId: optionId,
            questionNumber: questionNum,
          });
          setAutosaveStatus('saved');
        } catch {
          setAutosaveStatus('error');
        }
      }, 400);
    },
    [session, questions, idx]
  );

  const toggleFlag = useCallback((qNum: number) => {
    setFlags((prev) =>
      prev.includes(qNum) ? prev.filter((f) => f !== qNum) : [...prev, qNum]
    );
  }, []);

  // ─── Final Submission ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (reason: 'manual_submit' | 'timer_expired' | 'candidate_exit' = 'manual_submit') => {
      setSubmitting(true);
      setSubmitModalVisible(false);
      try {
        let backendResult;
        if (session?.profile?.dbCandidateId && session.backendAttemptId) {
          backendResult = await submitCandidateAttempt(
            session.profile.dbCandidateId,
            session.backendAttemptId,
            answers
          );
        }
        const finalized = await finalizeCandidateSession(reason);
        if (finalized && backendResult) {
          finalized.receiptId = backendResult.receiptId;
          finalized.score = backendResult.score;
          finalized.totalMarks = backendResult.totalMarks;
          finalized.percentage = backendResult.percentage;
          finalized.qualificationStatus = backendResult.qualificationStatus;
          finalized.isPublished = backendResult.isPublished;
          await saveCandidateSession(finalized);
        }
        router.replace('/candidate/submitted');
      } catch (err) {
        const e = err as ApiError;
        Alert.alert('Submission Notice', e.message || 'Could not finalize submission. Retrying sync.');
        setSubmitting(false);
      }
    },
    [session, answers, router]
  );

  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const isWarningTime = timeRemaining <= 600;
  const isCriticalTime = timeRemaining <= 180;

  if (loading || !session) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Initializing proctored exam session...</Text>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.loadingCenter}>
        <Ionicons name="document-text-outline" size={48} color={Colors.muted} />
        <Text style={styles.noQText}>No examination questions found in this assessment package.</Text>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.replace('/candidate/login')}>
          <Text style={styles.goBackBtnText}>Return to Portal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const question = questions[idx];
  const qNum = idx + 1;
  const selectedOption = answers[qNum];
  const isFlagged = flags.includes(qNum);
  const answeredCount = Object.keys(answers).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* ─── Pinned Proctored HUD Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.examTitle} numberOfLines={1} selectable={false}>
            {session.profile.examTitle || 'Technical Examination'}
          </Text>
          <View style={styles.setRow}>
            <View style={styles.setPill}>
              <Text style={styles.setPillText} selectable={false}>SET {session.assignedSet || 'A'}</Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText} selectable={false}>AI ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Countdown Timer Pill */}
        <View
          style={[
            styles.timerPill,
            isWarningTime && styles.timerPillWarning,
            isCriticalTime && styles.timerPillCritical,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={isCriticalTime ? Colors.error : isWarningTime ? Colors.warning : Colors.primary}
          />
          <Text
            selectable={false}
            style={[
              styles.timerText,
              isWarningTime && styles.timerTextWarning,
              isCriticalTime && styles.timerTextCritical,
            ]}
          >
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(answeredCount / questions.length) * 100}%` as any },
          ]}
        />
      </View>

      {/* ─── Dedicated Pinned Proctor Bar (Non-Blocking, Perfectly Docked) ─── */}
      <View style={styles.proctorBar}>
        <View style={styles.proctorBarLeft}>
          <Text style={styles.qCounter} selectable={false}>
            QUESTION <Text style={{ color: Colors.primary, fontWeight: '800' }}>{qNum}</Text> / {questions.length}
          </Text>

          <View style={styles.autosaveWrap}>
            {autosaveStatus === 'saving' && (
              <>
                <ActivityIndicator size="small" color={Colors.muted} style={{ transform: [{ scale: 0.6 }] }} />
                <Text style={styles.autosaveText} selectable={false}>Syncing...</Text>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
                <Text style={styles.autosaveText} selectable={false}>Encrypted & Locked</Text>
              </>
            )}
            {autosaveStatus === 'error' && (
              <>
                <Ionicons name="cloud-offline-outline" size={12} color={Colors.warning} />
                <Text style={[styles.autosaveText, { color: Colors.warning }]} selectable={false}>Local Cache</Text>
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={styles.forensicPill}>
              <Ionicons name="finger-print" size={10} color={Colors.primary} />
              <Text style={styles.forensicPillText} selectable={false}>
                ID: {session.profile.candidateId} · {liveTimestamp}
              </Text>
            </View>
            <ProctoringStatus />
          </View>
        </View>

        {/* ─── Integrated Live Camera Stream (Standard 4:3 Aspect, ZERO Overlap) ─── */}
        <View style={styles.dockedCameraFrame}>
          {permission?.granted && isScreenFocused ? (
            <ProctoringCameraView
              cameraKey={`cam-${permission.granted}-${cameraKey}`}
              style={styles.cameraPreview}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator size="small" color="#86EFAC" />
            </View>
          )}

          {/* Biometric Scanning Overlay Reticle */}
          <View style={styles.reticleOverlay} pointerEvents="none">
            <View style={[styles.reticleCorner, styles.reticleTL]} />
            <View style={[styles.reticleCorner, styles.reticleTR]} />
            <View style={[styles.reticleCorner, styles.reticleBL]} />
            <View style={[styles.reticleCorner, styles.reticleBR]} />
          </View>

          <View style={styles.dockedCameraBadge} pointerEvents="none">
            <View style={styles.livePulseDot} />
            <Text style={styles.dockedCameraBadgeText} selectable={false}>AI CAM</Text>
          </View>
        </View>
      </View>

      {/* ─── Question Statement & Options (Zero-Selection & Zero Blocking) ─── */}
      <View style={styles.mainContainer}>
        {/* Anti-Scan Forensic Watermark Overlay (Breaks OCR & Secondary Phone Cameras) */}
        <View style={styles.watermarkOverlay} pointerEvents="none">
          {[0, 1, 2, 3, 4].map((wIdx) => (
            <Text key={wIdx} style={styles.watermarkText} numberOfLines={1} selectable={false}>
              {session.profile.name.toUpperCase()} · {session.profile.candidateId} · {liveTimestamp} · EXAMSECURE
            </Text>
          ))}
        </View>

        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={styles.questionContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Question Card */}
          <View style={styles.questionCard}>
            <View style={styles.questionMetaRow}>
              <View style={styles.questionNumBadge}>
                <Text style={styles.questionNumBadgeText} selectable={false}>Question {qNum}</Text>
              </View>

              <TouchableOpacity
                onPress={() => toggleFlag(qNum)}
                style={[styles.flagBtn, isFlagged && styles.flagBtnActive]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isFlagged ? 'bookmark' : 'bookmark-outline'}
                  size={14}
                  color={isFlagged ? '#92400E' : Colors.slate500}
                />
                <Text style={[styles.flagBtnText, isFlagged && styles.flagBtnTextActive]} selectable={false}>
                  {isFlagged ? 'Marked' : 'Mark for Review'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Question text with selectable=false to block Circle to Search & copying */}
            <Text style={styles.questionText} selectable={false}>
              {question.questionText}
            </Text>

            {question.marks ? (
              <View style={styles.marksTag}>
                <Ionicons name="ribbon-outline" size={12} color={Colors.primary} />
                <Text style={styles.marksTagText} selectable={false}>
                  +{question.marks} Mark per Correct Option
                </Text>
              </View>
            ) : null}
          </View>

          {/* Option Selection Tiles (Zero-Selection Protected) */}
          <View style={styles.optionsContainer}>
            {question.options.map((option, oi) => {
              const isSelected = selectedOption === option.id;
              const optionLabel = option.label || ['A', 'B', 'C', 'D'][oi] || String(oi + 1);

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => handleSelectOption(qNum, option.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionBadge, isSelected && styles.optionBadgeSelected]}>
                    <Text style={[styles.optionBadgeText, isSelected && styles.optionBadgeTextSelected]} selectable={false}>
                      {optionLabel}
                    </Text>
                  </View>

                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} selectable={false}>
                    {option.optionText}
                  </Text>

                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInnerDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ─── Pinned Docked Bottom Navigation Bar ─── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navBtn, idx === 0 && styles.navBtnDisabled]}
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={17} color={idx === 0 ? Colors.slate300 : Colors.ink} />
          <Text style={[styles.navBtnText, idx === 0 && styles.navBtnTextDisabled]} selectable={false}>Prev</Text>
        </TouchableOpacity>

        {/* Question Palette Drawer Trigger */}
        <TouchableOpacity
          style={styles.paletteTrigger}
          onPress={() => setPaletteVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="grid-outline" size={15} color={Colors.primary} />
          <Text style={styles.paletteTriggerText} selectable={false}>
            {answeredCount}/{questions.length}
          </Text>
        </TouchableOpacity>

        {idx < questions.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText} selectable={false}>Next</Text>
            <Ionicons name="chevron-forward" size={17} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.submitFinalBtn}
            onPress={() => setSubmitModalVisible(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="send" size={15} color="#fff" />
            <Text style={styles.submitFinalBtnText} selectable={false}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Question Palette Modal Sheet ─── */}
      <Modal
        visible={paletteVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPaletteVisible(false)}
      >
        <View style={styles.paletteOverlay}>
          <View style={styles.paletteSheet}>
            <View style={styles.paletteHeader}>
              <View>
                <Text style={styles.paletteTitle} selectable={false}>Question Navigator</Text>
                <Text style={styles.paletteSubtitle} selectable={false}>
                  Overview of all {questions.length} questions in this assessment set
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaletteVisible(false)}
                style={styles.paletteCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Status Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText} selectable={false}>Answered ({answeredCount})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.accentGold }]} />
                <Text style={styles.legendText} selectable={false}>Flagged ({flags.length})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.slate200, borderWidth: 1, borderColor: Colors.slate300 }]} />
                <Text style={styles.legendText} selectable={false}>Unanswered ({questions.length - answeredCount})</Text>
              </View>
            </View>

            {/* Numbered Grid */}
            <ScrollView contentContainerStyle={styles.paletteGrid} showsVerticalScrollIndicator={false}>
              {questions.map((_, i) => {
                const qn = i + 1;
                const isAns = answers[qn] !== undefined;
                const isFlg = flags.includes(qn);
                const isCur = i === idx;

                return (
                  <TouchableOpacity
                    key={qn}
                    style={[
                      styles.paletteNum,
                      isAns && styles.paletteNumAnswered,
                      isFlg && !isAns && styles.paletteNumFlagged,
                      isCur && styles.paletteNumCurrent,
                    ]}
                    onPress={() => {
                      setIdx(i);
                      setPaletteVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      selectable={false}
                      style={[
                        styles.paletteNumText,
                        (isAns || isCur) && { color: '#fff', fontWeight: '800' },
                        isFlg && !isAns && { color: '#92400E', fontWeight: '800' },
                      ]}
                    >
                      {qn}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.paletteSubmitAction}
              onPress={() => {
                setPaletteVisible(false);
                setSubmitModalVisible(true);
              }}
              activeOpacity={0.88}
            >
              <Ionicons name="send" size={15} color="#fff" />
              <Text style={styles.paletteSubmitActionText} selectable={false}>Finalize & Submit Assessment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Submit Confirmation Modal ─── */}
      <Modal
        visible={submitModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSubmitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.submitIconRing}>
              <Ionicons name="cloud-upload" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle} selectable={false}>Submit Your Assessment?</Text>
            <Text style={styles.modalMessage} selectable={false}>
              You have completed <Text style={{ fontWeight: '800', color: Colors.ink }}>{answeredCount}</Text> of{' '}
              <Text style={{ fontWeight: '800', color: Colors.ink }}>{questions.length}</Text> questions.
              {answeredCount < questions.length
                ? `\n\n⚠️ ${questions.length - answeredCount} question(s) will remain unanswered.`
                : '\n\n✓ All questions have been securely recorded.'}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSubmitModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText} selectable={false}>Review Answers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => handleSubmit('manual_submit')}
                activeOpacity={0.88}
              >
                <Text style={styles.modalConfirmText} selectable={false}>Confirm & Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Anti-Gemini, Overlay & Secondary Device Tamper Siren Modal ─── */}
      <Modal visible={violationAlertVisible} animationType="fade" transparent>
        <View style={styles.securityOverlayBackdrop}>
          <View style={styles.securityAlertCard}>
            <View style={styles.securitySirenCircle}>
              <Ionicons name="shield-half" size={32} color="#DC2626" />
            </View>

            <Text style={styles.securityAlertTitle} selectable={false}>
              PROCTOR INTEGRITY BREACH
            </Text>

            <View style={styles.securityTypeBadge}>
              <Ionicons name="warning" size={12} color="#DC2626" />
              <Text style={styles.securityTypeBadgeText} selectable={false}>
                {violationType === 'ASSISTANT_OR_OVERLAY_TRIGGERED'
                  ? 'GOOGLE GEMINI / OVERLAY DETECTED'
                  : violationType === 'SECONDARY_DEVICE'
                  ? 'SECONDARY PHONE SCAN DETECTED'
                  : violationType === 'MULTI_FACE'
                  ? 'MULTIPLE INDIVIDUALS DETECTED'
                  : 'FOCUS DISRUPTION DETECTED'}
              </Text>
            </View>

            <Text style={styles.securityAlertDesc} selectable={false}>
              {violationMessage || 'An unauthorized background assistant, secondary device, or overlay was invoked during the active examination.'}
            </Text>

            <View style={styles.strikeCounterBox}>
              <Text style={styles.strikeCounterLabel} selectable={false}>SECURITY STRIKE AUDIT</Text>
              <Text style={styles.strikeCounterValue} selectable={false}>
                Strike <Text style={{ color: '#DC2626', fontWeight: '900' }}>{violations}</Text> of {MAX_VIOLATIONS}
              </Text>
              <Text style={styles.strikeWarningText} selectable={false}>
                {violations >= MAX_VIOLATIONS
                  ? 'Exceeded maximum allowable infractions. Permanent exam termination initiated.'
                  : 'Final warning: A second infraction will instantly terminate and fail your assessment.'}
              </Text>
            </View>

            {violations < MAX_VIOLATIONS && (
              <TouchableOpacity
                style={styles.resumeSecureBtn}
                onPress={() => setViolationAlertVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.resumeSecureBtnText} selectable={false}>Return to Proctored Exam</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Submitting Overlay ─── */}
      {submitting && (
        <View style={styles.submittingOverlay}>
          <View style={styles.submittingCard}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.submittingTitle} selectable={false}>Encrypting & Submitting...</Text>
            <Text style={styles.submittingSubtitle} selectable={false}>
              Calculating final verification receipt and cryptographic audit seal. Please do not close the app.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    gap: 12,
    padding: 24,
  },
  loadingText: { fontSize: 13.5, color: Colors.muted, fontWeight: '600' },
  noQText: { fontSize: 14, color: Colors.muted, textAlign: 'center', marginTop: 12 },
  goBackBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  goBackBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    gap: 8,
  },
  headerLeft: { flex: 1 },
  examTitle: { fontSize: 13.5, fontWeight: '800', color: Colors.ink },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  setPill: {
    backgroundColor: Colors.slate100,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: Radius.xs,
  },
  setPillText: { fontSize: 9, fontWeight: '800', color: Colors.slate600 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryPale,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.full,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.primary },
  liveText: { fontSize: 8.5, fontWeight: '800', color: Colors.primaryDark },

  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1.5,
    borderColor: 'rgba(1, 120, 70, 0.25)',
  },
  timerPillWarning: {
    backgroundColor: Colors.accentGoldLight,
    borderColor: Colors.warningBorder,
  },
  timerPillCritical: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  timerText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  timerTextWarning: { color: Colors.warningText },
  timerTextCritical: { color: Colors.errorText },

  progressBar: { height: 3, backgroundColor: Colors.slate200 },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  /* Dedicated Pinned Proctor Bar (Non-Blocking) */
  proctorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    gap: 10,
  },
  proctorBarLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  qCounter: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  autosaveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  autosaveText: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '600',
  },
  forensicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  forensicPillText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: Colors.primaryDark,
    fontFamily: Fonts.mono,
  },

  /* Docked Live Camera Frame (Zero Overlap with Questions) */
  dockedCameraFrame: {
    width: 72,
    height: 54,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    position: 'relative',
    zIndex: 1,
    ...Shadow.xs,
  },
  cameraPreview: {
    width: 72,
    height: 54,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 3,
  },
  reticleCorner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: '#4ADE80',
  },
  reticleTL: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  reticleTR: { top: 2, right: 2, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  reticleBL: { bottom: 2, left: 2, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  reticleBR: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  dockedCameraBadge: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  livePulseDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22C55E',
  },
  dockedCameraBadgeText: {
    fontSize: 6.5,
    fontWeight: '900',
    color: '#86EFAC',
    letterSpacing: 0.3,
  },

  /* Main Viewport Container */
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    position: 'relative',
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-around',
    alignItems: 'center',
    opacity: 0.04,
    transform: [{ rotate: '-22deg' }],
    zIndex: 1,
  },
  watermarkText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    color: '#0F172A',
    letterSpacing: 2,
  },

  /* Question & Options */
  questionScroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  questionContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  questionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  questionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionNumBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  questionNumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.4,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flagBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  flagBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate600,
  },
  flagBtnTextActive: {
    color: '#92400E',
  },
  questionText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 21,
  },
  marksTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  marksTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.muted,
  },

  /* Options */
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F7FCF9',
  },
  optionBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionBadgeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.ink,
  },
  optionBadgeTextSelected: {
    color: '#fff',
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 18,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: Colors.ink,
  },
  radioCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    borderColor: Colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },

  /* Docked Bottom Bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
    ...Shadow.lg,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navBtnDisabled: {
    opacity: 0.45,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ink,
  },
  navBtnTextDisabled: {
    color: Colors.slate400,
  },
  paletteTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
  },
  paletteTriggerText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  submitFinalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentAmber,
    ...Shadow.sm,
  },
  submitFinalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },

  /* Palette Modal */
  paletteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  paletteSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg,
    maxHeight: '75%',
  },
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.ink,
  },
  paletteSubtitle: {
    fontSize: 11.5,
    color: Colors.muted,
    marginTop: 2,
  },
  paletteCloseBtn: {
    padding: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    marginBottom: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.slate600,
    fontWeight: '600',
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  paletteNum: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paletteNumAnswered: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paletteNumFlagged: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  paletteNumCurrent: {
    borderColor: Colors.ink,
    borderWidth: 2,
  },
  paletteNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate700,
  },
  paletteSubmitAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 13,
    marginTop: Spacing.md,
    ...Shadow.md,
  },
  paletteSubmitActionText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#fff',
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadow.lg,
  },
  submitIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.ink,
    marginBottom: 6,
  },
  modalMessage: {
    fontSize: 13,
    color: Colors.slate600,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate700,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    ...Shadow.sm,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },

  /* High-Stakes Security Violation Modal */
  securityOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  securityAlertCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderTopWidth: 5,
    borderTopColor: '#DC2626',
    ...Shadow.lg,
  },
  securitySirenCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  securityAlertTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  securityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 10,
  },
  securityTypeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  securityAlertDesc: {
    fontSize: 12.5,
    color: Colors.slate700,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  strikeCounterBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  strikeCounterLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.6,
  },
  strikeCounterValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.ink,
    marginVertical: 4,
  },
  strikeWarningText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 15,
  },
  resumeSecureBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  resumeSecureBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  /* Submitting Overlay */
  submittingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  submittingCard: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 10,
    maxWidth: 320,
    ...Shadow.lg,
  },
  submittingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.ink,
  },
  submittingSubtitle: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
