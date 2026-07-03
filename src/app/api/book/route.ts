import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { bookingConfirmationMessage } from "@/lib/whatsapp/messages";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/book
 *
 * Public endpoint for self-booking.
 * Creates patient (if needed) + appointment, then sends WhatsApp confirmation.
 *
 * Security (replaces the old anon RLS policies):
 * - Only inserts into patients (full_name + phone) and appointments.
 * - Appointment source is hardcoded to 'self_booked' and status to 'pending';
 *   the client cannot override them (mirrors the anon INSERT policy
 *   WITH CHECK (source = 'self_booked')).
 * - Never returns patient data to the caller — only the new appointment id.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const {
    full_name,
    phone,
    treatment_type_id,
    starts_at,
    ends_at,
  } = body;

  if (!full_name || !phone || !treatment_type_id || !starts_at || !ends_at) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const normalizedPhone = normalizePhone(phone);

  // Find or create patient
  let existingPatient: { id: string } | null = null;
  try {
    existingPatient = await queryOne<{ id: string }>(
      `SELECT id FROM patients WHERE phone = $1 LIMIT 1`,
      [normalizedPhone]
    );
  } catch (searchError) {
    console.error("Patient search error:", searchError);
  }

  let patientId: string;

  if (existingPatient) {
    patientId = existingPatient.id;
  } else {
    try {
      const newPatient = await queryOne<{ id: string }>(
        `INSERT INTO patients (full_name, phone)
         VALUES ($1, $2)
         RETURNING id`,
        [full_name, normalizedPhone]
      );
      if (!newPatient) throw new Error("Insert returned no row");
      patientId = newPatient.id;
    } catch (patientError) {
      console.error("Patient create error:", patientError);
      return NextResponse.json(
        {
          error:
            "Failed to create patient: " +
            (patientError instanceof Error
              ? patientError.message
              : String(patientError)),
        },
        { status: 500 }
      );
    }
  }

  // Create appointment — source/status hardcoded server-side (self_booked/pending)
  let appointment: { id: string } | null = null;
  try {
    appointment = await queryOne<{ id: string }>(
      `INSERT INTO appointments
         (patient_id, treatment_type_id, starts_at, ends_at, source, status)
       VALUES ($1, $2, $3, $4, 'self_booked', 'pending')
       RETURNING id`,
      [patientId, treatment_type_id, starts_at, ends_at]
    );
    if (!appointment) throw new Error("Insert returned no row");
  } catch (apptError) {
    console.error("Appointment create error:", apptError);
    return NextResponse.json(
      {
        error:
          "Failed to create appointment: " +
          (apptError instanceof Error ? apptError.message : String(apptError)),
      },
      { status: 500 }
    );
  }

  // Get treatment name + practice settings for the WhatsApp message
  const [treatment, settings] = await Promise.all([
    queryOne<{ name: string }>(
      `SELECT name FROM treatment_types WHERE id = $1`,
      [treatment_type_id]
    ).catch((err) => {
      console.error("Treatment lookup error:", err);
      return null;
    }),
    queryOne<{ practice_name: string; address: string }>(
      `SELECT practice_name, address FROM practice_settings LIMIT 1`
    ).catch((err) => {
      console.error("Settings lookup error:", err);
      return null;
    }),
  ]);

  // Send WhatsApp confirmation (fire and forget — don't block the response)
  sendWhatsAppMessage(
    phone,
    bookingConfirmationMessage({
      patientName: full_name,
      treatmentName: treatment?.name ?? "טיפול",
      startsAt: new Date(starts_at),
      practiceName: settings?.practice_name ?? "המרפאה",
      practiceAddress: settings?.address,
    })
  ).catch((err) => console.error("WhatsApp confirmation failed:", err));

  return NextResponse.json({
    success: true,
    appointmentId: appointment.id,
  });
}
