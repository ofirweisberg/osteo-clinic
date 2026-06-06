"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Plus, Ban, Repeat, CheckCircle, Clock, XCircle, AlertCircle, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { AppointmentDialog } from "./appointment-dialog";
import { AppointmentDetail } from "./appointment-detail";
import { BlockDialog } from "./block-dialog";
import { deleteScheduleBlock, addBlockException } from "./block-actions";
import { updateAppointmentStatus, deleteAppointment } from "./actions";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "confirmed", label: "מאושר", icon: CheckCircle, color: "text-blue-500" },
  { value: "completed", label: "הושלם", icon: CheckCircle, color: "text-green-500" },
  { value: "pending", label: "ממתין", icon: Clock, color: "text-yellow-500" },
  { value: "cancelled", label: "בוטל", icon: XCircle, color: "text-red-500" },
  { value: "no_show", label: "לא הגיע/ה", icon: AlertCircle, color: "text-orange-500" },
];

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

interface ScheduleBlock {
  id: string;
  block_type: "one_time" | "recurring";
  starts_at: string | null;
  ends_at: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  exception_dates: string[];
}

const DAY_LABELS: Record<string, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

const DAY_LABELS_SHORT: Record<string, string> = {
  0: "א׳",
  1: "ב׳",
  2: "ג׳",
  3: "ד׳",
  4: "ה׳",
  5: "ו׳",
  6: "ש׳",
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

// Compute overlay rectangles for a given day
interface OverlayZone {
  topPx: number;
  heightPx: number;
  type: "non_working" | "blocked";
  blockId?: string;
  blockType?: "one_time" | "recurring";
  reason?: string;
  dayDate?: string; // YYYY-MM-DD for recurring exception
}

function minutesToPx(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

function clampMinutes(m: number): number {
  return Math.max(0, Math.min(m, TOTAL_MINUTES));
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m - START_HOUR * 60;
}

export function WeeklyCalendar({
  patients,
  treatmentTypes,
  workingHours,
}: {
  patients: Patient[];
  treatmentTypes: TreatmentType[];
  workingHours: Record<string, { start: string; end: string; enabled: boolean }>;
}) {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockPrefilledDate, setBlockPrefilledDate] = useState<string | null>(null);
  const [blockPrefilledHour, setBlockPrefilledHour] = useState<number | null>(null);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [blockMenuPos, setBlockMenuPos] = useState({ x: 0, y: 0 });
  const [blockMenuZone, setBlockMenuZone] = useState<OverlayZone | null>(null);
  const [apptMenuOpen, setApptMenuOpen] = useState(false);
  const [apptMenuPos, setApptMenuPos] = useState({ x: 0, y: 0 });
  const [apptMenuTarget, setApptMenuTarget] = useState<Appointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSize, setDetailSize] = useState<"full" | "half">("full");
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const desktopGridRef = useRef<HTMLDivElement>(null);
  const mobileGridRef = useRef<HTMLDivElement>(null);
  // Deep-link from the dashboard agenda (?appt=&date=): which appointment to
  // auto-open, and whether we've already done so this mount.
  const pendingApptId = useRef<string | null>(null);
  const consumedDeepLink = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const weekEnd = new Date(currentWeek);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [apptRes, blocksRes] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "*, patients(id, full_name, phone), treatment_types(id, name, duration_minutes, price, color)"
        )
        .gte("starts_at", currentWeek.toISOString())
        .lt("starts_at", weekEnd.toISOString())
        .neq("status", "cancelled")
        .order("starts_at"),
      supabase.from("schedule_blocks").select("*"),
    ]);

    setAppointments((apptRes.data as Appointment[]) ?? []);
    setBlocks((blocksRes.data as ScheduleBlock[]) ?? []);
    setLoading(false);
  }, [currentWeek]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount / week change
    fetchData();
  }, [fetchData]);

  // Deep link from the dashboard agenda: jump to the appointment's week so its
  // week gets fetched; the effect below opens the detail once it's loaded. Read
  // from window.location (not useSearchParams) to avoid the Suspense/build
  // requirement and any static de-opt.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const appt = params.get("appt");
    const date = params.get("date");
    if (!appt) return;
    pendingApptId.current = appt;
    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      if (y && m && d) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL on mount
        setCurrentWeek(getWeekStart(new Date(y, m - 1, d, 12, 0, 0)));
      }
    }
  }, []);

  function navigateWeek(direction: number) {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + direction * 7);
    setCurrentWeek(next);
  }

  function goToToday() {
    setCurrentWeek(getWeekStart(new Date()));
    setSelectedDay(new Date().getDay());
  }

  function handleSlotClick(dayIndex: number, hour: number) {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + dayIndex);
    date.setHours(hour, 0, 0, 0);
    setPrefilledDate(date.toISOString());
    setSelectedAppointment(null);
    setDialogOpen(true);
  }

  function handleSlotRightClick(e: React.MouseEvent, dayIndex: number, hour: number) {
    e.preventDefault();
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + dayIndex);
    date.setHours(hour, 0, 0, 0);
    setBlockPrefilledDate(date.toISOString());
    setBlockPrefilledHour(hour);
    setBlockDialogOpen(true);
  }

  function handleAppointmentClick(appt: Appointment) {
    setSelectedAppointment(appt);
    setDetailSize("full"); // open full by default; user can shrink to half
    setDetailOpen(true);

    requestAnimationFrame(() => {
      const start = new Date(appt.starts_at);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const scrollTop = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 20;
      const grid = desktopGridRef.current ?? mobileGridRef.current;
      if (grid) {
        grid.scrollTo({ top: Math.max(0, scrollTop), behavior: "smooth" });
      }
    });
  }

  // Once the deep-linked appointment's week has loaded, open its detail panel.
  useEffect(() => {
    if (consumedDeepLink.current || loading) return;
    const id = pendingApptId.current;
    if (!id) return;
    const found = appointments.find((a) => a.id === id);
    if (found) {
      consumedDeepLink.current = true;
      pendingApptId.current = null;
      handleAppointmentClick(found);
    }
  }, [appointments, loading]);

  function handleNewAppointment() {
    setPrefilledDate(null);
    setSelectedAppointment(null);
    setDialogOpen(true);
  }

  function handleApptRightClick(e: React.MouseEvent, appt: Appointment) {
    e.preventDefault();
    e.stopPropagation();
    setApptMenuTarget(appt);
    setApptMenuPos({ x: e.clientX, y: e.clientY });
    setApptMenuOpen(true);
  }

  async function handleApptStatusChange(id: string, status: string) {
    try {
      await updateAppointmentStatus(id, status);
      toast.success("הסטטוס עודכן");
      setApptMenuOpen(false);
      fetchData();
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    }
  }

  async function handleApptDelete(id: string) {
    if (!confirm("למחוק את התור?")) return;
    try {
      await deleteAppointment(id);
      toast.success("התור נמחק");
      setApptMenuOpen(false);
      if (detailOpen && selectedAppointment?.id === id) {
        setDetailOpen(false);
      }
      fetchData();
    } catch {
      toast.error("שגיאה במחיקת תור");
    }
  }

  function handleNewBlock() {
    setBlockPrefilledDate(null);
    setBlockPrefilledHour(null);
    setBlockDialogOpen(true);
  }

  function handleBlockRightClick(e: React.MouseEvent, zone: OverlayZone) {
    e.preventDefault();
    e.stopPropagation();
    setBlockMenuZone(zone);
    setBlockMenuPos({ x: e.clientX, y: e.clientY });
    setBlockMenuOpen(true);
  }

  async function handleDeleteBlockAll() {
    if (!blockMenuZone?.blockId) return;
    try {
      await deleteScheduleBlock(blockMenuZone.blockId);
      toast.success("החסימה נמחקה");
      setBlockMenuOpen(false);
      fetchData();
    } catch {
      toast.error("שגיאה במחיקת חסימה");
    }
  }

  async function handleDeleteBlockOnce() {
    if (!blockMenuZone?.blockId || !blockMenuZone.dayDate) return;
    try {
      if (blockMenuZone.blockType === "recurring") {
        await addBlockException(blockMenuZone.blockId, blockMenuZone.dayDate);
        toast.success("החסימה הוסרה לתאריך זה");
      } else {
        await deleteScheduleBlock(blockMenuZone.blockId);
        toast.success("החסימה נמחקה");
      }
      setBlockMenuOpen(false);
      fetchData();
    } catch {
      toast.error("שגיאה במחיקת חסימה");
    }
  }

  function getAppointmentsForDay(dayIndex: number): Appointment[] {
    const dayDate = new Date(currentWeek);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const dayStr = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, "0")}-${dayDate.getDate().toString().padStart(2, "0")}`;

    return appointments.filter((a) => {
      const apptDate = new Date(a.starts_at);
      const apptStr = `${apptDate.getFullYear()}-${(apptDate.getMonth() + 1).toString().padStart(2, "0")}-${apptDate.getDate().toString().padStart(2, "0")}`;
      return apptStr === dayStr;
    });
  }

  function getOverlaysForDay(dayIndex: number): OverlayZone[] {
    const zones: OverlayZone[] = [];
    const dayKey = DAY_KEYS[dayIndex];
    const wh = workingHours[dayKey];

    // Non-working: entire day disabled
    if (!wh?.enabled) {
      zones.push({
        topPx: 0,
        heightPx: minutesToPx(TOTAL_MINUTES),
        type: "non_working",
      });
      return zones;
    }

    // Non-working: before working hours start
    const workStart = timeToMinutes(wh.start);
    if (workStart > 0) {
      zones.push({
        topPx: 0,
        heightPx: minutesToPx(clampMinutes(workStart)),
        type: "non_working",
      });
    }

    // Non-working: after working hours end
    const workEnd = timeToMinutes(wh.end);
    if (workEnd < TOTAL_MINUTES) {
      zones.push({
        topPx: minutesToPx(clampMinutes(workEnd)),
        heightPx: minutesToPx(TOTAL_MINUTES - clampMinutes(workEnd)),
        type: "non_working",
      });
    }

    // Blocked: one-time blocks on this specific date
    const dayDate = new Date(currentWeek);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const dayStr = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, "0")}-${dayDate.getDate().toString().padStart(2, "0")}`;

    for (const block of blocks) {
      if (block.block_type === "one_time" && block.starts_at && block.ends_at) {
        const bStart = new Date(block.starts_at);
        const bStartStr = `${bStart.getFullYear()}-${(bStart.getMonth() + 1).toString().padStart(2, "0")}-${bStart.getDate().toString().padStart(2, "0")}`;
        if (bStartStr === dayStr) {
          const bEnd = new Date(block.ends_at);
          const startMin = clampMinutes(bStart.getHours() * 60 + bStart.getMinutes() - START_HOUR * 60);
          const endMin = clampMinutes(bEnd.getHours() * 60 + bEnd.getMinutes() - START_HOUR * 60);
          if (endMin > startMin) {
            zones.push({
              topPx: minutesToPx(startMin),
              heightPx: minutesToPx(endMin - startMin),
              type: "blocked",
              blockId: block.id,
              blockType: "one_time",
              reason: block.reason ?? undefined,
              dayDate: dayStr,
            });
          }
        }
      }

      // Recurring blocks matching this day of week (skip exception dates)
      if (
        block.block_type === "recurring" &&
        block.day_of_week === dayIndex &&
        block.start_time &&
        block.end_time
      ) {
        const exceptions: string[] = (block.exception_dates as string[]) ?? [];
        if (exceptions.includes(dayStr)) continue;

        const startMin = clampMinutes(timeToMinutes(block.start_time));
        const endMin = clampMinutes(timeToMinutes(block.end_time));
        if (endMin > startMin) {
          zones.push({
            topPx: minutesToPx(startMin),
            heightPx: minutesToPx(endMin - startMin),
            type: "blocked",
            blockId: block.id,
            blockType: "recurring",
            reason: block.reason ?? undefined,
            dayDate: dayStr,
          });
        }
      }
    }

    return zones;
  }

  function getAppointmentStyle(appt: Appointment) {
    const start = new Date(appt.starts_at);
    const end = new Date(appt.ends_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 24)}px`,
      backgroundColor: appt.treatment_types?.color ?? "#6366f1",
    };
  }

  function isDayEnabled(dayIndex: number): boolean {
    const dayKey = DAY_KEYS[dayIndex];
    return workingHours[dayKey]?.enabled ?? true;
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  function isHourBlocked(dayIndex: number, hour: number): boolean {
    // Admin can book during non-working hours — only explicit blocks prevent booking
    // Check blocks
    const dayDate = new Date(currentWeek);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const dayStr = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, "0")}-${dayDate.getDate().toString().padStart(2, "0")}`;
    const hourStart = hour * 60;
    const hourEnd = (hour + 1) * 60;

    return blocks.some((block) => {
      if (block.block_type === "one_time" && block.starts_at && block.ends_at) {
        const bStart = new Date(block.starts_at);
        const bStartStr = `${bStart.getFullYear()}-${(bStart.getMonth() + 1).toString().padStart(2, "0")}-${bStart.getDate().toString().padStart(2, "0")}`;
        if (bStartStr !== dayStr) return false;
        const bEnd = new Date(block.ends_at);
        const bStartMin = bStart.getHours() * 60 + bStart.getMinutes();
        const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes();
        return hourStart < bEndMin && hourEnd > bStartMin;
      }
      if (block.block_type === "recurring" && block.day_of_week === dayIndex && block.start_time && block.end_time) {
        const exceptions: string[] = (block.exception_dates as string[]) ?? [];
        if (exceptions.includes(dayStr)) return false;
        const [bsh, bsm] = block.start_time.split(":").map(Number);
        const [beh, bem] = block.end_time.split(":").map(Number);
        return hourStart < beh * 60 + bem && hourEnd > bsh * 60 + bsm;
      }
      return false;
    });
  }

  // Shared overlay renderer
  function renderOverlays(overlays: OverlayZone[]) {
    return overlays.map((zone, i) => (
      <div
        key={`overlay-${i}`}
        className={`absolute inset-x-0 ${
          zone.type === "non_working"
            ? "bg-muted/50 pointer-events-none"
            : "bg-red-500/15 pointer-events-auto cursor-context-menu"
        }`}
        style={{ top: zone.topPx, height: zone.heightPx }}
        title={zone.reason ?? (zone.type === "non_working" ? "מחוץ לשעות עבודה" : "חסום — לחץ ימני למחיקה")}
        onContextMenu={
          zone.blockId
            ? (e) => handleBlockRightClick(e, zone)
            : undefined
        }
      >
        {zone.type === "blocked" && zone.heightPx >= 20 && (
          <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-red-600/70 pointer-events-none">
            {zone.blockType === "recurring" ? <Repeat className="h-3 w-3 shrink-0" /> : <Ban className="h-3 w-3 shrink-0" />}
            {zone.reason && <span className="truncate">{zone.reason}</span>}
          </div>
        )}
      </div>
    ));
  }

  // Shared day column renderer
  function renderDayColumn(dayIndex: number, isMobile: boolean) {
    const dayAppointments = getAppointmentsForDay(dayIndex);
    const overlays = getOverlaysForDay(dayIndex);

    return (
      <div
        key={dayIndex}
        className={`${isMobile ? "flex-1" : "flex-1 border-e last:border-e-0"} relative`}
      >
        {/* Hour slot lines */}
        {hours.map((hour) => {
          const blocked = isHourBlocked(dayIndex, hour);
          return (
            <div
              key={hour}
              className={`border-b transition-colors ${blocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-primary/5"}`}
              style={{ height: HOUR_HEIGHT }}
              onClick={() => !blocked && handleSlotClick(dayIndex, hour)}
              onContextMenu={(e) => handleSlotRightClick(e, dayIndex, hour)}
            />
          );
        })}

        {/* Non-working + blocked overlays */}
        {renderOverlays(overlays)}

        {/* Appointments */}
        {dayAppointments.map((appt) => {
          const isSelected = detailOpen && selectedAppointment?.id === appt.id;
          return (
            <button
              key={appt.id}
              className={`absolute inset-x-1 rounded ${isMobile ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"} text-white cursor-pointer overflow-hidden transition-all text-start ${
                isSelected ? "z-10 border-2 border-green-500 shadow-lg" : "hover:opacity-90"
              }`}
              style={getAppointmentStyle(appt)}
              onClick={(e) => {
                e.stopPropagation();
                handleAppointmentClick(appt);
              }}
              onContextMenu={(e) => handleApptRightClick(e, appt)}
            >
              <div className="font-medium truncate">
                {appt.patients?.full_name}
              </div>
              <div className="flex items-center gap-1 truncate opacity-90">
                {(() => {
                  const s = STATUS_OPTIONS.find((o) => o.value === appt.status);
                  return s ? <><s.icon className="h-3 w-3 shrink-0" /><span className="truncate">{s.label}</span></> : null;
                })()}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-[calc(100vh-3rem)]">
      {/* Header — Desktop */}
      <div className="hidden md:flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">יומן תורים</h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            היום
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-32 text-center">
            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewBlock}>
            <Ban className="h-4 w-4 me-1" />
            חסימה
          </Button>
          <Button size="sm" onClick={handleNewAppointment}>
            <Plus className="h-4 w-4 me-1" />
            תור חדש
          </Button>
        </div>
      </div>

      {/* Header — Mobile */}
      <div className="flex md:hidden flex-col gap-3 mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">יומן תורים</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              היום
            </Button>
            <Button variant="outline" size="sm" onClick={handleNewBlock}>
              <Ban className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleNewAppointment}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Day selector strip */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigateWeek(-1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 gap-1">
            {weekDays.map((day, i) => {
              const isToday = day.getTime() === today.getTime();
              const isSelected = i === selectedDay;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(i)}
                  className={`flex-1 flex flex-col items-center py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                  } ${!isDayEnabled(i) ? "opacity-40" : ""}`}
                >
                  <span>{DAY_LABELS_SHORT[i]}</span>
                  <span className="text-sm font-medium">{day.getDate()}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigateWeek(1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid — Desktop (full week) */}
      <div ref={desktopGridRef} className={`border rounded-lg bg-card overflow-auto ${detailOpen && detailSize === "full" ? "hidden" : `hidden md:block ${detailOpen ? "flex-1 min-h-0" : "flex-1"}`}`}>
        {/* Day headers */}
        <div className="flex border-b sticky top-0 bg-card z-10">
          <div className="w-16 shrink-0 border-e" />
          {weekDays.map((day, i) => {
            const isToday = day.getTime() === today.getTime();
            return (
              <div
                key={i}
                className={`flex-1 text-center py-2 border-e last:border-e-0 text-sm ${
                  isToday ? "bg-primary/10 font-bold" : ""
                } ${!isDayEnabled(i) ? "opacity-40" : ""}`}
              >
                <div>{DAY_LABELS[i]}</div>
                <div className={`text-lg ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex relative">
          {/* Hour labels */}
          <div className="w-16 shrink-0 border-e">
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b text-xs text-muted-foreground text-center"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2.5">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((_, dayIndex) => renderDayColumn(dayIndex, false))}
        </div>
      </div>

      {/* Calendar grid — Mobile (single day) */}
      <div ref={mobileGridRef} className={`border rounded-lg bg-card overflow-auto ${detailOpen && detailSize === "full" ? "hidden" : `md:hidden ${detailOpen ? "flex-1 min-h-0" : "flex-1"}`}`}>
        <div className="flex relative">
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-e">
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b text-xs text-muted-foreground text-center"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2.5">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Single day column */}
          {renderDayColumn(selectedDay, true)}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
          <span className="text-muted-foreground">טוען...</span>
        </div>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patients={patients}
        treatmentTypes={treatmentTypes}
        prefilledDate={prefilledDate}
        onCreated={fetchData}
      />

      <AppointmentDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selectedAppointment}
        onUpdated={fetchData}
        size={detailSize}
        onSizeChange={setDetailSize}
      />

      <BlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        prefilledDate={blockPrefilledDate}
        prefilledHour={blockPrefilledHour}
        onCreated={fetchData}
      />

      {/* Appointment right-click context menu */}
      {apptMenuOpen && apptMenuTarget && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setApptMenuOpen(false)}
          onContextMenu={(e) => { e.preventDefault(); setApptMenuOpen(false); }}
        >
          <div
            className="absolute bg-popover border rounded-lg shadow-lg py-1 min-w-44 text-sm"
            style={{ top: apptMenuPos.y, left: apptMenuPos.x }}
          >
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b truncate">
              {apptMenuTarget.patients?.full_name} · {apptMenuTarget.treatment_types?.name}
            </div>
            {STATUS_OPTIONS.filter((s) => s.value !== apptMenuTarget.status).map((s) => (
              <button
                key={s.value}
                className="w-full px-3 py-2 text-start hover:bg-muted transition-colors flex items-center gap-2"
                onClick={(e) => { e.stopPropagation(); handleApptStatusChange(apptMenuTarget.id, s.value); }}
              >
                <s.icon className={`h-4 w-4 ${s.color}`} />
                {s.label}
              </button>
            ))}
            <div className="border-t" />
            <button
              className="w-full px-3 py-2 text-start hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
              onClick={(e) => { e.stopPropagation(); handleApptDelete(apptMenuTarget.id); }}
            >
              <Trash2 className="h-4 w-4" />
              מחק תור
            </button>
          </div>
        </div>
      )}

      {/* Block right-click context menu */}
      {blockMenuOpen && blockMenuZone && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setBlockMenuOpen(false)}
          onContextMenu={(e) => { e.preventDefault(); setBlockMenuOpen(false); }}
        >
          <div
            className="absolute bg-popover border rounded-lg shadow-lg py-1 min-w-40 text-sm"
            style={{ top: blockMenuPos.y, left: blockMenuPos.x }}
          >
            {blockMenuZone.reason && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground border-b">
                {blockMenuZone.reason}
              </div>
            )}
            <button
              className="w-full px-3 py-2 text-start hover:bg-muted transition-colors"
              onClick={(e) => { e.stopPropagation(); handleDeleteBlockOnce(); }}
            >
              {blockMenuZone.blockType === "recurring" ? "הסר לתאריך זה בלבד" : "מחק חסימה"}
            </button>
            {blockMenuZone.blockType === "recurring" && (
              <button
                className="w-full px-3 py-2 text-start hover:bg-muted transition-colors text-destructive"
                onClick={(e) => { e.stopPropagation(); handleDeleteBlockAll(); }}
              >
                מחק חסימה חוזרת (כל השבועות)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
