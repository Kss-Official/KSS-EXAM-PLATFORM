import type { DepartmentDto } from "../../services/api";

interface DepartmentSelectorProps {
  value: string;
  onChange: (deptName: string, deptId?: number) => void;
  error?: string;
  disabled?: boolean;
}

export const PRIMARY_DEPARTMENTS: DepartmentDto[] = [
  { id: 1, name: "Technical Department", code: "TECH", active: true },
  { id: 2, name: "Non-Technical Department", code: "NON_TECH", active: true }
];

export default function DepartmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: DepartmentSelectorProps) {
  const departments = PRIMARY_DEPARTMENTS;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const matched = departments.find(d => d.name === selectedName);
    onChange(selectedName, matched ? matched.id : undefined);
  };

  const safeDepts = PRIMARY_DEPARTMENTS;

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
          Select Department
        </option>
        {safeDepts.map((dept, idx) => (
          <option key={`${dept.id || 'dept'}-${dept.code || 'code'}-${idx}`} value={dept.name}>
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

