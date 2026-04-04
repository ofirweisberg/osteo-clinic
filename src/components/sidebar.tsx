"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  FileText,
  Receipt,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/dashboard/patients", label: "מטופלים", icon: Users },
  { href: "/dashboard/calendar", label: "יומן תורים", icon: Calendar },
  { href: "/dashboard/visits", label: "מעקב טיפולים", icon: FileText },
  { href: "/dashboard/invoices", label: "חשבוניות", icon: Receipt },
  { href: "/dashboard/settings", label: "הגדרות", icon: Settings },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-e bg-card flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-lg font-bold">מרפאת אוסטאופתיה</h1>
        <p className="text-xs text-muted-foreground mt-1 truncate" dir="ltr">
          {userEmail}
        </p>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <form action={logout}>
          <Button variant="ghost" className="w-full justify-start gap-3" type="submit">
            <LogOut className="h-4 w-4" />
            התנתק
          </Button>
        </form>
      </div>
    </aside>
  );
}
