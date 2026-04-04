"use client";

import { useState, useEffect } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  discount_percent: number;
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
  const [priceOverride, setPriceOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
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
      setPriceOverride("");
      setPatientSearch("");
      setShowAddPatient(false);
      setNewPatientName("");
      setNewPatientPhone("");
    }
  }, [open, prefilledDate]);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedTreatment = treatmentTypes.find(
    (t) => t.id === treatmentTypeId
  );

  // Show new patient preview if adding new patient is complete
  const newPatientPreview = !showAddPatient && newPatientName.trim() && newPatientPhone.trim()
    ? { full_name: newPatientName.trim(), phone: normalizePhone(newPatientPhone), discount_percent: 0 }
    : null;

  // Auto-apply patient discount when patient or treatment selection changes
  const currentPatient = selectedPatient || (showAddPatient && newPatientName.trim() && newPatientPhone.trim()
    ? { discount_percent: 0 }
    : null) || newPatientPreview;
  const discount = currentPatient?.discount_percent ?? 0;
  const basePrice = selectedTreatment?.price ?? 0;
  const discountedPrice = discount > 0
    ? Math.round(basePrice * (1 - discount / 100) * 100) / 100
    : basePrice;

  const filteredPatients = patientSearch
    ? patients.filter(
        (p) =>
          p.full_name.includes(patientSearch) ||
          p.phone.includes(patientSearch)
      )
    : patients;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!treatmentTypeId || !date || !time) {
      toast.error("נא למלא את כל השדות");
      return;
    }

    let finalPatientId = patientId;

    // Create new patient if needed
    if (showAddPatient) {
      if (!newPatientName.trim() || !newPatientPhone.trim()) {
        toast.error("נא למלא שם וטלפון למטופל החדש");
        return;
      }

      try {
        const supabase = createClient();
        const { data: newPatient, error } = await supabase
          .from("patients")
          .insert({
            full_name: newPatientName.trim(),
            phone: normalizePhone(newPatientPhone),
          })
          .select("id")
          .single();

        if (error) throw error;
        finalPatientId = newPatient.id;
      } catch {
        toast.error("שגיאה ביצירת מטופל חדש");
        return;
      }
    }

    if (!finalPatientId) {
      toast.error("נא לבחור מטופל");
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

      // Check for overlapping appointments (with 15-min gap)
      const GAP_MS = 15 * 60 * 1000;
      const checkStart = new Date(startsAt.getTime() - GAP_MS);
      const checkEnd = new Date(endsAt.getTime() + GAP_MS);

      const supabase = createClient();
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at")
        .neq("status", "cancelled")
        .lt("starts_at", checkEnd.toISOString())
        .gt("ends_at", checkStart.toISOString());

      if (conflicts && conflicts.length > 0) {
        toast.error("יש תור חופף בטווח הזמן הזה (כולל 15 דקות הפרש)");
        setLoading(false);
        return;
      }

      // Check for schedule blocks
      const { data: blockConflicts } = await supabase
        .from("schedule_blocks")
        .select("*");

      const dayOfWeek = startsAt.getDay();
      const hasBlockConflict = (blockConflicts ?? []).some((block: { block_type: string; starts_at: string | null; ends_at: string | null; day_of_week: number | null; start_time: string | null; end_time: string | null }) => {
        if (block.block_type === "one_time" && block.starts_at && block.ends_at) {
          const bStart = new Date(block.starts_at).getTime();
          const bEnd = new Date(block.ends_at).getTime();
          return startsAt.getTime() < bEnd && endsAt.getTime() > bStart;
        }
        if (block.block_type === "recurring" && block.day_of_week === dayOfWeek && block.start_time && block.end_time) {
          const [bsh, bsm] = block.start_time.split(":").map(Number);
          const [beh, bem] = block.end_time.split(":").map(Number);
          const blockStartMin = bsh * 60 + bsm;
          const blockEndMin = beh * 60 + bem;
          const slotStartMin = startsAt.getHours() * 60 + startsAt.getMinutes();
          const slotEndMin = endsAt.getHours() * 60 + endsAt.getMinutes();
          return slotStartMin < blockEndMin && slotEndMin > blockStartMin;
        }
        return false;
      });

      if (hasBlockConflict) {
        toast.error("הזמן חסום ביומן. נא לבחור זמן אחר.");
        setLoading(false);
        return;
      }

      const price = priceOverride !== ""
        ? parseFloat(priceOverride)
        : discount > 0
          ? discountedPrice
          : null;

      await createAppointment({
        patient_id: finalPatientId,
        treatment_type_id: treatmentTypeId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        notes: notes || undefined,
        price,
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
            {selectedPatient || newPatientPreview ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                <span className="text-sm font-medium">
                  {(selectedPatient || newPatientPreview)?.full_name}{" "}
                  <span className="text-muted-foreground" dir="ltr">
                    ({(selectedPatient || newPatientPreview)?.phone})
                  </span>
                  {newPatientPreview && (
                    <span className="text-xs text-primary ml-2">(חדש)</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPatientId("");
                    setPatientSearch("");
                    setShowAddPatient(false);
                    setNewPatientName("");
                    setNewPatientPhone("");
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
                {showAddPatient ? (
                  <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">מטופל חדש</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddPatient(false);
                          setNewPatientName("");
                          setNewPatientPhone("");
                        }}
                      >
                        ביטול
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="שם מלא"
                        value={newPatientName}
                        onChange={(e) => setNewPatientName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                      />
                      <Input
                        placeholder="טלפון"
                        value={newPatientPhone}
                        onChange={(e) => setNewPatientPhone(e.target.value)}
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="max-h-36 rounded-lg border">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          לא נמצאו מטופלים
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddPatient(true)}
                        >
                          הוסף מטופל חדש
                        </Button>
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
                )}
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
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                משך הטיפול: {selectedTreatment.duration_minutes} דקות · מחיר
                בסיס: {selectedTreatment.price} ₪
                {discount > 0 && (
                  <span className="text-primary font-medium">
                    {" "}· הנחת מטופל: {discount}% → {discountedPrice} ₪
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-1">
                <Label>מחיר (₪)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`${discountedPrice}`}
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  dir="ltr"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {discount > 0
                    ? "המחיר כולל הנחת מטופל. ניתן לשנות ידנית."
                    : "השאירו ריק לשימוש במחיר ברירת המחדל"}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-2">
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                }
              }}
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
