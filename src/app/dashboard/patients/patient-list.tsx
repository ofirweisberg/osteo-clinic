"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { PatientDialog } from "./patient-dialog";
import { deletePatient } from "./actions";
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
  updated_at: string;
}

export function PatientList({
  patients,
  initialSearch,
}: {
  patients: Patient[];
  initialSearch: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    router.push(`/dashboard/patients?${params.toString()}`);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את ${name}?`)) return;
    try {
      await deletePatient(id);
      toast.success("המטופל נמחק");
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת מטופל");
    }
  }

  function handleEdit(patient: Patient) {
    setEditingPatient(patient);
    setDialogOpen(true);
  }

  function handleAdd() {
    setEditingPatient(null);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">מטופלים</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 me-2" />
          מטופל חדש
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם או טלפון..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם מלא</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>כתובת</TableHead>
              <TableHead className="w-24">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search ? "לא נמצאו תוצאות" : "אין מטופלים עדיין. הוסיפי מטופל חדש!"}
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/patients/${patient.id}`}
                      className="hover:underline"
                    >
                      {patient.full_name}
                    </Link>
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {patient.phone}
                  </TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {patient.email ?? "—"}
                  </TableCell>
                  <TableCell>{patient.address ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(patient)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleDelete(patient.id, patient.full_name)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patient={editingPatient}
      />
    </div>
  );
}
