# Osteo-Clinic — Build Notes

## Project Overview
Web-based practice management system for an osteopathy clinic in Israel.
Patient management, scheduling, visit logs, invoicing, WhatsApp reminders.
Built for a single practitioner (osteopath). Hebrew RTL UI only.

## Tech Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript
- **UI:** shadcn/ui + Tailwind CSS v4, Hebrew RTL, Heebo font
- **Database:** Azure PostgreSQL (`osteoclinic` DB on the shared `barly-pg` flexible server), direct `pg` via `src/lib/db.ts`
- **Auth:** single-practitioner credentials (bcrypt hash in env) + jose JWT cookie (`src/lib/auth.ts`)
- **Files:** Azure Blob, private `patient-files` container in `doclinicspnt` storage account, SAS URLs (`src/lib/storage.ts`)
- **Hosting:** Azure App Service `doclinics-pnt` (shared `barly-plan` B2, RG `barly-rg`), standalone Next build (migrated off Vercel+Supabase 2026-07-03)
- **WhatsApp:** Green API (not yet configured)

## URLs
- **Live:** https://doclinics-pnt.azurewebsites.net (custom domain: https://doclinics.net)
- **Public booking:** /book
- **GitHub:** https://github.com/ofirweisberg/osteo-clinic

## Architecture
- **Auth:** env-credential login (`PRACTITIONER_EMAIL` + `PRACTITIONER_PASSWORD_HASH`), JWT session cookie `oc_session`; `src/middleware.ts` guards `/dashboard/*`
- **Public routes:** `/login`, `/book`, `/api/book`, `/api/whatsapp/status`, `/api/reminders` (CRON_SECRET)
- **Server actions:** Each feature has `actions.ts` with parameterized SQL via `query`/`queryOne` from `@/lib/db`; dashboard actions guarded with `getSession()`. Old anon-RLS rules for /book are enforced server-side in `src/app/book/actions.ts` + `/api/book`
- **DB type parsers** in `db.ts` mimic PostgREST JSON: NUMERIC→number, DATE→"YYYY-MM-DD" string, TIMESTAMPTZ→ISO string (keeps the manual component interfaces working)
- **Database types:** Manual interfaces in each component (not auto-generated)
- **Deploy:** `npm run build`, then zip `.next/standalone` + `.next/static` + `public` → `az webapp deploy -g barly-rg -n doclinics-pnt --type zip`

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
2. Add `GREENAPI_INSTANCE_ID`, `GREENAPI_API_TOKEN` to Azure app settings (`az webapp config appsettings set -g barly-rg -n doclinics-pnt`)
3. For daily reminders: free external cron (cron-job.org) calls `GET /api/reminders` with header `Authorization: Bearer <CRON_SECRET>` — once daily at 8pm Israel time

## Custom Domain Setup
- Domain: `doclinics.net` registered at GoDaddy
- GoDaddy DNS: A `@` → App Service inbound IP, CNAME `www` → `doclinics-pnt.azurewebsites.net`, TXT `asuid`/`asuid.www` → customDomainVerificationId
- Azure: `az webapp config hostname add` + free App Service managed certs (SNI)

## Env Variables (Azure app settings + .env.local)
- `DATABASE_URL` — postgres://osteoclinic_app:…@barly-pg…/osteoclinic?sslmode=require
- `AUTH_SECRET` — signs the session JWT
- `PRACTITIONER_EMAIL` / `PRACTITIONER_PASSWORD_HASH` — login credentials (bcrypt)
- `AZURE_STORAGE_CONNECTION_STRING` — doclinicspnt account (patient-files container)
- `CRON_SECRET` — protects /api/reminders endpoint
- `GREENAPI_INSTANCE_ID` — Green API instance (optional, for WhatsApp)
- `GREENAPI_API_TOKEN` — Green API token (optional, for WhatsApp)

## Known Issues / Future Enhancements
- WhatsApp not yet connected (needs Green API credentials)
- Invoice PDF uses browser print dialog — could upgrade to proper PDF library
- No email notifications
- No recurring appointments support
- No multi-practitioner support (single user only)
