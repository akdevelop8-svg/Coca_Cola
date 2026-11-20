-- Server-side login throttling. Only the Edge Function's service role may call these RPCs.
CREATE TABLE IF NOT EXISTS public.auth_login_rate_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_login_rate_limits TO service_role;
CREATE INDEX IF NOT EXISTS auth_login_rate_limits_updated_at_idx
  ON public.auth_login_rate_limits (updated_at);

CREATE OR REPLACE FUNCTION public.consume_login_rate_limit(
  p_key_hash text,
  p_max_attempts integer,
  p_window_seconds integer,
  p_block_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.auth_login_rate_limits%ROWTYPE;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_max_attempts < 1 OR p_window_seconds < 1 OR p_block_seconds < 1 THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_ARGUMENT' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.auth_login_rate_limits (key_hash, attempts, window_started_at, updated_at)
  VALUES (p_key_hash, 0, now(), now())
  ON CONFLICT (key_hash) DO NOTHING;

  SELECT * INTO v_row
  FROM public.auth_login_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > now() THEN
    RETURN QUERY SELECT false,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - now())))::integer);
    RETURN;
  END IF;

  IF v_row.window_started_at <= now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.auth_login_rate_limits
    SET attempts = 1, window_started_at = now(), blocked_until = NULL, updated_at = now()
    WHERE key_hash = p_key_hash;
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  IF v_row.attempts >= p_max_attempts THEN
    UPDATE public.auth_login_rate_limits
    SET blocked_until = now() + make_interval(secs => p_block_seconds), updated_at = now()
    WHERE key_hash = p_key_hash;
    RETURN QUERY SELECT false, p_block_seconds;
    RETURN;
  END IF;

  UPDATE public.auth_login_rate_limits
  SET attempts = attempts + 1, updated_at = now()
  WHERE key_hash = p_key_hash;

  RETURN QUERY SELECT true, 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_login_rate_limit(p_key_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_RATE_LIMIT_ARGUMENT' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.auth_login_rate_limits WHERE key_hash = p_key_hash;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_login_rate_limit(text, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_login_rate_limit(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_login_rate_limit(text, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_login_rate_limit(text)
  TO service_role;
