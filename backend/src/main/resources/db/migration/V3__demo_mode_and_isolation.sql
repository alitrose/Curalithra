-- CURALITHRA Horizon Edition — Public Demo Isolation Schema Governance (Flyway V3)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Replace global uniqueness with scope-aware uniqueness so demo and non-demo workspaces never collide
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_email_key;
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_name_demo ON departments (LOWER(name), is_demo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_code_demo ON departments (LOWER(code), is_demo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_doctors_email_demo ON doctors (LOWER(email), is_demo);
CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_phone_demo ON patients (phone, is_demo);

CREATE INDEX IF NOT EXISTS idx_users_demo ON users (is_demo);
CREATE INDEX IF NOT EXISTS idx_departments_demo ON departments (is_demo);
CREATE INDEX IF NOT EXISTS idx_doctors_demo ON doctors (is_demo);
CREATE INDEX IF NOT EXISTS idx_patients_demo ON patients (is_demo);
CREATE INDEX IF NOT EXISTS idx_appointments_demo ON appointments (is_demo);
CREATE INDEX IF NOT EXISTS idx_med_records_demo ON medical_records (is_demo);
CREATE INDEX IF NOT EXISTS idx_prescriptions_demo ON prescriptions (is_demo);
CREATE INDEX IF NOT EXISTS idx_bills_demo ON bills (is_demo);
CREATE INDEX IF NOT EXISTS idx_activity_logs_demo ON activity_logs (is_demo, created_at DESC);
