/**
 * WhatsApp message templates (Hebrew)
 */

const DAY_LABELS: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function bookingConfirmationMessage(data: {
  patientName: string;
  treatmentName: string;
  startsAt: Date;
  practiceName: string;
  practiceAddress?: string;
}): string {
  const day = DAY_LABELS[data.startsAt.getDay()];
  const date = formatDate(data.startsAt);
  const time = formatTime(data.startsAt);

  return [
    `שלום ${data.patientName} 👋`,
    ``,
    `התור שלך אושר בהצלחה!`,
    ``,
    `📋 ${data.treatmentName}`,
    `📅 יום ${day}, ${date}`,
    `🕐 ${time}`,
    `📍 ${data.practiceName}${data.practiceAddress ? ` - ${data.practiceAddress}` : ""}`,
    ``,
    `לביטול או שינוי - צרו קשר.`,
    `נתראה! 😊`,
  ].join("\n");
}

export function appointmentReminderMessage(data: {
  patientName: string;
  treatmentName: string;
  startsAt: Date;
  practiceName: string;
  practiceAddress?: string;
}): string {
  const day = DAY_LABELS[data.startsAt.getDay()];
  const date = formatDate(data.startsAt);
  const time = formatTime(data.startsAt);

  return [
    `שלום ${data.patientName} 👋`,
    ``,
    `תזכורת: יש לך תור מחר!`,
    ``,
    `📋 ${data.treatmentName}`,
    `📅 יום ${day}, ${date}`,
    `🕐 ${time}`,
    `📍 ${data.practiceName}${data.practiceAddress ? ` - ${data.practiceAddress}` : ""}`,
    ``,
    `לביטול או שינוי - צרו קשר.`,
    `נתראה! 😊`,
  ].join("\n");
}
