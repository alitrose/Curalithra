-- CURALITHRA Web Edition — PostgreSQL Relational Schema (Flyway V1)

CREATE SEQUENCE IF NOT EXISTS seq_patient_code START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_doctor_code START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_appointment_code START WITH 2001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_record_code START WITH 3001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE departments (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    description VARCHAR(500),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE doctors (
    id                    BIGSERIAL PRIMARY KEY,
    doctor_code           VARCHAR(32)    NOT NULL UNIQUE,
    full_name             VARCHAR(150)   NOT NULL,
    specialization        VARCHAR(120)   NOT NULL,
    department_id         BIGINT         NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    phone                 VARCHAR(30)    NOT NULL,
    email                 VARCHAR(160)   NOT NULL UNIQUE,
    qualification         VARCHAR(200)   NOT NULL,
    experience_years      INTEGER        NOT NULL CHECK (experience_years >= 0 AND experience_years <= 75),
    availability_schedule VARCHAR(200)   NOT NULL,
    consultation_fee      NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
    active                BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id               BIGSERIAL PRIMARY KEY,
    username         VARCHAR(64)  NOT NULL UNIQUE,
    full_name        VARCHAR(150) NOT NULL,
    email            VARCHAR(160) UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(24)  NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'RECEPTIONIST')),
    linked_doctor_id BIGINT REFERENCES doctors(id) ON DELETE SET NULL,
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at    TIMESTAMPTZ
);

CREATE TABLE patients (
    id                BIGSERIAL PRIMARY KEY,
    patient_code      VARCHAR(32)  NOT NULL UNIQUE,
    full_name         VARCHAR(150) NOT NULL,
    date_of_birth     DATE         NOT NULL,
    gender            VARCHAR(16)  NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    phone             VARCHAR(30)  NOT NULL UNIQUE,
    email             VARCHAR(160),
    address           VARCHAR(500),
    blood_group       VARCHAR(16)  NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown')),
    emergency_contact VARCHAR(200),
    bp                VARCHAR(40),
    sugar             VARCHAR(40),
    weight_kg         VARCHAR(40),
    height_cm         VARCHAR(40),
    registered_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE appointments (
    id               BIGSERIAL PRIMARY KEY,
    appointment_code VARCHAR(32)  NOT NULL UNIQUE,
    patient_id       BIGINT       NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id        BIGINT       NOT NULL REFERENCES doctors(id)  ON DELETE RESTRICT,
    appointment_date DATE         NOT NULL,
    appointment_time TIME         NOT NULL,
    duration_minutes INTEGER      NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    reason           VARCHAR(500) NOT NULL,
    status           VARCHAR(24)  NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE medical_records (
    id             BIGSERIAL PRIMARY KEY,
    record_code    VARCHAR(32) NOT NULL UNIQUE,
    patient_id     BIGINT      NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id      BIGINT      NOT NULL REFERENCES doctors(id)  ON DELETE RESTRICT,
    appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
    visit_date     DATE        NOT NULL,
    symptoms       TEXT        NOT NULL,
    diagnosis      TEXT        NOT NULL,
    treatment      TEXT        NOT NULL,
    vitals_bp      VARCHAR(40),
    vitals_temp    VARCHAR(40),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prescriptions (
    id                BIGSERIAL PRIMARY KEY,
    medical_record_id BIGINT       NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    patient_id        BIGINT       NOT NULL REFERENCES patients(id)        ON DELETE RESTRICT,
    doctor_id         BIGINT       NOT NULL REFERENCES doctors(id)         ON DELETE RESTRICT,
    medication_name   VARCHAR(200) NOT NULL,
    dosage            VARCHAR(100) NOT NULL,
    frequency         VARCHAR(120) NOT NULL,
    duration_days     INTEGER      NOT NULL CHECK (duration_days > 0),
    instructions      VARCHAR(500),
    status            VARCHAR(24)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISPENSED', 'COMPLETED')),
    prescribed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE bills (
    id             BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(40)    NOT NULL UNIQUE,
    patient_id     BIGINT         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
    subtotal       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_rate       NUMERIC(6, 4)  NOT NULL DEFAULT 0.0500 CHECK (tax_rate >= 0),
    tax_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    payment_status VARCHAR(24)    NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PAID', 'PENDING', 'PARTIALLY_PAID', 'CANCELLED')),
    notes          TEXT,
    issued_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE bill_items (
    id          BIGSERIAL PRIMARY KEY,
    bill_id     BIGINT         NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description VARCHAR(250)   NOT NULL,
    category    VARCHAR(80)    NOT NULL,
    quantity    INTEGER        NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total  NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE payments (
    id             BIGSERIAL PRIMARY KEY,
    bill_id        BIGINT         NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(24)    NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE')),
    reference_no   VARCHAR(120),
    paid_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    received_by    BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE activity_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username    VARCHAR(64),
    action_type VARCHAR(40)  NOT NULL,
    entity_type VARCHAR(40)  NOT NULL,
    entity_id   VARCHAR(64),
    summary     VARCHAR(600) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes for fast clinical lookup, reporting & double-booking protection
CREATE INDEX idx_patients_name ON patients (full_name);
CREATE INDEX idx_patients_reg_date ON patients (registered_at);
CREATE INDEX idx_doctors_spec ON doctors (specialization);
CREATE INDEX idx_appointments_date ON appointments (appointment_date);
CREATE INDEX idx_appointments_patient ON appointments (patient_id);
CREATE INDEX idx_appointments_doctor ON appointments (doctor_id);
CREATE UNIQUE INDEX idx_appointments_doctor_slot
    ON appointments (doctor_id, appointment_date, appointment_time)
    WHERE status NOT IN ('CANCELLED', 'NO_SHOW');
CREATE INDEX idx_med_records_patient ON medical_records (patient_id);
CREATE INDEX idx_prescriptions_record ON prescriptions (medical_record_id);
CREATE INDEX idx_bills_patient ON bills (patient_id);
CREATE INDEX idx_bills_status ON bills (payment_status);
CREATE INDEX idx_bills_issued_at ON bills (issued_at);
CREATE INDEX idx_activity_created ON activity_logs (created_at DESC);
