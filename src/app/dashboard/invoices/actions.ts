"use server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createInvoice(data: {
  patient_id: string;
  appointment_id?: string;
  amount: number;
  notes?: string;
}) {
  if (!(await getSession())) throw new Error("unauthorized");

  // invoice_number is SERIAL — assigned by the DB, never supplied here.
  await query(
    `INSERT INTO invoices (patient_id, appointment_id, amount, notes, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [
      data.patient_id,
      data.appointment_id || null,
      data.amount,
      data.notes || null,
    ]
  );
  revalidatePath("/dashboard/invoices");
}

export async function updateInvoiceStatus(id: string, status: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  if (status === "paid") {
    const paidAt = new Date().toISOString().split("T")[0];
    await query(
      `UPDATE invoices SET status = $2, paid_at = $3 WHERE id = $1`,
      [id, status, paidAt]
    );
  } else {
    await query(`UPDATE invoices SET status = $2 WHERE id = $1`, [id, status]);
  }
  revalidatePath("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(`DELETE FROM invoices WHERE id = $1`, [id]);
  revalidatePath("/dashboard/invoices");
}
