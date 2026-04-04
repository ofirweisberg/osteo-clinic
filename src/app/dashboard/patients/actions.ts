"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizePhone } from "@/lib/phone";

export async function createPatient(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("patients").insert({
    full_name: formData.get("full_name") as string,
    phone: normalizePhone(formData.get("phone") as string),
    email: (formData.get("email") as string) || null,
    date_of_birth: (formData.get("date_of_birth") as string) || null,
    address: (formData.get("address") as string) || null,
    notes: (formData.get("notes") as string) || null,
    discount_percent: parseInt(formData.get("discount_percent") as string) || 0,
  });
  if (error) throw error;

  revalidatePath("/dashboard/patients");
}

export async function updatePatient(id: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("patients")
    .update({
      full_name: formData.get("full_name") as string,
      phone: normalizePhone(formData.get("phone") as string),
      email: (formData.get("email") as string) || null,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      address: (formData.get("address") as string) || null,
      notes: (formData.get("notes") as string) || null,
      discount_percent: parseInt(formData.get("discount_percent") as string) || 0,
    })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/patients");
}

export async function deletePatient(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/dashboard/patients");
}
