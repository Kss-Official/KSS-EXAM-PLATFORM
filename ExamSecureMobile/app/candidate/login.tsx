import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Shadow } from '../../constants/theme';
import KalpanaaaLogo from '../../components/KalpanaaaLogo';
import {
  verifyCandidateEligibility,
  getCandidateDepartments,
  ApiError,
  type DepartmentDto,
} from '../../services/api';
import {
  loadCandidateSession,
  saveCandidateToken,
} from '../../services/sessionStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CandidateProfile } from '../../types/candidate';

export const FALLBACK_DEPARTMENTS: DepartmentDto[] = [
  { id: 3, name: 'Computer Science & Engineering (CSE)', code: 'CSE', category: 'TECHNICAL', active: true },
  { id: 19, name: 'Information Science & Engineering (ISE)', code: 'ISE', category: 'TECHNICAL', active: true },
  { id: 20, name: 'Master of Computer Applications (MCA)', code: 'MCA', category: 'TECHNICAL', active: true },
  { id: 4, name: 'Information Technology (IT)', code: 'IT', category: 'TECHNICAL', active: true },
  { id: 17, name: 'AI & Machine Learning (CSE-AIML)', code: 'CSE-AIML', category: 'TECHNICAL', active: true },
  { id: 22, name: 'Data Science (CSE-DS)', code: 'CSE-DS', category: 'TECHNICAL', active: true },
  { id: 18, name: 'IoT & Cyber Security (CSE-IOT)', code: 'CSE-IOT', category: 'TECHNICAL', active: true },
];

const DRAFT_PROFILE_KEY = 'examsecure_draft_profile';

export default function CandidateLoginScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedDept, setSelectedDept] = useState<DepartmentDto | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>(FALLBACK_DEPARTMENTS);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const [touched, setTouched] = useState({ name: false, dept: false, email: false });
  const [errors, setErrors] = useState({ name: '', dept: '', email: '' });
  const [serverError, setServerError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [existingSession, setExistingSession] = useState<boolean>(false);
  const [existingCandidateName, setExistingCandidateName] = useState('');

  // Load departments in background + check for existing session
  useEffect(() => {
    (async () => {
      try {
        const depts = await getCandidateDepartments();
        if (Array.isArray(depts) && depts.length > 0) {
          setDepartments(depts.filter((d) => d.active));
        }
      } catch {}

      const session = await loadCandidateSession();
      if (session && !session.isSubmitted) {
        setExistingSession(true);
        if (session.profile) {
          setName(session.profile.name || '');
          setEmail(session.profile.email || '');
          setExistingCandidateName(session.profile.name || 'Candidate');
        }
      }
    })();
  }, []);

  const validate = useCallback(() => {
    const errs = { name: '', dept: '', email: '' };
    if (!name.trim() || name.trim().length < 2) {
      errs.name = 'Full name is required (min. 2 characters).';
    }
    if (!selectedDept) {
      errs.dept = 'Please select your department.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = 'Enter a valid registered email address.';
    }
    setErrors(errs);
    return !errs.name && !errs.dept && !errs.email;
  }, [name, selectedDept, email]);

  const handleResumeSession = async () => {
    const session = await loadCandidateSession();
    if (session && !session.isSubmitted) {
      router.replace('/candidate/exam');
    } else if (session?.isSubmitted) {
      router.replace('/candidate/submitted');
    }
  };

  const handleSubmit = async () => {
    setTouched({ name: true, dept: true, email: true });
    setServerError(null);
    if (!validate()) return;

    setIsVerifying(true);
    try {
      const verifyRes = await verifyCandidateEligibility({
        fullName: name.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: selectedDept!.name,
        departmentName: selectedDept!.name,
        departmentId: selectedDept!.id,
      });

      if (!verifyRes.eligible) {
        setServerError(verifyRes.message || 'Credentials not found in institutional enrollment records.');
        return;
      }

      if (verifyRes.token) {
        await saveCandidateToken(verifyRes.token);
      }

      const profile: CandidateProfile = {
        name: verifyRes.candidateName || name.trim(),
        email: verifyRes.email || email.trim().toLowerCase(),
        department: selectedDept!.name,
        departmentId: selectedDept!.id,
        departmentCategory: verifyRes.departmentCategory as 'TECHNICAL' | 'NON_TECHNICAL',
        collegeName: verifyRes.collegeName,
        candidateId: verifyRes.registrationNumber || 'CAND-001',
        dbCandidateId: verifyRes.candidateId,
        assignedExamId: verifyRes.assignedExamId,
        examTitle: verifyRes.examTitle,
        slotName: verifyRes.slotName,
        questionSetCode: verifyRes.questionSetCode,
      };

      await AsyncStorage.setItem(DRAFT_PROFILE_KEY, JSON.stringify(profile));
      router.push('/candidate/role-application');
    } catch (err) {
      const e = err as ApiError;
      setServerError(e.message || 'Network verification failed. Ensure server connectivity.');
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase();
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
    );
  }, [departments, deptSearch]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Compact Top Navigation Bar */}
        <View style={styles.topBar}>
          <KalpanaaaLogo size="sm" />

          <View style={styles.proctorPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.proctorPillText}>AI PROCTORED</Text>
          </View>
        </View>

        {/* Main Viewport Content (Zero-Scroll Flex Container) */}
        <View style={styles.contentBody}>
          {/* Active Session Recovery Banner */}
          {existingSession && (
            <TouchableOpacity
              style={styles.resumeBanner}
              onPress={handleResumeSession}
              activeOpacity={0.88}
            >
              <View style={styles.resumeIconWrap}>
                <Ionicons name="play" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitle}>Active Exam Session</Text>
                <Text style={styles.resumeSub} numberOfLines={1}>
                  Session for {existingCandidateName} in progress. Tap to resume.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          {/* Form Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Candidate Sign In</Text>
            <Text style={styles.formSubtitle}>
              Enter registered details to access your assessment
            </Text>
          </View>

          {/* Server Error Alert */}
          {serverError && (
            <View style={styles.serverErrorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          )}

          {/* Field 1: Full Name */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.req}>*</Text>
            </View>
            <View
              style={[
                styles.inputWrap,
                nameFocused && styles.inputFocused,
                errors.name && touched.name && styles.inputError,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={17}
                color={nameFocused ? Colors.primary : Colors.slate400}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Jigyansha Sharma"
                placeholderTextColor={Colors.slate400}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors((e) => ({ ...e, name: '' }));
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => {
                  setNameFocused(false);
                  setTouched((t) => ({ ...t, name: true }));
                }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            {errors.name && touched.name ? (
              <Text style={styles.errorText}>{errors.name}</Text>
            ) : null}
          </View>

          {/* Field 2: Department Picker */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Assigned Department</Text>
              <Text style={styles.req}>*</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.inputWrap,
                styles.pickerWrap,
                errors.dept && touched.dept && styles.inputError,
              ]}
              onPress={() => setDeptModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="business-outline"
                size={17}
                color={selectedDept ? Colors.primary : Colors.slate400}
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.pickerText,
                  !selectedDept && styles.placeholderText,
                ]}
                numberOfLines={1}
              >
                {selectedDept ? selectedDept.name : 'Select your academic department'}
              </Text>
              <Ionicons name="chevron-down" size={15} color={Colors.slate400} />
            </TouchableOpacity>
            {errors.dept && touched.dept ? (
              <Text style={styles.errorText}>{errors.dept}</Text>
            ) : null}
          </View>

          {/* Field 3: Email Address */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Institutional Email</Text>
              <Text style={styles.req}>*</Text>
            </View>
            <View
              style={[
                styles.inputWrap,
                emailFocused && styles.inputFocused,
                errors.email && touched.email && styles.inputError,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={17}
                color={emailFocused ? Colors.primary : Colors.slate400}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="candidate@university.edu"
                placeholderTextColor={Colors.slate400}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors((e) => ({ ...e, email: '' }));
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => {
                  setEmailFocused(false);
                  setTouched((t) => ({ ...t, email: true }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
            {errors.email && touched.email ? (
              <Text style={styles.errorText}>{errors.email}</Text>
            ) : null}
          </View>
        </View>

        {/* Docked Pinned Bottom Action Container */}
        <View style={styles.dockedFooter}>
          <TouchableOpacity
            style={[styles.submitBtn, isVerifying && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isVerifying}
            activeOpacity={0.88}
          >
            {isVerifying ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitBtnText}>Authenticating...</Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Authenticate & Proceed</Text>
                <Ionicons name="arrow-forward" size={17} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.trustBadgeRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={Colors.muted} />
            <Text style={styles.trustBadgeText}>
              256-Bit TLS · Anti-Tamper · Biometric / Camera Verified
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Department Picker Bottom Sheet Modal */}
      <Modal
        visible={deptModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Department</Text>
                <Text style={styles.modalSubtitle}>
                  Choose your designated academic branch
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDeptModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={Colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Department Search */}
            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={16} color={Colors.slate400} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search department or code (e.g. CSE)..."
                placeholderTextColor={Colors.slate400}
                value={deptSearch}
                onChangeText={setDeptSearch}
              />
              {deptSearch ? (
                <TouchableOpacity onPress={() => setDeptSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.slate400} />
                </TouchableOpacity>
              ) : null}
            </View>

            {deptLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
            ) : filteredDepartments.length === 0 ? (
              <Text style={styles.noDeptText}>No matching departments found.</Text>
            ) : (
              <FlatList
                data={filteredDepartments}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedDept?.id === item.id;
                  const isTech = (item.category || '').toUpperCase() !== 'NON_TECHNICAL';
                  return (
                    <TouchableOpacity
                      style={[
                        styles.deptItem,
                        isSelected && styles.deptItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedDept(item);
                        setErrors((e) => ({ ...e, dept: '' }));
                        setTouched((t) => ({ ...t, dept: true }));
                        setDeptModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.deptItemContent}>
                        <View style={[styles.deptIconBadge, isTech ? styles.deptIconTech : styles.deptIconNonTech]}>
                          <Ionicons
                            name={isTech ? 'terminal' : 'briefcase'}
                            size={14}
                            color={isTech ? Colors.primary : Colors.accentGold}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.deptItemText,
                              isSelected && styles.deptItemTextSelected,
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text style={styles.deptCodeText}>
                            {item.code} · {isTech ? 'Technical Track' : 'Non-Technical Track'}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.ink,
    letterSpacing: -0.4,
  },
  proctorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  proctorPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 0.5,
  },
  contentBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryPale,
    borderWidth: 1,
    borderColor: 'rgba(1, 120, 70, 0.25)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  resumeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  resumeSub: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 1,
  },
  formHeader: {
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  formSubtitle: {
    fontSize: 13,
    color: Colors.muted,
    marginTop: 3,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 3,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.inkSecondary,
  },
  req: {
    color: Colors.error,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 48,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryPale,
  },
  inputError: {
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorLight,
  },
  inputIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.ink,
    paddingVertical: 0,
    fontWeight: '500',
  },
  pickerWrap: {
    justifyContent: 'space-between',
  },
  pickerText: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.ink,
    fontWeight: '500',
  },
  placeholderText: {
    color: Colors.slate400,
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.errorText,
    marginTop: 3,
    fontWeight: '600',
  },
  serverErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    borderRadius: Radius.sm,
    padding: 10,
    marginBottom: Spacing.md,
  },
  serverErrorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.errorText,
    fontWeight: '600',
  },
  dockedFooter: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.lineSubtle,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    height: 50,
    ...Shadow.primaryBtn,
  },
  submitBtnDisabled: {
    opacity: 0.75,
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
  },
  trustBadgeText: {
    fontSize: 10,
    color: Colors.mutedLight,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.ink,
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: Colors.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: Spacing.md,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.ink,
    paddingVertical: 0,
  },
  noDeptText: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
    marginVertical: 32,
  },
  deptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: 5,
    backgroundColor: Colors.slate50,
  },
  deptItemSelected: {
    backgroundColor: Colors.primaryPale,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  deptItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deptIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptIconTech: {
    backgroundColor: Colors.primaryLight,
  },
  deptIconNonTech: {
    backgroundColor: Colors.accentGoldLight,
  },
  deptItemText: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: '600',
  },
  deptItemTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  deptCodeText: {
    fontSize: 10.5,
    color: Colors.muted,
    marginTop: 1,
  },
});
