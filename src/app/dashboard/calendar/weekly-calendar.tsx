"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppointmentDialog } from "./appointment-dialog";
import { AppointmentDetail } from "./appointment-detail";

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

interface Appointment {
  id: string;
  patient_id: string;
  treatment_type_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  notes: string | null;
  patients: { id: string; full_name: string; phone: string };
  treatment_types: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
    color: string;
  };
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

function formatDateISO(date: Date): string {
  return date.toISOString();
}

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 21;

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const weekEnd = new Date(currentWeek);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data } = await supabase
      .from("appointments")
      .select(
        "*, patients(id, full_name, phone), treatment_types(id, name, duration_minutes, price, color)"
      )
      .gte("starts_at", currentWeek.toISOString())
      .lt("starts_at", weekEnd.toISOString())
      .neq("status", "cancelled")
      .order("starts_at");

    setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }, [currentWeek]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function navigateWeek(direction: number) {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + direction * 7);
    setCurrentWeek(next);
  }

  function goToToday() {
    setCurrentWeek(getWeekStart(new Date()));
  }

  function handleSlotClick(dayIndex: number, hour: number) {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + dayIndex);
    date.setHours(hour, 0, 0, 0);
    setPrefilledDate(date.toISOString());
    setSelectedAppointment(null);
    setDialogOpen(true);
  }

  function handleAppointmentClick(appt: Appointment) {
    setSelectedAppointment(appt);
    setDetailOpen(true);
  }

  function handleNewAppointment() {
    setPrefilledDate(null);
    setSelectedAppointment(null);
    setDialogOpen(true);
  }

  function getAppointmentsForDay(dayIndex: number): Appointment[] {
    const dayDate = new Date(currentWeek);
    dayDate.setDate(dayDate.getDate() + dayIndex);
    const dayStr = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, "0")}-${dayDate.getDate().toString().padStart(2, "0")}`;

    return appointments.filter((a) => {
      // Compare using local date of the appointment
      const apptDate = new Date(a.starts_at);
      const apptStr = `${apptDate.getFullYear()}-${(apptDate.getMonth() + 1).toString().padStart(2, "0")}-${apptDate.getDate().toString().padStart(2, "0")}`;
      return apptStr === dayStr;
    });
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

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">יומן תורים</h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            היום
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-32 text-center">
            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleNewAppointment}>
            <Plus className="h-4 w-4 me-1" />
            תור חדש
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 border rounded-lg bg-card overflow-auto">
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
          {weekDays.map((_, dayIndex) => {
            const dayAppointments = getAppointmentsForDay(dayIndex);
            const enabled = isDayEnabled(dayIndex);

            return (
              <div
                key={dayIndex}
                className={`flex-1 border-e last:border-e-0 relative ${
                  !enabled ? "bg-muted/30" : ""
                }`}
              >
                {/* Hour slots (clickable) */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b cursor-pointer hover:bg-primary/5 transition-colors"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => enabled && handleSlotClick(dayIndex, hour)}
                  />
                ))}

                {/* Appointments overlay */}
                {dayAppointments.map((appt) => (
                  <button
                    key={appt.id}
                    className="absolute inset-x-1 rounded px-1.5 py-0.5 text-white text-xs cursor-pointer overflow-hidden hover:opacity-90 transition-opacity text-start"
                    style={getAppointmentStyle(appt)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAppointmentClick(appt);
                    }}
                  >
                    <div className="font-medium truncate">
                      {appt.patients?.full_name}
                    </div>
                    <div className="truncate opacity-80">
                      {appt.treatment_types?.name}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
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
        onCreated={fetchAppointments}
      />

      <AppointmentDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        appointment={selectedAppointment}
        onUpdated={fetchAppointments}
      />
    </div>
  );
}
