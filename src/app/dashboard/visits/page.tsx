import { createClient } from "@/lib/supabase/server";
import { VisitsList } from "./visits-list";

export default async function VisitsPage() {
  const supabase = await createClient();

  // Get visit logs with related data
  const { data: visits } = await supabase
    .from("visit_logs")
    .select(
      "*, patients(id, full_name, phone), appointments(id, starts_at, treatment_types(name, color))"
    )
    .order("visit_date", { ascending: false });

  // Get completed appointments without visit logs
  const { data: allAppointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, patient_id, patients(id, full_name), treatment_types(name)"
    )
    .eq("status", "completed")
    .order("starts_at", { ascending: false });

  const { data: existingLogs } = await supabase
    .from("visit_logs")
    .select("appointment_id");

  const loggedIds = new Set(
    (existingLogs ?? []).map((l) => l.appointment_id)
  );

  const pendingAppointments = (allAppointments ?? []).filter(
    (a) => !loggedIds.has(a.id)
  );

  return (
    <VisitsList
      visits={visits ?? []}
      pendingAppointments={pendingAppointments}
    />
  );
}
