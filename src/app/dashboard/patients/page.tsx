import { query } from "@/lib/db";
import { PatientList } from "./patient-list";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const patients = q
    ? await query(
        `SELECT * FROM patients
         WHERE full_name ILIKE $1 OR phone ILIKE $1
         ORDER BY created_at DESC`,
        [`%${q}%`]
      )
    : await query(`SELECT * FROM patients ORDER BY created_at DESC`);

  return <PatientList patients={patients ?? []} initialSearch={q ?? ""} />;
}
