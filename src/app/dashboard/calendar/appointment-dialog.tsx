"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import { createAppointment } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  full_name: string;
  phone: string;
}

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  patients,
  treatmentTypes,
  prefilledDate,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
  treatmentTypes: TreatmentType[];
  prefilledDate: string | null;
  onCreated: () => void;
}) {
  const [patientId, setPatientId] = useState("");
  const [treatmentTypeId, setTreatmentTypeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  // Reset form when dialog opens
  useMemo(() => {
    if (open) {
      if (prefilledDate) {
        const d = new Date(prefilledDate);
        // Use local date parts, not UTC (toISOString would shift the date in Israel timezone)
        const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
        setDate(localDate);
        setTime(
          `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
        );
      } else {
        setDate("");
        setTime("");
      }
      setPatientId("");
      setTreatmentTypeId("");
      setNotes("");
      setPatientSearch("");
    }
  }, [open, prefilledDate]);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedTreatment = treatmentTypes.find(
    (t) => t.id === treatmentTypeId
  );

  const filteredPatients = patientSearch
    ? patients.filter(
        (p) =>
          p.full_name.includes(patientSearch) ||
          p.phone.includes(patientSearch)
      )
    : patients;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !treatmentTypeId || !date || !time) {
      toast.error("נא למלא את כל השדות");
      return;
    }

    // Parse date and time as local timezone (not UTC)
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const startsAt = new Date(year, month - 1, day, hours, minutes, 0);

    // Warn if scheduling in the past
    if (startsAt < new Date()) {
      const confirmed = confirm("שים לב: התאריך שנבחר הוא בעבר. להמשיך בכל זאת?");
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const endsAt = new Date(startsAt);
      endsAt.setMinutes(
        endsAt.getMinutes() + (selectedTreatment?.duration_minutes ?? 60)
      );

      await createAppointment({
        patient_id: patientId,
        treatment_type_id: treatmentTypeId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        notes: notes || undefined,
      });

      toast.success("התור נקבע בהצלחה");
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("שגיאה ביצירת תור");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>תור חדש</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Patient selection */}
          <div className="flex flex-col gap-2">
            <Label>מטופל/ת *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                <span className="text-sm font-medium">
                  {selectedPatient.full_name}{" "}
                  <span className="text-muted-foreground" dir="ltr">
                    ({selectedPatient.phone})
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPatientId("");
                    setPatientSearch("");
                  }}
                >
                  שנה
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="חיפוש לפי שם או טלפון..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                <ScrollArea className="max-h-36 rounded-lg border">
                  {filteredPatients.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      לא נמצאו מטופלים
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-start"
                        onClick={() => setPatientId(p.id)}
                      >
                        <span>
                          {p.full_name}{" "}
                          <span className="text-muted-foreground" dir="ltr">
                            ({p.phone})
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </>
            )}
          </div>

          {/* Treatment type */}
          <div className="flex flex-col gap-2">
            <Label>סוג טיפול *</Label>
            <div className="flex flex-col gap-1">
              {treatmentTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors text-start",
                    treatmentTypeId === t.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                  onClick={() => setTreatmentTypeId(t.id)}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                    <span className="text-muted-foreground">
                      ({t.duration_minutes} דק׳ · {t.price} ₪)
                    </span>
                  </span>
                  {treatmentTypeId === t.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date & time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>שעה *</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>

          {selectedTreatment && (
            <p className="text-sm text-muted-foreground">
              משך הטיפול: {selectedTreatment.duration_minutes} דקות · מחיר:{" "}
              {selectedTreatment.price} ₪
            </p>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "שומר..." : "קבע תור"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
