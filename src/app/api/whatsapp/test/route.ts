import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";

export async function POST(request: Request) {
  // Verify authenticated
  const session = await getSession();

  if (!session) {
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
