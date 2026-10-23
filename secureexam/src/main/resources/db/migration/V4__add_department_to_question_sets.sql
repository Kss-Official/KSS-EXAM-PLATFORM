-- Flyway Migration V4: Add Department to Question Sets
-- Supports department-wise independent 4-set question banks

ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE CASCADE;

-- Backfill department_id for existing question sets from exam_departments if available
UPDATE question_sets qs
SET department_id = (
    SELECT ed.department_id FROM exam_departments ed WHERE ed.exam_id = qs.exam_id LIMIT 1
)
WHERE qs.department_id IS NULL AND EXISTS (
    SELECT 1 FROM exam_departments ed WHERE ed.exam_id = qs.exam_id
);

-- Drop previous unique constraint on (exam_id, set_code) to allow multiple departments to each have Sets A, B, C, D
ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS question_sets_exam_id_set_code_key;
ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS uq_question_sets_exam_set;

-- Create index and unique constraint on (exam_id, department_id, set_code)
CREATE INDEX IF NOT EXISTS idx_question_sets_dept ON question_sets(exam_id, department_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_dept_set ON question_sets(exam_id, department_id, set_code);
