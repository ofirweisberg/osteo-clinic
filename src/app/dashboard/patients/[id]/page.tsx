import { query, queryOne } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  PatientProfile,
  type Patient,
  type Visit,
  type Appointment,
  type Invoice,
} from "./patient-profile";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [patient, visits, appointments, invoices] = await Promise.all([
    queryOne<Patient>(`SELECT * FROM patients WHERE id = $1`, [id]),
    query<Visit>(
      `SELECT v.*,
              CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object(
                'starts_at', a.starts_at,
                'treatment_types', CASE WHEN tt.id IS NULL THEN NULL ELSE json_build_object(
                  'name', tt.name,
                  'color', tt.color
                ) END
              ) END AS appointments
       FROM visit_logs v
       LEFT JOIN appointments a ON a.id = v.appointment_id
       LEFT JOIN treatment_types tt ON tt.id = a.treatment_type_id
       WHERE v.patient_id = $1
       ORDER BY v.visit_date DESC`,
      [id]
    ),
    query<Appointment>(
      `SELECT a.*,
              CASE WHEN tt.id IS NULL THEN NULL ELSE json_build_object(
                'name', tt.name,
                'color', tt.color,
                'duration_minutes', tt.duration_minutes,
                'price', tt.price
              ) END AS treatment_types
       FROM appointments a
       LEFT JOIN treatment_types tt ON tt.id = a.treatment_type_id
       WHERE a.patient_id = $1
       ORDER BY a.starts_at DESC`,
      [id]
    ),
    query<Invoice>(
      `SELECT * FROM invoices
       WHERE patient_id = $1
       ORDER BY created_at DESC`,
      [id]
    ),
  ]);

  if (!patient) notFound();

  return (
    <PatientProfile
      patient={patient}
      visits={visits ?? []}
      appointments={appointments ?? []}
      invoices={invoices ?? []}
    />
  );
}
