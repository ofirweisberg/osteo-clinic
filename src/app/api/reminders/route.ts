import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { appointmentReminderMessage } from "@/lib/whatsapp/messages";

interface ReminderSettings {
  reminder_hours_before: number;
  practice_name: string;
  address: string;
}

interface ReminderAppointment {
  id: string;
  starts_at: string;
  patient_name: string;
  patient_phone: string | null;
  treatment_name: string | null;
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

  // Get practice settings for reminder window
  let settings: ReminderSettings | null = null;
  try {
    settings = await queryOne<ReminderSettings>(
      `SELECT reminder_hours_before, practice_name, address
       FROM practice_settings
       LIMIT 1`
    );
  } catch (err) {
    console.error("Failed to fetch practice settings:", err);
  }

  const reminderHours = settings?.reminder_hours_before ?? 24;
  const practiceName = settings?.practice_name ?? "המרפאה";
  const practiceAddress = settings?.address ?? "";

  // Find appointments in the reminder window that haven't been reminded yet
  const now = new Date();
  const windowStart = new Date(now);
  const windowEnd = new Date(now);
  windowEnd.setHours(windowEnd.getHours() + reminderHours);

  let appointments: ReminderAppointment[];
  try {
    appointments = await query<ReminderAppointment>(
      `SELECT a.id,
              a.starts_at,
              p.full_name AS patient_name,
              p.phone AS patient_phone,
              t.name AS treatment_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN treatment_types t ON t.id = a.treatment_type_id
       WHERE a.status IN ('pending', 'confirmed')
         AND a.reminder_sent = false
         AND a.starts_at >= $1
         AND a.starts_at <= $2`,
      [windowStart.toISOString(), windowEnd.toISOString()]
    );
  } catch (error) {
    console.error("Failed to fetch appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }

  let sent = 0;
  let failed = 0;

  for (const appt of appointments) {
    if (!appt.patient_phone) continue;

    const message = appointmentReminderMessage({
      patientName: appt.patient_name,
      treatmentName: appt.treatment_name ?? "טיפול",
      startsAt: new Date(appt.starts_at),
      practiceName,
      practiceAddress,
    });

    const result = await sendWhatsAppMessage(appt.patient_phone, message);

    if (result.success) {
      // Mark as reminded
      try {
        await query(
          "UPDATE appointments SET reminder_sent = true WHERE id = $1",
          [appt.id]
        );
      } catch (err) {
        console.error(
          `Failed to mark reminder_sent for appointment ${appt.id}:`,
          err
        );
      }
      sent++;
    } else {
      console.error(
        `Failed to send reminder for appointment ${appt.id}:`,
        result.error
      );
      failed++;
    }
  }

  return NextResponse.json({
    sent,
    failed,
    total: appointments.length,
    timestamp: now.toISOString(),
  });
}
