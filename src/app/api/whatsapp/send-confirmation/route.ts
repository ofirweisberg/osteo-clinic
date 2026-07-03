import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { bookingConfirmationMessage } from "@/lib/whatsapp/messages";

interface ConfirmationAppointment {
  starts_at: string;
  patient_name: string;
  patient_phone: string | null;
  treatment_name: string | null;
}

/**
 * POST /api/whatsapp/send-confirmation
 *
 * Sends a booking confirmation WhatsApp message.
 * Called after an appointment is created.
 */
export async function POST(request: Request) {
  // Verify the user is authenticated
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { appointmentId } = body;

  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointmentId required" },
      { status: 400 }
    );
  }

  // Fetch appointment details
  let appointment: ConfirmationAppointment | null = null;
  try {
    appointment = await queryOne<ConfirmationAppointment>(
      `SELECT a.starts_at,
              p.full_name AS patient_name,
              p.phone AS patient_phone,
              t.name AS treatment_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN treatment_types t ON t.id = a.treatment_type_id
       WHERE a.id = $1`,
      [appointmentId]
    );
  } catch {
    // Invalid UUID or query failure — treat as not found (matches previous behavior)
    appointment = null;
  }

  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  // Fetch practice settings
  let settings: { practice_name: string; address: string } | null = null;
  try {
    settings = await queryOne<{ practice_name: string; address: string }>(
      "SELECT practice_name, address FROM practice_settings LIMIT 1"
    );
  } catch (err) {
    console.error("Failed to fetch practice settings:", err);
  }

  if (!appointment.patient_phone) {
    return NextResponse.json(
      { error: "Patient phone not found" },
      { status: 400 }
    );
  }

  const message = bookingConfirmationMessage({
    patientName: appointment.patient_name,
    treatmentName: appointment.treatment_name ?? "טיפול",
    startsAt: new Date(appointment.starts_at),
    practiceName: settings?.practice_name ?? "המרפאה",
    practiceAddress: settings?.address,
  });

  const result = await sendWhatsAppMessage(
    appointment.patient_phone,
    message
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
