import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { bookingConfirmationMessage } from "@/lib/whatsapp/messages";
import { normalizePhone } from "@/lib/phone";

// Use service role for public booking (bypasses RLS for reads, anon policies handle inserts)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Fall back to anon key if service role not set
  return createClient(url, key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * POST /api/book
 *
 * Public endpoint for self-booking.
 * Creates patient (if needed) + appointment, then sends WhatsApp confirmation.
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
  const supabase = getServiceClient();

  // Find or create patient
  const { data: existingPatients, error: searchError } = await supabase
    .from("patients")
    .select("id")
    .eq("phone", normalizedPhone)
    .limit(1);

  if (searchError) {
    console.error("Patient search error:", searchError);
  }

  let patientId: string;

  if (existingPatients && existingPatients.length > 0) {
    patientId = existingPatients[0].id;
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({ full_name, phone: normalizedPhone })
      .select("id")
      .single();

    if (patientError) {
      console.error("Patient create error:", patientError);
      return NextResponse.json(
        { error: "Failed to create patient: " + patientError.message },
        { status: 500 }
      );
    }
    patientId = newPatient.id;
  }

  // Create appointment
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      treatment_type_id,
      starts_at,
      ends_at,
      source: "self_booked",
      status: "pending",
    })
    .select("id")
    .single();

  if (apptError) {
    console.error("Appointment create error:", apptError);
    return NextResponse.json(
      { error: "Failed to create appointment: " + apptError.message },
      { status: 500 }
    );
  }

  // Get treatment name + practice settings for the WhatsApp message
  const [treatmentRes, settingsRes] = await Promise.all([
    supabase
      .from("treatment_types")
      .select("name")
      .eq("id", treatment_type_id)
      .single(),
    supabase
      .from("practice_settings")
      .select("practice_name, address")
      .single(),
  ]);

  // Send WhatsApp confirmation (fire and forget — don't block the response)
  sendWhatsAppMessage(
    phone,
    bookingConfirmationMessage({
      patientName: full_name,
      treatmentName: treatmentRes.data?.name ?? "טיפול",
      startsAt: new Date(starts_at),
      practiceName: settingsRes.data?.practice_name ?? "המרפאה",
      practiceAddress: settingsRes.data?.address,
    })
  ).catch((err) => console.error("WhatsApp confirmation failed:", err));

  return NextResponse.json({
    success: true,
    appointmentId: appointment.id,
  });
}
