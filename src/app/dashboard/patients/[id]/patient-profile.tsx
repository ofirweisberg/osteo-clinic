"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Receipt,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface Visit {
  id: string;
  visit_date: string;
  notes: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appointments: any;
}

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  treatment_types: any;
}

interface Invoice {
  id: string;
  invoice_number: number;
  amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתין",
  confirmed: "מאושר",
  completed: "הושלם",
  cancelled: "בוטל",
  no_show: "לא הגיע/ה",
  draft: "טיוטה",
  sent: "נשלח",
  paid: "שולם",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PatientProfile({
  patient,
  visits: initialVisits,
  appointments,
  invoices,
}: {
  patient: Patient;
  visits: Visit[];
  appointments: Appointment[];
  invoices: Invoice[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [visits, setVisits] = useState(initialVisits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalOwed = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + i.amount, 0);

  function startEdit(visit: Visit) {
    setEditingId(visit.id);
    setEditNotes(visit.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNotes("");
  }

  async function saveEdit(visitId: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("visit_logs")
        .update({ notes: editNotes })
        .eq("id", visitId);
      if (error) throw error;

      // Update local state
      setVisits((prev) =>
        prev.map((v) =>
          v.id === visitId ? { ...v, notes: editNotes } : v
        )
      );
      setEditingId(null);
      toast.success("הערות עודכנו");
    } catch {
      toast.error("שגיאה בעדכון");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/dashboard/patients"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowRight className="h-3 w-3" />
        חזרה לרשימת מטופלים
      </Link>

      {/* Patient header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{patient.full_name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1" dir="ltr">
              <Phone className="h-3 w-3" />
              {patient.phone}
            </span>
            {patient.email && (
              <span className="flex items-center gap-1" dir="ltr">
                <Mail className="h-3 w-3" />
                {patient.email}
              </span>
            )}
            {patient.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {patient.address}
              </span>
            )}
          </div>
          {patient.notes && (
            <p className="text-sm mt-2 text-muted-foreground">
              {patient.notes}
            </p>
          )}
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{appointments.length}</div>
            <div className="text-xs text-muted-foreground">תורים</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{visits.length}</div>
            <div className="text-xs text-muted-foreground">ביקורים</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {totalPaid.toLocaleString()} ₪
            </div>
            <div className="text-xs text-muted-foreground">שולם</div>
          </div>
          {totalOwed > 0 && (
            <div>
              <div className="text-2xl font-bold text-destructive">
                {totalOwed.toLocaleString()} ₪
              </div>
              <div className="text-xs text-muted-foreground">לגבייה</div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="visits" dir="rtl">
        <TabsList>
          <TabsTrigger value="visits" className="gap-1">
            <FileText className="h-3 w-3" />
            רשומות טיפול ({visits.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1">
            <Calendar className="h-3 w-3" />
            תורים ({appointments.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1">
            <Receipt className="h-3 w-3" />
            חשבוניות ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4">
          {visits.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                אין רשומות טיפול עדיין
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {visits.map((visit) => (
                <Card key={visit.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
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
                      {editingId !== visit.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(visit)}
                          className="h-7 w-7"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {editingId === visit.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={4}
                          className="text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(visit.id)}
                            disabled={saving}
                          >
                            <Save className="h-3 w-3 me-1" />
                            {saving ? "שומר..." : "שמור"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="h-3 w-3 me-1" />
                            ביטול
                          </Button>
                        </div>
                      </div>
                    ) : visit.notes ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {visit.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic">
                        ללא הערות
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                אין תורים עדיין
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {appt.treatment_types && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: appt.treatment_types.color,
                        }}
                      />
                    )}
                    <span className="font-medium">
                      {appt.treatment_types?.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(appt.starts_at)} ·{" "}
                      {formatTime(appt.starts_at)}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {STATUS_LABELS[appt.status] ?? appt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                אין חשבוניות עדיין
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">
                      #{inv.invoice_number}
                    </span>
                    <span className="font-medium">
                      {inv.amount.toLocaleString()} ₪
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(inv.issued_at)}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
