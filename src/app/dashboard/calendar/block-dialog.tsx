"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createOneTimeBlock, createRecurringBlock } from "./block-actions";
import { toast } from "sonner";

const DAY_LABELS: Record<number, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

export function BlockDialog({
  open,
  onOpenChange,
  prefilledDate,
  prefilledHour,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledDate: string | null;
  prefilledHour: number | null;
  onCreated: () => void;
}) {
  const [blockType, setBlockType] = useState<"one_time" | "recurring">("one_time");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  if (open && prefilledDate && !date) {
    const d = new Date(prefilledDate);
    const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    setDate(localDate);
    setDayOfWeek(d.getDay());
    if (prefilledHour !== null) {
      setStartTime(`${prefilledHour.toString().padStart(2, "0")}:00`);
      setEndTime(`${(prefilledHour + 1).toString().padStart(2, "0")}:00`);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setDate("");
    setStartTime("");
    setEndTime("");
    setReason("");
    setBlockType("one_time");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startTime || !endTime) {
      toast.error("נא למלא שעת התחלה וסיום");
      return;
    }

    setLoading(true);
    try {
      if (blockType === "one_time") {
        if (!date) {
          toast.error("נא לבחור תאריך");
          setLoading(false);
          return;
        }
        const [year, month, day] = date.split("-").map(Number);
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startsAt = new Date(year, month - 1, day, sh, sm, 0);
        const endsAt = new Date(year, month - 1, day, eh, em, 0);

        await createOneTimeBlock({
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          reason: reason || undefined,
        });
      } else {
        await createRecurringBlock({
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          reason: reason || undefined,
        });
      }
      toast.success("חסימה נוספה");
      handleClose();
      onCreated();
    } catch {
      toast.error("שגיאה ביצירת חסימה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>חסימת זמן ביומן</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Block type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={blockType === "one_time" ? "default" : "outline"}
              onClick={() => setBlockType("one_time")}
            >
              חד פעמי
            </Button>
            <Button
              type="button"
              size="sm"
              variant={blockType === "recurring" ? "default" : "outline"}
              onClick={() => setBlockType("recurring")}
            >
              חוזר שבועי
            </Button>
          </div>

          {blockType === "one_time" ? (
            <div className="flex flex-col gap-2">
              <Label>תאריך</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>יום בשבוע</Label>
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={dayOfWeek === d ? "default" : "outline"}
                    onClick={() => setDayOfWeek(d)}
                  >
                    {DAY_LABELS[d]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>משעה</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>עד שעה</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>סיבה (אופציונלי)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="למשל: הפסקת צהריים, ישיבה..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "שומר..." : "חסום"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
