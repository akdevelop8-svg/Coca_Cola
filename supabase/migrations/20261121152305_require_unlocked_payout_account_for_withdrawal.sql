CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  p_user_id text,
  p_idempotency_key text,
  p_gross_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account public.payout_accounts%ROWTYPE;
  v_method public.payment_methods%ROWTYPE;
  v_balance numeric(14,2);
  v_gross numeric(14,2);
  v_fee numeric(14,2);
  v_net numeric(14,2);
  v_fee_percent numeric(8,4) := 17;
  v_minimum numeric(14,2) := 150;
  v_id text := 'wdr_'||gen_random_uuid()::text;
  v_existing public.withdrawals%ROWTYPE;
  v_ledger public.ledger_entries%ROWTYPE;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;
  IF length(trim(COALESCE(p_idempotency_key,''))) < 8 THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_gross_amount IS NULL OR p_gross_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_AMOUNT' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='minWithdrawal'),150) INTO v_minimum;
  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='withdrawalFeePercent'),17) INTO v_fee_percent;
  SELECT * INTO v_ledger FROM public.ledger_entries
    WHERE idempotency_key='withdrawal-reserve:'||p_user_id||':'||p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_existing FROM public.withdrawals WHERE id=v_ledger.reference_id;
    IF FOUND THEN RETURN jsonb_build_object('withdrawalId',v_existing.id,'grossAmount',v_existing.gross_amount,
      'feeAmount',v_existing.fee_amount,'netAmount',v_existing.net_amount,'status',v_existing.status); END IF;
    RAISE EXCEPTION 'DUPLICATE_WITHDRAWAL_REQUEST' USING ERRCODE='23505';
  END IF;
  SELECT * INTO v_account FROM public.payout_accounts WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_account.status<>'approved' OR v_account.is_locked<>0 THEN
    RAISE EXCEPTION 'PAYOUT_ACCOUNT_NOT_APPROVED' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_method FROM public.payment_methods
    WHERE kind='payout' AND is_active=1 AND name=v_account.method_name ORDER BY sort_order ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_METHOD_UNAVAILABLE' USING ERRCODE='22023'; END IF;
  v_gross:=round(p_gross_amount,2);
  IF v_minimum IS NULL OR v_minimum<=0 OR v_fee_percent IS NULL OR v_fee_percent<0 OR v_fee_percent>=100 THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_CONFIGURATION' USING ERRCODE='22023';
  END IF;
  IF v_gross<v_minimum THEN RAISE EXCEPTION 'MINIMUM_WITHDRAWAL_IS_150_ETB' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(SUM(amount_signed),0) INTO v_balance FROM public.ledger_entries WHERE user_id=p_user_id;
  IF v_gross>v_balance THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE' USING ERRCODE='22003'; END IF;
  v_fee:=round(v_gross*v_fee_percent/100,2);
  v_net:=round(v_gross-v_fee,2);
  INSERT INTO public.withdrawals(id,user_id,payout_account_id,method_name,account_number_snapshot,account_owner_snapshot,
    gross_amount,fee_amount,net_amount,status,created_at)
  VALUES(v_id,p_user_id,v_account.id,v_method.name,v_account.account_number,v_account.account_owner_name,
    v_gross,v_fee,v_net,'pending',now());
  PERFORM public.wallet_post_entry(p_user_id,'withdrawal_reserve',-v_gross,v_gross,0,0,0,0,v_id,
    'Withdrawal request reserved ('||v_fee_percent||'% fee)','withdrawal-reserve:'||p_user_id||':'||p_idempotency_key);
  RETURN jsonb_build_object('withdrawalId',v_id,'grossAmount',v_gross,'feeAmount',v_fee,'netAmount',v_net,'status','pending');
END;
$function$;
