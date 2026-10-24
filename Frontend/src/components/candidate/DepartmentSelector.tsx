import { useState, useEffect } from "react";
import { getEligibleDepartments, type DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number) => void;
  error?: string;
  disabled?: boolean;
}

const PRIMARY_DEPARTMENTS: DepartmentDto[] = [
  { id: 1, name: "Technical Department", code: "TECH", active: true },
  { id: 2, name: "Non-Technical Department", code: "NON_TECH", active: true }
];

export default function DepartmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>(PRIMARY_DEPARTMENTS);
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
        // Silently retain primary departments without displaying offline server error
        if (!isCancelled) {
          setDepartments(PRIMARY_DEPARTMENTS);
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

  const safeDepts = Array.isArray(departments) && departments.length > 0 ? departments : PRIMARY_DEPARTMENTS;

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
          Select Department
        </option>
        {safeDepts.map((dept) => (
          <option key={dept.id || dept.code} value={dept.name}>
            {dept.name}
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

