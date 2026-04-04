"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTreatmentType,
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
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await createTreatmentType(new FormData(e.currentTarget));
      toast.success("סוג טיפול נוסף בהצלחה");
      setDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("שגיאה בהוספת סוג טיפול");
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
          <Button size="sm" onClick={() => setDialogOpen(true)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>סוג טיפול חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">שם הטיפול</Label>
              <Input
                id="name"
                name="name"
                placeholder='למשל "טיפול ראשוני"'
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
                  defaultValue={60}
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
                  defaultValue={0}
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
                defaultValue="#6366f1"
                className="h-10 w-20"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "שומר..." : "הוסף"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
