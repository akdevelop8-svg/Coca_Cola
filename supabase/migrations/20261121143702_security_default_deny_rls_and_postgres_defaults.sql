-- Explicitly deny browser-role access on every public table whose RLS
-- was enabled without policies. Service-role Edge Function access is preserved.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_direct_api_clients', t.nspname, t.relname
    );
  END LOOP;
END
$$;

-- Harden the existing login-rate-limit table with a restrictive deny policy.
DROP POLICY deny_direct_client_access ON public.auth_login_rate_limits;
CREATE POLICY deny_direct_client_access
  ON public.auth_login_rate_limits
  AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Restrict future tables, sequences, and functions created by postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
