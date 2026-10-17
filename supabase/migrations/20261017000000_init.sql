-- Beatmap core schema: workspaces, members, uploaded datasets and their records.
-- Every tenant table carries workspace_id and is protected by row-level security.

-- Workspaces -----------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  -- Default country for rows whose sheet has no country column.
  country text not null check (country in ('US', 'GB')),
  plan text not null default 'free' check (plan in ('free', 'starter', 'team', 'enterprise')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

-- Security definer so policies can check membership without recursing into memberships' own RLS.
create function public.has_workspace_role(ws uuid, roles text[] default array['owner', 'editor', 'viewer'])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Creates a workspace and makes the caller its owner in one step.
create function public.create_workspace(ws_name text, ws_country text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.workspaces (name, country, created_by)
  values (ws_name, ws_country, auth.uid())
  returning id into ws_id;
  insert into public.memberships (workspace_id, user_id, role) values (ws_id, auth.uid(), 'owner');
  return ws_id;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- Datasets and records -------------------------------------------------------

create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  headers text[] not null,
  column_map jsonb not null,
  row_count integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index datasets_workspace_idx on public.datasets (workspace_id, created_at desc);

create table public.records (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  dataset_id uuid not null references public.datasets (id) on delete cascade,
  row_index integer not null,
  attrs jsonb not null default '{}',
  name text,
  address text,
  city text,
  region text,
  postcode text,
  country text not null check (country in ('US', 'GB')),
  category text,
  owner text,
  territory text,
  metric double precision,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'high', 'medium', 'postcode', 'failed')),
  geocode_source text,
  geocode_note text,
  geocoded_at timestamptz,
  unique (dataset_id, row_index),
  -- A placed row must have coordinates; an unplaced row must not.
  check ((geocode_status in ('high', 'medium', 'postcode')) = (lat is not null and lng is not null))
);

create index records_pending_idx on public.records (dataset_id, id) where geocode_status = 'pending';

-- A record must belong to the same workspace as its dataset.
create function public.records_check_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.datasets d where d.id = new.dataset_id and d.workspace_id = new.workspace_id) then
    raise exception 'record workspace does not match dataset workspace';
  end if;
  return new;
end;
$$;

create trigger records_check_workspace
before insert or update of workspace_id, dataset_id on public.records
for each row execute function public.records_check_workspace();

-- Writes geocoding results for a batch of records. Runs with the caller's rights, so RLS applies.
create function public.apply_geocodes(results jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with r as (
    select * from jsonb_to_recordset(results)
      as x(id bigint, lat double precision, lng double precision, status text, source text, note text)
  ), u as (
    update public.records t
    set lat = r.lat, lng = r.lng, geocode_status = r.status, geocode_source = r.source,
        geocode_note = r.note, geocoded_at = now()
    from r
    where t.id = r.id
    returning 1
  )
  select count(*)::integer from u;
$$;

grant execute on function public.apply_geocodes(jsonb) to authenticated;

-- Usage metering (read by billing; written by the server as work is done).
create table public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  meter text not null check (meter in ('geocode', 'rows', 'report', 'drive_time')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index usage_events_workspace_idx on public.usage_events (workspace_id, meter, created_at);

-- Reference data: US ZIP code (ZCTA) centroids from the Census Gazetteer (public domain).
create table public.ref_us_zcta (
  zip text primary key check (zip ~ '^\d{5}$'),
  lat double precision not null,
  lng double precision not null
);

-- Row-level security ---------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.datasets enable row level security;
alter table public.records enable row level security;
alter table public.usage_events enable row level security;
alter table public.ref_us_zcta enable row level security;

-- Workspaces are created only through create_workspace().
create policy "members read workspace" on public.workspaces
  for select to authenticated using (public.has_workspace_role(id));
create policy "owners update workspace" on public.workspaces
  for update to authenticated using (public.has_workspace_role(id, array['owner']))
  with check (public.has_workspace_role(id, array['owner']));
create policy "owners delete workspace" on public.workspaces
  for delete to authenticated using (public.has_workspace_role(id, array['owner']));

create policy "members read memberships" on public.memberships
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy "owners manage memberships" on public.memberships
  for all to authenticated using (public.has_workspace_role(workspace_id, array['owner']))
  with check (public.has_workspace_role(workspace_id, array['owner']));

create policy "members read datasets" on public.datasets
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy "editors write datasets" on public.datasets
  for all to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'editor']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'editor']));

create policy "members read records" on public.records
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy "editors write records" on public.records
  for all to authenticated using (public.has_workspace_role(workspace_id, array['owner', 'editor']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'editor']));

create policy "members read usage" on public.usage_events
  for select to authenticated using (public.has_workspace_role(workspace_id));
create policy "editors record usage" on public.usage_events
  for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner', 'editor']));

create policy "signed-in users read ZIP centroids" on public.ref_us_zcta
  for select to authenticated using (true);
