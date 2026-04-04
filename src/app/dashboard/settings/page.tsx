import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { TreatmentTypes } from "./treatment-types";
import { WhatsAppStatus } from "./whatsapp-status";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [settingsRes, treatmentsRes] = await Promise.all([
    supabase.from("practice_settings").select("*").single(),
    supabase
      .from("treatment_types")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-6">הגדרות מרפאה</h2>

      <div className="flex flex-col gap-8">
        <SettingsForm settings={settingsRes.data} />
        <TreatmentTypes treatments={treatmentsRes.data ?? []} />
        <WhatsAppStatus />
      </div>
    </div>
  );
}
