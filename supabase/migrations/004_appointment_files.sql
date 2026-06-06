-- Attachments (files / photos) for appointments, shown in the appointment
-- detail panel next to the session notes, and in the patient's treatment
-- history. Files live in a PRIVATE storage bucket; the app serves them only
-- via short-lived signed URLs to the authenticated practitioner.

create table appointment_files (
  id            uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  patient_id    uuid not null references patients(id) on delete cascade,
  storage_path  text not null,        -- object key inside the patient-files bucket
  file_name     text not null,        -- original filename for display
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create index idx_appointment_files_appointment on appointment_files (appointment_id);
create index idx_appointment_files_patient on appointment_files (patient_id);

-- RLS — same model as the rest of the app: the authenticated practitioner has
-- full access; anonymous (public booking) gets nothing.
alter table appointment_files enable row level security;

create policy "Authenticated full access" on appointment_files
  for all to authenticated using (true) with check (true);

-- Private storage bucket for the actual file bytes.
insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- Storage RLS: only authenticated users may touch objects in this bucket.
create policy "patient-files auth read" on storage.objects
  for select to authenticated using (bucket_id = 'patient-files');

create policy "patient-files auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'patient-files');

create policy "patient-files auth update" on storage.objects
  for update to authenticated using (bucket_id = 'patient-files');

create policy "patient-files auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'patient-files');
