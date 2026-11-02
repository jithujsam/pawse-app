-- Deleting an account needs a sign-in made in the last few minutes.
--
-- The app asks for the password again before it calls delete_my_account(), but that check ran only in the app: anyone
-- holding a stored session could call the function directly and delete the account. The function now looks at the
-- session the request belongs to (the session_id claim in the JWT) and refuses unless that session was created in the
-- last 5 minutes. A password sign-in creates a new session; refreshing a token does not, so a stolen refresh token
-- can't satisfy it. Safe to run more than once.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  sid uuid := nullif(claims ->> 'session_id', '')::uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from auth.sessions s
    where s.id = sid and s.user_id = uid and s.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'sign in again to delete your account' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
