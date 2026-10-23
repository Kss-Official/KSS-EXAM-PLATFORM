-- Flyway Migration V5: Drop Hibernate Old Unique Constraint on (exam_id, set_code)
-- To allow department-wise independent Sets A, B, C, D across multiple departments

ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS ukrf0mu3bnnhocthehfd7iwx306;
