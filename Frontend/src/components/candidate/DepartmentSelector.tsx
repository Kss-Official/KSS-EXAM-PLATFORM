import { useState, useEffect } from "react";
import { getCandidateDepartments, type DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number, category?: "TECHNICAL" | "NON_TECHNICAL") => void;
  error?: string;
  disabled?: boolean;
}

export const FALLBACK_DEPARTMENTS: DepartmentDto[] = [
  { id: 3, name: "Computer Science & Engineering (CSE)", code: "CSE", category: "TECHNICAL", active: true },
  { id: 19, name: "Information Science & Engineering (ISE)", code: "ISE", category: "TECHNICAL", active: true },
  { id: 20, name: "Master of Computer Applications (MCA)", code: "MCA", category: "TECHNICAL", active: true },
  { id: 4, name: "Information Technology (IT)", code: "IT", category: "TECHNICAL", active: true },
  { id: 17, name: "AI & Machine Learning (CSE-AIML)", code: "CSE-AIML", category: "TECHNICAL", active: true },
  { id: 22, name: "Data Science (CSE-DS)", code: "CSE-DS", category: "TECHNICAL", active: true },
  { id: 18, name: "IoT & Cyber Security (CSE-IOT)", code: "CSE-IOT", category: "TECHNICAL", active: true }
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
    const cat = matched 
      ? ((matched.category || "").toUpperCase() === "NON_TECHNICAL" ? "NON_TECHNICAL" : "TECHNICAL") 
      : undefined;
    onChange(selectedName, matched ? matched.id : undefined, cat);
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


