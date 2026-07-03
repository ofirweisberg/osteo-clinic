"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { uploadFile, deleteFile, getSignedUrl } from "@/lib/storage";

async function requireAuth() {
  if (!(await getSession())) throw new Error("unauthorized");
}

// Reproduces the old Supabase nested select shape:
// "*, patients(id, full_name, phone), treatment_types(id, name, duration_minutes, price, color)"
const APPOINTMENT_WITH_JOINS = `
  SELECT a.*,
    json_build_object('id', p.id, 'full_name', p.full_name, 'phone', p.phone) AS patients,
    json_build_object(
      'id', t.id, 'name', t.name, 'duration_minutes', t.duration_minutes,
      'price', t.price, 'color', t.color
    ) AS treatment_types
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN treatment_types t ON t.id = a.treatment_type_id
`;

export async function getAppointmentsForWeek(weekStart: string, weekEnd: string) {
  await requireAuth();
  return query(
    `${APPOINTMENT_WITH_JOINS}
     WHERE a.starts_at >= $1::timestamptz AND a.starts_at <= $2::timestamptz
     ORDER BY a.starts_at ASC`,
    [weekStart, weekEnd]
  );
}

// Week fetch used by the weekly calendar grid: half-open range, cancelled excluded.
export async function getWeekAppointments(weekStart: string, weekEnd: string) {
  await requireAuth();
  return query(
    `${APPOINTMENT_WITH_JOINS}
     WHERE a.starts_at >= $1::timestamptz AND a.starts_at < $2::timestamptz
       AND a.status <> 'cancelled'
     ORDER BY a.starts_at ASC`,
    [weekStart, weekEnd]
  );
}

// Overlap check for the new-appointment dialog (excludes cancelled).
export async function findConflictingAppointments(
  checkStart: string,
  checkEnd: string
) {
  await requireAuth();
  return query<{ id: string; starts_at: string; ends_at: string }>(
    `SELECT id, starts_at, ends_at
     FROM appointments
     WHERE status <> 'cancelled'
       AND starts_at < $1::timestamptz
       AND ends_at > $2::timestamptz`,
    [checkEnd, checkStart]
  );
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
  await requireAuth();
  await query(
    `INSERT INTO appointments
       (patient_id, treatment_type_id, starts_at, ends_at, notes, source, status, price)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7)`,
    [
      data.patient_id,
      data.treatment_type_id,
      data.starts_at,
      data.ends_at,
      data.notes || null,
      data.source || "manual",
      data.price ?? null,
    ]
  );
  revalidatePath("/dashboard/calendar");
}

export async function updateAppointmentStatus(id: string, status: string) {
  await requireAuth();
  await query(`UPDATE appointments SET status = $2 WHERE id = $1`, [id, status]);
  revalidatePath("/dashboard/calendar");
}

export async function updateAppointmentDateTime(
  id: string,
  starts_at: string,
  ends_at: string
) {
  await requireAuth();
  await query(
    `UPDATE appointments SET starts_at = $2, ends_at = $3 WHERE id = $1`,
    [id, starts_at, ends_at]
  );
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

export async function updateAppointmentPrice(id: string, price: number | null) {
  await requireAuth();
  await query(`UPDATE appointments SET price = $2 WHERE id = $1`, [id, price]);
  revalidatePath("/dashboard/calendar");
}

export async function deleteAppointment(id: string) {
  await requireAuth();
  await query(`DELETE FROM appointments WHERE id = $1`, [id]);
  revalidatePath("/dashboard/calendar");
}

export async function getPatientsList() {
  await requireAuth();
  return query(
    `SELECT id, full_name, phone FROM patients ORDER BY full_name ASC`
  );
}

export async function getTreatmentTypesList() {
  await requireAuth();
  return query(
    `SELECT * FROM treatment_types WHERE is_active = true ORDER BY name ASC`
  );
}

// Quick-create a patient from the new-appointment dialog. Returns the new id.
export async function createPatientQuick(fullName: string, phone: string) {
  await requireAuth();
  const row = await queryOne<{ id: string }>(
    `INSERT INTO patients (full_name, phone) VALUES ($1, $2) RETURNING id`,
    [fullName, phone]
  );
  if (!row) throw new Error("insert failed");
  return row;
}

// ---------------------------------------------------------------------------
// Visit logs (session notes in the appointment detail panel)
// ---------------------------------------------------------------------------

export async function getVisitLog(appointmentId: string) {
  await requireAuth();
  return queryOne<{
    id: string;
    appointment_id: string;
    visit_date: string;
    notes: string | null;
  }>(
    `SELECT * FROM visit_logs WHERE appointment_id = $1 LIMIT 1`,
    [appointmentId]
  );
}

export async function updateVisitLogNotes(id: string, notes: string) {
  await requireAuth();
  await query(`UPDATE visit_logs SET notes = $2 WHERE id = $1`, [id, notes]);
}

export async function createVisitLogForAppointment(data: {
  appointment_id: string;
  patient_id: string;
  visit_date: string;
  notes: string;
}) {
  await requireAuth();
  const row = await queryOne(
    `INSERT INTO visit_logs (appointment_id, patient_id, visit_date, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.appointment_id, data.patient_id, data.visit_date, data.notes]
  );
  if (!row) throw new Error("insert failed");
  return row;
}

// ---------------------------------------------------------------------------
// Patient history (other appointments + their notes + their files)
// ---------------------------------------------------------------------------

export async function getPatientHistory(
  patientId: string,
  excludeAppointmentId: string
) {
  await requireAuth();
  const [appointments, logs, files] = await Promise.all([
    query<{
      id: string;
      starts_at: string;
      treatment_types: { name: string; color: string } | null;
    }>(
      `SELECT a.id, a.starts_at,
         json_build_object('name', t.name, 'color', t.color) AS treatment_types
       FROM appointments a
       JOIN treatment_types t ON t.id = a.treatment_type_id
       WHERE a.patient_id = $1 AND a.id <> $2
       ORDER BY a.starts_at DESC`,
      [patientId, excludeAppointmentId]
    ),
    query<{ appointment_id: string; notes: string | null }>(
      `SELECT appointment_id, notes
       FROM visit_logs
       WHERE patient_id = $1 AND appointment_id <> $2`,
      [patientId, excludeAppointmentId]
    ),
    query(
      `SELECT * FROM appointment_files
       WHERE patient_id = $1 AND appointment_id <> $2
       ORDER BY created_at DESC`,
      [patientId, excludeAppointmentId]
    ),
  ]);
  return { appointments, logs, files };
}

// ---------------------------------------------------------------------------
// File attachments (Azure Blob "patient-files" container)
// ---------------------------------------------------------------------------

export async function getAppointmentFiles(appointmentId: string) {
  await requireAuth();
  return query(
    `SELECT * FROM appointment_files
     WHERE appointment_id = $1
     ORDER BY created_at DESC`,
    [appointmentId]
  );
}

export async function uploadAppointmentFile(formData: FormData) {
  await requireAuth();
  const file = formData.get("file") as File | null;
  const appointmentId = formData.get("appointmentId") as string | null;
  const patientId = formData.get("patientId") as string | null;
  if (!file || !appointmentId || !patientId) throw new Error("missing fields");

  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${patientId}/${appointmentId}/${Date.now()}_${safe}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadFile(path, buffer, file.type || undefined);

  const row = await queryOne(
    `INSERT INTO appointment_files
       (appointment_id, patient_id, storage_path, file_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [appointmentId, patientId, path, file.name, file.type || null, file.size]
  );
  if (!row) throw new Error("insert failed");
  return row;
}

export async function getFileSignedUrl(storagePath: string) {
  await requireAuth();
  return getSignedUrl(storagePath);
}

export async function deleteAppointmentFile(fileId: string) {
  await requireAuth();
  const row = await queryOne<{ id: string; storage_path: string }>(
    `SELECT id, storage_path FROM appointment_files WHERE id = $1`,
    [fileId]
  );
  if (!row) return;
  await deleteFile(row.storage_path);
  await query(`DELETE FROM appointment_files WHERE id = $1`, [fileId]);
}
