import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PatientProfile } from "./patient-profile";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [patientRes, visitsRes, appointmentsRes, invoicesRes] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("visit_logs")
        .select(
          "*, appointments(starts_at, treatment_types(name, color))"
        )
        .eq("patient_id", id)
        .order("visit_date", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, treatment_types(name, color, duration_minutes, price)")
        .eq("patient_id", id)
        .order("starts_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!patientRes.data) notFound();

  return (
    <PatientProfile
      patient={patientRes.data}
      visits={visitsRes.data ?? []}
      appointments={appointmentsRes.data ?? []}
      invoices={invoicesRes.data ?? []}
    />
  );
}
