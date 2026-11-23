import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Shadow, Fonts } from '../../constants/theme';
import ExamSecureLogo from '../../components/ExamSecureLogo';
import {
  loadCandidateSession,
  clearCandidateSession,
  clearCandidateToken,
} from '../../services/sessionStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubmissionReceipt } from '../../types/candidate';

function formatDate(ts?: number | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function formatTime(secs?: number | null): string {
  if (secs == null || secs < 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0 && s === 0) return '< 1 min';
  if (m === 0) return `${s} sec`;
  return `${m}m ${s}s`;
}

export default function SubmissionScreen() {
  const router = useRouter();
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await loadCandidateSession();
      if (!session || !session.isSubmitted) {
        router.replace('/candidate/login');
        return;
      }
      const answered = Object.keys(session.answers || {}).length;
      const totalQ = session.questions?.length || 60;
      const r: SubmissionReceipt = {
        receiptId: session.receiptId || `REC-${Date.now()}`,
        sessionId: session.sessionId,
        examId: session.examId,
        candidateName: session.profile?.name || 'Candidate',
        candidateEmail: session.profile?.email,
        candidateId: session.profile?.candidateId || 'CAND-001',
        department: session.profile?.department || '—',
        answeredCount: answered,
        unansweredCount: Math.max(0, totalQ - answered),
        totalQuestions: totalQ,
        submittedAt: session.submittedAt || Date.now(),
        timeTakenSeconds: session.timeTakenSeconds,
        submissionReason: session.submissionReason || 'manual_submit',
        score: session.score,
        totalMarks: session.totalMarks,
        percentage: session.percentage,
        qualificationStatus: session.qualificationStatus,
        isPublished: session.isPublished,
      };
      setReceipt(r);
    })();
  }, []);

  const handleCopyReceiptId = async () => {
    if (!receipt?.receiptId) return;
    await Clipboard.setStringAsync(receipt.receiptId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!receipt) return;
    try {
      await Share.share({
        message: `ExamSecure Verification Receipt\nReceipt ID: ${receipt.receiptId}\nCandidate: ${receipt.candidateName}\nDepartment: ${receipt.department}\nAnswered: ${receipt.answeredCount}/${receipt.totalQuestions}\nSubmitted: ${formatDate(receipt.submittedAt)}`,
        title: 'ExamSecure Submission Receipt',
      });
    } catch {}
  };

  const handleClose = async () => {
    await clearCandidateSession();
    await clearCandidateToken();
    await AsyncStorage.removeItem('examsecure_draft_profile');
    router.replace('/candidate/login');
  };

  if (!receipt) return null;

  const qualStatus = receipt.qualificationStatus;
  const isQualified = qualStatus === 'QUALIFIED';
  const isPublished = receipt.isPublished;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      {/* ─── Compact Header with Verified Seal ─── */}
      <View style={styles.header}>
        <View style={styles.successSealRing}>
          <View style={styles.successSeal}>
            <Ionicons name="checkmark-done" size={26} color="#fff" />
          </View>
        </View>

        <Text style={styles.headerTitle}>Examination Submitted</Text>
        <Text style={styles.headerSubtitle}>
          Cryptographically recorded, sealed, and synced to institutional evaluation servers.
        </Text>

        <View style={styles.auditPill}>
          <Ionicons name="shield-checkmark" size={11} color="#86EFAC" />
          <Text style={styles.auditPillText}>TAMPER-PROOF AUDIT SEALED</Text>
        </View>
      </View>

      {/* ─── Viewport Body (Zero-Scroll Optimized on standard screens) ─── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Official Receipt Card */}
        <View style={styles.receiptCard}>
          <View style={styles.receiptHeader}>
            <Text style={styles.receiptHeaderLabel}>OFFICIAL RECEIPT CODE</Text>
            <View style={styles.receiptVerifiedBadge}>
              <Ionicons name="lock-closed" size={10} color={Colors.primary} />
              <Text style={styles.receiptVerifiedText}>VERIFIED</Text>
            </View>
          </View>

          <Text style={styles.receiptId} selectable={true}>
            {receipt.receiptId}
          </Text>

          <View style={styles.receiptActions}>
            <TouchableOpacity
              style={[styles.receiptBtn, copied && styles.receiptBtnCopied]}
              onPress={handleCopyReceiptId}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={copied ? Colors.successText : Colors.primaryDark}
              />
              <Text style={[styles.receiptBtnText, copied && { color: Colors.successText }]}>
                {copied ? 'Copied to Clipboard' : 'Copy Receipt ID'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.receiptBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-social-outline" size={14} color={Colors.primaryDark} />
              <Text style={styles.receiptBtnText}>Share Proof</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Score Card (when result published) */}
        {isPublished && receipt.score !== undefined && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assessment Performance</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreNumber}>{receipt.score?.toFixed(1) ?? '—'}</Text>
                <Text style={styles.scoreLabel}>Score</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreItem}>
                <Text style={styles.scoreNumber}>{receipt.totalMarks ?? '—'}</Text>
                <Text style={styles.scoreLabel}>Total Marks</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreItem}>
                <Text style={styles.scoreNumber}>{receipt.percentage?.toFixed(1) ?? '—'}%</Text>
                <Text style={styles.scoreLabel}>Percentage</Text>
              </View>
            </View>

            {qualStatus && (
              <View style={[styles.qualBadge, isQualified ? styles.qualPass : styles.qualFail]}>
                <Ionicons
                  name={isQualified ? 'checkmark-circle' : 'close-circle'}
                  size={15}
                  color={isQualified ? Colors.successText : Colors.errorText}
                />
                <Text style={[styles.qualText, isQualified ? styles.qualTextPass : styles.qualTextFail]}>
                  {isQualified ? 'QUALIFIED FOR NEXT STAGE' : 'NOT QUALIFIED'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Candidate & Audit Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Candidate & Audit Details</Text>

          <View style={styles.detailsList}>
            {[
              { icon: 'person-outline', label: 'Candidate Name', value: receipt.candidateName },
              { icon: 'id-card-outline', label: 'Candidate Reg ID', value: receipt.candidateId },
              { icon: 'business-outline', label: 'Academic Department', value: receipt.department },
              {
                icon: 'checkbox-outline',
                label: 'Questions Answered',
                value: `${receipt.answeredCount} of ${receipt.totalQuestions} questions`,
              },
              { icon: 'timer-outline', label: 'Duration Elapsed', value: formatTime(receipt.timeTakenSeconds) },
              { icon: 'calendar-outline', label: 'Submission Timestamp', value: formatDate(receipt.submittedAt) },
            ].map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name={row.icon as any} size={14} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ─── Permanently Docked Bottom Exit CTA ─── */}
      <View style={styles.dockedBottomBar}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleClose} activeOpacity={0.88}>
          <Ionicons name="home-outline" size={16} color="#fff" />
          <Text style={styles.exitBtnText}>Return to Candidate Portal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.primaryDark },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  successSealRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successSeal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 3,
    paddingHorizontal: 16,
    lineHeight: 15,
  },
  auditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  auditPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.6,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.md,
  },
  receiptCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(1, 120, 70, 0.25)',
    ...Shadow.sm,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.muted,
    letterSpacing: 0.6,
  },
  receiptVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  receiptVerifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  receiptId: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Fonts.mono,
    color: Colors.primaryDark,
    letterSpacing: 1,
    marginVertical: 4,
  },
  receiptActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
  },
  receiptBtnCopied: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
  },
  receiptBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.ink,
    marginBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  scoreLabel: {
    fontSize: 10.5,
    color: Colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  qualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  qualPass: {
    backgroundColor: Colors.successBg,
  },
  qualFail: {
    backgroundColor: '#FEF2F2',
  },
  qualText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qualTextPass: {
    color: Colors.successText,
  },
  qualTextFail: {
    color: Colors.errorText,
  },

  detailsList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.ink,
    marginTop: 1,
  },

  /* Docked Bottom Bar */
  dockedBottomBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.lg,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    ...Shadow.md,
  },
  exitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
