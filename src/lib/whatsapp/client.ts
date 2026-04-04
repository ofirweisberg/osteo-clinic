/**
 * WhatsApp messaging via Green API (green-api.com)
 *
 * Setup:
 * 1. Create account at green-api.com
 * 2. Get Instance ID + API Token
 * 3. Scan QR code with WhatsApp on your phone
 * 4. Set env vars: GREENAPI_INSTANCE_ID, GREENAPI_API_TOKEN
 */

const GREENAPI_URL = "https://api.green-api.com";

function getConfig() {
  const instanceId = process.env.GREENAPI_INSTANCE_ID;
  const apiToken = process.env.GREENAPI_API_TOKEN;

  if (!instanceId || !apiToken) {
    return null;
  }

  return { instanceId, apiToken };
}

function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, "");

  // Israeli numbers: if starts with 0, replace with 972
  if (digits.startsWith("0")) {
    digits = "972" + digits.slice(1);
  }

  // If no country code, assume Israel
  if (!digits.startsWith("972") && digits.length <= 10) {
    digits = "972" + digits;
  }

  return digits + "@c.us";
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();
  if (!config) {
    console.warn("WhatsApp not configured — skipping message");
    return { success: false, error: "WhatsApp not configured" };
  }

  const chatId = formatPhoneForWhatsApp(phone);

  try {
    const response = await fetch(
      `${GREENAPI_URL}/waInstance${config.instanceId}/sendMessage/${config.apiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          message,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("WhatsApp API error:", text);
      return { success: false, error: text };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("WhatsApp send failed:", message);
    return { success: false, error: message };
  }
}

export async function checkWhatsAppConnection(): Promise<{
  connected: boolean;
  phone?: string;
}> {
  const config = getConfig();
  if (!config) {
    return { connected: false };
  }

  try {
    const response = await fetch(
      `${GREENAPI_URL}/waInstance${config.instanceId}/getStateInstance/${config.apiToken}`
    );

    if (!response.ok) return { connected: false };

    const data = await response.json();
    return {
      connected: data.stateInstance === "authorized",
      phone: data.wid,
    };
  } catch {
    return { connected: false };
  }
}
