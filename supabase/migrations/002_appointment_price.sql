-- Add optional price override per appointment
-- NULL means use the treatment type's default price
ALTER TABLE appointments ADD COLUMN price DECIMAL(10, 2) DEFAULT NULL;

-- Add optional discount percentage per patient (0-100)
-- Applied automatically when creating appointments, can still be overridden per appointment
ALTER TABLE patients ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100);
