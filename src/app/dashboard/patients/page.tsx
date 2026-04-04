import { createClient } from "@/lib/supabase/server";
import { PatientList } from "./patient-list";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: patients } = await query;

  return <PatientList patients={patients ?? []} initialSearch={q ?? ""} />;
}
