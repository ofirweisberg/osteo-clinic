"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getVisitLogs(patientId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("visit_logs")
    .select(
      "*, patients(id, full_name, phone), appointments(id, starts_at, treatment_types(name, color))"
    )
    .order("visit_date", { ascending: false });

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createVisitLog(data: {
  appointment_id: string;
  patient_id: string;
  visit_date: string;
  notes: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("visit_logs").insert(data);
  if (error) throw error;
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard/calendar");
}

export async function updateVisitLog(id: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("visit_logs")
    .update({ notes })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/visits");
}

export async function deleteVisitLog(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("visit_logs").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/visits");
}

export async function getCompletedAppointmentsWithoutVisit() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, patient_id, patients(id, full_name), treatment_types(name)"
    )
    .eq("status", "completed")
    .order("starts_at", { ascending: false });

  if (error) throw error;

  // Filter out appointments that already have visit logs
  const { data: existingLogs } = await supabase
    .from("visit_logs")
    .select("appointment_id");

  const loggedIds = new Set(
    (existingLogs ?? []).map((l) => l.appointment_id)
  );

  return (data ?? []).filter((a) => !loggedIds.has(a.id));
}
