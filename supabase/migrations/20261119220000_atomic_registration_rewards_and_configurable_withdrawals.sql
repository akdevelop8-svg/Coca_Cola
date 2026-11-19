-- Keep registration and its promotional credit in one transaction.
-- Make rewards and withdrawal pricing read their current configured amounts.
CREATE OR REPLACE FUNCTION public.register_customer_atomic(
  p_user_id text,p_full_name text,p_phone text,p_email text,p_password_hash text,p_referral_code text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_inviter_id text := NULL; v_referral_code text; v_attempt integer := 0;
        v_bonus numeric(14,2) := 150; v_finance_enabled text;
BEGIN
  IF length(trim(COALESCE(p_user_id,'')))<8 OR length(trim(COALESCE(p_full_name,'')))<2
     OR length(trim(COALESCE(p_phone,'')))<10 OR length(COALESCE(p_password_hash,''))<20 THEN
    RAISE EXCEPTION 'INVALID_REGISTRATION_DETAILS' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.users WHERE phone=p_phone) THEN
    RAISE EXCEPTION 'ACCOUNT_ALREADY_EXISTS' USING ERRCODE='23505';
  END IF;
  IF NULLIF(upper(trim(COALESCE(p_referral_code,''))),'') IS NOT NULL THEN
    SELECT id INTO v_inviter_id FROM public.users WHERE upper(referral_code)=upper(trim(p_referral_code)) FOR SHARE;
    IF v_inviter_id IS NULL THEN RAISE EXCEPTION 'INVALID_REFERRAL_CODE' USING ERRCODE='22023'; END IF;
  END IF;
  LOOP
    v_attempt:=v_attempt+1;
    v_referral_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.users WHERE referral_code=v_referral_code);
    IF v_attempt>=5 THEN RAISE EXCEPTION 'REFERRAL_CODE_GENERATION_FAILED' USING ERRCODE='23505'; END IF;
  END LOOP;
  INSERT INTO public.users(id,full_name,phone,email,password_hash,role,status,referral_code,invited_by_user_id,created_at,last_active_at)
  VALUES(p_user_id,trim(p_full_name),p_phone,NULLIF(lower(trim(COALESCE(p_email,''))),''),p_password_hash,'customer','active',v_referral_code,v_inviter_id,now(),now());
  SELECT value INTO v_finance_enabled FROM public.app_settings WHERE key='financial_operations_enabled';
  SELECT COALESCE(value::numeric,150) INTO v_bonus FROM public.app_settings WHERE key='registrationBonus';
  v_bonus:=COALESCE(v_bonus,150);
  IF lower(COALESCE(v_finance_enabled,'false')) IN ('true','1','yes','enabled') AND v_bonus>0 THEN
    PERFORM public.wallet_post_entry(p_user_id,'registration_bonus',v_bonus,0,v_bonus,0,0,0,p_user_id,'Registration reward','registration-bonus:'||p_user_id);
  END IF;
  RETURN p_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.register_customer_atomic(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_atomic(text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_daily_checkin_atomic(p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_today text:=to_char(now() AT TIME ZONE 'Africa/Addis_Ababa','YYYY-MM-DD');
        v_amount numeric(14,2); v_id text:='chk_'||gen_random_uuid()::text;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='dailyCheckinAmount'),2) INTO v_amount;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CHECKIN_REWARD_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.daily_checkins WHERE user_id=p_user_id AND ethiopia_date=v_today) THEN
    RAISE EXCEPTION 'ALREADY_CHECKED_IN_TODAY' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.daily_checkins(id,user_id,ethiopia_date,amount,status,created_at)
  VALUES(v_id,p_user_id,v_today,round(v_amount,2),'claimed',now());
  PERFORM public.wallet_post_entry(p_user_id,'daily_checkin',round(v_amount,2),0,0,0,round(v_amount,2),0,v_id,
    'Daily check-in reward · '||v_today,'daily-checkin:'||p_user_id||':'||v_today);
  RETURN jsonb_build_object('checkinId',v_id,'ethiopiaDate',v_today,'amount',round(v_amount,2));
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(p_user_id text,p_idempotency_key text,p_gross_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_account public.payout_accounts%ROWTYPE; v_method public.payment_methods%ROWTYPE;
        v_balance numeric(14,2); v_gross numeric(14,2); v_fee numeric(14,2); v_net numeric(14,2);
        v_fee_percent numeric(8,4):=17; v_minimum numeric(14,2):=150;
        v_id text:='wdr_'||gen_random_uuid()::text; v_existing public.withdrawals%ROWTYPE; v_ledger public.ledger_entries%ROWTYPE;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;
  IF length(trim(COALESCE(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_gross_amount IS NULL OR p_gross_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_AMOUNT' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='minWithdrawal'),150) INTO v_minimum;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='withdrawalFeePercent'),17) INTO v_fee_percent;
  SELECT * INTO v_ledger FROM public.ledger_entries WHERE idempotency_key='withdrawal-reserve:'||p_user_id||':'||p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_existing FROM public.withdrawals WHERE id=v_ledger.reference_id;
    IF FOUND THEN RETURN jsonb_build_object('withdrawalId',v_existing.id,'grossAmount',v_existing.gross_amount,'feeAmount',v_existing.fee_amount,'netAmount',v_existing.net_amount,'status',v_existing.status); END IF;
    RAISE EXCEPTION 'DUPLICATE_WITHDRAWAL_REQUEST' USING ERRCODE='23505';
  END IF;
  SELECT * INTO v_account FROM public.payout_accounts WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_account.status<>'approved' THEN RAISE EXCEPTION 'PAYOUT_ACCOUNT_NOT_APPROVED' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_method FROM public.payment_methods WHERE kind='payout' AND is_active=1 AND name=v_account.method_name ORDER BY sort_order LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_METHOD_UNAVAILABLE' USING ERRCODE='22023'; END IF;
  v_gross:=round(p_gross_amount,2);
  IF v_minimum IS NULL OR v_minimum<=0 OR v_fee_percent IS NULL OR v_fee_percent<0 OR v_fee_percent>=100 THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF v_gross<v_minimum THEN RAISE EXCEPTION 'MINIMUM_WITHDRAWAL_IS_150_ETB' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(SUM(amount_signed),0) INTO v_balance FROM public.ledger_entries WHERE user_id=p_user_id;
  IF v_gross>v_balance THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE' USING ERRCODE='22003'; END IF;
  v_fee:=round(v_gross*v_fee_percent/100,2); v_net:=round(v_gross-v_fee,2);
  INSERT INTO public.withdrawals(id,user_id,payout_account_id,method_name,account_number_snapshot,account_owner_snapshot,gross_amount,fee_amount,net_amount,status,created_at)
  VALUES(v_id,p_user_id,v_account.id,v_method.name,v_account.account_number,v_account.account_owner_name,v_gross,v_fee,v_net,'pending',now());
  PERFORM public.wallet_post_entry(p_user_id,'withdrawal_reserve',-v_gross,v_gross,0,0,0,0,v_id,
    'Withdrawal request reserved ('||v_fee_percent||'% fee)','withdrawal-reserve:'||p_user_id||':'||p_idempotency_key);
  RETURN jsonb_build_object('withdrawalId',v_id,'grossAmount',v_gross,'feeAmount',v_fee,'netAmount',v_net,'status','pending');
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_unique_completed_transfer_reference
ON public.withdrawals(lower(trim(provider_reference)))
WHERE status='completed' AND NULLIF(trim(provider_reference),'') IS NOT NULL;
