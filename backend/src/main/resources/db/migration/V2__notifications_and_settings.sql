-- CURALITHRA Web Edition — Notification Read State & Hospital Settings (Flyway V2)

CREATE TABLE notification_reads (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_key VARCHAR(100) NOT NULL,
    read_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, notification_key)
);

CREATE INDEX idx_notification_reads_user ON notification_reads (user_id);

CREATE TABLE hospital_settings (
    id                          BIGINT PRIMARY KEY,
    hospital_name               VARCHAR(160)   NOT NULL,
    tagline                     VARCHAR(240)   NOT NULL,
    default_tax_rate            NUMERIC(6, 4)  NOT NULL DEFAULT 0.0500 CHECK (default_tax_rate >= 0 AND default_tax_rate <= 1),
    default_appointment_minutes INTEGER        NOT NULL DEFAULT 30 CHECK (default_appointment_minutes >= 5 AND default_appointment_minutes <= 480),
    currency_code               VARCHAR(10)    NOT NULL DEFAULT 'INR',
    currency_symbol             VARCHAR(8)     NOT NULL DEFAULT '₹',
    support_email               VARCHAR(160),
    support_phone               VARCHAR(40),
    address                     VARCHAR(400),
    invoice_footer_note         VARCHAR(400),
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

INSERT INTO hospital_settings (
    id, hospital_name, tagline, default_tax_rate, default_appointment_minutes,
    currency_code, currency_symbol, support_email, support_phone, address, invoice_footer_note
) VALUES (
    1,
    'CURALITHRA Medical Center',
    'Care, Connected. Operations, Simplified.',
    0.0500,
    30,
    'INR',
    '₹',
    'care@curalithra.demo',
    '+91 800 555 0100',
    'Horizon Healthcare Campus, Sector 14',
    'Thank you for trusting CURALITHRA Horizon Edition. Retain this invoice for insurance and clinical follow-up.'
) ON CONFLICT (id) DO NOTHING;
