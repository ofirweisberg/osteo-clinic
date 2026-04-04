"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createPatient(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("patients").insert({
    full_name: formData.get("full_name") as string,
    phone: formData.get("phone") as string,
    email: (formData.get("email") as string) || null,
    date_of_birth: (formData.get("date_of_birth") as string) || null,
    address: (formData.get("address") as string) || null,
    notes: (formData.get("notes") as string) || null,
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
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || null,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      address: (formData.get("address") as string) || null,
      notes: (formData.get("notes") as string) || null,
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
