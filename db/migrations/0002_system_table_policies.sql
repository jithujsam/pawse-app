-- System tables (no org_id) are used by the owning role, which bypasses RLS.
-- Some hosts (Supabase's ensure_rls trigger) enable RLS on every new table, which
-- would block tenant code (role app_user) from queueing jobs and recording
-- analytics. Enable RLS everywhere for consistency, and grant app_user exactly
-- the access it needs: queue jobs for its own org (INSERT ... ON CONFLICT also
-- needs SELECT on the row) and insert analytics events. Nothing else.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE login_tokens ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY app_user_enqueue ON job_queue FOR INSERT TO app_user WITH CHECK (payload->>'orgId' = app_current_org()::text);
--> statement-breakpoint
CREATE POLICY app_user_read_own_jobs ON job_queue FOR SELECT TO app_user USING (payload->>'orgId' = app_current_org()::text);
--> statement-breakpoint
CREATE POLICY app_user_track ON analytics_events FOR INSERT TO app_user WITH CHECK (true);
--> statement-breakpoint
-- On Supabase, the public Data API roles get access to every table by default.
-- This app never uses the Data API, so remove that access entirely.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
