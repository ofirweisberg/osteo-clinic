import { query } from "@/lib/db";
import { VisitsList } from "./visits-list";

export default async function VisitsPage() {
  // Get visit logs with related data (errors fall back to empty lists, as the
  // previous implementation silently ignored query errors).
  let visits: Awaited<ReturnType<typeof getVisits>> = [];
  let pendingAppointments: Awaited<ReturnType<typeof getPending>> = [];
  try {
    [visits, pendingAppointments] = await Promise.all([
      getVisits(),
      getPending(),
    ]);
  } catch {
    // keep empty fallbacks
  }

  return (
    <VisitsList visits={visits} pendingAppointments={pendingAppointments} />
  );
}

function getVisits() {
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
      ORDER BY v.visit_date DESC`
  );
}

// Completed appointments that don't have a visit log yet.
function getPending() {
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
