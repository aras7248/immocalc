-- ImmoCalc: gespeicherte Kalkulationen und ihre Zugriffsregeln.
-- Entspricht dem Stand in Production (Stand 25.11.2026).
-- Idempotent: kann auf einer Datenbank laufen, in der die Tabelle schon existiert.

create table if not exists public.immocalc_saved_objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  calc_data jsonb not null
);

alter table public.immocalc_saved_objects enable row level security;

grant select, insert, update, delete on public.immocalc_saved_objects to authenticated;

drop policy if exists immocalc_select_own_objects on public.immocalc_saved_objects;
create policy immocalc_select_own_objects on public.immocalc_saved_objects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists immocalc_insert_own_objects on public.immocalc_saved_objects;
create policy immocalc_insert_own_objects on public.immocalc_saved_objects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists immocalc_update_own_objects on public.immocalc_saved_objects;
create policy immocalc_update_own_objects on public.immocalc_saved_objects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists immocalc_delete_own_objects on public.immocalc_saved_objects;
create policy immocalc_delete_own_objects on public.immocalc_saved_objects
  for delete to authenticated
  using ((select auth.uid()) = user_id);
