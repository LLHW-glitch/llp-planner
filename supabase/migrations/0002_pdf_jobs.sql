-- PDF downloads: the app asks for a PDF, a background worker (GitHub Actions) builds it, stores it and emails a link.
create table public.pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  year int not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  path text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  emailed_at timestamptz
);
create index pdf_jobs_status_idx on public.pdf_jobs (status, created_at);
create index pdf_jobs_user_idx on public.pdf_jobs (user_id, created_at desc);
alter table public.pdf_jobs enable row level security;
create policy "own pdf jobs readable" on public.pdf_jobs for select to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.pdf_jobs;

-- customer asks for a PDF: one at a time, up to 5 a day, only for years they own
create or replace function public.request_pdf(p_year int) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); jid uuid; n int;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if not exists (select 1 from entitlements where user_id = uid and year = p_year) then raise exception 'This planner year is not unlocked on your account.'; end if;
  select id into jid from pdf_jobs where user_id = uid and year = p_year and status in ('queued','running') and created_at > now() - interval '30 minutes' order by created_at desc limit 1;
  if jid is not null then return jid; end if;
  select count(*) into n from pdf_jobs where user_id = uid and created_at > now() - interval '1 day';
  if n >= 5 then raise exception 'You can make up to 5 PDFs a day. Please try again tomorrow.'; end if;
  insert into pdf_jobs (user_id, year) values (uid, p_year) returning id into jid;
  return jid;
end $$;
revoke all on function public.request_pdf(int) from public, anon;
grant execute on function public.request_pdf(int) to authenticated;

-- worker picks the oldest waiting job (or one stuck for 20 minutes), safely even if two workers run
create or replace function public.claim_pdf_job() returns setof public.pdf_jobs
language sql security definer set search_path = public as $$
  update pdf_jobs set status = 'running', started_at = now(), attempts = attempts + 1
  where id = (select id from pdf_jobs
              where (status = 'queued' or (status = 'running' and started_at < now() - interval '20 minutes')) and attempts < 3
              order by created_at limit 1 for update skip locked)
  returning *;
$$;
revoke all on function public.claim_pdf_job() from public, anon, authenticated;
grant execute on function public.claim_pdf_job() to service_role;

-- private bucket for finished PDFs, each user can read only their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('pdf-exports', 'pdf-exports', false, 52428800, array['application/pdf']) on conflict do nothing;
create policy "own pdf exports read" on storage.objects for select to authenticated using (bucket_id = 'pdf-exports' and (storage.foldername(name))[1] = (select auth.uid())::text);
