"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPracticeSettings,
  getActiveTreatmentTypes,
  getScheduleBlocks,
  getAppointmentsForDate,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneDisplay } from "@/lib/phone";

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

interface PracticeSettings {
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
  working_hours: Record<string, { start: string; end: string; enabled: boolean }>;
  booking_window_days: number;
}

interface TimeSlot {
  time: string;
  label: string;
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_LABELS: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

type Step = "info" | "treatment" | "date" | "time" | "confirm" | "done";

export default function BookPage() {
  const [step, setStep] = useState<Step>("info");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data from DB
  const [settings, setSettings] = useState<PracticeSettings | null>(null);
  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<
    { starts_at: string; ends_at: string }[]
  >([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<
    { block_type: string; starts_at: string | null; ends_at: string | null; day_of_week: number | null; start_time: string | null; end_time: string | null; exception_dates: string[] }[]
  >([]);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTreatment, setSelectedTreatment] =
    useState<TreatmentType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        const [settingsData, treatmentsData, blocksData] = await Promise.all([
          getPracticeSettings(),
          getActiveTreatmentTypes(),
          getScheduleBlocks(),
        ]);
        setSettings(settingsData as PracticeSettings | null);
        setTreatments(treatmentsData ?? []);
        setScheduleBlocks(blocksData ?? []);
      } catch (err) {
        console.error("Failed to load booking data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch appointments for selected date
  const fetchAppointmentsForDate = useCallback(async (dateStr: string) => {
    try {
      const data = await getAppointmentsForDate(dateStr);
      setExistingAppointments(data ?? []);
    } catch (err) {
      console.error("Failed to load appointments:", err);
      setExistingAppointments([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAppointmentsForDate(selectedDate);
    }
  }, [selectedDate, fetchAppointmentsForDate]);

  function getAvailableDates(): string[] {
    if (!settings) return [];
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= settings.booking_window_days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayKey = DAY_KEYS[d.getDay()];
      if (settings.working_hours[dayKey]?.enabled) {
        dates.push(d.toISOString().split("T")[0]);
      }
    }
    return dates;
  }

  function getAvailableSlots(): TimeSlot[] {
    if (!settings || !selectedDate || !selectedTreatment) return [];

    const dayOfWeek = new Date(selectedDate).getDay();
    const dayKey = DAY_KEYS[dayOfWeek];
    const hours = settings.working_hours[dayKey];
    if (!hours?.enabled) return [];

    const [startH, startM] = hours.start.split(":").map(Number);
    const [endH, endM] = hours.end.split(":").map(Number);
    const duration = selectedTreatment.duration_minutes;
    const slots: TimeSlot[] = [];

    for (
      let minutes = startH * 60 + startM;
      minutes + duration <= endH * 60 + endM;
      minutes += 30
    ) {
      const slotStart = new Date(`${selectedDate}T00:00:00`);
      slotStart.setMinutes(minutes);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check if slot overlaps with existing appointments (including 15-min gap)
      const GAP_MS = 15 * 60 * 1000;
      const overlaps = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.starts_at).getTime();
        const apptEnd = new Date(appt.ends_at).getTime();
        return slotStart.getTime() < apptEnd + GAP_MS && slotEnd.getTime() + GAP_MS > apptStart;
      });

      // Check if slot overlaps with schedule blocks
      const blocked = scheduleBlocks.some((block) => {
        if (block.block_type === "one_time" && block.starts_at && block.ends_at) {
          const bStart = new Date(block.starts_at).getTime();
          const bEnd = new Date(block.ends_at).getTime();
          return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
        }
        if (block.block_type === "recurring" && block.day_of_week === dayOfWeek && block.start_time && block.end_time) {
          const exceptions: string[] = (block.exception_dates as string[]) ?? [];
          if (exceptions.includes(selectedDate)) return false;
          const [bsh, bsm] = block.start_time.split(":").map(Number);
          const [beh, bem] = block.end_time.split(":").map(Number);
          const blockStartMin = bsh * 60 + bsm;
          const blockEndMin = beh * 60 + bem;
          const slotStartMin = slotStart.getHours() * 60 + slotStart.getMinutes();
          const slotEndMin = slotEnd.getHours() * 60 + slotEnd.getMinutes();
          return slotStartMin < blockEndMin && slotEndMin > blockStartMin;
        }
        return false;
      });

      if (!overlaps && !blocked) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        slots.push({
          time: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
          label: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
        });
      }
    }

    return slots;
  }

  async function handleSubmit() {
    if (!selectedTreatment || !selectedDate || !selectedTime) return;

    setSubmitting(true);
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const [hh, mm] = selectedTime.split(":").map(Number);
      const startsAt = new Date(y, m - 1, d, hh, mm, 0);
      const endsAt = new Date(startsAt);
      endsAt.setMinutes(
        endsAt.getMinutes() + selectedTreatment.duration_minutes
      );

      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          treatment_type_id: selectedTreatment.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("Booking error:", errData);
        throw new Error(errData.error || "Booking failed");
      }
      setStep("done");
    } catch {
      toast.error("שגיאה בקביעת התור. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="py-12 text-center text-muted-foreground">
          טוען...
        </CardContent>
      </Card>
    );
  }

  if (step === "done") {
    return (
      <Card className="w-full max-w-lg">
        <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">התור נקבע בהצלחה!</h2>
          <p className="text-muted-foreground">
            {selectedTreatment?.name} · יום{" "}
            {DAY_LABELS[new Date(selectedDate).getDay()]}{" "}
            {new Date(selectedDate).toLocaleDateString("he-IL")} בשעה{" "}
            {selectedTime}
          </p>
          <p className="text-sm text-muted-foreground">
            תקבלו תזכורת לפני התור. להתראות!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {settings?.practice_name || "קביעת תור"}
        </CardTitle>
        <CardDescription>
          {settings?.practitioner_name && `${settings.practitioner_name} · `}
          {settings?.address}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step: Patient Info */}
        {step === "info" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>שם מלא *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="השם המלא שלך"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>טלפון *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-0000000"
                type="tel"
                dir="ltr"
              />
            </div>
            <Button
              onClick={() => setStep("treatment")}
              disabled={!fullName.trim() || !phone.trim()}
              className="w-full"
            >
              המשך
            </Button>
          </div>
        )}

        {/* Step: Choose Treatment */}
        {step === "treatment" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("info")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              חזרה
            </button>
            <p className="font-medium">בחירת סוג טיפול:</p>
            {treatments.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTreatment(t);
                  setStep("date");
                }}
                className="flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors text-start"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.duration_minutes} דקות
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{t.price} ₪</Badge>
              </button>
            ))}
          </div>
        )}

        {/* Step: Choose Date */}
        {step === "date" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("treatment")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              חזרה
            </button>
            <div className="flex items-center gap-2 text-sm mb-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{selectedTreatment?.name}</span>
            </div>
            <p className="font-medium">בחירת תאריך:</p>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-auto">
              {getAvailableDates().map((dateStr) => {
                const d = new Date(dateStr);
                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      setSelectedTime("");
                      setStep("time");
                    }}
                    className="p-3 rounded-lg border text-center hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="text-xs text-muted-foreground">
                      יום {DAY_LABELS[d.getDay()]}
                    </div>
                    <div className="font-medium">
                      {d.toLocaleDateString("he-IL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step: Choose Time */}
        {step === "time" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("date")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              חזרה
            </button>
            <div className="flex items-center gap-2 text-sm mb-2">
              <Calendar className="h-4 w-4" />
              <span>
                {selectedTreatment?.name} · יום{" "}
                {DAY_LABELS[new Date(selectedDate).getDay()]}{" "}
                {new Date(selectedDate).toLocaleDateString("he-IL")}
              </span>
            </div>
            <p className="font-medium">בחירת שעה:</p>
            {getAvailableSlots().length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                אין תורים פנויים בתאריך זה. נסו תאריך אחר.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-auto">
                {getAvailableSlots().map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => {
                      setSelectedTime(slot.time);
                      setStep("confirm");
                    }}
                    className="p-2 rounded-lg border text-center hover:border-primary hover:bg-primary/5 transition-colors"
                    dir="ltr"
                  >
                    <Clock className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-sm font-medium">{slot.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setStep("time")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              חזרה
            </button>
            <p className="font-medium text-center">סיכום התור:</p>
            <div className="rounded-lg border p-4 flex flex-col gap-2 bg-muted/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">שם:</span>
                <span className="font-medium">{fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">טלפון:</span>
                <span dir="ltr">{formatPhoneDisplay(phone)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">טיפול:</span>
                <span>{selectedTreatment?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">תאריך:</span>
                <span>
                  יום {DAY_LABELS[new Date(selectedDate).getDay()]}{" "}
                  {new Date(selectedDate).toLocaleDateString("he-IL")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">שעה:</span>
                <span dir="ltr">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">מחיר:</span>
                <span>{selectedTreatment?.price} ₪</span>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
            >
              {submitting ? "קובע תור..." : "אישור וקביעת תור"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
