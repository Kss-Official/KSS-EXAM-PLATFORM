import { useState, useEffect } from "react";
import { getEligibleDepartments, type DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number) => void;
  error?: string;
  disabled?: boolean;
}

export default function DepartmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchDepartments = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getEligibleDepartments();
        if (!isCancelled) {
          setDepartments(Array.isArray(data) ? data : []);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const errorObj = err as Error;
          setLoadError("Failed to fetch active exam departments: " + errorObj.message);
          setDepartments([]);
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

  const safeDepts = Array.isArray(departments) ? departments : [];

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
          {loading ? "-- Loading Active Departments... --" : "-- Select Department --"}
        </option>
        {safeDepts.map((dept) => (
          <option key={dept.id} value={dept.name}>
            {dept.name} ({dept.code})
          </option>
        ))}
      </select>

      {error && (
        <span className="inline-validation-error" role="alert">
          {error}
        </span>
      )}

      {loadError && (
        <span style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px", display: "block" }}>
          {loadError}
        </span>
      )}

      {!loading && departments.length === 0 && !loadError && (
        <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
          Notice: No examinations are currently published. Departments appear only when an exam is published by the administrator.
        </span>
      )}
    </div>
  );
}
