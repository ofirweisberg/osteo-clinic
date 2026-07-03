"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Upload,
  Camera,
  Paperclip,
  Loader2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  updateAppointmentStatus,
  deleteAppointment,
  updateAppointmentPrice,
  updateAppointmentDateTime,
  getVisitLog,
  updateVisitLogNotes,
  createVisitLogForAppointment,
  getPatientHistory,
  getAppointmentFiles,
  uploadAppointmentFile,
  getFileSignedUrl,
  deleteAppointmentFile,
} from "./actions";
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

interface AppFile {
  id: string;
  appointment_id: string;
  patient_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
}

// One past-visit row in the history: any of the patient's other appointments
// that has notes and/or files attached.
interface HistoryEntry {
  id: string; // appointment id
  starts_at: string;
  treatment: { name: string; color: string } | null;
  notes: string | null;
  files: AppFile[];
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

// Local (browser = Israel) date/time strings for the <input> fields. We build
// the new instant with the local-date constructor on save — never parse a naive
// "YYYY-MM-DDTHH:mm" string (that's read as UTC and shifts the date).
function toDateInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function toTimeInput(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

const isImage = (mime: string | null) => !!mime && mime.startsWith("image/");

// Supabase to-one joins may arrive as an object or a single-element array.
const one = <T,>(x: T | T[] | null | undefined): T | null =>
  Array.isArray(x) ? x[0] ?? null : x ?? null;

export function AppointmentDetail({
  open,
  onOpenChange,
  appointment,
  onUpdated,
  size = "half",
  onSizeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onUpdated: () => void;
  size?: "full" | "half";
  onSizeChange?: (size: "full" | "half") => void;
}) {
  const [visitLog, setVisitLog] = useState<VisitLog | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");

  // Date/time editing
  const [editingDateTime, setEditingDateTime] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [savingDateTime, setSavingDateTime] = useState(false);

  // Files for this appointment
  const [files, setFiles] = useState<AppFile[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Signed URLs (file id → URL) for files shown in the history entries.
  const [historyFileUrls, setHistoryFileUrls] = useState<Record<string, string>>(
    {}
  );

  // Sign every file's storage path for inline viewing (images) / opening.
  const signFiles = useCallback(async (list: AppFile[]) => {
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (f) => {
        try {
          urls[f.id] = await getFileSignedUrl(f.storage_path);
        } catch {
          // Skip files we couldn't sign — the tile still renders.
        }
      })
    );
    return urls;
  }, []);

  const loadFiles = useCallback(async () => {
    if (!appointment) return;
    try {
      const list = ((await getAppointmentFiles(appointment.id)) as AppFile[]) ?? [];
      setFiles(list);
      setFileUrls(await signFiles(list));
    } catch {
      // Table/container not migrated yet — keep the panel working regardless.
      setFiles([]);
      setFileUrls({});
    }
  }, [appointment, signFiles]);

  // Load visit log for this appointment + reset transient state on open.
  const loadData = useCallback(async () => {
    if (!appointment) return;

    let log: VisitLog | null = null;
    try {
      log = (await getVisitLog(appointment.id)) as VisitLog | null;
    } catch {
      log = null;
    }

    if (log) {
      setVisitLog(log);
      setVisitNotes(log.notes ?? "");
    } else {
      setVisitLog(null);
      setVisitNotes("");
    }

    setShowHistory(false);
    setHistoryLoaded(false);
    setEditingDateTime(false);
    setEditingPrice(false);
    loadFiles();
  }, [appointment, loadFiles]);

  useEffect(() => {
    if (open && appointment) {
      loadData();
    }
  }, [open, appointment, loadData]);

  async function handleToggleHistory() {
    if (!appointment) return;
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (!historyLoaded) {
      setLoadingHistory(true);
      const pid = appointment.patient_id;
      const curId = appointment.id;

      // History is appointment-based: every OTHER appointment for the patient,
      // enriched with its notes (visit_logs) and files (appointment_files). We
      // then keep entries that have notes OR files — so files show even when no
      // note was ever written for that visit.
      type ApptRow = {
        id: string;
        starts_at: string;
        treatment_types:
          | { name: string; color: string }
          | { name: string; color: string }[]
          | null;
      };
      type LogRow = { appointment_id: string; notes: string | null };

      try {
        const history = await getPatientHistory(pid, curId);

        const notesByAppt: Record<string, string | null> = {};
        for (const l of (history.logs as LogRow[] | null) ?? []) {
          notesByAppt[l.appointment_id] = l.notes;
        }

        // Files grouped by appointment (table/container may not be migrated yet).
        const filesByAppt: Record<string, AppFile[]> = {};
        try {
          const all = (history.files as AppFile[]) ?? [];
          for (const f of all) (filesByAppt[f.appointment_id] ??= []).push(f);
          setHistoryFileUrls(await signFiles(all));
        } catch {
          setHistoryFileUrls({});
        }

        const entries: HistoryEntry[] = ((history.appointments as ApptRow[] | null) ?? [])
          .map((a) => ({
            id: a.id,
            starts_at: a.starts_at,
            treatment: one(a.treatment_types),
            notes: notesByAppt[a.id] ?? null,
            files: filesByAppt[a.id] ?? [],
          }))
          .filter((e) => (e.notes && e.notes.trim().length > 0) || e.files.length > 0);

        setHistoryEntries(entries);
      } catch {
        setHistoryEntries([]);
        setHistoryFileUrls({});
      }
      setHistoryLoaded(true);
      setLoadingHistory(false);
    }
    setShowHistory(true);
  }

  async function handleSaveNotes() {
    if (!appointment) return;
    setSavingNotes(true);

    try {
      if (visitLog) {
        await updateVisitLogNotes(visitLog.id, visitNotes);
      } else {
        const visitDate = new Date(appointment.starts_at);
        const dateStr = `${visitDate.getFullYear()}-${(visitDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${visitDate.getDate().toString().padStart(2, "0")}`;

        const data = await createVisitLogForAppointment({
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          visit_date: dateStr,
          notes: visitNotes,
        });
        setVisitLog(data as VisitLog);
      }
      toast.success("הערות הטיפול נשמרו");
    } catch {
      toast.error("שגיאה בשמירת הערות");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!appointment || !fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("appointmentId", appointment.id);
        formData.append("patientId", appointment.patient_id);
        await uploadAppointmentFile(formData);
      }
      toast.success("הקובץ הועלה");
      await loadFiles();
    } catch {
      toast.error("שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(f: AppFile) {
    if (!confirm("למחוק את הקובץ?")) return;
    try {
      await deleteAppointmentFile(f.id);
      setFiles((prev) => prev.filter((x) => x.id !== f.id));
      toast.success("הקובץ נמחק");
    } catch {
      toast.error("שגיאה במחיקת קובץ");
    }
  }

  if (!appointment) return null;

  const statusInfo = STATUS_MAP[appointment.status] ?? STATUS_MAP.pending;

  function startEditPrice() {
    const effectivePrice =
      appointment!.price ?? appointment!.treatment_types?.price ?? 0;
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

  function startEditDateTime() {
    setDateValue(toDateInput(appointment!.starts_at));
    setTimeValue(toTimeInput(appointment!.starts_at));
    setEditingDateTime(true);
  }

  async function handleSaveDateTime() {
    if (!dateValue || !timeValue) return;
    const [y, m, d] = dateValue.split("-").map(Number);
    const [hh, mm] = timeValue.split(":").map(Number);
    // Local constructor → correct Israel instant; toISOString() stores UTC.
    const starts = new Date(y, m - 1, d, hh, mm, 0, 0);
    const duration = appointment!.treatment_types?.duration_minutes ?? 60;
    const ends = new Date(starts.getTime() + duration * 60000);
    setSavingDateTime(true);
    try {
      await updateAppointmentDateTime(
        appointment!.id,
        starts.toISOString(),
        ends.toISOString()
      );
      toast.success("מועד התור עודכן");
      setEditingDateTime(false);
      onUpdated();
    } catch {
      toast.error("שגיאה בעדכון מועד התור");
    } finally {
      setSavingDateTime(false);
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

  // Small reusable file-grid renderer (used for the current appointment and
  // each history entry). `urls` maps file id → signed URL.
  const renderFiles = (
    list: AppFile[],
    urls: Record<string, string>,
    onDelete?: (f: AppFile) => void
  ) => (
    <div className="flex flex-wrap gap-2">
      {list.map((f) => {
        const url = urls[f.id];
        return (
          <div key={f.id} className="relative group">
            {isImage(f.mime_type) && url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={f.file_name}
                  className="h-20 w-20 rounded-md object-cover border"
                />
              </a>
            ) : (
              <a
                href={url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border p-1 text-center hover:bg-muted"
              >
                <Paperclip className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2 break-all">
                  {f.file_name}
                </span>
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(f)}
                className="absolute -top-1.5 -end-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-white group-hover:flex"
                aria-label="מחק קובץ"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`border-t bg-card flex flex-col ${
        size === "full" ? "flex-1 min-h-0" : "shrink-0"
      }`}
      style={size === "full" ? undefined : { height: "66vh" }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <h3 className="font-medium text-sm">פרטי תור</h3>
        <div className="flex items-center gap-1">
          {onSizeChange && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onSizeChange(size === "full" ? "half" : "full")}
              aria-label={size === "full" ? "הקטן לחצי מסך" : "הגדל למסך מלא"}
              title={size === "full" ? "הקטן לחצי מסך" : "הגדל למסך מלא"}
            >
              {size === "full" ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
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

              {/* Date + time (editable) */}
              {editingDateTime ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateValue}
                      onChange={(e) => setDateValue(e.target.value)}
                      className="h-8 w-40 text-sm"
                    />
                    <Input
                      type="time"
                      value={timeValue}
                      onChange={(e) => setTimeValue(e.target.value)}
                      className="h-8 w-28 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDateTime}
                      disabled={savingDateTime}
                    >
                      <Save className="h-3 w-3 me-1" />
                      {savingDateTime ? "שומר..." : "שמור מועד"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingDateTime(false)}
                    >
                      ביטול
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    משך הטיפול ({appointment.treatment_types?.duration_minutes} דקות) נשמר —
                    שעת הסיום מתעדכנת אוטומטית.
                  </p>
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors w-fit"
                  onClick={startEditDateTime}
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatDate(appointment.starts_at)} ·{" "}
                    {formatTime(appointment.starts_at)} -{" "}
                    {formatTime(appointment.ends_at)}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}

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
                  <span className="text-xs text-muted-foreground">עודכן</span>
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

            {/* Files / photos */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                קבצים ותמונות
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 me-1 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3 me-1" />
                  )}
                  העלה קובץ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-3 w-3 me-1" />
                  צלם תמונה
                </Button>
              </div>
              {files.length > 0 && renderFiles(files, fileUrls, handleDeleteFile)}
            </div>

            <Separator />

            {/* Patient History (toggle) */}
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleHistory}
                disabled={loadingHistory}
                className="w-fit"
              >
                {loadingHistory ? (
                  <Loader2 className="h-3 w-3 me-1 animate-spin" />
                ) : (
                  <History className="h-3 w-3 me-1" />
                )}
                {loadingHistory
                  ? "טוען..."
                  : showHistory
                    ? "הסתר היסטוריית טיפולים"
                    : "הצג היסטוריית טיפולים"}
                {!loadingHistory &&
                  (showHistory ? (
                    <ChevronUp className="h-3 w-3 ms-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ms-1" />
                  ))}
              </Button>

              {showHistory && (
                <div className="flex flex-col gap-2 mt-1">
                  {historyEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      אין רשומות טיפול קודמות
                    </p>
                  ) : (
                    historyEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-muted-foreground text-xs">
                            {formatShortDate(entry.starts_at)}
                          </span>
                          {entry.treatment && (
                            <Badge
                              variant="secondary"
                              className="text-xs py-0"
                              style={{
                                borderColor: entry.treatment.color,
                                borderWidth: 1,
                              }}
                            >
                              {entry.treatment.name}
                            </Badge>
                          )}
                        </div>
                        {entry.notes ? (
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {entry.notes}
                          </p>
                        ) : (
                          <p className="text-muted-foreground/50 italic">
                            ללא הערות
                          </p>
                        )}
                        {entry.files.length > 0 && (
                          <div className="mt-2">
                            {renderFiles(entry.files, historyFileUrls)}
                          </div>
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
