-- Checks for 0005. Run on a fresh local Postgres after local-auth-stub.sql and migrations 0001–0005.
-- Each check prints PASS or FAIL.
\set ON_ERROR_STOP 1
insert into auth.users values ('aaaaaaaa-0000-4000-8000-00000000000a','a@x'), ('bbbbbbbb-0000-4000-8000-00000000000b','b@x') on conflict do nothing;

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, name; end $$;
create or replace function pg_temp.rejected(sql text) returns boolean language plpgsql as $$
begin execute sql; return false; exception when check_violation or insufficient_privilege then return true; end $$;

set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-00000000000a',false);
insert into companions (id,user_id,species,name,born_on) values ('c0000000-0000-4000-8000-0000000005aa','aaaaaaaa-0000-4000-8000-00000000000a','dog','Rex','2026-10-01');
insert into habits (id,user_id,companion_id,name,class,class_weight,unit,fields) values ('d0000000-0000-4000-8000-0000000005aa','aaaaaaaa-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-0000000005aa','Orders','food_spending',0.7,'money','[]');
insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,strategy,trigger,client_created_at)
  values ('e0000000-0000-4000-8000-0000000005aa','aaaaaaaa-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-0000000005aa','2026-10-02',3,'rode_it_out','breathe','Stressed',1);
select pg_temp.check('owner stores strategy and trigger', (select strategy = 'breathe' and trigger = 'Stressed' from urges where id = 'e0000000-0000-4000-8000-0000000005aa'));
insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,client_created_at)
  values ('e0000000-0000-4000-8000-0000000005ab','aaaaaaaa-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-0000000005aa','2026-10-02',2,'slipped',2);
select pg_temp.check('older apps can still insert urges without the new columns', (select count(*) from urges where id = 'e0000000-0000-4000-8000-0000000005ab') = 1);
select pg_temp.check('unknown strategy is rejected', pg_temp.rejected($q$insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,strategy,client_created_at) values ('e0000000-0000-4000-8000-0000000005ac','aaaaaaaa-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-0000000005aa','2026-10-02',2,'slipped','hack',3)$q$));
select pg_temp.check('over-long trigger is rejected', pg_temp.rejected($q$insert into urges (id,user_id,habit_id,occurred_on,strength,outcome,trigger,client_created_at) values ('e0000000-0000-4000-8000-0000000005ad','aaaaaaaa-0000-4000-8000-00000000000a','d0000000-0000-4000-8000-0000000005aa','2026-10-02',2,'slipped',repeat('x',41),3)$q$));

select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-00000000000b',false);
select pg_temp.check('another person cannot read the strategy or trigger', (select count(*) from urges) = 0);
reset role;
