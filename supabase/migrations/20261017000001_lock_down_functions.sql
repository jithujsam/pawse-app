-- Keep internal helpers off the REST API (Supabase advisors 0028/0029).
-- Policies reference functions by OID, so moving the schema doesn't affect them.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.has_workspace_role(uuid, text[]) set schema private;
revoke execute on function private.has_workspace_role(uuid, text[]) from public, anon;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;

-- Trigger functions never need to be called directly.
revoke execute on function public.records_check_workspace() from public, anon, authenticated;
