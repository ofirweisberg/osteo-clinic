"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle, XCircle, Send } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppStatus() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "not_configured">("loading");
  const [testPhone, setTestPhone] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      if (data.connected) {
        setStatus("connected");
      } else if (data.notConfigured) {
        setStatus("not_configured");
      } else {
        setStatus("disconnected");
      }
    } catch {
      setStatus("not_configured");
    }
  }

  async function sendTestMessage() {
    if (!testPhone.trim()) {
      toast.error("נא להזין מספר טלפון");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("הודעת בדיקה נשלחה בהצלחה!");
      } else {
        toast.error(`שגיאה: ${data.error}`);
      }
    } catch {
      toast.error("שגיאה בשליחת הודעה");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </CardTitle>
            <CardDescription>
              תזכורות ואישורי תורים דרך WhatsApp
            </CardDescription>
          </div>
          {status === "connected" && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 me-1" />
              מחובר
            </Badge>
          )}
          {status === "disconnected" && (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 me-1" />
              מנותק
            </Badge>
          )}
          {status === "not_configured" && (
            <Badge variant="outline">לא מוגדר</Badge>
          )}
          {status === "loading" && (
            <Badge variant="outline">בודק...</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status === "not_configured" ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>כדי להפעיל תזכורות WhatsApp:</p>
            <ol className="list-decimal list-inside space-y-1 ps-2">
              <li>
                הירשמו ב-{" "}
                <a
                  href="https://green-api.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                  dir="ltr"
                >
                  green-api.com
                </a>
              </li>
              <li>צרו Instance וסרקו QR עם WhatsApp</li>
              <li>
                הוסיפו את המשתנים ל-<code dir="ltr">.env.local</code>:
              </li>
            </ol>
            <pre
              className="bg-muted p-3 rounded text-xs mt-2 overflow-auto"
              dir="ltr"
            >
{`GREENAPI_INSTANCE_ID=your-instance-id
GREENAPI_API_TOKEN=your-api-token
CRON_SECRET=your-random-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              תזכורות נשלחות אוטומטית לפי מספר השעות שהגדרת בהגדרות המרפאה.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="test-phone" className="text-sm">
                  שליחת הודעת בדיקה
                </Label>
                <Input
                  id="test-phone"
                  placeholder="050-0000000"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  dir="ltr"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={sendTestMessage}
                disabled={sending}
                size="sm"
              >
                <Send className="h-3 w-3 me-1" />
                {sending ? "שולח..." : "שלח בדיקה"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
