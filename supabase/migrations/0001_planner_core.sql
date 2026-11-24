-- Applied to Supabase project "LLP Planner" (hanqpldjcegadyrrxzvw) on 24 Nov 2026 as migration "planner_core".
create table public.access_codes (
  code text primary key, year int not null, shopify_order_id text, email text,
  redeemed_by uuid references auth.users on delete set null, redeemed_at timestamptz,
  created_at timestamptz not null default now());
alter table public.access_codes enable row level security; -- no policies: never readable from the browser

create table public.entitlements (
  user_id uuid not null references auth.users on delete cascade, year int not null,
  source_code text references public.access_codes(code), created_at timestamptz not null default now(),
  primary key (user_id, year));
alter table public.entitlements enable row level security;
create policy "read own entitlements" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));

create table public.planner_docs (
  user_id uuid not null references auth.users on delete cascade, year int not null default 2027,
  doc_key text not null, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), deleted_at timestamptz,
  primary key (user_id, year, doc_key));
alter table public.planner_docs enable row level security;
create policy "read own docs" on public.planner_docs for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.entitlements e where e.user_id = (select auth.uid()) and e.year = planner_docs.year));
create policy "insert own docs" on public.planner_docs for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.entitlements e where e.user_id = (select auth.uid()) and e.year = planner_docs.year));
create policy "update own docs" on public.planner_docs for update to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.entitlements e where e.user_id = (select auth.uid()) and e.year = planner_docs.year))
  with check (user_id = (select auth.uid()));
-- no delete policy: soft deletes only

create table public.planner_docs_history (
  id bigserial primary key, user_id uuid not null references auth.users on delete cascade,
  year int not null, doc_key text not null, patch jsonb not null, created_at timestamptz not null default now());
alter table public.planner_docs_history enable row level security;
create index planner_docs_history_lookup on public.planner_docs_history (user_id, year, doc_key, created_at desc);

create or replace function public.apply_patch(p_year int, p_doc text, p_patch jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); dels text[];
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.entitlements where user_id = uid and year = p_year) then raise exception 'no access to %', p_year; end if;
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'patch must be an object'; end if;
  select coalesce(array_agg(key), '{}') into dels from jsonb_each(p_patch) where value = 'null'::jsonb;
  insert into public.planner_docs (user_id, year, doc_key, data) values (uid, p_year, p_doc, jsonb_strip_nulls(p_patch))
  on conflict (user_id, year, doc_key) do update
    set data = (public.planner_docs.data || p_patch) - dels, updated_at = now(), deleted_at = null;
  insert into public.planner_docs_history (user_id, year, doc_key, patch) values (uid, p_year, p_doc, p_patch);
end $$;
revoke all on function public.apply_patch(int, text, jsonb) from public, anon;
grant execute on function public.apply_patch(int, text, jsonb) to authenticated;

create or replace function public.redeem_code(p_code text)
returns int language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.access_codes;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into c from public.access_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'That code was not recognised'; end if;
  if c.redeemed_by is not null and c.redeemed_by <> uid then raise exception 'That code has already been used'; end if;
  update public.access_codes set redeemed_by = uid, redeemed_at = coalesce(redeemed_at, now()) where code = c.code;
  insert into public.entitlements (user_id, year, source_code) values (uid, c.year, c.code) on conflict do nothing;
  return c.year;
end $$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

alter publication supabase_realtime add table public.planner_docs;

insert into storage.buckets (id, name, public) values ('user-uploads', 'user-uploads', false) on conflict do nothing;
create policy "own uploads read" on storage.objects for select to authenticated using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own uploads write" on storage.objects for insert to authenticated with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own uploads update" on storage.objects for update to authenticated using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Staging only: 10 test codes LLP27-TEST-0001 to LLP27-TEST-0010 were inserted for 2027.
