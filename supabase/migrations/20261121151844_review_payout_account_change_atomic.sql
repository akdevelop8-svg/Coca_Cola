CREATE OR REPLACE FUNCTION public.review_payout_account_change_atomic(
  p_admin_user_id text,
  p_request_id text,
  p_action text,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request public.payout_change_requests%ROWTYPE;
  v_admin_role text;
  v_note text := NULLIF(trim(COALESCE(p_admin_note, '')), '');
BEGIN
  SELECT role INTO v_admin_role
  FROM public.users
  WHERE id = p_admin_user_id
    AND role IN ('owner_admin', 'finance_admin', 'admin', 'super_admin')
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_REVIEW_ACTION' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'reject' AND length(COALESCE(v_note, '')) < 3 THEN
    RAISE EXCEPTION 'PAYOUT_REJECTION_NOTE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request
  FROM public.payout_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_CHANGE_REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'PAYOUT_CHANGE_REQUEST_ALREADY_REVIEWED' USING ERRCODE = '22023';
  END IF;

  IF p_action = 'approve' THEN
    INSERT INTO public.payout_accounts (
      id, user_id, method_name, account_number, account_owner_name,
      status, is_locked, review_note, reviewed_by, reviewed_at, updated_at
    ) VALUES (
      'pay_' || gen_random_uuid()::text,
      v_request.user_id,
      v_request.new_method_name,
      v_request.new_account_number,
      v_request.new_account_owner_name,
      'approved', 0, NULL, p_admin_user_id, now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      method_name = EXCLUDED.method_name,
      account_number = EXCLUDED.account_number,
      account_owner_name = EXCLUDED.account_owner_name,
      status = 'approved',
      is_locked = 0,
      review_note = NULL,
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      updated_at = now();

    UPDATE public.payout_change_requests
    SET status = 'approved',
        admin_note = v_note,
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.payout_change_requests
    SET status = 'rejected',
        admin_note = v_note,
        reviewed_by = p_admin_user_id,
        reviewed_at = now()
    WHERE id = p_request_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at
  ) VALUES (
    'audit_' || gen_random_uuid()::text,
    p_admin_user_id,
    v_admin_role,
    CASE WHEN p_action = 'approve'
      THEN 'payout_account_change_approved'
      ELSE 'payout_account_change_rejected'
    END,
    'payout_account_change',
    p_request_id,
    jsonb_build_object(
      'userId', v_request.user_id,
      'methodName', v_request.new_method_name,
      'accountNumberLast4', right(v_request.new_account_number, 4),
      'action', p_action,
      'adminNote', COALESCE(v_note, '')
    ),
    now()
  );

  RETURN jsonb_build_object(
    'requestId', p_request_id,
    'userId', v_request.user_id,
    'status', CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.review_payout_account_change_atomic(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_payout_account_change_atomic(text, text, text, text)
  TO service_role;
