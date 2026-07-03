import { query, queryOne } from "@/lib/db";
import { SettingsForm } from "./settings-form";
import { TreatmentTypes } from "./treatment-types";
import { WhatsAppStatus } from "./whatsapp-status";

interface PracticeSettings {
  id: string;
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
  working_hours: Record<
    string,
    { start: string; end: string; enabled: boolean }
  >;
  booking_window_days: number;
  reminder_hours_before: number;
  created_at: string;
  updated_at: string;
}

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  is_active: boolean;
  created_at: string;
}

export default async function SettingsPage() {
  const [settings, treatments] = await Promise.all([
    queryOne<PracticeSettings>("SELECT * FROM practice_settings LIMIT 1"),
    query<TreatmentType>(
      "SELECT * FROM treatment_types ORDER BY created_at ASC"
    ),
  ]);

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">הגדרות מרפאה</h2>

      <div className="flex flex-col gap-8">
        <SettingsForm settings={settings} />
        <TreatmentTypes treatments={treatments ?? []} />
        <WhatsAppStatus />
      </div>
    </div>
  );
}
