import { NextResponse } from "next/server";
import { checkWhatsAppConnection } from "@/lib/whatsapp/client";

export async function GET() {
  if (
    !process.env.GREENAPI_INSTANCE_ID ||
    !process.env.GREENAPI_API_TOKEN
  ) {
    return NextResponse.json({ connected: false, notConfigured: true });
  }

  const result = await checkWhatsAppConnection();
  return NextResponse.json(result);
}
