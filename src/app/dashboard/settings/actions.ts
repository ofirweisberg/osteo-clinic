"use server";

import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";

export async function updatePracticeSettings(formData: FormData) {
  if (!(await getSession())) throw new Error("unauthorized");

  // Get the single settings row ID first
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM practice_settings LIMIT 1"
  );

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

  await query(
    `UPDATE practice_settings
     SET practice_name = $1,
         practitioner_name = $2,
         phone = $3,
         address = $4,
         working_hours = $5::jsonb,
         booking_window_days = $6,
         reminder_hours_before = $7
     WHERE id = $8`,
    [
      formData.get("practice_name") as string,
      formData.get("practitioner_name") as string,
      normalizePhone(formData.get("phone") as string),
      formData.get("address") as string,
      JSON.stringify(workingHours),
      parseInt(formData.get("booking_window_days") as string),
      parseInt(formData.get("reminder_hours_before") as string),
      existing.id,
    ]
  );

  revalidatePath("/dashboard/settings");
}

export async function createTreatmentType(formData: FormData) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(
    `INSERT INTO treatment_types (name, duration_minutes, price, color)
     VALUES ($1, $2, $3, $4)`,
    [
      formData.get("name") as string,
      parseInt(formData.get("duration_minutes") as string),
      parseFloat(formData.get("price") as string),
      (formData.get("color") as string) || "#6366f1",
    ]
  );
  revalidatePath("/dashboard/settings");
}

export async function updateTreatmentType(id: string, formData: FormData) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(
    `UPDATE treatment_types
     SET name = $1, duration_minutes = $2, price = $3, color = $4
     WHERE id = $5`,
    [
      formData.get("name") as string,
      parseInt(formData.get("duration_minutes") as string),
      parseFloat(formData.get("price") as string),
      (formData.get("color") as string) || "#6366f1",
      id,
    ]
  );
  revalidatePath("/dashboard/settings");
}

export async function deleteTreatmentType(id: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query("DELETE FROM treatment_types WHERE id = $1", [id]);
  revalidatePath("/dashboard/settings");
}

export async function toggleTreatmentType(id: string, isActive: boolean) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query("UPDATE treatment_types SET is_active = $1 WHERE id = $2", [
    isActive,
    id,
  ]);
  revalidatePath("/dashboard/settings");
}
