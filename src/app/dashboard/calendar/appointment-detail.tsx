"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  User,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Save,
  History,
  Pencil,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateAppointmentStatus, deleteAppointment, updateAppointmentPrice } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/phone";

interface Appointment {
  id: string;
  patient_id: string;
  treatment_type_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  notes: string | null;
  price: number | null;
  patients: { id: string; full_name: string; phone: string };
  treatment_types: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    color: string;
  };
}

interface VisitLog {
  id: string;
  appointment_id: string;
  visit_date: string;
  notes: string | null;
}

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "ממתין לאישור", variant: "outline" },
  confirmed: { label: "מאושר", variant: "default" },
  completed: { label: "הושלם", variant: "secondary" },
  cancelled: { label: "בוטל", variant: "destructive" },
  no_show: { label: "לא הגיע/ה", variant: "destructive" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AppointmentDetail({
  open,
  onOpenChange,
  appointment,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onUpdated: () => void;
}) {
  const supabase = createClient();
  const [visitLog, setVisitLog] = useState<VisitLog | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [patientHistory, setPatientHistory] = useState<VisitLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");

  // Load visit log for this appointment + patient history
  const loadData = useCallback(async () => {
    if (!appointment) return;

    // Get visit log for this specific appointment
    const { data: logs } = await supabase
      .from("visit_logs")
      .select("*")
      .eq("appointment_id", appointment.id)
      .limit(1);

    if (logs && logs.length > 0) {
      setVisitLog(logs[0]);
      setVisitNotes(logs[0].notes ?? "");
    } else {
      setVisitLog(null);
      setVisitNotes("");
    }

    setShowHistory(false);
  }, [appointment, supabase]);

  useEffect(() => {
    if (open && appointment) {
      loadData();
    }
  }, [open, appointment, loadData]);

  async function loadPatientHistory() {
    if (!appointment) return;
    setLoadingHistory(true);

    const { data } = await supabase
      .from("visit_logs")
      .select("*, appointments(starts_at, treatment_types(name, color))")
      .eq("patient_id", appointment.patient_id)
      .neq("appointment_id", appointment.id)
      .order("visit_date", { ascending: false });

    setPatientHistory((data as VisitLog[]) ?? []);
    setShowHistory(true);
    setLoadingHistory(false);
  }

  async function handleSaveNotes() {
    if (!appointment) return;
    setSavingNotes(true);

    try {
      if (visitLog) {
        // Update existing
        const { error } = await supabase
          .from("visit_logs")
          .update({ notes: visitNotes })
          .eq("id", visitLog.id);
        if (error) throw error;
      } else {
        // Create new
        const visitDate = new Date(appointment.starts_at);
        const dateStr = `${visitDate.getFullYear()}-${(visitDate.getMonth() + 1).toString().padStart(2, "0")}-${visitDate.getDate().toString().padStart(2, "0")}`;

        const { data, error } = await supabase
          .from("visit_logs")
          .insert({
            appointment_id: appointment.id,
            patient_id: appointment.patient_id,
            visit_date: dateStr,
            notes: visitNotes,
          })
          .select("*")
          .single();
        if (error) throw error;
        setVisitLog(data);
      }
      toast.success("הערות הטיפול נשמרו");
    } catch {
      toast.error("שגיאה בשמירת הערות");
    } finally {
      setSavingNotes(false);
    }
  }

  if (!appointment) return null;

  const statusInfo = STATUS_MAP[appointment.status] ?? STATUS_MAP.pending;

  function startEditPrice() {
    const effectivePrice = appointment!.price ?? appointment!.treatment_types?.price ?? 0;
    setPriceValue(String(effectivePrice));
    setEditingPrice(true);
  }

  async function handleSavePrice() {
    const treatmentPrice = appointment!.treatment_types?.price ?? 0;
    const newPrice = priceValue !== "" ? parseFloat(priceValue) : null;
    const priceToSave = newPrice === treatmentPrice ? null : newPrice;
    try {
      await updateAppointmentPrice(appointment!.id, priceToSave);
      toast.success("המחיר עודכן");
      setEditingPrice(false);
      onUpdated();
    } catch {
      toast.error("שגיאה בעדכון מחיר");
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await updateAppointmentStatus(appointment!.id, status);
      toast.success("הסטטוס עודכן");
      onUpdated();
      if (status === "cancelled") onOpenChange(false);
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    }
  }

  async function handleDelete() {
    if (!confirm("למחוק את התור?")) return;
    try {
      await deleteAppointment(appointment!.id);
      toast.success("התור נמחק");
      onOpenChange(false);
      onUpdated();
    } catch {
      toast.error("שגיאה במחיקת תור");
    }
  }

  if (!open) return null;

  return (
    <div className="border-t bg-card shrink-0 flex flex-col" style={{ height: "66vh" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <h3 className="font-medium text-sm">פרטי תור</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              {appointment.source === "self_booked" && (
                <Badge variant="outline">הזמנה עצמית</Badge>
              )}
            </div>

            {/* Patient info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Link
                    href={`/dashboard/patients/${appointment.patient_id}`}
                    className="font-medium hover:underline"
                  >
                    {appointment.patients?.full_name}
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm" dir="ltr">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{formatPhoneDisplay(appointment.patients?.phone ?? "")}</span>
              </div>
            </div>

            <Separator />

            {/* Appointment info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: appointment.treatment_types?.color,
                  }}
                />
                <span className="font-medium">
                  {appointment.treatment_types?.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {formatDate(appointment.starts_at)} ·{" "}
                  {formatTime(appointment.starts_at)} -{" "}
                  {formatTime(appointment.ends_at)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {appointment.treatment_types?.duration_minutes} דקות
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">מחיר:</span>
                {editingPrice ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                      className="w-24 h-7 text-sm"
                      dir="ltr"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePrice();
                        if (e.key === "Escape") setEditingPrice(false);
                      }}
                    />
                    <span className="text-muted-foreground">₪</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={handleSavePrice}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={startEditPrice}
                  >
                    <span className="font-medium">
                      {appointment.price ?? appointment.treatment_types?.price} ₪
                    </span>
                    {appointment.price != null &&
                      appointment.price !== appointment.treatment_types?.price && (
                        <span className="text-xs text-muted-foreground">
                          (במקום {appointment.treatment_types?.price} ₪)
                        </span>
                      )}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {appointment.notes && (
              <>
                <Separator />
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{appointment.notes}</span>
                </div>
              </>
            )}

            <Separator />

            {/* Session Notes */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  הערות טיפול
                </p>
                {visitLog && (
                  <span className="text-xs text-muted-foreground">
                    {visitLog ? "עודכן" : "חדש"}
                  </span>
                )}
              </div>
              <Textarea
                placeholder="תלונות, ממצאים, המלצות..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                rows={4}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="w-fit"
              >
                <Save className="h-3 w-3 me-1" />
                {savingNotes ? "שומר..." : visitLog ? "עדכן הערות" : "שמור הערות"}
              </Button>
            </div>

            <Separator />

            {/* Patient History */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPatientHistory}
                disabled={loadingHistory}
                className="w-fit"
              >
                <History className="h-3 w-3 me-1" />
                {loadingHistory
                  ? "טוען..."
                  : showHistory
                    ? "רענן היסטוריה"
                    : "הצג היסטוריית טיפולים"}
              </Button>

              {showHistory && (
                <div className="flex flex-col gap-2 mt-1">
                  {patientHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      אין רשומות טיפול קודמות
                    </p>
                  ) : (
                    patientHistory.map((log: any) => (
                      <div
                        key={log.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-muted-foreground text-xs">
                            {formatShortDate(log.visit_date)}
                          </span>
                          {log.appointments?.treatment_types && (
                            <Badge
                              variant="secondary"
                              className="text-xs py-0"
                              style={{
                                borderColor:
                                  log.appointments.treatment_types.color,
                                borderWidth: 1,
                              }}
                            >
                              {log.appointments.treatment_types.name}
                            </Badge>
                          )}
                        </div>
                        {log.notes ? (
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {log.notes}
                          </p>
                        ) : (
                          <p className="text-muted-foreground/50 italic">
                            ללא הערות
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Status actions */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">עדכון סטטוס:</p>
              <div className="flex flex-wrap gap-2">
                {appointment.status !== "confirmed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange("confirmed")}
                  >
                    <CheckCircle className="h-3 w-3 me-1" />
                    אשר
                  </Button>
                )}
                {appointment.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange("completed")}
                  >
                    <CheckCircle className="h-3 w-3 me-1" />
                    הושלם
                  </Button>
                )}
                {appointment.status !== "no_show" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange("no_show")}
                  >
                    <AlertCircle className="h-3 w-3 me-1" />
                    לא הגיע/ה
                  </Button>
                )}
                {appointment.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange("cancelled")}
                  >
                    <XCircle className="h-3 w-3 me-1" />
                    בטל
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="w-fit"
            >
              <Trash2 className="h-3 w-3 me-1" />
              מחק תור
            </Button>
      </div>
    </div>
  );
}
