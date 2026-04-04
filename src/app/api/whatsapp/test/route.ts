import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";

export async function POST(request: Request) {
  // Verify authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = await request.json();
  if (!phone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }

  const result = await sendWhatsAppMessage(
    phone,
    "🔔 הודעת בדיקה ממערכת ניהול המרפאה. אם קיבלת הודעה זו, החיבור תקין!"
  );

  return NextResponse.json(result);
}
