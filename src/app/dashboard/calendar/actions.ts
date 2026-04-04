"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAppointmentsForWeek(weekStart: string, weekEnd: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id, full_name, phone), treatment_types(id, name, duration_minutes, price, color)")
    .gte("starts_at", weekStart)
    .lte("starts_at", weekEnd)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function createAppointment(data: {
  patient_id: string;
  treatment_type_id: string;
  starts_at: string;
  ends_at: string;
  notes?: string;
  source?: string;
  price?: number | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").insert({
    patient_id: data.patient_id,
    treatment_type_id: data.treatment_type_id,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    notes: data.notes || null,
    source: data.source || "manual",
    status: "confirmed",
    price: data.price ?? null,
  });
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function updateAppointmentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function updateAppointmentPrice(id: string, price: number | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ price })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function deleteAppointment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/calendar");
}

export async function getPatientsList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, phone")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTreatmentTypesList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_types")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}
