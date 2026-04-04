"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createInvoice(data: {
  patient_id: string;
  appointment_id?: string;
  amount: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    patient_id: data.patient_id,
    appointment_id: data.appointment_id || null,
    amount: data.amount,
    notes: data.notes || null,
    status: "draft",
  });
  if (error) throw error;
  revalidatePath("/dashboard/invoices");
}

export async function updateInvoiceStatus(id: string, status: string) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  if (status === "paid") {
    update.paid_at = new Date().toISOString().split("T")[0];
  }
  const { error } = await supabase
    .from("invoices")
    .update(update)
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/invoices");
}
