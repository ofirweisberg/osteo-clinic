import { createClient } from "@/lib/supabase/server";
import { InvoicesList } from "./invoices-list";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const [invoicesRes, patientsRes, settingsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, patients(id, full_name, phone)")
      .order("created_at", { ascending: false }),
    supabase
      .from("patients")
      .select("id, full_name, phone")
      .order("full_name"),
    supabase.from("practice_settings").select("*").single(),
  ]);

  return (
    <InvoicesList
      invoices={invoicesRes.data ?? []}
      patients={patientsRes.data ?? []}
      practiceSettings={settingsRes.data}
    />
  );
}
