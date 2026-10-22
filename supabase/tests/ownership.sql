begin;
insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.immocalc_saved_objects(id,user_id,calc_data) values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ declare n int; begin
 select count(*) into n from public.immocalc_saved_objects;if n<>0 then raise exception 'Foreign row readable';end if;
 update public.immocalc_saved_objects set calc_data='{"foreign":true}';get diagnostics n=row_count;if n<>0 then raise exception 'Foreign row updated';end if;
 delete from public.immocalc_saved_objects;get diagnostics n=row_count;if n<>0 then raise exception 'Foreign row deleted';end if;
 begin
  insert into public.immocalc_saved_objects(user_id,calc_data) values('00000000-0000-0000-0000-000000000001','{}');
  raise exception 'Foreign owner accepted';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin update public.immocalc_saved_objects set user_id='00000000-0000-0000-0000-000000000002';raise exception 'Owner reassignment accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.immocalc_saved_objects;raise exception 'Anonymous read accepted';exception when insufficient_privilege then null;end;
end $$;
rollback;
