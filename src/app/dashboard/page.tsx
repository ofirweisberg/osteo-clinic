import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, Receipt } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [patientsRes, appointmentsRes, visitsRes, invoicesRes] =
    await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("starts_at", new Date().toISOString().split("T")[0])
        .in("status", ["pending", "confirmed"]),
      supabase
        .from("visit_logs")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]);

  const stats = [
    {
      title: "מטופלים",
      value: patientsRes.count ?? 0,
      icon: Users,
      description: "סה״כ מטופלים רשומים",
    },
    {
      title: "תורים קרובים",
      value: appointmentsRes.count ?? 0,
      icon: Calendar,
      description: "תורים עתידיים פתוחים",
    },
    {
      title: "טיפולים",
      value: visitsRes.count ?? 0,
      icon: FileText,
      description: "סה״כ ביקורים",
    },
    {
      title: "חשבוניות פתוחות",
      value: invoicesRes.count ?? 0,
      icon: Receipt,
      description: "ממתינות לתשלום",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">לוח בקרה</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
