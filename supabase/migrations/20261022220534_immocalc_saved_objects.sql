-- ImmoCalc-owned table only. Apply to production after reviewing the existing schema.
create table if not exists public.immocalc_saved_objects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 calc_data jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.immocalc_saved_objects add column if not exists updated_at timestamptz not null default now();
create index if not exists immocalc_objects_owner_created on public.immocalc_saved_objects(user_id,created_at desc);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='immocalc_calc_data_size' and conrelid='public.immocalc_saved_objects'::regclass) then
  alter table public.immocalc_saved_objects add constraint immocalc_calc_data_size check(pg_column_size(calc_data)<100000);
 end if;
end $$;
alter table public.immocalc_saved_objects enable row level security;
-- Remove legacy permissive policies on this own table so they cannot bypass ownership.
do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='immocalc_saved_objects' loop
  execute format('drop policy %I on public.immocalc_saved_objects',p.policyname);
 end loop;
end $$;
create policy immocalc_select on public.immocalc_saved_objects for select to authenticated using((select auth.uid())=user_id);
create policy immocalc_insert on public.immocalc_saved_objects for insert to authenticated with check((select auth.uid())=user_id);
create policy immocalc_update on public.immocalc_saved_objects for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy immocalc_delete on public.immocalc_saved_objects for delete to authenticated using((select auth.uid())=user_id);
revoke all on public.immocalc_saved_objects from public,anon;
grant select,insert,update,delete on public.immocalc_saved_objects to authenticated;
grant all on public.immocalc_saved_objects to service_role;
create or replace function public.immocalc_touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond'); return new; end $$;
revoke all on function public.immocalc_touch_updated_at() from public;
drop trigger if exists immocalc_updated_at on public.immocalc_saved_objects;
create trigger immocalc_updated_at before update on public.immocalc_saved_objects for each row execute function public.immocalc_touch_updated_at();
