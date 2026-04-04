import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { bookingConfirmationMessage } from "@/lib/whatsapp/messages";

/**
 * POST /api/whatsapp/send-confirmation
 *
 * Sends a booking confirmation WhatsApp message.
 * Called after an appointment is created.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      "starts_at, patients(full_name, phone), treatment_types(name)"
    )
    .eq("id", appointmentId)
    .single();

  if (error || !appointment) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  // Fetch practice settings
  const { data: settings } = await supabase
    .from("practice_settings")
    .select("practice_name, address")
    .single();

  const patient = (Array.isArray(appointment.patients)
    ? appointment.patients[0]
    : appointment.patients) as { full_name: string; phone: string } | null;
  const treatment = (Array.isArray(appointment.treatment_types)
    ? appointment.treatment_types[0]
    : appointment.treatment_types) as { name: string } | null;

  if (!patient?.phone) {
    return NextResponse.json(
      { error: "Patient phone not found" },
      { status: 400 }
    );
  }

  const message = bookingConfirmationMessage({
    patientName: patient.full_name,
    treatmentName: treatment?.name ?? "טיפול",
    startsAt: new Date(appointment.starts_at),
    practiceName: settings?.practice_name ?? "המרפאה",
    practiceAddress: settings?.address,
  });

  const result = await sendWhatsAppMessage(patient.phone, message);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
