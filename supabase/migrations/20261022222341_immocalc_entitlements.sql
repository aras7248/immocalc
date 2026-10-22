create table if not exists public.immocalc_entitlements(
 user_id uuid primary key references auth.users(id) on delete cascade,
 level text not null default 'free' check(level in ('free','investor','professional')),
 valid_until timestamptz,
 source text not null default 'manual'
);
alter table public.immocalc_entitlements enable row level security;
drop policy if exists immocalc_entitlement_read on public.immocalc_entitlements;
create policy immocalc_entitlement_read on public.immocalc_entitlements for select to authenticated using((select auth.uid())=user_id);
revoke all on public.immocalc_entitlements from public,anon,authenticated;
grant select on public.immocalc_entitlements to authenticated;
grant all on public.immocalc_entitlements to service_role;
create or replace function public.immocalc_enforce_project_limit() returns trigger language plpgsql set search_path='' as $$
declare access_level text; project_count bigint; begin
 if current_user in ('postgres','service_role') then return new; end if;
 if auth.uid() is null or auth.uid()<>new.user_id then raise exception 'Object ownership mismatch' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 select level into access_level from public.immocalc_entitlements where user_id=new.user_id and (valid_until is null or valid_until>now());
 access_level=coalesce(access_level,'free');
 if access_level='free' and new.calc_data ? 'premiumAnalysis' then raise exception 'Premium entitlement required' using errcode='23514';end if;
 if tg_op='UPDATE' then return new;end if;
 select count(*) into project_count from public.immocalc_saved_objects where user_id=new.user_id;
 if access_level='free' or (access_level='investor' and project_count>=3) then raise exception 'ImmoCalc project limit reached' using errcode='23514';end if;
 return new;
end $$;
revoke all on function public.immocalc_enforce_project_limit() from public;
drop trigger if exists immocalc_project_limit on public.immocalc_saved_objects;
create trigger immocalc_project_limit before insert or update on public.immocalc_saved_objects for each row execute function public.immocalc_enforce_project_limit();
