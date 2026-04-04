"use client";

import { useRouter } from "next/navigation";
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
import { createPatient, updatePatient } from "./actions";
import { toast } from "sonner";
import { useState } from "react";

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  discount_percent: number;
  created_at: string;
  updated_at: string;
}

export function PatientDialog({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEditing = !!patient;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      if (isEditing) {
        await updatePatient(patient.id, formData);
        toast.success("המטופל עודכן בהצלחה");
      } else {
        await createPatient(formData);
        toast.success("מטופל חדש נוסף בהצלחה");
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת מטופל");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "עריכת מטופל" : "מטופל חדש"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">שם מלא *</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={patient?.full_name ?? ""}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">טלפון *</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={patient?.phone ?? ""}
              required
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={patient?.email ?? ""}
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="date_of_birth">תאריך לידה</Label>
            <Input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              defaultValue={patient?.date_of_birth ?? ""}
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address">כתובת</Label>
            <Input
              id="address"
              name="address"
              defaultValue={patient?.address ?? ""}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="discount_percent">הנחה (%)</Label>
            <Input
              id="discount_percent"
              name="discount_percent"
              type="number"
              min={0}
              max={100}
              defaultValue={patient?.discount_percent ?? 0}
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={patient?.notes ?? ""}
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
              {loading ? "שומר..." : isEditing ? "עדכון" : "הוספה"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
