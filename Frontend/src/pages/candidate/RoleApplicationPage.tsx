import { useState, useRef, useEffect } from "react";
import { 
  Briefcase, 
  Search, 
  X, 
  RotateCcw, 
  GraduationCap, 
  Calendar, 
  ChevronDown, 
  ArrowLeft, 
  ArrowRight,
  AlertCircle
} from "lucide-react";
import type { CandidateProfile } from "../../types/candidate";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";
import "../../styles/roleApplication.css";

interface RoleApplicationPageProps {
  profile: CandidateProfile;
  onBack: () => void;
  onContinue: (updatedProfile: CandidateProfile) => void;
}

const JOB_ROLES = [
  "Software Development Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps & Cloud Engineer",
  "Data Analyst / Data Engineer",
  "Quality Assurance Engineer",
  "UI/UX Designer",
  "Technical Consultant"
];

const SUGGESTED_SKILLS = [
  "Java", "Python", "JavaScript", "C++", "React", "HTML/CSS", 
  "Node.js", "SQL", "Git", "Spring Boot", "Docker", "AWS", 
  "Linux", "Kubernetes", "TypeScript", "MongoDB"
];

const GRADUATION_YEARS = [
  "2024", "2025", "2026", "2027", "2028", "2029"
];

export default function RoleApplicationPage({
  profile,
  onBack,
  onContinue
}: RoleApplicationPageProps) {
  const [jobRole, setJobRole] = useState(profile.jobRole || "");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    profile.skills && profile.skills.length > 0 
      ? profile.skills 
      : ["Java", "Python", "React"]
  );
  const [skillSearchText, setSkillSearchText] = useState("");
  
  const [degreeBranch, setDegreeBranch] = useState(profile.degreeBranch || "");
  
  const [graduationYear, setGraduationYear] = useState(profile.graduationYear || "");
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRoleDropdownOpen(false);
        setIsYearDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter(s => s !== skill));
  };

  const handleClearAllSkills = () => {
    setSelectedSkills([]);
  };

  const handleSkillInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillSearchText.trim()) {
      e.preventDefault();
      const trimmed = skillSearchText.trim();
      if (!selectedSkills.includes(trimmed)) {
        setSelectedSkills([...selectedSkills, trimmed]);
      }
      setSkillSearchText("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole) {
      setErrorMessage("Please select the job role you are applying for.");
      return;
    }

    setErrorMessage(null);
    onContinue({
      ...profile,
      jobRole,
      skills: selectedSkills,
      degreeBranch,
      graduationYear
    });
  };

  return (
    <div className="role-app-page">
      <div className="role-app-container">
        {/* Top Header Logo */}
        <header className="role-app-header">
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            className="role-app-logo"
          />
        </header>

        {/* Hero Header */}
        <div className="role-app-hero">
          <h1 className="role-app-hero-title">
            Role & Application <span className="highlight">Details</span>
          </h1>
          <p className="role-app-hero-desc">
            Tell us more about the role you are applying for. This information helps us match you with the right opportunity.
          </p>
        </div>

        {/* Main Application Card */}
        <div className="role-app-card">
          {/* Card Header */}
          <div className="role-app-card-header">
            <div className="role-app-card-icon">
              <Briefcase size={20} />
            </div>
            <div>
              <h2 className="role-app-card-title">Application Information</h2>
              <p className="role-app-card-subtitle">
                Provide the details below to continue to the next step.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="role-app-error">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="role-app-form" onSubmit={handleSubmit}>
            {/* Row 1: Job Role Applying For * */}
            <div className="role-app-row">
              <div className="role-app-col-label">
                <div className="role-app-label-line">
                  <label htmlFor="role-select" className="role-app-label">
                    Job Role Applying For <span className="role-app-required">*</span>
                  </label>
                </div>
                <p className="role-app-desc">Select the role you are applying for.</p>
              </div>

              <div className="role-app-col-input">
                <div ref={roleDropdownRef} style={{ position: "relative", width: "100%" }}>
                  <div
                    id="role-select"
                    role="button"
                    tabIndex={0}
                    className={`role-app-select-trigger ${isRoleDropdownOpen ? "open" : ""}`}
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsRoleDropdownOpen(!isRoleDropdownOpen);
                      }
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isRoleDropdownOpen}
                  >
                    <Briefcase size={17} className="role-app-input-icon" />
                    <span className={`role-app-select-val ${jobRole ? "filled" : "placeholder"}`}>
                      {jobRole || "Select Job Role"}
                    </span>
                    <ChevronDown size={17} className={`role-app-chevron ${isRoleDropdownOpen ? "rotated" : ""}`} />
                  </div>

                  {isRoleDropdownOpen && (
                    <div className="role-app-dropdown-menu" role="listbox">
                      {JOB_ROLES.map(role => (
                        <div
                          key={role}
                          role="option"
                          aria-selected={jobRole === role}
                          className={`role-app-dropdown-item ${jobRole === role ? "selected" : ""}`}
                          onClick={() => {
                            setJobRole(role);
                            setIsRoleDropdownOpen(false);
                            setErrorMessage(null);
                          }}
                        >
                          {role}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Primary Skills (Optional) */}
            <div className="role-app-row">
              <div className="role-app-col-label">
                <div className="role-app-label-line">
                  <label className="role-app-label">Primary Skills</label>
                  <span className="role-app-badge-optional">Optional</span>
                </div>
                <p className="role-app-desc">
                  Select the skills that best match your strengths. You can choose multiple skills.
                </p>
              </div>

              <div className="role-app-col-input">
                {/* Multi-skill Input Box */}
                <div className="role-app-skills-box">
                  <Search size={16} className="role-app-input-icon" style={{ marginRight: "6px" }} />

                  {selectedSkills.map(skill => (
                    <span key={skill} className="role-app-skill-chip">
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="role-app-skill-chip-remove"
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}

                  <input
                    type="text"
                    placeholder={selectedSkills.length === 0 ? "Search or select skills..." : ""}
                    value={skillSearchText}
                    onChange={(e) => setSkillSearchText(e.target.value)}
                    onKeyDown={handleSkillInputKeyDown}
                    className="role-app-skills-input"
                    aria-label="Search or add skill"
                    style={{ outline: "none", border: "none", boxShadow: "none" }}
                  />
                </div>

                {/* Suggested Skills Section */}
                <div className="role-app-suggested-header">
                  <div>
                    <strong className="role-app-suggested-title">Suggested Skills</strong>
                    <span className="role-app-suggested-sub">
                      Click on the skills below to add them to the field above.
                    </span>
                  </div>
                  {selectedSkills.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSkills}
                      className="role-app-clear-btn"
                    >
                      <RotateCcw size={12} /> Clear All
                    </button>
                  )}
                </div>

                {/* Suggested Skills Pill Cloud */}
                <div className="role-app-pills-cloud">
                  {SUGGESTED_SKILLS.map(skill => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleToggleSkill(skill)}
                        className={`role-app-pill ${isSelected ? "active" : ""}`}
                        aria-pressed={isSelected}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 3: Degree / Branch */}
            <div className="role-app-row">
              <div className="role-app-col-label">
                <div className="role-app-label-line">
                  <label htmlFor="degree-input" className="role-app-label">
                    Degree / Branch
                  </label>
                </div>
                <p className="role-app-desc">
                  Enter your current degree and branch (e.g., B.E. Computer Science).
                </p>
              </div>

              <div className="role-app-col-input">
                <div className="role-app-input-wrap">
                  <GraduationCap size={18} className="role-app-input-icon" />
                  <input
                    id="degree-input"
                    type="text"
                    placeholder="e.g., B.E. Computer Science and Engineering"
                    value={degreeBranch}
                    onChange={(e) => setDegreeBranch(e.target.value)}
                    className="role-app-text-input"
                    style={{ outline: "none", border: "none", boxShadow: "none" }}
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Graduation Year */}
            <div className="role-app-row">
              <div className="role-app-col-label">
                <div className="role-app-label-line">
                  <label htmlFor="year-select" className="role-app-label">
                    Graduation Year
                  </label>
                </div>
                <p className="role-app-desc">Select your expected year of graduation.</p>
              </div>

              <div className="role-app-col-input">
                <div ref={yearDropdownRef} style={{ position: "relative", width: "100%" }}>
                  <div
                    id="year-select"
                    role="button"
                    tabIndex={0}
                    className={`role-app-select-trigger ${isYearDropdownOpen ? "open" : ""}`}
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsYearDropdownOpen(!isYearDropdownOpen);
                      }
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isYearDropdownOpen}
                  >
                    <Calendar size={17} className="role-app-input-icon" />
                    <span className={`role-app-select-val ${graduationYear ? "filled" : "placeholder"}`}>
                      {graduationYear || "Select Graduation Year"}
                    </span>
                    <ChevronDown size={17} className={`role-app-chevron ${isYearDropdownOpen ? "rotated" : ""}`} />
                  </div>

                  {isYearDropdownOpen && (
                    <div className="role-app-dropdown-menu" role="listbox">
                      {GRADUATION_YEARS.map(year => (
                        <div
                          key={year}
                          role="option"
                          aria-selected={graduationYear === year}
                          className={`role-app-dropdown-item ${graduationYear === year ? "selected" : ""}`}
                          onClick={() => {
                            setGraduationYear(year);
                            setIsYearDropdownOpen(false);
                          }}
                        >
                          {year}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hidden submit trigger */}
            <button type="submit" style={{ display: "none" }} />
          </form>
        </div>

        {/* Action Buttons Aligned with Container */}
        <div className="role-app-actions">
          <button
            type="button"
            onClick={onBack}
            className="role-app-btn-back"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="role-app-btn-continue"
          >
            <span>Continue to Device Compatibility Check</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
