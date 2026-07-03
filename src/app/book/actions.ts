"use server";

import { query, queryOne } from "@/lib/db";

/**
 * Public (anonymous) server actions for the self-service booking wizard.
 *
 * These replace the Supabase anon-key reads that were previously governed by
 * RLS. There is intentionally NO auth guard here, but each query enforces the
 * exact constraints the old anon RLS policies allowed — nothing more:
 *  - treatment_types: only rows WHERE is_active = true
 *  - practice_settings: readable (only the fields the wizard uses)
 *  - appointments: only status IN ('pending','confirmed'), and ONLY the
 *    starts_at/ends_at times — never patient data
 *  - schedule_blocks: readable (availability)
 */

export interface PublicPracticeSettings {
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
  working_hours: Record<
    string,
    { start: string; end: string; enabled: boolean }
  >;
  booking_window_days: number;
}

export interface PublicTreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

export interface PublicScheduleBlock {
  block_type: string;
  starts_at: string | null;
  ends_at: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  exception_dates: string[];
}

export interface PublicAppointmentSlot {
  starts_at: string;
  ends_at: string;
}

export async function getPracticeSettings(): Promise<PublicPracticeSettings | null> {
  try {
    return await queryOne<PublicPracticeSettings>(
      `SELECT practice_name, practitioner_name, phone, address,
              working_hours, booking_window_days
       FROM practice_settings
       LIMIT 1`
    );
  } catch (err) {
    console.error("getPracticeSettings error:", err);
    return null;
  }
}

export async function getActiveTreatmentTypes(): Promise<
  PublicTreatmentType[]
> {
  try {
    return await query<PublicTreatmentType>(
      `SELECT id, name, duration_minutes, price, color
       FROM treatment_types
       WHERE is_active = true
       ORDER BY name`
    );
  } catch (err) {
    console.error("getActiveTreatmentTypes error:", err);
    return [];
  }
}

export async function getScheduleBlocks(): Promise<PublicScheduleBlock[]> {
  try {
    return await query<PublicScheduleBlock>(
      `SELECT block_type, starts_at, ends_at, day_of_week,
              start_time, end_time, exception_dates
       FROM schedule_blocks`
    );
  } catch (err) {
    console.error("getScheduleBlocks error:", err);
    return [];
  }
}

/**
 * Busy time ranges for a given day — used only for availability calculation.
 * Returns ONLY starts_at/ends_at (no patient info), and ONLY pending/confirmed
 * appointments, mirroring the old anon RLS policy.
 */
export async function getAppointmentsForDate(
  dateStr: string
): Promise<PublicAppointmentSlot[]> {
  // Expect "YYYY-MM-DD" — reject anything else.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];

  try {
    return await query<PublicAppointmentSlot>(
      `SELECT starts_at, ends_at
       FROM appointments
       WHERE starts_at >= $1::timestamptz
         AND starts_at <= $2::timestamptz
         AND status IN ('pending', 'confirmed')`,
      [`${dateStr}T00:00:00`, `${dateStr}T23:59:59`]
    );
  } catch (err) {
    console.error("getAppointmentsForDate error:", err);
    return [];
  }
}
