import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CandidateSession } from '../types/candidate';

const SESSION_KEY = 'examsecure_candidate_session';
const CANDIDATE_TOKEN_KEY = 'examsecure_candidate_token';

export async function loadCandidateSession(): Promise<CandidateSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CandidateSession;
  } catch {
    return null;
  }
}

export async function saveCandidateSession(session: CandidateSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export async function clearCandidateSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([SESSION_KEY]);
  } catch {}
}

export async function saveCandidateToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CANDIDATE_TOKEN_KEY, token);
  } catch {}
}

export async function getCandidateToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CANDIDATE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearCandidateToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CANDIDATE_TOKEN_KEY);
  } catch {}
}

export function generateSessionId(): string {
  return `SES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function finalizeCandidateSession(
  reason: 'manual_submit' | 'timer_expired' | 'candidate_exit'
): Promise<CandidateSession | null> {
  const session = await loadCandidateSession();
  if (!session) return null;
  const finalized: CandidateSession = {
    ...session,
    isSubmitted: true,
    submittedAt: Date.now(),
    submissionReason: reason,
    timeTakenSeconds: session.startTime
      ? Math.max(0, Math.round((Date.now() - session.startTime) / 1000))
      : undefined,
  };
  await saveCandidateSession(finalized);
  return finalized;
}
