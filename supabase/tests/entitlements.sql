begin;
insert into auth.users values('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
insert into public.immocalc_entitlements(user_id,level) values('00000000-0000-0000-0000-000000000003','investor');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
do $$ begin
 begin insert into public.immocalc_saved_objects(user_id,calc_data) values(auth.uid(),'{}');raise exception 'Free limit bypassed';exception when check_violation then null;end;
 begin insert into public.immocalc_entitlements(user_id,level) values(auth.uid(),'professional');raise exception 'User changed own level';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
insert into public.immocalc_saved_objects(user_id,calc_data) select auth.uid(),'{}'::jsonb from generate_series(1,3);
do $$ begin
 begin insert into public.immocalc_saved_objects(user_id,calc_data) values(auth.uid(),'{}');raise exception 'Investor limit bypassed';exception when check_violation then null;end;
 begin update public.immocalc_entitlements set level='professional';raise exception 'User updated entitlement';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.immocalc_entitlements set level='professional' where user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
insert into public.immocalc_saved_objects(user_id,calc_data) values(auth.uid(),'{}');
reset role;
update public.immocalc_entitlements set valid_until=now()-interval '1 day' where user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
do $$ begin
 begin insert into public.immocalc_saved_objects(user_id,calc_data) values(auth.uid(),'{}');raise exception 'Expired limit bypassed';exception when check_violation then null;end;
end $$;
rollback;
