-- Record both approved and rejected deposit reviews in the administrator audit trail.
-- Keep the review and audit event atomic: any failure rolls back the entire action.
CREATE OR REPLACE FUNCTION public.review_deposit_atomic(
  p_admin_user_id text,
  p_deposit_id text,
  p_action text,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_d public.deposits%ROWTYPE;
  v_actor_role text;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT role INTO v_actor_role
  FROM public.users
  WHERE id = p_admin_user_id
    AND role IN ('admin', 'super_admin', 'owner_admin', 'finance_admin')
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_d
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_d.status <> 'pending' THEN
    RAISE EXCEPTION 'DEPOSIT_ALREADY_REVIEWED' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'approve' THEN
    -- Only approval posts a wallet credit and therefore requires finance to be enabled.
    PERFORM public.assert_financial_operations_enabled();

    UPDATE public.deposits
    SET status = 'approved',
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    WHERE id = p_deposit_id;

    PERFORM public.wallet_post_entry(
      v_d.user_id,
      'deposit',
      v_d.amount,
      0, 0, 0, 0, 0,
      v_d.id,
      'Admin verified deposit · ' || v_d.tx_reference,
      'deposit:' || v_d.id
    );
  ELSIF p_action = 'reject' THEN
    -- Rejection does not move funds, but still requires a recorded reason.
    IF v_reason IS NULL OR length(v_reason) < 3 THEN
      RAISE EXCEPTION 'REJECTION_REASON_REQUIRED' USING ERRCODE = '22023';
    END IF;

    UPDATE public.deposits
    SET status = 'rejected',
        rejection_reason = v_reason,
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    WHERE id = p_deposit_id;
  ELSE
    RAISE EXCEPTION 'INVALID_REVIEW_ACTION' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.admin_audit_logs (
    id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at
  ) VALUES (
    'audit_' || gen_random_uuid()::text,
    p_admin_user_id,
    v_actor_role,
    CASE WHEN p_action = 'approve' THEN 'deposit_approved' ELSE 'deposit_rejected' END,
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'amount', v_d.amount,
      'transactionReference', v_d.tx_reference,
      'reason', COALESCE(v_reason, '')
    ),
    now()
  );

  RETURN jsonb_build_object(
    'depositId', p_deposit_id,
    'status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    'amount', v_d.amount
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.review_deposit_atomic(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_deposit_atomic(text, text, text, text)
  TO service_role;
