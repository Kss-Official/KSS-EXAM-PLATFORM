import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';
import ScreenKeyboardWrapper from '../../components/ScreenKeyboardWrapper';
import type { CandidateProfile } from '../../types/candidate';

const DRAFT_PROFILE_KEY = 'examsecure_draft_profile';

const YEAR_OFFSET_FUTURE = 5;
const YEAR_OFFSET_PAST = 10;
const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEARS = Array.from(
  { length: YEAR_OFFSET_FUTURE + YEAR_OFFSET_PAST + 1 },
  (_, i) => String(CURRENT_YEAR + YEAR_OFFSET_FUTURE - i)
);

const TOP_SKILLS = [
  'JavaScript', 'Python', 'Java', 'C++', 'React', 'SQL',
  'Data Structures', 'Algorithms', 'Cloud', 'Machine Learning'
];

const DEGREE_BRANCHES = [
  'Computer Science (CSE)', 'Information Tech (IT)',
  'Electronics & Comm (ECE)', 'Mechanical Engineering',
  'MCA / BCA', 'Other Specialization',
];

export default function RoleApplicationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 420;

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobRole, setJobRole] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [degreeBranch, setDegreeBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(DRAFT_PROFILE_KEY);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          setProfile(p);
          if (p.jobRole) setJobRole(p.jobRole);
          if (p.skills) setSelectedSkills(p.skills);
          if (p.degreeBranch) setDegreeBranch(p.degreeBranch);
          if (p.graduationYear) setGraduationYear(p.graduationYear);
        } catch {}
      }
    })();
  }, []);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleContinue = async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_PROFILE_KEY);
      if (!raw) {
        router.replace('/candidate/login');
        return;
      }
      const p: CandidateProfile = JSON.parse(raw);
      const updated: CandidateProfile = {
        ...p,
        jobRole: jobRole.trim() || undefined,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        degreeBranch: degreeBranch || undefined,
        graduationYear: graduationYear || undefined,
      };
      await AsyncStorage.setItem(DRAFT_PROFILE_KEY, JSON.stringify(updated));
      router.push('/candidate/system-check');
    } catch {
      router.push('/candidate/system-check');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <ScreenKeyboardWrapper
        header={
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backIconBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={Colors.ink} />
            </TouchableOpacity>
            <View style={styles.topBarCenter}>
              <Text style={styles.topBarTitle}>Academic Profile</Text>
              <Text style={styles.topBarSubtitle}>Step 2 of 4</Text>
            </View>
            <View style={styles.stepTrackPill}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={styles.stepDot} />
              <View style={styles.stepDot} />
            </View>
          </View>
        }
        contentContainerStyle={styles.contentBody}
        footer={
          <View style={styles.dockedFooter}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={16} color={Colors.slate600} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.88}>
              <Text style={styles.continueBtnText}>Proceed to System Check</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      >
          {/* Candidate Identity Strip */}
          {profile && (
            <View style={styles.candidateStrip}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.candidateNameRow}>
                  <Text style={styles.candidateName} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <View style={styles.verifiedTag}>
                    <Ionicons name="checkmark-circle" size={11} color={Colors.primary} />
                    <Text style={styles.verifiedTagText}>VERIFIED</Text>
                  </View>
                </View>
                <Text style={styles.candidateDetail} numberOfLines={1}>
                  {profile.department} · {profile.email}
                </Text>
              </View>
            </View>
          )}

          {/* Target Role Field */}
          <View style={styles.fieldSection}>
            <Text style={styles.sectionLabel}>Target Job Role / Specialization</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="briefcase-outline" size={16} color={Colors.slate400} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Software Engineer, AI/ML Developer"
                placeholderTextColor={Colors.slate400}
                value={jobRole}
                contextMenuHidden
                onChangeText={setJobRole}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Technical Skills Selection */}
          <View style={styles.fieldSection}>
            <View style={styles.skillsHeader}>
              <Text style={styles.sectionLabel}>Core Competencies</Text>
              <Text style={styles.skillsCountText}>
                {selectedSkills.length} selected
              </Text>
            </View>
            <View style={styles.skillsGrid}>
              {TOP_SKILLS.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <TouchableOpacity
                    key={skill}
                    style={[styles.skillChip, isSelected && styles.skillChipSelected]}
                    onPress={() => toggleSkill(skill)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark' : 'add'}
                      size={13}
                      color={isSelected ? Colors.primary : Colors.slate500}
                    />
                    <Text style={[styles.skillChipText, isSelected && styles.skillChipTextSelected]}>
                      {skill}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Degree & Year Dual Selector */}
          <View style={styles.fieldSection}>
            <Text style={styles.sectionLabel}>Degree Branch & Graduation Year</Text>
            <View style={[styles.dualRow, isNarrowScreen && styles.dualRowStacked]}>
              {/* Branch Selector */}
              <TouchableOpacity
                style={[styles.selectorBtn, !isNarrowScreen && { flex: 1.4 }]}
                onPress={() => {
                  setShowBranchPicker((v) => !v);
                  setShowYearPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="school-outline" size={15} color={Colors.slate400} />
                <Text style={[styles.selectorBtnText, !degreeBranch && styles.placeholderText]} numberOfLines={1}>
                  {degreeBranch || 'Select Branch'}
                </Text>
                <Ionicons name="chevron-down" size={13} color={Colors.slate400} />
              </TouchableOpacity>

              {/* Graduation Year Dropdown Selector */}
              <TouchableOpacity
                style={[styles.selectorBtn, !isNarrowScreen && { flex: 1 }]}
                onPress={() => {
                  setShowYearPicker((v) => !v);
                  setShowBranchPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={15} color={Colors.slate400} />
                <Text style={[styles.selectorBtnText, !graduationYear && styles.placeholderText]} numberOfLines={1}>
                  {graduationYear || 'Passing Year'}
                </Text>
                <Ionicons name="chevron-down" size={13} color={Colors.slate400} />
              </TouchableOpacity>
            </View>

            {/* Branch dropdown if toggled */}
            {showBranchPicker && (
              <View style={styles.branchDropdown}>
                {DEGREE_BRANCHES.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.branchItem, degreeBranch === b && styles.branchItemSelected]}
                    onPress={() => {
                      setDegreeBranch(b);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text style={[styles.branchItemText, degreeBranch === b && styles.branchItemTextSelected]}>
                      {b}
                    </Text>
                    {degreeBranch === b && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Graduation Year dropdown reusing the same dropdown style */}
            {showYearPicker && (
              <View style={styles.branchDropdown}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {GRADUATION_YEARS.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.branchItem, graduationYear === y && styles.branchItemSelected]}
                      onPress={() => {
                        setGraduationYear(y);
                        setShowYearPicker(false);
                      }}
                    >
                      <Text style={[styles.branchItemText, graduationYear === y && styles.branchItemTextSelected]}>
                        {y}
                      </Text>
                      {graduationYear === y && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
      </ScreenKeyboardWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lineSubtle,
    backgroundColor: '#FFFFFF',
  },
  backIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ink,
  },
  topBarSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '600',
    marginTop: 1,
  },
  stepTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.slate300,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  contentBody: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  candidateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  candidateNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  candidateName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.ink,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  verifiedTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  candidateDetail: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  fieldSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.inkSecondary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink,
    paddingVertical: 0,
    fontWeight: '500',
  },
  skillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillsCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.slate100,
    borderWidth: 1,
    borderColor: Colors.slate200,
  },
  skillChipSelected: {
    backgroundColor: Colors.primaryPale,
    borderColor: Colors.primary,
  },
  skillChipText: {
    fontSize: 11.5,
    color: Colors.slate600,
    fontWeight: '600',
  },
  skillChipTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  dualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dualRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 140,
    backgroundColor: Colors.slate50,
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    height: 44,
  },
  selectorBtnText: {
    flex: 1,
    fontSize: 12,
    color: Colors.ink,
    fontWeight: '500',
    marginHorizontal: 4,
  },
  placeholderText: { color: Colors.slate400 },
  dropdownScroll: {
    maxHeight: 220,
  },
  branchDropdown: {
    marginTop: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: 'hidden',
    ...Shadow.md,
  },
  branchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
  },
  branchItemSelected: {
    backgroundColor: Colors.primaryPale,
  },
  branchItemText: {
    fontSize: 12,
    color: Colors.ink,
  },
  branchItemTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  dockedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.lineSubtle,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.slate100,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate700,
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    height: 48,
    ...Shadow.primaryBtn,
  },
  continueBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
