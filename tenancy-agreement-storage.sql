-- Run this in the matching Supabase project's SQL Editor to prepare agreement fields and storage.
-- Tenancy templates, drafts, and room condition photos are private and stored under <auth-user-id>/... paths.

-- Keep the completed v3 form values and witness / agent / referral contact snapshots
-- with each agreement. Existing tenancy_agreements RLS policies still protect this data.
alter table public.tenancy_agreements
  add column if not exists agreement_data jsonb not null default '{}'::jsonb;

alter table public.tenancy_agreements
  add column if not exists witness_signature text;

-- Store landlord identity and payout details once on the owner profile so new
-- agreements can reuse them without asking for the same values each time.
alter table public.owners
  add column if not exists identity_number text,
  add column if not exists bank_name text,
  add column if not exists bank_account text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenancy-documents',
  'tenancy-documents',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tenancy documents read own files" on storage.objects;
create policy "Tenancy documents read own files"
on storage.objects for select to authenticated
using (
  bucket_id = 'tenancy-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Tenancy documents upload own files" on storage.objects;
create policy "Tenancy documents upload own files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tenancy-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Tenancy documents update own files" on storage.objects;
create policy "Tenancy documents update own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'tenancy-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'tenancy-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Tenancy documents delete own files" on storage.objects;
create policy "Tenancy documents delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'tenancy-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
