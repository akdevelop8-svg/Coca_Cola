-- Keep promotional wallet credits independently gated from deposits, purchases and withdrawals.
-- Default OFF: this migration must never activate monetary rewards by itself.
INSERT INTO public.app_settings(key,value,updated_at)
VALUES ('promotional_rewards_enabled','false',now())
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.assert_promotional_rewards_enabled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_enabled text;
BEGIN
  SELECT value INTO v_enabled
  FROM public.app_settings
  WHERE key='promotional_rewards_enabled';
  IF COALESCE(lower(v_enabled),'false') NOT IN ('true','1','yes','enabled') THEN
    RAISE EXCEPTION 'PROMOTIONAL_REWARDS_DISABLED' USING ERRCODE='42501';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.assert_promotional_rewards_enabled() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_promotional_rewards_enabled() TO service_role;

CREATE OR REPLACE FUNCTION public.register_customer_atomic(
  p_user_id text,p_full_name text,p_phone text,p_email text,p_password_hash text,p_referral_code text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_inviter_id text := NULL;
  v_referral_code text;
  v_attempt integer := 0;
  v_bonus numeric(14,2) := 150;
  v_rewards_enabled text;
BEGIN
  IF length(trim(COALESCE(p_user_id,'')))<8 OR length(trim(COALESCE(p_full_name,'')))<2
     OR length(trim(COALESCE(p_phone,'')))<10 OR length(COALESCE(p_password_hash,''))<20 THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION_DETAILS' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE phone=p_phone) THEN
    RAISE EXCEPTION 'ACCOUNT_ALREADY_EXISTS' USING ERRCODE='23505';
  END IF;
  IF NULLIF(upper(trim(COALESCE(p_referral_code,''))),'') IS NOT NULL THEN
    SELECT id INTO v_inviter_id FROM public.users
    WHERE upper(referral_code)=upper(trim(p_referral_code)) FOR SHARE;
    IF v_inviter_id IS NULL THEN RAISE EXCEPTION 'INVALID_REFERRAL_CODE' USING ERRCODE='22023'; END IF;
  END IF;
  LOOP
    v_attempt:=v_attempt+1;
    v_referral_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.users WHERE referral_code=v_referral_code);
    IF v_attempt>=5 THEN RAISE EXCEPTION 'REFERRAL_CODE_GENERATION_FAILED' USING ERRCODE='23505'; END IF;
  END LOOP;
  INSERT INTO public.users(id,full_name,phone,email,password_hash,role,status,referral_code,invited_by_user_id,created_at,last_active_at)
  VALUES(p_user_id,trim(p_full_name),p_phone,NULLIF(lower(trim(COALESCE(p_email,''))),''),p_password_hash,
    'customer','active',v_referral_code,v_inviter_id,now(),now());

  SELECT value INTO v_rewards_enabled
  FROM public.app_settings
  WHERE key='promotional_rewards_enabled';
  SELECT COALESCE(value::numeric,150) INTO v_bonus
  FROM public.app_settings WHERE key='registrationBonus';
  v_bonus:=COALESCE(v_bonus,150);

  IF lower(COALESCE(v_rewards_enabled,'false')) IN ('true','1','yes','enabled') AND v_bonus>0 THEN
    PERFORM public.wallet_post_entry(
      p_user_id,'registration_bonus',v_bonus,0,v_bonus,0,0,0,p_user_id,
      'Registration reward','registration-bonus:'||p_user_id
    );
  END IF;
  RETURN p_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.register_customer_atomic(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_atomic(text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_daily_checkin_atomic(p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_today text:=to_char(now() AT TIME ZONE 'Africa/Addis_Ababa','YYYY-MM-DD');
  v_amount numeric(14,2);
  v_id text:='chk_'||gen_random_uuid()::text;
BEGIN
  PERFORM public.assert_promotional_rewards_enabled();
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='dailyCheckinAmount'),2)
  INTO v_amount;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CHECKIN_REWARD_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id=p_user_id AND ethiopia_date=v_today) THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.daily_checkins(id,user_id,ethiopia_date,amount,status,created_at)
  VALUES(v_id,p_user_id,v_today,round(v_amount,2),'claimed',now());
  PERFORM public.wallet_post_entry(
    p_user_id,'daily_checkin',round(v_amount,2),0,0,0,round(v_amount,2),0,v_id,
    'Daily check-in reward · '||v_today,'daily-checkin:'||p_user_id||':'||v_today
  );
  RETURN jsonb_build_object('checkinId',v_id,'ethiopiaDate',v_today,'amount',round(v_amount,2));
END;
$function$;


-- Promotional credits use their own gate. All other wallet ledger operations
-- remain protected by financial_operations_enabled.
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
) RETURNS public.ledger_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_existing public.ledger_entries%ROWTYPE;
  v_available numeric(14,2);
  v_reserved numeric(14,2);
  v_row public.ledger_entries%ROWTYPE;
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
