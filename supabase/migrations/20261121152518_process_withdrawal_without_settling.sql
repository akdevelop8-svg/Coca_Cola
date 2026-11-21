CREATE OR REPLACE FUNCTION public.process_withdrawal_atomic(
  p_admin_user_id text,
  p_withdrawal_id text,
  p_bank_transfer_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_actor_role text;
  v_reference text := trim(COALESCE(p_bank_transfer_reference, ''));
BEGIN
  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_admin_user_id
    AND role IN ('admin', 'super_admin', 'owner_admin', 'finance_admin')
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF length(v_reference) < 4 THEN
    RAISE EXCEPTION 'BANK_TRANSFER_REFERENCE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_w.status <> 'approved' THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_STATE' USING ERRCODE = '22023';
  END IF;
  IF v_w.reviewed_by IS NULL THEN
    RAISE EXCEPTION 'WITHDRAWAL_REVIEWER_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.withdrawals
  SET status = 'processed',
      provider_reference = v_reference,
      processed_at = now()
  WHERE id = p_withdrawal_id;

  INSERT INTO public.admin_audit_logs (
    id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at
  ) VALUES (
    'audit_' || gen_random_uuid()::text,
    p_admin_user_id,
    v_actor_role,
    'withdrawal_processed',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object(
      'grossAmount', v_w.gross_amount,
      'feeAmount', v_w.fee_amount,
      'netAmount', v_w.net_amount,
      'bankTransferReference', v_reference,
      'approvedBy', v_w.reviewed_by
    ),
    now()
  );

  RETURN jsonb_build_object(
    'withdrawalId', p_withdrawal_id,
    'status', 'processed',
    'grossAmount', v_w.gross_amount,
    'feeAmount', v_w.fee_amount,
    'netAmount', v_w.net_amount,
    'bankTransferReference', v_reference
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_withdrawal_atomic(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_atomic(text, text, text)
  TO service_role;
