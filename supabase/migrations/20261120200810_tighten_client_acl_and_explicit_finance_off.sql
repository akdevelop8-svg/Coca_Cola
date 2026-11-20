-- Tighten client access controls and explicitly record the safe finance default.
ALTER TABLE public.auth_login_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_client_access ON public.auth_login_rate_limits;
CREATE POLICY deny_direct_client_access
  ON public.auth_login_rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.auth_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_login_rate_limits TO service_role;

-- Referral rewards are written only by the trusted Edge Function.
REVOKE ALL ON TABLE public.referral_rewards FROM PUBLIC, anon, authenticated;

-- The API already treats a missing value as false; make the setting explicit without
-- overwriting a deliberate owner setting if one already exists.
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('financial_operations_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;
