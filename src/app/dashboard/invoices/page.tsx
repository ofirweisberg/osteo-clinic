import { query, queryOne } from "@/lib/db";
import { InvoicesList } from "./invoices-list";

export default async function InvoicesPage() {
  // Errors fall back to empty data, matching the previous implementation
  // which silently ignored query errors.
  const [invoices, patients, practiceSettings] = await Promise.all([
    query(
      `SELECT i.*,
              CASE WHEN p.id IS NULL THEN NULL
                   ELSE json_build_object(
                     'id', p.id,
                     'full_name', p.full_name,
                     'phone', p.phone
                   )
              END AS patients
         FROM invoices i
         LEFT JOIN patients p ON p.id = i.patient_id
        ORDER BY i.created_at DESC`
    ).catch(() => []),
    query(
      `SELECT id, full_name, phone FROM patients ORDER BY full_name`
    ).catch(() => []),
    queryOne<{
      practice_name: string;
      practitioner_name: string;
      phone: string;
      address: string;
    }>(`SELECT * FROM practice_settings`).catch(() => null),
  ]);

  return (
    <InvoicesList
      invoices={invoices}
      patients={patients}
      practiceSettings={practiceSettings}
    />
  );
}
