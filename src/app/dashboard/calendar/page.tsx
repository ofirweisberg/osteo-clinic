import { createClient } from "@/lib/supabase/server";
import { WeeklyCalendar } from "./weekly-calendar";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [patientsRes, treatmentsRes, settingsRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name, phone")
      .order("full_name"),
    supabase
      .from("treatment_types")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    supabase.from("practice_settings").select("*").single(),
  ]);

  return (
    <WeeklyCalendar
      patients={patientsRes.data ?? []}
      treatmentTypes={treatmentsRes.data ?? []}
      workingHours={
        (settingsRes.data?.working_hours as Record<
          string,
          { start: string; end: string; enabled: boolean }
        >) ?? {}
      }
    />
  );
}
