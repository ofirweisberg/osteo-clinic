-- Enums
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE appointment_source AS ENUM ('self_booked', 'manual');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid');

-- Patients
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patients_phone ON patients (phone);
CREATE INDEX idx_patients_full_name ON patients (full_name);

-- Treatment types
CREATE TABLE treatment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  treatment_type_id UUID NOT NULL REFERENCES treatment_types (id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  source appointment_source NOT NULL DEFAULT 'manual',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_patient ON appointments (patient_id);
CREATE INDEX idx_appointments_starts_at ON appointments (starts_at);
CREATE INDEX idx_appointments_status ON appointments (status);

-- Visit logs
CREATE TABLE visit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visit_logs_patient ON visit_logs (patient_id);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number SERIAL UNIQUE,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments (id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_at DATE,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_patient ON invoices (patient_id);
CREATE INDEX idx_invoices_status ON invoices (status);

-- Practice settings (single row)
CREATE TABLE practice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_name TEXT NOT NULL DEFAULT '',
  practitioner_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  working_hours JSONB NOT NULL DEFAULT '{
    "sunday": {"start": "09:00", "end": "18:00", "enabled": true},
    "monday": {"start": "09:00", "end": "18:00", "enabled": true},
    "tuesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "wednesday": {"start": "09:00", "end": "18:00", "enabled": true},
    "thursday": {"start": "09:00", "end": "18:00", "enabled": true},
    "friday": {"start": "09:00", "end": "14:00", "enabled": true},
    "saturday": {"start": "09:00", "end": "18:00", "enabled": false}
  }'::jsonb,
  booking_window_days INTEGER NOT NULL DEFAULT 30,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one practice_settings row
CREATE UNIQUE INDEX idx_practice_settings_singleton ON practice_settings ((true));

-- Insert default settings row
INSERT INTO practice_settings (practice_name, practitioner_name)
VALUES ('המרפאה שלי', '');

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER visit_logs_updated_at BEFORE UPDATE ON visit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER practice_settings_updated_at BEFORE UPDATE ON practice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_settings ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can do everything (single practitioner)
CREATE POLICY "Authenticated full access" ON patients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON treatment_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON visit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access" ON practice_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read access for booking page
CREATE POLICY "Public read treatment types" ON treatment_types
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Public read practice settings" ON practice_settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public read appointments for availability" ON appointments
  FOR SELECT TO anon USING (status IN ('pending', 'confirmed'));

-- Allow anonymous users to create appointments (self-booking) and patients
CREATE POLICY "Public insert appointments" ON appointments
  FOR INSERT TO anon WITH CHECK (source = 'self_booked');

CREATE POLICY "Public insert patients" ON patients
  FOR INSERT TO anon WITH CHECK (true);
