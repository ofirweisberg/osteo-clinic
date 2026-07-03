"use server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";

export async function createPatient(formData: FormData) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(
    `INSERT INTO patients
       (full_name, phone, email, date_of_birth, address, notes, discount_percent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      formData.get("full_name") as string,
      normalizePhone(formData.get("phone") as string),
      (formData.get("email") as string) || null,
      (formData.get("date_of_birth") as string) || null,
      (formData.get("address") as string) || null,
      (formData.get("notes") as string) || null,
      parseInt(formData.get("discount_percent") as string) || 0,
    ]
  );

  revalidatePath("/dashboard/patients");
}

export async function updatePatient(id: string, formData: FormData) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(
    `UPDATE patients
     SET full_name = $1,
         phone = $2,
         email = $3,
         date_of_birth = $4,
         address = $5,
         notes = $6,
         discount_percent = $7
     WHERE id = $8`,
    [
      formData.get("full_name") as string,
      normalizePhone(formData.get("phone") as string),
      (formData.get("email") as string) || null,
      (formData.get("date_of_birth") as string) || null,
      (formData.get("address") as string) || null,
      (formData.get("notes") as string) || null,
      parseInt(formData.get("discount_percent") as string) || 0,
      id,
    ]
  );

  revalidatePath("/dashboard/patients");
}

export async function deletePatient(id: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(`DELETE FROM patients WHERE id = $1`, [id]);

  revalidatePath("/dashboard/patients");
}

export async function updateVisitNotes(visitId: string, notes: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(`UPDATE visit_logs SET notes = $1 WHERE id = $2`, [
    notes,
    visitId,
  ]);

  revalidatePath("/dashboard/patients");
}
