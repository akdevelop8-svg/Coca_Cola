-- Withdrawal maker-checker: a different active administrator must confirm payout completion.
-- Record every withdrawal approval, rejection, and completion in admin_audit_logs.

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_admin_user_id text,
  p_withdrawal_id text,
  p_action text,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_w public.withdrawals%ROWTYPE;
  v_actor_role text;
BEGIN
  PERFORM public.assert_financial_operations_enabled();

  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_admin_user_id
    AND role IN ('admin','super_admin','owner_admin','finance_admin')
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'approve' THEN
    IF v_w.status <> 'pending' THEN
      RAISE EXCEPTION 'INVALID_WITHDRAWAL_STATE' USING ERRCODE = '22023';
    END IF;
    UPDATE public.withdrawals
    SET status = 'approved', reviewed_by = p_admin_user_id, reviewed_at = now()
    WHERE id = p_withdrawal_id;
  ELSIF p_action = 'reject' THEN
    IF v_w.status <> 'pending' THEN
      RAISE EXCEPTION 'INVALID_WITHDRAWAL_STATE' USING ERRCODE = '22023';
    END IF;
    UPDATE public.withdrawals
    SET status = 'rejected',
        rejection_reason = COALESCE(p_reason, 'Rejected by admin'),
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    WHERE id = p_withdrawal_id;

    PERFORM public.wallet_post_entry(
      v_w.user_id, 'withdrawal_release', v_w.gross_amount, -v_w.gross_amount,
      0, 0, 0, 0, v_w.id,
      COALESCE(p_reason, 'Withdrawal rejected; reserved funds returned'),
      'withdrawal-release:' || v_w.id
    );
  ELSE
    RAISE EXCEPTION 'INVALID_REVIEW_ACTION' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_audit_logs (
    id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at
  ) VALUES (
    'audit_' || gen_random_uuid()::text,
    p_admin_user_id,
    v_actor_role,
    CASE WHEN p_action = 'approve' THEN 'withdrawal_approved' ELSE 'withdrawal_rejected' END,
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object(
      'grossAmount', v_w.gross_amount,
      'feeAmount', v_w.fee_amount,
      'netAmount', v_w.net_amount,
      'reason', COALESCE(p_reason, '')
    ),
    now()
  );

  RETURN jsonb_build_object(
    'withdrawalId', p_withdrawal_id,
    'status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_withdrawal_atomic(
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
BEGIN
  PERFORM public.assert_financial_operations_enabled();

  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_admin_user_id
    AND role IN ('admin','super_admin','owner_admin','finance_admin')
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_bank_transfer_reference, ''))) < 4 THEN
    RAISE EXCEPTION 'BANK_TRANSFER_REFERENCE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_w.status NOT IN ('approved', 'processed') THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_STATE' USING ERRCODE = '22023';
  END IF;
  IF v_w.reviewed_by IS NULL THEN
    RAISE EXCEPTION 'WITHDRAWAL_REVIEWER_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_w.reviewed_by = p_admin_user_id THEN
    RAISE EXCEPTION 'MAKER_CHECKER_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.withdrawals
  SET status = 'completed',
      provider_reference = trim(p_bank_transfer_reference),
      processed_at = COALESCE(processed_at, now()),
      completed_at = now(),
      completed_by = p_admin_user_id
  WHERE id = p_withdrawal_id;

  PERFORM public.wallet_post_entry(
    v_w.user_id, 'withdrawal_settle', 0, -v_w.gross_amount,
    0, 0, 0, 0, v_w.id,
    'Manual bank transfer completed · ' || trim(p_bank_transfer_reference),
    'withdrawal-settle:' || v_w.id
  );

  INSERT INTO public.admin_audit_logs (
    id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at
  ) VALUES (
    'audit_' || gen_random_uuid()::text,
    p_admin_user_id,
    v_actor_role,
    'withdrawal_completed',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object(
      'grossAmount', v_w.gross_amount,
      'feeAmount', v_w.fee_amount,
      'netAmount', v_w.net_amount,
      'bankTransferReference', trim(p_bank_transfer_reference),
      'approvedBy', v_w.reviewed_by
    ),
    now()
  );

  RETURN jsonb_build_object(
    'withdrawalId', p_withdrawal_id,
    'status', 'completed',
    'grossAmount', v_w.gross_amount,
    'feeAmount', v_w.fee_amount,
    'netAmount', v_w.net_amount,
    'bankTransferReference', trim(p_bank_transfer_reference)
  );
END;
$function$;