"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText, Pencil, Trash2, AlertCircle } from "lucide-react";
import { createVisitLog, updateVisitLog, deleteVisitLog } from "./actions";
import { toast } from "sonner";

interface Visit {
  id: string;
  appointment_id: string;
  patient_id: string;
  visit_date: string;
  notes: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patients: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appointments: any;
}

interface PendingAppointment {
  id: string;
  starts_at: string;
  patient_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patients: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  treatment_types: any;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function VisitsList({
  visits,
  pendingAppointments,
}: {
  visits: Visit[];
  pendingAppointments: PendingAppointment[];
}) {
  const router = useRouter();
  const [newLogDialog, setNewLogDialog] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<PendingAppointment | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateLog() {
    if (!selectedAppointment) return;
    setLoading(true);
    try {
      await createVisitLog({
        appointment_id: selectedAppointment.id,
        patient_id: selectedAppointment.patient_id,
        visit_date: selectedAppointment.starts_at.split("T")[0],
        notes,
      });
      toast.success("רשומת ביקור נשמרה");
      setNewLogDialog(false);
      setSelectedAppointment(null);
      setNotes("");
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateLog() {
    if (!editingVisit) return;
    setLoading(true);
    try {
      await updateVisitLog(editingVisit.id, notes);
      toast.success("הרשומה עודכנה");
      setEditingVisit(null);
      setNotes("");
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את רשומת הביקור?")) return;
    try {
      await deleteVisitLog(id);
      toast.success("הרשומה נמחקה");
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">מעקב טיפולים</h2>
      </div>

      {/* Pending appointments needing visit logs */}
      {pendingAppointments.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              טיפולים שהושלמו ללא רשומה ({pendingAppointments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {pendingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white"
                >
                  <div>
                    <span className="font-medium">
                      {appt.patients?.full_name}
                    </span>
                    <span className="text-muted-foreground text-sm mx-2">·</span>
                    <span className="text-sm text-muted-foreground">
                      {appt.treatment_types?.name}
                    </span>
                    <span className="text-muted-foreground text-sm mx-2">·</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(appt.starts_at)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedAppointment(appt);
                      setNotes("");
                      setNewLogDialog(true);
                    }}
                  >
                    <Plus className="h-3 w-3 me-1" />
                    הוסף רשומה
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visit log history */}
      {visits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>אין רשומות טיפול עדיין.</p>
            <p className="text-sm">
              סמנו תורים כ״הושלם״ ביומן כדי להוסיף רשומת טיפול.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visits.map((visit) => (
            <Card key={visit.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">
                        {visit.patients?.full_name}
                      </span>
                      {visit.appointments?.treatment_types && (
                        <Badge
                          variant="secondary"
                          style={{
                            borderColor:
                              visit.appointments.treatment_types.color,
                            borderWidth: 1,
                          }}
                        >
                          {visit.appointments.treatment_types.name}
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(visit.visit_date)}
                      </span>
                    </div>
                    {visit.notes ? (
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {visit.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic">
                        ללא הערות
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ms-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingVisit(visit);
                        setNotes(visit.notes ?? "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(visit.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New visit log dialog */}
      <Dialog open={newLogDialog} onOpenChange={setNewLogDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>רשומת טיפול חדשה</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="flex flex-col gap-4">
              <div className="text-sm flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                <div>
                  <span className="text-muted-foreground">מטופל/ת: </span>
                  <span className="font-medium">
                    {selectedAppointment.patients?.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">טיפול: </span>
                  <span>{selectedAppointment.treatment_types?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">תאריך: </span>
                  <span>{formatDate(selectedAppointment.starts_at)}</span>
                </div>
              </div>
              <Separator />
              <Textarea
                placeholder="הערות מהטיפול... (תלונות, ממצאים, המלצות)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setNewLogDialog(false)}
                >
                  ביטול
                </Button>
                <Button onClick={handleCreateLog} disabled={loading}>
                  {loading ? "שומר..." : "שמור"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit visit log dialog */}
      <Dialog
        open={!!editingVisit}
        onOpenChange={(open) => !open && setEditingVisit(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת רשומת טיפול</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingVisit(null)}
              >
                ביטול
              </Button>
              <Button onClick={handleUpdateLog} disabled={loading}>
                {loading ? "שומר..." : "עדכן"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
