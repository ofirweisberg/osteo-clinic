import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { appointmentReminderMessage } from "@/lib/whatsapp/messages";

// Use service role key for cron jobs (bypasses RLS)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/reminders
 *
 * Sends WhatsApp reminders for upcoming appointments.
 * Designed to be called by a cron service (e.g., Vercel Cron, external cron).
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Get practice settings for reminder window
  const { data: settings } = await supabase
    .from("practice_settings")
    .select("reminder_hours_before, practice_name, address")
    .single();

  const reminderHours = settings?.reminder_hours_before ?? 24;
  const practiceName = settings?.practice_name ?? "המרפאה";
  const practiceAddress = settings?.address ?? "";

  // Find appointments in the reminder window that haven't been reminded yet
  const now = new Date();
  const windowStart = new Date(now);
  const windowEnd = new Date(now);
  windowEnd.setHours(windowEnd.getHours() + reminderHours);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, reminder_sent, patients(full_name, phone), treatment_types(name)"
    )
    .in("status", ["pending", "confirmed"])
    .eq("reminder_sent", false)
    .gte("starts_at", windowStart.toISOString())
    .lte("starts_at", windowEnd.toISOString());

  if (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }

  let sent = 0;
  let failed = 0;

  for (const appt of appointments ?? []) {
    const patient = Array.isArray(appt.patients)
      ? appt.patients[0]
      : appt.patients;
    const treatment = Array.isArray(appt.treatment_types)
      ? appt.treatment_types[0]
      : appt.treatment_types;

    if (!patient?.phone) continue;

    const message = appointmentReminderMessage({
      patientName: patient.full_name,
      treatmentName: treatment?.name ?? "טיפול",
      startsAt: new Date(appt.starts_at),
      practiceName,
      practiceAddress,
    });

    const result = await sendWhatsAppMessage(patient.phone, message);

    if (result.success) {
      // Mark as reminded
      await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", appt.id);
      sent++;
    } else {
      console.error(`Failed to send reminder for appointment ${appt.id}:`, result.error);
      failed++;
    }
  }

  return NextResponse.json({
    sent,
    failed,
    total: (appointments ?? []).length,
    timestamp: now.toISOString(),
  });
}
