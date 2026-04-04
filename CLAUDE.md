# Osteo-Clinic — Build Notes

## Project Overview
Web-based practice management system for an osteopathy clinic in Israel.
Patient management, scheduling, visit logs, invoicing, WhatsApp reminders.
Built for a single practitioner (osteopath). Hebrew RTL UI only.

## Tech Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript
- **UI:** shadcn/ui + Tailwind CSS v4, Hebrew RTL, Heebo font
- **Database + Auth:** Supabase (Postgres + Auth + RLS)
- **Hosting:** Vercel (free tier)
- **WhatsApp:** Green API (not yet configured)

## URLs
- **Live:** https://osteo-clinic.vercel.app (will be https://doclinics.net)
- **Public booking:** /book
- **GitHub:** https://github.com/ofirweisberg/osteo-clinic
- **Supabase:** Project ID `mvjklgakvqtimjipkzcb`

## Architecture
- **Auth:** Supabase Auth, single practitioner, middleware protects `/dashboard/*`
- **Public routes:** `/login`, `/book`, `/api/book`, `/api/whatsapp/status`, `/api/reminders`
- **Server actions:** Each feature has `actions.ts` with server-side Supabase calls
- **Client components:** Use `createClient()` from `@/lib/supabase/client` for real-time data
- **Database types:** Manual interfaces in each component (not auto-generated)

## Key Patterns
- **Timezone:** Always use local date parsing (`new Date(year, month-1, day, h, m)`) — NEVER `new Date("YYYY-MM-DDTHH:mm")` which parses as UTC and shifts dates in Israel (UTC+3)
- **Supabase joins:** Joined relations may come as arrays — use `any` type or handle both array/object
- **Select components:** shadcn Select shows value (UUID) not label — use custom clickable lists instead
- **Settings singleton:** `practice_settings` table has one row, fetch ID first then update by `.eq("id", id)`
- **Form re-render:** Use `key={updatedAt}` on forms with `defaultValue` to avoid controlled/uncontrolled warnings

## Database Schema
See `supabase/migrations/001_initial_schema.sql` for full schema:
- `patients` — name, phone, email, address, notes
- `treatment_types` — name, duration, price, color
- `appointments` — patient + treatment + time + status(pending/confirmed/completed/cancelled/no_show) + source(manual/self_booked)
- `visit_logs` — appointment + patient + free-text notes
- `invoices` — patient + amount + status (draft/sent/paid) + sequential invoice_number
- `practice_settings` — singleton row with working hours (JSON per day), practice info, booking window, reminder config

## RLS Policies
- Authenticated users: full access to all tables
- Anonymous (public booking): can read active treatments, practice settings, appointment availability; can insert patients and self-booked appointments

## Features Built (Phases 1-4)
1. **Auth + Settings + Patients CRUD** — login, practice config, working hours, treatment types, patient list/search/add/edit/delete
2. **Calendar + Scheduling** — weekly calendar view, manual booking with past-date warning, appointment status management, public self-service booking wizard at /book
3. **Visit Logs + Invoices** — session notes editable from calendar detail panel AND patient profile, patient visit history, invoice CRUD with PDF generation (browser print), filter by status
4. **WhatsApp** — Green API client, Hebrew message templates, reminder API route, booking confirmation on self-book, status check + test message in settings

## File Structure
```
src/app/
  login/                    # Auth (login page + logout action)
  dashboard/
    page.tsx                # Stats dashboard
    layout.tsx              # Sidebar + auth guard
    patients/               # CRUD + [id] profile with editable visit notes
    calendar/               # Weekly view + appointment dialog + detail sheet
    visits/                 # Visit log list with pending appointments alert
    invoices/               # Invoice list + create + PDF + status management
    settings/               # Practice info + treatment types + WhatsApp status
  book/                     # Public booking wizard (no auth required)
  api/
    book/                   # Public booking endpoint (creates patient + appointment + sends WhatsApp)
    reminders/              # Cron-triggered WhatsApp reminders
    whatsapp/status/        # Check Green API connection
    whatsapp/test/          # Send test WhatsApp message
    whatsapp/send-confirmation/  # Manual confirmation send
src/lib/
  supabase/                 # client.ts, server.ts, middleware.ts
  whatsapp/                 # client.ts (Green API), messages.ts (Hebrew templates)
src/components/
  sidebar.tsx               # Hebrew nav sidebar with logout
  ui/                       # shadcn components
```

## WhatsApp Setup (When Ready)
1. Create account at green-api.com, create Instance, scan QR with WhatsApp
2. Add to Vercel env vars: `GREENAPI_INSTANCE_ID`, `GREENAPI_API_TOKEN`
3. For daily reminders: use free external cron (cron-job.org) to call `GET /api/reminders` with header `Authorization: Bearer <CRON_SECRET>` — once daily at 8pm Israel time
4. Or upgrade Vercel to Pro ($20/mo) and add cron in vercel.json

## Custom Domain Setup
- Domain: `doclinics.net` registered at GoDaddy
- GoDaddy DNS: A record `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`
- Vercel: add `doclinics.net` and `www.doclinics.net` in project → Settings → Domains
- SSL auto-provisioned by Vercel

## Env Variables (Vercel + .env.local)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase secret key (for API routes)
- `CRON_SECRET` — protects /api/reminders endpoint
- `GREENAPI_INSTANCE_ID` — Green API instance (optional, for WhatsApp)
- `GREENAPI_API_TOKEN` — Green API token (optional, for WhatsApp)

## Known Issues / Future Enhancements
- WhatsApp not yet connected (needs Green API credentials)
- Invoice PDF uses browser print dialog — could upgrade to proper PDF library
- No email notifications
- No recurring appointments support
- No multi-practitioner support (single user only)
- Supabase types are manual — could auto-generate with `supabase gen types typescript`
