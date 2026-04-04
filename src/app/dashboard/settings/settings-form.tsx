"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updatePracticeSettings } from "./actions";
import { toast } from "sonner";

interface PracticeSettings {
  id: string;
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
  working_hours: Record<string, { start: string; end: string; enabled: boolean }>;
  booking_window_days: number;
  reminder_hours_before: number;
  created_at: string;
  updated_at: string;
}

const DAY_LABELS: Record<string, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};

const DAYS_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function SettingsForm({
  settings,
}: {
  settings: PracticeSettings | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const workingHours = (settings?.working_hours ?? {}) as Record<
    string,
    { start: string; end: string; enabled: boolean }
  >;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePracticeSettings(new FormData(e.currentTarget));
      toast.success("ההגדרות נשמרו בהצלחה");
      router.refresh();
    } catch (err) {
      console.error("Settings save error:", err);
      toast.error("שגיאה בשמירת הגדרות: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setLoading(false);
    }
  }

  // Key forces full remount when settings change (avoids controlled/uncontrolled warning)
  const formKey = settings?.updated_at ?? "new";

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטי מרפאה</CardTitle>
      </CardHeader>
      <CardContent>
        <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="practice_name">שם המרפאה</Label>
              <Input
                id="practice_name"
                name="practice_name"
                defaultValue={settings?.practice_name ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="practitioner_name">שם המטפל/ת</Label>
              <Input
                id="practitioner_name"
                name="practitioner_name"
                defaultValue={settings?.practitioner_name ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">טלפון מרפאה</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={settings?.phone ?? ""}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">כתובת</Label>
              <Input
                id="address"
                name="address"
                defaultValue={settings?.address ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking_window_days">חלון הזמנה (ימים קדימה)</Label>
              <Input
                id="booking_window_days"
                name="booking_window_days"
                type="number"
                defaultValue={settings?.booking_window_days ?? 30}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reminder_hours_before">
                תזכורת WhatsApp (שעות לפני)
              </Label>
              <Input
                id="reminder_hours_before"
                name="reminder_hours_before"
                type="number"
                defaultValue={settings?.reminder_hours_before ?? 24}
              />
            </div>
          </div>

          <Separator className="my-2" />

          <h3 className="font-semibold">שעות פעילות</h3>
          <div className="flex flex-col gap-3">
            {DAYS_ORDER.map((day) => {
              const dayHours = workingHours[day] ?? {
                start: "09:00",
                end: "18:00",
                enabled: day !== "saturday",
              };
              return (
                <div key={day} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-20">
                    <input
                      type="checkbox"
                      name={`${day}_enabled`}
                      defaultChecked={dayHours.enabled}
                      className="rounded"
                    />
                    <span className="text-sm">{DAY_LABELS[day]}</span>
                  </label>
                  <Input
                    name={`${day}_start`}
                    type="time"
                    defaultValue={dayHours.start}
                    className="w-28"
                    dir="ltr"
                  />
                  <span className="text-muted-foreground">עד</span>
                  <Input
                    name={`${day}_end`}
                    type="time"
                    defaultValue={dayHours.end}
                    className="w-28"
                    dir="ltr"
                  />
                </div>
              );
            })}
          </div>

          <Button type="submit" className="w-fit mt-2" disabled={loading}>
            {loading ? "שומר..." : "שמור הגדרות"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
