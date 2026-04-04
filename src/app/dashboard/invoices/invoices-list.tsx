"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  CheckCircle,
  Send,
  Trash2,
  FileDown,
} from "lucide-react";
import { createInvoice, updateInvoiceStatus, deleteInvoice } from "./actions";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: number;
  patient_id: string;
  appointment_id: string | null;
  amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  patients: { id: string; full_name: string; phone: string } | null;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
}

interface PracticeSettings {
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
}

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "טיוטה", variant: "outline" },
  sent: { label: "נשלח", variant: "secondary" },
  paid: { label: "שולם", variant: "default" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL");
}

export function InvoicesList({
  invoices,
  patients,
  practiceSettings,
}: {
  invoices: Invoice[];
  patients: Patient[];
  practiceSettings: PracticeSettings | null;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const filteredInvoices =
    filter === "all"
      ? invoices
      : invoices.filter((i) => i.status === filter);

  const totalUnpaid = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  async function handleCreate() {
    if (!patientId || !amount) {
      toast.error("נא למלא מטופל וסכום");
      return;
    }
    setLoading(true);
    try {
      await createInvoice({
        patient_id: patientId,
        amount: parseFloat(amount),
        notes: notes || undefined,
      });
      toast.success("חשבונית נוצרה");
      setDialogOpen(false);
      setPatientId("");
      setAmount("");
      setNotes("");
      router.refresh();
    } catch {
      toast.error("שגיאה ביצירת חשבונית");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateInvoiceStatus(id, status);
      toast.success("הסטטוס עודכן");
      router.refresh();
    } catch {
      toast.error("שגיאה בעדכון");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את החשבונית?")) return;
    try {
      await deleteInvoice(id);
      toast.success("החשבונית נמחקה");
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  }

  function handleDownloadPdf(invoice: Invoice) {
    // Generate and download PDF
    generateInvoicePdf(invoice, practiceSettings);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">חשבוניות</h2>
          {totalUnpaid > 0 && (
            <p className="text-sm text-muted-foreground">
              סה״כ לגבייה: {totalUnpaid.toLocaleString()} ₪
            </p>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 me-2" />
          חשבונית חדשה
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "all", label: "הכל" },
          { key: "draft", label: "טיוטה" },
          { key: "sent", label: "נשלח" },
          { key: "paid", label: "שולם" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key !== "all" && (
              <Badge variant="secondary" className="ms-1.5">
                {invoices.filter((i) =>
                  f.key === "all" ? true : i.status === f.key
                ).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>מס׳</TableHead>
              <TableHead>מטופל/ת</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תאריך הנפקה</TableHead>
              <TableHead>תאריך תשלום</TableHead>
              <TableHead className="w-16">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  אין חשבוניות
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => {
                const statusInfo =
                  STATUS_MAP[invoice.status] ?? STATUS_MAP.draft;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {invoice.patients?.full_name}
                    </TableCell>
                    <TableCell>{invoice.amount.toLocaleString()} ₪</TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invoice.issued_at)}</TableCell>
                    <TableCell>
                      {invoice.paid_at ? formatDate(invoice.paid_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDownloadPdf(invoice)}
                          >
                            <FileDown className="h-4 w-4 me-2" />
                            הורד PDF
                          </DropdownMenuItem>
                          {invoice.status !== "sent" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(invoice.id, "sent")
                              }
                            >
                              <Send className="h-4 w-4 me-2" />
                              סמן כנשלח
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "paid" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(invoice.id, "paid")
                              }
                            >
                              <CheckCircle className="h-4 w-4 me-2" />
                              סמן כשולם
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(invoice.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 me-2" />
                            מחק
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* New invoice dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>חשבונית חדשה</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>מטופל/ת *</Label>
              {patientId ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                  <span className="text-sm font-medium">
                    {patients.find((p) => p.id === patientId)?.full_name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatientId("")}
                  >
                    שנה
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border max-h-36 overflow-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-start"
                      onClick={() => setPatientId(p.id)}
                    >
                      {p.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>סכום (₪) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>הערות</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? "שומר..." : "צור חשבונית"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// PDF generation using browser canvas
function generateInvoicePdf(
  invoice: Invoice,
  settings: PracticeSettings | null
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("נא לאפשר חלונות קופצים להורדת PDF");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>חשבונית ${invoice.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, Tahoma, sans-serif;
          padding: 40px;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .header h1 { font-size: 28px; color: #111; }
        .header .invoice-number { font-size: 14px; color: #666; margin-top: 4px; }
        .practice-info { text-align: left; font-size: 13px; color: #666; line-height: 1.6; }
        .divider { border-top: 2px solid #eee; margin: 20px 0; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 600; }
        .total { font-size: 24px; font-weight: 700; text-align: center; margin: 30px 0; padding: 20px; background: #f8f8f8; border-radius: 8px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
        @media print {
          body { padding: 20px; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>חשבונית / קבלה</h1>
          <div class="invoice-number">מס׳ ${invoice.invoice_number}</div>
        </div>
        <div class="practice-info">
          ${settings?.practice_name ? `<div><strong>${settings.practice_name}</strong></div>` : ""}
          ${settings?.practitioner_name ? `<div>${settings.practitioner_name}</div>` : ""}
          ${settings?.address ? `<div>${settings.address}</div>` : ""}
          ${settings?.phone ? `<div dir="ltr">${settings.phone}</div>` : ""}
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">פרטי מטופל</div>
        <div class="detail-row">
          <span class="detail-label">שם:</span>
          <span class="detail-value">${invoice.patients?.full_name ?? ""}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">טלפון:</span>
          <span class="detail-value" dir="ltr">${invoice.patients?.phone ?? ""}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">פרטי חשבונית</div>
        <div class="detail-row">
          <span class="detail-label">תאריך הנפקה:</span>
          <span class="detail-value">${new Date(invoice.issued_at).toLocaleDateString("he-IL")}</span>
        </div>
        ${
          invoice.paid_at
            ? `<div class="detail-row">
                <span class="detail-label">תאריך תשלום:</span>
                <span class="detail-value">${new Date(invoice.paid_at).toLocaleDateString("he-IL")}</span>
               </div>`
            : ""
        }
        <div class="detail-row">
          <span class="detail-label">סטטוס:</span>
          <span class="detail-value">${invoice.status === "paid" ? "שולם" : invoice.status === "sent" ? "נשלח" : "טיוטה"}</span>
        </div>
        ${invoice.notes ? `<div class="detail-row"><span class="detail-label">הערות:</span><span class="detail-value">${invoice.notes}</span></div>` : ""}
      </div>

      <div class="total">
        סה״כ לתשלום: ${invoice.amount.toLocaleString()} ₪
      </div>

      <div class="footer">
        <p>תודה רבה!</p>
      </div>

      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
