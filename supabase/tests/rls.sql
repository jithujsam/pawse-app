-- Row level security checks. Run against a local Postgres after local-auth-stub.sql and the migrations:
--   psql -f supabase/tests/local-auth-stub.sql -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_normalized.sql -f supabase/tests/rls.sql
-- Each block prints what to expect.
\set ON_ERROR_STOP 0
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001','a@x'), ('bbbbbbbb-0000-4000-8000-000000000002','b@x');
-- user A writes their companion, habit, entry, deduction, clean day
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
insert into companions (id,user_id,species,name,born_on,client_updated_at) values ('c0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','dog','Biscuit','2026-10-01',100);
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields,client_updated_at) values ('d0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','c0000000-0000-4000-8000-00000000000a','Orders','food_spending',0.7,'money','[]',100);
insert into entries (id,user_id,habit_id,companion_id,occurred_on,"values",amount,client_created_at,client_updated_at) values ('e0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','d0000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-00000000000a','2026-10-02','{"amount":"300"}',300,1,100);
insert into deductions (entry_id,user_id,months_lost,severity,source,client_updated_at) values ('e0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001',2.8,0.7,'baseline',100);
insert into clean_days (habit_id,day,user_id,client_updated_at) values ('d0000000-0000-4000-8000-00000000000a','2026-10-03','aaaaaaaa-0000-4000-8000-000000000001',100);
insert into profiles (id,settings,client_updated_at) values ('aaaaaaaa-0000-4000-8000-000000000001','{"tone":"honest"}',100);
\echo '--- A sees own rows (expect 1 1 1)'
select (select count(*) from companions), (select count(*) from entries), (select count(*) from profiles);
\echo '--- stale write from a slower phone is ignored (expect Biscuit)'
update companions set name='Stale', client_updated_at=50 where id='c0000000-0000-4000-8000-00000000000a';
select name from companions;
\echo '--- newer write wins (expect Pepper)'
update companions set name='Pepper', client_updated_at=200 where id='c0000000-0000-4000-8000-00000000000a';
select name from companions;
\echo '--- user B sees nothing of A (expect 0 0 0 0)'
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select (select count(*) from companions), (select count(*) from entries), (select count(*) from deductions), (select count(*) from profiles);
\echo '--- B cannot update or delete A rows (expect UPDATE 0, DELETE 0)'
update companions set name='Hacked' where id='c0000000-0000-4000-8000-00000000000a';
delete from entries where id='e0000000-0000-4000-8000-00000000000a';
\echo '--- B cannot attach an entry to A habit (expect RLS error)'
insert into companions (id,user_id,species,name,born_on) values ('c0000000-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000002','cat','Miso','2026-10-01');
insert into entries (id,user_id,habit_id,companion_id,occurred_on,client_created_at) values ('e0000000-0000-4000-8000-00000000000b','bbbbbbbb-0000-4000-8000-000000000002','d0000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-00000000000b','2026-10-02',1);
\echo '--- B cannot write rows claiming to be A (expect RLS error)'
insert into companions (id,user_id,species,name,born_on) values ('c0000000-0000-4000-8000-00000000000c','aaaaaaaa-0000-4000-8000-000000000001','cat','Fake','2026-10-01');
\echo '--- anon sees nothing (expect permission denied)'
reset role; set role anon; select count(*) from companions;
\echo '--- constraints reject bad data (expect check violation)'
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
insert into companions (id,user_id,species,name,born_on) values ('c0000000-0000-4000-8000-00000000000d','bbbbbbbb-0000-4000-8000-000000000002','dragon','X','2026-10-01');
\echo '--- B can delete own account and everything cascades (expect 0 rows left for B)'
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select public.delete_my_account();
reset role; select count(*) as b_users from auth.users where id='bbbbbbbb-0000-4000-8000-000000000002'; select count(*) as b_companions from companions where user_id='bbbbbbbb-0000-4000-8000-000000000002';
\echo '--- A data untouched (expect Pepper, 1 entry)'
select name, (select count(*) from entries) from companions;
