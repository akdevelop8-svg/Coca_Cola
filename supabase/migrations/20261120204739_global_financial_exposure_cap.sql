-- Enforce a global ETB cap on wallet liabilities and remaining daily plan claims.
INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('global_exposure_cap_etb', '1500000', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.lock_global_financial_exposure()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_locked boolean;
BEGIN
  -- Non-blocking transaction-scoped lock avoids deadlocks with callers that already hold user/request rows.
  SELECT pg_try_advisory_xact_lock(20261120, 1500000) INTO v_locked;
  IF NOT COALESCE(v_locked, false) THEN
    RAISE EXCEPTION 'FINANCIAL_EXPOSURE_CHECK_BUSY: A financial limit check is in progress. Please retry.'
      USING ERRCODE = '55P03';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_global_financial_exposure_etb()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH clock AS (
    SELECT (now() AT TIME ZONE 'Africa/Addis_Ababa')::date AS today
  ),
  wallet AS (
    SELECT COALESCE(SUM(amount_signed + reserved_delta), 0)::numeric AS total
    FROM public.ledger_entries
    WHERE status = 'posted'
  ),
  plan_rows AS (
    SELECT
      pp.id,
      pp.daily_mining_rate,
      pp.period_days,
      (pp.start_date AT TIME ZONE 'Africa/Addis_Ababa')::date AS start_day,
      COUNT(dc.id) FILTER (
        WHERE dc.ethiopia_date >= to_char(now() AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM-DD')
      )::integer AS claims_from_today
    FROM public.plan_purchases pp
    LEFT JOIN public.daily_claims dc ON dc.purchase_id = pp.id
    WHERE pp.status = 'active'
    GROUP BY pp.id
  ),
  plans AS (
    SELECT COALESCE(SUM(
      p.daily_mining_rate * GREATEST(
        0,
        (p.start_day + p.period_days - 1 - GREATEST(p.start_day, c.today) + 1)
        - p.claims_from_today
      )
    ), 0)::numeric AS total
    FROM plan_rows p
    CROSS JOIN clock c
    WHERE p.start_day + p.period_days - 1 >= c.today
  )
  SELECT round(wallet.total + plans.total, 2)
  FROM wallet CROSS JOIN plans;
$function$;

CREATE OR REPLACE FUNCTION public.assert_global_financial_exposure_within_cap(p_additional_etb numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cap numeric;
  v_current numeric;
  v_projected numeric;
BEGIN
  PERFORM public.lock_global_financial_exposure();

  SELECT NULLIF(trim(value), '')::numeric
  INTO v_cap
  FROM public.app_settings
  WHERE key = 'global_exposure_cap_etb';

  IF v_cap IS NULL OR v_cap <= 0 OR v_cap::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'GLOBAL_EXPOSURE_CAP_NOT_CONFIGURED: The global financial exposure cap is not configured.'
      USING ERRCODE = '55000';
  END IF;

  v_current := public.current_global_financial_exposure_etb();
  v_projected := round(v_current + COALESCE(p_additional_etb, 0), 2);

  IF v_projected > v_cap THEN
    RAISE EXCEPTION 'GLOBAL_EXPOSURE_CAP_REACHED: The 1,500,000 ETB aggregate financial commitment limit has been reached. New financial credits and plan purchases are temporarily unavailable.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_global_financial_exposure() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_global_financial_exposure_etb() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_global_financial_exposure_within_cap(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_global_financial_exposure() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_global_financial_exposure_etb() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_global_financial_exposure_within_cap(numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.wallet_post_entry(
  p_user_id text,
  p_type text,
  p_amount_signed numeric,
  p_reserved_delta numeric DEFAULT 0,
  p_promo_delta numeric DEFAULT 0,
  p_earnings_delta numeric DEFAULT 0,
  p_reward_delta numeric DEFAULT 0,
  p_commission_delta numeric DEFAULT 0,
  p_reference_id text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.ledger_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing public.ledger_entries%ROWTYPE;
  v_available numeric(14,2);
  v_reserved numeric(14,2);
  v_row public.ledger_entries%ROWTYPE;
  v_exposure_delta numeric;
BEGIN
  IF p_type IN ('registration_bonus','daily_checkin') THEN
    PERFORM public.assert_promotional_rewards_enabled();
  ELSE
    PERFORM public.assert_financial_operations_enabled();
  END IF;

  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.ledger_entries WHERE idempotency_key=p_idempotency_key;
    IF FOUND THEN
      IF v_existing.user_id<>p_user_id THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT' USING ERRCODE='23505';
      END IF;
      RETURN v_existing;
    END IF;
  END IF;

  v_exposure_delta := COALESCE(p_amount_signed,0) + COALESCE(p_reserved_delta,0);
  IF v_exposure_delta > 0 THEN
    PERFORM public.assert_global_financial_exposure_within_cap(v_exposure_delta);
  END IF;

  SELECT COALESCE(SUM(amount_signed),0),COALESCE(SUM(reserved_delta),0)
    INTO v_available,v_reserved
    FROM public.ledger_entries WHERE user_id=p_user_id;

  v_available:=round(v_available+COALESCE(p_amount_signed,0),2);
  v_reserved:=round(v_reserved+COALESCE(p_reserved_delta,0),2);
  IF v_available<0 THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE' USING ERRCODE='22003'; END IF;
  IF v_reserved<0 THEN RAISE EXCEPTION 'INVALID_RESERVED_BALANCE' USING ERRCODE='22003'; END IF;

  INSERT INTO public.ledger_entries(
    id,user_id,type,amount_signed,reserved_delta,promo_delta,earnings_delta,reward_delta,
    commission_delta,balance_after,status,reference_id,note,idempotency_key,created_at
  ) VALUES (
    'ldg_'||gen_random_uuid()::text,p_user_id,p_type,round(COALESCE(p_amount_signed,0),2),
    round(COALESCE(p_reserved_delta,0),2),round(COALESCE(p_promo_delta,0),2),
    round(COALESCE(p_earnings_delta,0),2),round(COALESCE(p_reward_delta,0),2),
    round(COALESCE(p_commission_delta,0),2),v_available,'posted',p_reference_id,p_note,
    p_idempotency_key,now()
  ) RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_plan_atomic(
  p_user_id text,
  p_plan_code text,
  p_amount numeric,
  p_daily_rate numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_expected_amount numeric;
  v_expected_rate numeric;
  v_balance numeric(14,2);
  v_active_count integer;
  v_purchase_id text := 'pur_' || gen_random_uuid()::text;
  v_now timestamptz := now();
  v_existing public.ledger_entries%ROWTYPE;
  v_purchase public.plan_purchases%ROWTYPE;
  v_inviter text;
  v_level integer;
  v_rate numeric;
  v_reward numeric(14,2);
  v_referrer text;
  v_referral_total numeric(14,2) := 0;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  PERFORM public.lock_global_financial_exposure();
  PERFORM 1 FROM public.users WHERE id = p_user_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = 'P0002'; END IF;

  IF length(trim(COALESCE(p_idempotency_key,''))) < 8 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.ledger_entries
    WHERE idempotency_key = 'plan-purchase:' || p_user_id || ':' || p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_purchase FROM public.plan_purchases WHERE id = v_existing.reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('purchaseId',v_purchase.id,'planCode',v_purchase.plan_code,
        'amount',v_purchase.amount,'dailyMiningRate',v_purchase.daily_mining_rate,
        'periodDays',v_purchase.period_days,'startDate',v_purchase.start_date,
        'endDate',v_purchase.end_date,'alreadyProcessed',true);
    END IF;
    RAISE EXCEPTION 'DUPLICATE_PLAN_PURCHASE_REQUEST' USING ERRCODE = '23505';
  END IF;

  SELECT amount,daily_rate INTO v_expected_amount,v_expected_rate
  FROM (VALUES
    ('A',600::numeric,100::numeric),('B',1500,200),('C',3000,500),
    ('D',5000,750),('E',8000,1200),('F',12000,2000),('G',25000,5000),
    ('H',50000,12000),('I',75000,20000),('J',100000,30000),('K',150000,35000),
    ('L',500000,50000),('M',1000000,100000)
  ) AS plans(code,amount,daily_rate) WHERE code = upper(p_plan_code);
  IF v_expected_amount IS NULL OR p_amount <> v_expected_amount OR p_daily_rate <> v_expected_rate THEN
    RAISE EXCEPTION 'INVALID_PLAN_CONFIGURATION' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.plan_purchases
  WHERE user_id = p_user_id AND status = 'active' AND end_date > v_now;
  IF v_active_count >= 2 THEN RAISE EXCEPTION 'ACTIVE_PLAN_LIMIT_REACHED' USING ERRCODE = '22023'; END IF;

  SELECT COALESCE(SUM(amount_signed),0) INTO v_balance
  FROM public.ledger_entries WHERE user_id = p_user_id;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE' USING ERRCODE = '22003'; END IF;

  WITH RECURSIVE referral_chain(level, user_id) AS (
    SELECT 1, u.invited_by_user_id
    FROM public.users u
    WHERE u.id = p_user_id AND u.invited_by_user_id IS NOT NULL
    UNION ALL
    SELECT rc.level + 1, parent.invited_by_user_id
    FROM referral_chain rc
    JOIN public.users parent ON parent.id = rc.user_id
    WHERE rc.level < 3 AND parent.invited_by_user_id IS NOT NULL
  )
  SELECT COALESCE(SUM(round(p_amount * CASE level
    WHEN 1 THEN 20 ELSE CASE level WHEN 2 THEN 2 ELSE 1 END END / 100, 2)), 0)
  INTO v_referral_total
  FROM referral_chain;

  PERFORM public.assert_global_financial_exposure_within_cap(
    (p_daily_rate * 365) + v_referral_total - p_amount
  );

  PERFORM public.wallet_post_entry(
    p_user_id,'plan_purchase',-p_amount,0,0,0,0,0,v_purchase_id,
    'Investment plan ' || upper(p_plan_code),
    'plan-purchase:' || p_user_id || ':' || p_idempotency_key
  );

  INSERT INTO public.plan_purchases(
    id,user_id,plan_code,amount,daily_mining_rate,period_days,status,start_date,end_date,created_at
  ) VALUES (
    v_purchase_id,p_user_id,upper(p_plan_code),p_amount,p_daily_rate,365,'active',v_now,
    v_now + interval '365 days',v_now
  );

  SELECT invited_by_user_id INTO v_inviter FROM public.users WHERE id = p_user_id;
  FOR v_level IN 1..3 LOOP
    EXIT WHEN v_inviter IS NULL;
    v_rate := CASE v_level WHEN 1 THEN 20 WHEN 2 THEN 2 ELSE 1 END;
    v_reward := round(p_amount * v_rate / 100,2);
    IF v_reward > 0 THEN
      INSERT INTO public.referral_rewards(
        id,beneficiary_user_id,source_user_id,purchase_id,level,rate_percent,amount,created_at
      ) VALUES (
        'rwd_' || gen_random_uuid()::text,v_inviter,p_user_id,v_purchase_id,v_level,v_rate,v_reward,v_now
      );
      PERFORM public.wallet_post_entry(
        v_inviter,'referral_reward',v_reward,0,0,0,0,v_reward,v_purchase_id,
        'Level ' || v_level || ' referral reward',
        'referral-reward:' || v_purchase_id || ':' || v_level
      );
    END IF;
    SELECT invited_by_user_id INTO v_referrer FROM public.users WHERE id = v_inviter;
    v_inviter := v_referrer;
  END LOOP;

  RETURN jsonb_build_object('purchaseId',v_purchase_id,'planCode',upper(p_plan_code),
    'amount',p_amount,'dailyMiningRate',p_daily_rate,'periodDays',365,
    'startDate',v_now,'endDate',v_now + interval '365 days','alreadyProcessed',false);
END;
$function$;
