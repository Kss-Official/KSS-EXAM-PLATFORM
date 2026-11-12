import { useState, useEffect } from "react";
import { getCandidateDepartments, type DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number) => void;
  error?: string;
  disabled?: boolean;
}

export const FALLBACK_DEPARTMENTS: DepartmentDto[] = [
  { id: 71, name: "Developer", code: "DEV", category: "TECHNICAL", active: true },
  { id: 72, name: "AI/ML Developer", code: "AIML", category: "TECHNICAL", active: true },
  { id: 73, name: "Computer Science and Engineering", code: "CSE", category: "TECHNICAL", active: true },
  { id: 74, name: "Information Technology", code: "IT", category: "TECHNICAL", active: true },
  { id: 75, name: "Electronics & Communication Engineering", code: "ECE", category: "TECHNICAL", active: true },
  { id: 76, name: "Electrical & Electronics Engineering", code: "EEE", category: "TECHNICAL", active: true },
  { id: 77, name: "Mechanical Engineering", code: "MECH", category: "TECHNICAL", active: true },
  { id: 78, name: "Civil Engineering", code: "CIVIL", category: "TECHNICAL", active: true },
  { id: 79, name: "Quality Assurance & Testing", code: "QA", category: "TECHNICAL", active: true },
  { id: 80, name: "DevOps", code: "DEVOPS", category: "TECHNICAL", active: true },
  { id: 81, name: "UI/UX Design & Product", code: "UIUX", category: "TECHNICAL", active: true },
  { id: 82, name: "Human Resources", code: "HR", category: "NON_TECHNICAL", active: true },
  { id: 83, name: "Sales & Marketing", code: "SALES_MKT", category: "NON_TECHNICAL", active: true }
];

export default function DepartmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>(FALLBACK_DEPARTMENTS);

  useEffect(() => {
    let mounted = true;
    getCandidateDepartments()
      .then(data => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setDepartments(data);
        }
      })
      .catch(() => {
        // Keep fallback list on network delay
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const matched = departments.find(d => d.name === selectedName);
    onChange(selectedName, matched ? matched.id : undefined);
  };

  const technicalDepts = departments.filter(d => (d.category || "").toUpperCase() !== "NON_TECHNICAL");
  const nonTechnicalDepts = departments.filter(d => (d.category || "").toUpperCase() === "NON_TECHNICAL");

  return (
    <div className="dept-field-wrapper">
      <select
        id="department-select"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`dept-select ${error ? "input-error" : ""}`}
        aria-label="Select your department"
        aria-required="true"
      >
        <option value="" disabled>
          Select Assigned Department
        </option>
        
        {technicalDepts.length > 0 && (
          <optgroup label="🛠️ Technical Departments">
            {technicalDepts.map((dept) => (
              <option key={`tech-${dept.id || dept.code}-${dept.name}`} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </optgroup>
        )}

        {nonTechnicalDepts.length > 0 && (
          <optgroup label="💼 Non-Technical Departments">
            {nonTechnicalDepts.map((dept) => (
              <option key={`nontech-${dept.id || dept.code}-${dept.name}`} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {error && (
        <span className="inline-validation-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}


