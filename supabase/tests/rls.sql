-- Row-level security checks: two users, two workspaces. Every check raises if isolation is broken,
-- so the script exits non-zero on the first failure (run with ON_ERROR_STOP).

insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

-- Runs a statement as the current role and fails the test if it succeeds.
create function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected failure but succeeded: %', label;
exception when others then
  if sqlerrm like 'expected failure but succeeded%' then raise; end if;
end;
$$;

set role authenticated;

-- User A: a workspace with one dataset and two records.
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.create_workspace('Acme', 'US') as ws_a \gset
insert into public.datasets (workspace_id, name, headers, column_map)
  values (:'ws_a', 'Dealers', '{Name}', '{}') returning id as ds_a \gset
insert into public.records (workspace_id, dataset_id, row_index, country, postcode)
  values (:'ws_a', :'ds_a', 0, 'US', '10118'), (:'ws_a', :'ds_a', 1, 'US', '62701');
select min(id) as rec_a from public.records \gset

do $$ begin
  if public.apply_geocodes(jsonb_build_array(jsonb_build_object(
       'id', (select min(id) from public.records), 'lat', 40.7, 'lng', -73.9, 'status', 'high', 'source', 'census'))) <> 1
  then raise exception 'owner could not apply geocodes'; end if;
  if (select count(*) from public.records) <> 2 then raise exception 'owner should see 2 records'; end if;
end $$;

select pg_temp.expect_error('update public.records set geocode_status = ''high'' where lat is null', 'placed row without coordinates');
select pg_temp.expect_error('insert into public.workspaces (name, country) values (''direct'', ''US'')', 'direct workspace insert');

-- User B: their own workspace; nothing of A's is visible or writable.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.create_workspace('Other', 'GB') as ws_b \gset

do $$ begin
  if (select count(*) from public.records) <> 0 then raise exception 'B can see A''s records'; end if;
  if (select count(*) from public.datasets) <> 0 then raise exception 'B can see A''s datasets'; end if;
  if (select count(*) from public.workspaces) <> 1 then raise exception 'B can see A''s workspace'; end if;
end $$;

select set_config('test.ws_a', :'ws_a', false), set_config('test.ds_a', :'ds_a', false),
       set_config('test.ws_b', :'ws_b', false), set_config('test.rec_a', :'rec_a', false);

do $$ begin
  if public.apply_geocodes(jsonb_build_array(jsonb_build_object(
       'id', current_setting('test.rec_a')::bigint, 'lat', 1, 'lng', 1, 'status', 'high'))) <> 0
  then raise exception 'B updated A''s record'; end if;
end $$;

select pg_temp.expect_error(format(
  'insert into public.datasets (workspace_id, name, headers, column_map) values (%L, ''x'', ''{x}'', ''{}'')',
  current_setting('test.ws_a')), 'B inserts dataset into A');
select pg_temp.expect_error(format(
  'insert into public.memberships values (%L, ''22222222-2222-2222-2222-222222222222'', ''owner'')',
  current_setting('test.ws_a')), 'B joins A''s workspace');
select pg_temp.expect_error(format(
  'insert into public.records (workspace_id, dataset_id, row_index, country) values (%L, %L, 5, ''GB'')',
  current_setting('test.ws_b'), current_setting('test.ds_a')), 'B attaches a record to A''s dataset');

do $$ begin
  delete from public.datasets where id = current_setting('test.ds_a')::uuid;
  if not found then return; end if;
  raise exception 'B deleted A''s dataset';
end $$;

reset role;
select 'RLS tests passed' as result;
