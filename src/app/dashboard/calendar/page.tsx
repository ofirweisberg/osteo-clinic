import { query, queryOne } from "@/lib/db";
import { WeeklyCalendar } from "./weekly-calendar";

interface PatientRow {
  id: string;
  full_name: string;
  phone: string;
  discount_percent: number;
}

interface TreatmentTypeRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  is_active: boolean;
  created_at: string;
}

interface SettingsRow {
  working_hours: Record<string, { start: string; end: string; enabled: boolean }>;
}

export default async function CalendarPage() {
  const [patients, treatmentTypes, settings] = await Promise.all([
    query<PatientRow>(
      `SELECT id, full_name, phone, discount_percent FROM patients ORDER BY full_name ASC`
    ),
    query<TreatmentTypeRow>(
      `SELECT * FROM treatment_types WHERE is_active = true ORDER BY name ASC`
    ),
    queryOne<SettingsRow>(`SELECT * FROM practice_settings LIMIT 1`),
  ]);

  return (
    <WeeklyCalendar
      patients={patients}
      treatmentTypes={treatmentTypes}
      workingHours={settings?.working_hours ?? {}}
    />
  );
}
