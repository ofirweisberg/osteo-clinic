"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";

export async function updatePracticeSettings(formData: FormData) {
  const supabase = await createClient();

  // Get the single settings row ID first
  const { data: existing } = await supabase
    .from("practice_settings")
    .select("id")
    .limit(1)
    .single();

  if (!existing) throw new Error("Settings row not found");

  const workingHours: Record<
    string,
    { start: string; end: string; enabled: boolean }
  > = {};
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  for (const day of days) {
    workingHours[day] = {
      start: (formData.get(`${day}_start`) as string) || "09:00",
      end: (formData.get(`${day}_end`) as string) || "18:00",
      enabled: formData.get(`${day}_enabled`) === "on",
    };
  }

  const { error } = await supabase
    .from("practice_settings")
    .update({
      practice_name: formData.get("practice_name") as string,
      practitioner_name: formData.get("practitioner_name") as string,
      phone: normalizePhone(formData.get("phone") as string),
      address: formData.get("address") as string,
      working_hours: workingHours,
      booking_window_days: parseInt(
        formData.get("booking_window_days") as string
      ),
      reminder_hours_before: parseInt(
        formData.get("reminder_hours_before") as string
      ),
    })
    .eq("id", existing.id);

  if (error) throw error;
  revalidatePath("/dashboard/settings");
}

export async function createTreatmentType(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("treatment_types").insert({
    name: formData.get("name") as string,
    duration_minutes: parseInt(formData.get("duration_minutes") as string),
    price: parseFloat(formData.get("price") as string),
    color: (formData.get("color") as string) || "#6366f1",
  });
  if (error) throw error;
  revalidatePath("/dashboard/settings");
}

export async function updateTreatmentType(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("treatment_types")
    .update({
      name: formData.get("name") as string,
      duration_minutes: parseInt(formData.get("duration_minutes") as string),
      price: parseFloat(formData.get("price") as string),
      color: (formData.get("color") as string) || "#6366f1",
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/settings");
}

export async function deleteTreatmentType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("treatment_types")
    .delete()
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/settings");
}

export async function toggleTreatmentType(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("treatment_types")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/settings");
}
