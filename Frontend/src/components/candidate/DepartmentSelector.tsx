import { useState, useEffect } from "react";
import { getEligibleDepartments, type DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number) => void;
  error?: string;
  disabled?: boolean;
}

const DEFAULT_DEPARTMENTS: DepartmentDto[] = [
  { id: 1, name: "Developer", code: "DEV", active: true },
  { id: 2, name: "Tester", code: "QA", active: true },
  { id: 3, name: "Computer Science & Engineering", code: "CSE", active: true },
  { id: 4, name: "Information Technology", code: "IT", active: true },
  { id: 5, name: "Electronics & Communication Engineering", code: "ECE", active: true },
  { id: 6, name: "Electrical & Electronics Engineering", code: "EEE", active: true },
  { id: 7, name: "UI/UX", code: "UIUX", active: true },
  { id: 8, name: "Marketing", code: "MKT", active: true },
  { id: 9, name: "HR", code: "HR", active: true }
];

export default function DepartmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const fetchDepartments = async () => {
      setLoading(true);
      try {
        const data = await getEligibleDepartments();
        if (!isCancelled && Array.isArray(data) && data.length > 0) {
          setDepartments(data);
        }
      } catch {
        // Silently retain default departments without displaying offline server error
        if (!isCancelled) {
          setDepartments(DEFAULT_DEPARTMENTS);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDepartments();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const matched = Array.isArray(departments) ? departments.find(d => d.name === selectedName) : undefined;
    onChange(selectedName, matched ? matched.id : undefined);
  };

  const safeDepts = Array.isArray(departments) && departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  return (
    <div className="dept-field-wrapper">
      <select
        id="department-select"
        value={value}
        onChange={handleChange}
        disabled={disabled || loading}
        className={`dept-select ${error ? "input-error" : ""}`}
        aria-label="Select your department"
        aria-required="true"
      >
        <option value="" disabled>
          -- Select Department --
        </option>
        {safeDepts.map((dept) => (
          <option key={dept.id || dept.code} value={dept.name}>
            {dept.name} ({dept.code})
          </option>
        ))}
      </select>

      {error && (
        <span className="inline-validation-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
