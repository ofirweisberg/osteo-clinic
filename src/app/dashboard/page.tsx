import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock } from "lucide-react";

// Appointments are stored as timestamptz. Vercel runs in UTC, so we must format
// and group dates explicitly in Israel time — never rely on the server's tz
// (see CLAUDE.md timezone rule).
const TZ = "Asia/Jerusalem";
const DAYS_AHEAD = 7;

const israelDateKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD

const israelTime = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

const israelWeekday = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" }).format(d);

const israelDayMonth = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
  }).format(d);

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "מאושר", cls: "text-blue-600" },
  completed: { label: "הושלם", cls: "text-green-600" },
  pending: { label: "ממתין", cls: "text-yellow-600" },
  cancelled: { label: "בוטל", cls: "text-red-600" },
  no_show: { label: "לא הגיע/ה", cls: "text-orange-600" },
};

interface Appointment {
  id: string;
  patient_id: string;
  starts_at: string;
  status: string;
  patients:
    | { id: string; full_name: string }
    | { id: string; full_name: string }[]
    | null;
  treatment_types:
    | { name: string; duration_minutes: number; color: string }
    | { name: string; duration_minutes: number; color: string }[]
    | null;
}

// Supabase joins may come back as arrays — normalise to a single object.
const one = <T,>(x: T | T[] | null): T | null =>
  Array.isArray(x) ? x[0] ?? null : x;

export default async function DashboardPage() {
  const supabase = await createClient();

  // Query a padded UTC window (±1 day) so appointments near the Israel-midnight
  // boundary are never missed regardless of DST; we group/display only the 7
  // target Israel dates below, so the padding rows fall away naturally.
  const now = new Date();
  const qStart = new Date(now);
  qStart.setUTCDate(qStart.getUTCDate() - 1);
  const qEnd = new Date(now);
  qEnd.setUTCDate(qEnd.getUTCDate() + DAYS_AHEAD + 1);

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, patient_id, starts_at, status, patients(id, full_name), treatment_types(name, duration_minutes, color)"
    )
    .gte("starts_at", qStart.toISOString())
    .lte("starts_at", qEnd.toISOString())
    .order("starts_at", { ascending: true });

  const appointments = (data as Appointment[] | null) ?? [];

  // Group by Israel-local date key.
  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = israelDateKey(new Date(a.starts_at));
    const list = byDay.get(key);
    if (list) list.push(a);
    else byDay.set(key, [a]);
  }

  // Build the 7 day anchors (today .. today+6) in Israel time. Anchor at noon
  // UTC of today's Israel date and step by whole days — noon stays inside the
  // same Israel calendar day, so weekday/date format correctly.
  const todayKey = israelDateKey(now);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const anchor = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() + i);
    return { date: d, key: israelDateKey(d), offset: i };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">לוח זמנים — 7 הימים הקרובים</h2>
        <Link
          href="/dashboard/calendar"
          className="inline-flex items-center gap-1 h-7 rounded-md border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
        >
          <CalendarDays className="h-4 w-4" />
          לוח שנה מלא
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">שגיאה בטעינת התורים.</p>
      )}

      <div className="space-y-5">
        {days.map(({ date, key, offset }) => {
          const list = byDay.get(key) ?? [];
          const tag = offset === 0 ? "היום" : offset === 1 ? "מחר" : null;
          return (
            <section key={key}>
              {/* Date header */}
              <div className="flex items-baseline gap-2 mb-2 border-b pb-1.5">
                <span className="font-semibold">{israelWeekday(date)}</span>
                <span className="text-muted-foreground text-sm">
                  {israelDayMonth(date)}
                </span>
                {tag && (
                  <Badge variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                )}
                <span className="ms-auto text-xs text-muted-foreground">
                  {list.length > 0 ? `${list.length} תורים` : "אין תורים"}
                </span>
              </div>

              {/* Appointments for the day */}
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-2">
                  אין תורים ליום זה
                </p>
              ) : (
                <div className="space-y-2">
                  {list.map((a) => {
                    const patient = one(a.patients);
                    const treatment = one(a.treatment_types);
                    const status = STATUS[a.status];
                    const dimmed =
                      a.status === "cancelled" || a.status === "no_show";
                    return (
                      <Card key={a.id} className={dimmed ? "opacity-60" : ""}>
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center gap-1.5 font-medium tabular-nums shrink-0">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {israelTime(new Date(a.starts_at))}
                            </div>
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: treatment?.color ?? "#94a3b8",
                              }}
                            />
                            <div className="min-w-0">
                              {patient ? (
                                <Link
                                  href={
                                    a.status === "cancelled"
                                      ? `/dashboard/patients/${patient.id}`
                                      : `/dashboard/calendar?appt=${a.id}&date=${key}`
                                  }
                                  className="font-medium hover:underline truncate block"
                                >
                                  {patient.full_name}
                                </Link>
                              ) : (
                                <span className="font-medium text-muted-foreground">
                                  ללא מטופל
                                </span>
                              )}
                              <div className="text-xs text-muted-foreground truncate">
                                {treatment?.name ?? "טיפול"}
                                {treatment?.duration_minutes
                                  ? ` · ${treatment.duration_minutes} דק׳`
                                  : ""}
                              </div>
                            </div>
                          </div>
                          {status && (
                            <Badge
                              variant="outline"
                              className={`shrink-0 ${status.cls}`}
                            >
                              {status.label}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
