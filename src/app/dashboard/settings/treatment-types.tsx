"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTreatmentType,
  updateTreatmentType,
  deleteTreatmentType,
  toggleTreatmentType,
} from "./actions";
import { toast } from "sonner";

interface TreatmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  is_active: boolean;
  created_at: string;
}

export function TreatmentTypes({
  treatments,
}: {
  treatments: TreatmentType[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<TreatmentType | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingTreatment;

  function handleAdd() {
    setEditingTreatment(null);
    setDialogOpen(true);
  }

  function handleEdit(treatment: TreatmentType) {
    setEditingTreatment(treatment);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      if (isEditing) {
        await updateTreatmentType(editingTreatment.id, formData);
        toast.success("סוג טיפול עודכן בהצלחה");
      } else {
        await createTreatmentType(formData);
        toast.success("סוג טיפול נוסף בהצלחה");
      }
      setDialogOpen(false);
      setEditingTreatment(null);
      router.refresh();
    } catch {
      toast.error(isEditing ? "שגיאה בעדכון סוג טיפול" : "שגיאה בהוספת סוג טיפול");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את "${name}"?`)) return;
    try {
      await deleteTreatmentType(id);
      toast.success("סוג טיפול נמחק");
      router.refresh();
    } catch {
      toast.error("לא ניתן למחוק - ייתכן שיש תורים המשויכים לטיפול זה");
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleTreatmentType(id, !isActive);
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>סוגי טיפולים</CardTitle>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 me-1" />
            הוסף
          </Button>
        </CardHeader>
        <CardContent>
          {treatments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              עדיין לא הוגדרו סוגי טיפולים. הוסיפי את הטיפול הראשון!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {treatments.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="secondary">{t.duration_minutes} דק׳</Badge>
                    <span className="text-muted-foreground text-sm">
                      {t.price} ₪
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(t.id, t.is_active)}
                    >
                      {t.is_active ? "פעיל" : "מושבת"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(t.id, t.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTreatment(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "עריכת סוג טיפול" : "סוג טיפול חדש"}
            </DialogTitle>
          </DialogHeader>
          <form
            key={editingTreatment?.id ?? "new"}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">שם הטיפול</Label>
              <Input
                id="name"
                name="name"
                placeholder='למשל "טיפול ראשוני"'
                defaultValue={editingTreatment?.name ?? ""}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration_minutes">משך (דקות)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  defaultValue={editingTreatment?.duration_minutes ?? 60}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">מחיר (₪)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={editingTreatment?.price ?? 0}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="color">צבע ביומן</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={editingTreatment?.color ?? "#6366f1"}
                className="h-10 w-20"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingTreatment(null);
                }}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "שומר..." : isEditing ? "עדכון" : "הוסף"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
