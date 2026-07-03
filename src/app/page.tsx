import Link from "next/link";
import { queryOne } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, Phone, MapPin, LogIn } from "lucide-react";

export const dynamic = "force-dynamic";

interface PracticeSettings {
  practice_name: string;
  practitioner_name: string;
  phone: string;
  address: string;
}

export default async function Home() {
  let settings: PracticeSettings | null = null;
  try {
    settings = await queryOne<PracticeSettings>(
      "SELECT practice_name, practitioner_name, phone, address FROM practice_settings LIMIT 1"
    );
  } catch {
    // DB unavailable — render the static shell anyway
  }

  const name = settings?.practice_name || "מרפאת אוסטאופתיה";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <main className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold">{name}</h1>
          {settings?.practitioner_name && (
            <p className="text-lg text-muted-foreground">
              {settings.practitioner_name}
            </p>
          )}
          <p className="text-muted-foreground">
            טיפולי אוסטאופתיה מקצועיים — הקלה בכאב, שיפור תנועה ואיזון הגוף
          </p>
        </div>

        <Link
          href="/book"
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full max-w-xs text-lg"
          )}
        >
          <CalendarPlus className="ms-2" />
          הזמנת תור אונליין
        </Link>

        {(settings?.phone || settings?.address) && (
          <Card className="w-full">
            <CardContent className="flex flex-col gap-3 py-4">
              {settings?.phone && (
                <a
                  href={`tel:${settings.phone}`}
                  className="flex items-center justify-center gap-2 text-sm hover:underline"
                  dir="ltr"
                >
                  <Phone className="size-4" />
                  {settings.phone}
                </a>
              )}
              {settings?.address && (
                <span className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4" />
                  {settings.address}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        <Link
          href="/login"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <LogIn className="size-3" />
          כניסת מטפלת
        </Link>
      </main>
    </div>
  );
}
