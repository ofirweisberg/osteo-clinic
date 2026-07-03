"use server";

import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getVisitLogs(patientId?: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  const params: unknown[] = [];
  let where = "";
  if (patientId) {
    params.push(patientId);
    where = "WHERE v.patient_id = $1";
  }

  return query(
    `SELECT v.*,
            CASE WHEN p.id IS NULL THEN NULL
                 ELSE json_build_object(
                   'id', p.id,
                   'full_name', p.full_name,
                   'phone', p.phone
                 )
            END AS patients,
            CASE WHEN a.id IS NULL THEN NULL
                 ELSE json_build_object(
                   'id', a.id,
                   'starts_at', a.starts_at,
                   'treatment_types',
                   CASE WHEN t.id IS NULL THEN NULL
                        ELSE json_build_object('name', t.name, 'color', t.color)
                   END
                 )
            END AS appointments
       FROM visit_logs v
       LEFT JOIN patients p ON p.id = v.patient_id
       LEFT JOIN appointments a ON a.id = v.appointment_id
       LEFT JOIN treatment_types t ON t.id = a.treatment_type_id
       ${where}
      ORDER BY v.visit_date DESC`,
    params
  );
}

export async function createVisitLog(data: {
  appointment_id: string;
  patient_id: string;
  visit_date: string;
  notes: string;
}) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(
    `INSERT INTO visit_logs (appointment_id, patient_id, visit_date, notes)
     VALUES ($1, $2, $3, $4)`,
    [data.appointment_id, data.patient_id, data.visit_date, data.notes]
  );
  revalidatePath("/dashboard/visits");
  revalidatePath("/dashboard/calendar");
}

export async function updateVisitLog(id: string, notes: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(`UPDATE visit_logs SET notes = $2 WHERE id = $1`, [id, notes]);
  revalidatePath("/dashboard/visits");
}

export async function deleteVisitLog(id: string) {
  if (!(await getSession())) throw new Error("unauthorized");

  await query(`DELETE FROM visit_logs WHERE id = $1`, [id]);
  revalidatePath("/dashboard/visits");
}

export async function getCompletedAppointmentsWithoutVisit() {
  if (!(await getSession())) throw new Error("unauthorized");

  return query(
    `SELECT a.id, a.starts_at, a.patient_id,
            CASE WHEN p.id IS NULL THEN NULL
                 ELSE json_build_object('id', p.id, 'full_name', p.full_name)
            END AS patients,
            CASE WHEN t.id IS NULL THEN NULL
                 ELSE json_build_object('name', t.name)
            END AS treatment_types
       FROM appointments a
       LEFT JOIN patients p ON p.id = a.patient_id
       LEFT JOIN treatment_types t ON t.id = a.treatment_type_id
      WHERE a.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM visit_logs v WHERE v.appointment_id = a.id
        )
      ORDER BY a.starts_at DESC`
  );
}
