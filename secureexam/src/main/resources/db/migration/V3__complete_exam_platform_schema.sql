-- Flyway Migration V3: Complete Exam Platform Schema
-- Adds Departments, Exam Enhancements, Randomization Sequences, Document Storage, and Audit Logs

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(active);

-- 2. Exam - Department Many-to-Many Mapping
CREATE TABLE IF NOT EXISTS exam_departments (
    exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, department_id)
);

-- 3. Enhance Exams Table with qualification rules, timing modes, and marks
ALTER TABLE exams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS qualification_mode VARCHAR(20) DEFAULT 'PERCENTAGE';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS qualification_threshold NUMERIC(6,2) DEFAULT 60.00;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS timing_mode VARCHAR(30) DEFAULT 'DURATION_FROM_START';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS total_marks NUMERIC(8,2) DEFAULT 100.00;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(6,2) DEFAULT 1.00;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(6,2) DEFAULT 0.00;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS results_published BOOLEAN DEFAULT FALSE;

-- 4. Enhance Candidates Table with department and status
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- 5. Enhance Exam Attempts Table with qualification, marks, and receipt
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS total_marks NUMERIC(8,2);
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS percentage NUMERIC(6,2);
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS receipt_id VARCHAR(64);

-- 6. Per-Candidate Attempt Randomized Questions
CREATE TABLE IF NOT EXISTS attempt_randomized_questions (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    display_order INT NOT NULL,
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id),
    CONSTRAINT uq_attempt_question_order UNIQUE (attempt_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_random_q_attempt ON attempt_randomized_questions(attempt_id, display_order);

-- 7. Per-Candidate Attempt Randomized Options
CREATE TABLE IF NOT EXISTS attempt_randomized_options (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_id BIGINT NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
    display_order INT NOT NULL,
    display_label VARCHAR(5) NOT NULL,
    CONSTRAINT uq_attempt_option UNIQUE (attempt_id, option_id),
    CONSTRAINT uq_attempt_option_order UNIQUE (attempt_id, question_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_random_opt_attempt ON attempt_randomized_options(attempt_id, question_id, display_order);

-- 8. Stored Documents Table (Confidential PDFs, TXT, Answer Keys)
CREATE TABLE IF NOT EXISTS stored_documents (
    id BIGSERIAL PRIMARY KEY,
    exam_id BIGINT REFERENCES exams(id) ON DELETE CASCADE,
    department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    question_set_id BIGINT REFERENCES question_sets(id) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL, -- QUESTION_PAPER, ANSWER_KEY
    original_filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT NOT NULL,
    sha256_checksum VARCHAR(64),
    uploading_admin_id BIGINT,
    validation_status VARCHAR(50) DEFAULT 'PENDING',
    version_number INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stored_docs_exam ON stored_documents(exam_id);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    performed_by VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
