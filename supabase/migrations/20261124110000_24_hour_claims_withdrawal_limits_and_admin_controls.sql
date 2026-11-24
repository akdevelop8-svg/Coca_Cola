-- Enforce elapsed 24-hour claim intervals, one Ethiopian-calendar-day withdrawal,
-- first-plan withdrawal eligibility, and admin-managed plan/task definitions.
-- Existing wallet ledger rows and purchased-plan snapshots are not changed.

CREATE TABLE IF NOT EXISTS public.investment_plans (
  code text PRIMARY KEY CHECK (code ~ '^[A-M]$'),
  name text NOT NULL,
  investment numeric(14,2) NOT NULL CHECK (investment > 0),
  daily_mining numeric(14,2) NOT NULL CHECK (daily_mining > 0),
  period_days integer NOT NULL CHECK (period_days BETWEEN 1 AND 3650),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.investment_plans(code,name,investment,daily_mining,period_days,is_active,sort_order)
VALUES
 ('A','Plan A',600,100,365,true,1),
 ('B','Plan B',1500,200,365,true,2),
 ('C','Plan C',3000,500,365,true,3),
 ('D','Plan D',5000,750,365,true,4),
 ('E','Plan E',8000,1200,365,true,5),
 ('F','Plan F',12000,2000,365,true,6),
 ('G','Plan G',25000,5000,365,true,7),
 ('H','Plan H',50000,12000,365,true,8),
 ('I','Plan I',75000,20000,365,true,9),
 ('J','Plan J',100000,30000,365,true,10),
 ('K','Plan K',150000,35000,365,true,11),
 ('L','Plan L',500000,50000,365,true,12),
 ('M','Plan M',1000000,100000,365,true,13)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.team_tasks (
  id text PRIMARY KEY CHECK (id ~ '^val_[1-5]$'),
  level integer NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 5),
  target_amount numeric(14,2) NOT NULL CHECK (target_amount > 0),
  reward_amount numeric(14,2) NOT NULL CHECK (reward_amount > 0),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.team_tasks(id,level,target_amount,reward_amount,is_enabled)
VALUES
 ('val_1',1,25000,1500,true),
 ('val_2',2,50000,3000,true),
 ('val_3',3,100000,6000,true),
 ('val_4',4,150000,10000,true),
 ('val_5',5,300000,20000,true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.investment_plans, public.team_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investment_plans, public.team_tasks TO service_role;

-- Count remaining mining obligations by 24-hour intervals, rather than calendar dates.
CREATE OR REPLACE FUNCTION public.current_global_financial_exposure_etb()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
  WITH wallet AS (
    SELECT COALESCE(SUM(amount_signed + reserved_delta),0)::numeric AS total
    FROM public.ledger_entries
    WHERE status='posted'
  ),
  plan_rows AS (
    SELECT
      pp.id,
      pp.daily_mining_rate,
      pp.end_date,
      COALESCE(last_claim.created_at + interval '24 hours',
               pp.start_date + interval '24 hours') AS next_claim_at
    FROM public.plan_purchases pp
    LEFT JOIN LATERAL (
      SELECT dc.created_at
      FROM public.daily_claims dc
      WHERE dc.purchase_id=pp.id
      ORDER BY dc.created_at DESC
      LIMIT 1
    ) last_claim ON true
    WHERE pp.status='active'
  ),
  plans AS (
    SELECT COALESCE(SUM(
      p.daily_mining_rate * CASE
        WHEN GREATEST(p.next_claim_at,now()) > p.end_date THEN 0
        ELSE FLOOR(EXTRACT(EPOCH FROM (p.end_date - GREATEST(p.next_claim_at,now()))) / 86400) + 1
      END
    ),0)::numeric AS total
    FROM plan_rows p
    WHERE p.end_date >= now()
  )
  SELECT round(wallet.total + plans.total,2)
  FROM wallet CROSS JOIN plans;
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
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_expected_amount numeric;
  v_expected_rate numeric;
  v_expected_period integer;
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
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;
  IF length(trim(COALESCE(p_idempotency_key,''))) < 8 THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_existing FROM public.ledger_entries
  WHERE idempotency_key='plan-purchase:'||p_user_id||':'||p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_purchase FROM public.plan_purchases WHERE id=v_existing.reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('purchaseId',v_purchase.id,'planCode',v_purchase.plan_code,
        'amount',v_purchase.amount,'dailyMiningRate',v_purchase.daily_mining_rate,
        'periodDays',v_purchase.period_days,'startDate',v_purchase.start_date,
        'endDate',v_purchase.end_date,'alreadyProcessed',true);
    END IF;
    RAISE EXCEPTION 'DUPLICATE_PLAN_PURCHASE_REQUEST' USING ERRCODE='23505';
  END IF;

  SELECT investment,daily_mining,period_days
  INTO v_expected_amount,v_expected_rate,v_expected_period
  FROM public.investment_plans
  WHERE code=upper(p_plan_code) AND is_active=true
  FOR SHARE;
  IF v_expected_amount IS NULL OR p_amount<>v_expected_amount OR p_daily_rate<>v_expected_rate THEN
    RAISE EXCEPTION 'INVALID_PLAN_CONFIGURATION' USING ERRCODE='22023';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.plan_purchases
  WHERE user_id=p_user_id AND status='active' AND end_date>v_now;
  IF v_active_count>=2 THEN RAISE EXCEPTION 'ACTIVE_PLAN_LIMIT_REACHED' USING ERRCODE='22023'; END IF;

  SELECT COALESCE(SUM(amount_signed),0) INTO v_balance
  FROM public.ledger_entries WHERE user_id=p_user_id;
  IF v_balance<p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_BALANCE' USING ERRCODE='22003'; END IF;

  WITH RECURSIVE referral_chain(level,user_id) AS (
    SELECT 1,u.invited_by_user_id
    FROM public.users u
    WHERE u.id=p_user_id AND u.invited_by_user_id IS NOT NULL
    UNION ALL
    SELECT rc.level+1,parent.invited_by_user_id
    FROM referral_chain rc
    JOIN public.users parent ON parent.id=rc.user_id
    WHERE rc.level<3 AND parent.invited_by_user_id IS NOT NULL
  )
  SELECT COALESCE(SUM(round(p_amount*CASE level
    WHEN 1 THEN 20 ELSE CASE level WHEN 2 THEN 2 ELSE 1 END END / 100,2)),0)
  INTO v_referral_total
  FROM referral_chain;

  PERFORM public.assert_global_financial_exposure_within_cap(
    (p_daily_rate*v_expected_period)+v_referral_total-p_amount
  );

  PERFORM public.wallet_post_entry(
    p_user_id,'plan_purchase',-p_amount,0,0,0,0,0,v_purchase_id,
    'Investment plan '||upper(p_plan_code),
    'plan-purchase:'||p_user_id||':'||p_idempotency_key
  );

  INSERT INTO public.plan_purchases(
    id,user_id,plan_code,amount,daily_mining_rate,period_days,status,start_date,end_date,created_at
  ) VALUES (
    v_purchase_id,p_user_id,upper(p_plan_code),p_amount,p_daily_rate,v_expected_period,'active',v_now,
    v_now+make_interval(days=>v_expected_period),v_now
  );

  SELECT invited_by_user_id INTO v_inviter FROM public.users WHERE id=p_user_id;
  FOR v_level IN 1..3 LOOP
    EXIT WHEN v_inviter IS NULL;
    v_rate:=CASE v_level WHEN 1 THEN 20 WHEN 2 THEN 2 ELSE 1 END;
    v_reward:=round(p_amount*v_rate/100,2);
    IF v_reward>0 THEN
      INSERT INTO public.referral_rewards(
        id,beneficiary_user_id,source_user_id,purchase_id,level,rate_percent,amount,created_at
      ) VALUES (
        'rwd_'||gen_random_uuid()::text,v_inviter,p_user_id,v_purchase_id,v_level,v_rate,v_reward,v_now
      );
      PERFORM public.wallet_post_entry(
        v_inviter,'referral_reward',v_reward,0,0,0,0,v_reward,v_purchase_id,
        'Level '||v_level||' referral reward',
        'referral-reward:'||v_purchase_id||':'||v_level
      );
    END IF;
    SELECT invited_by_user_id INTO v_referrer FROM public.users WHERE id=v_inviter;
    v_inviter:=v_referrer;
  END LOOP;

  RETURN jsonb_build_object('purchaseId',v_purchase_id,'planCode',upper(p_plan_code),
    'amount',p_amount,'dailyMiningRate',p_daily_rate,'periodDays',v_expected_period,
    'startDate',v_now,'endDate',v_now+make_interval(days=>v_expected_period),'alreadyProcessed',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_daily_mining_atomic(
  p_user_id text,
  p_purchase_id text,
  p_ethiopia_date text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_purchase public.plan_purchases%ROWTYPE;
  v_claim_id text := 'clm_'||gen_random_uuid()::text;
  v_amount numeric(14,2);
  v_today text := to_char(now() AT TIME ZONE 'Africa/Addis_Ababa','YYYY-MM-DD');
  v_last_claim timestamptz;
  v_next_claim timestamptz;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  IF p_ethiopia_date<>v_today THEN RAISE EXCEPTION 'INVALID_CLAIM_DATE' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_purchase
  FROM public.plan_purchases
  WHERE id=p_purchase_id AND user_id=p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PLAN_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  IF v_purchase.status<>'active' OR now()>v_purchase.end_date THEN
    RAISE EXCEPTION 'PLAN_NOT_CLAIMABLE' USING ERRCODE='22023';
  END IF;

  SELECT created_at INTO v_last_claim
  FROM public.daily_claims
  WHERE purchase_id=p_purchase_id
  ORDER BY created_at DESC
  LIMIT 1;
  v_next_claim:=COALESCE(v_last_claim+interval '24 hours',v_purchase.start_date+interval '24 hours');
  IF now()<v_next_claim THEN
    RAISE EXCEPTION 'CLAIM_COOLDOWN_ACTIVE: %',v_next_claim USING ERRCODE='22023';
  END IF;
  IF now()<v_purchase.start_date+interval '24 hours' THEN
    RAISE EXCEPTION 'CLAIM_COOLDOWN_ACTIVE: %',v_purchase.start_date+interval '24 hours' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.daily_claims WHERE purchase_id=p_purchase_id AND ethiopia_date=p_ethiopia_date) THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED_TODAY' USING ERRCODE='23505';
  END IF;

  v_amount:=round(v_purchase.daily_mining_rate,2);
  INSERT INTO public.daily_claims(id,user_id,purchase_id,ethiopia_date,amount,created_at)
  VALUES(v_claim_id,p_user_id,p_purchase_id,p_ethiopia_date,v_amount,now());

  PERFORM public.wallet_post_entry(
    p_user_id,'daily_mining_claim',v_amount,0,0,v_amount,0,0,v_claim_id,
    'Daily mining claim · '||p_ethiopia_date,
    'daily-claim:'||p_purchase_id||':'||p_ethiopia_date
  );
  RETURN jsonb_build_object('claimId',v_claim_id,'purchaseId',p_purchase_id,
    'ethiopiaDate',p_ethiopia_date,'amount',v_amount,'nextClaimAt',now()+interval '24 hours');
END;
$function$;

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
  v_user_created_at timestamptz;
  v_last_checkin_at timestamptz;
  v_next_checkin_at timestamptz;
BEGIN
  PERFORM public.assert_promotional_rewards_enabled();
  SELECT created_at INTO v_user_created_at
  FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;

  SELECT COALESCE((SELECT value::numeric FROM public.app_settings WHERE key='dailyCheckinAmount'),2)
  INTO v_amount;
  IF v_amount IS NULL OR v_amount<=0 OR v_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'INVALID_CHECKIN_REWARD_CONFIGURATION' USING ERRCODE='22023';
  END IF;

  SELECT created_at INTO v_last_checkin_at
  FROM public.daily_checkins
  WHERE user_id=p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  v_next_checkin_at:=COALESCE(v_last_checkin_at+interval '24 hours',v_user_created_at+interval '24 hours');
  IF now()<v_next_checkin_at THEN
    RAISE EXCEPTION 'CHECKIN_COOLDOWN_ACTIVE: %',v_next_checkin_at USING ERRCODE='22023';
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
  RETURN jsonb_build_object('checkinId',v_id,'ethiopiaDate',v_today,'amount',round(v_amount,2),
    'nextClaimAt',now()+interval '24 hours');
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_team_value_task_atomic(p_user_id text,p_task_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_target numeric;
  v_reward numeric;
  v_level integer;
  v_enabled boolean;
  v_total numeric(14,2);
  v_l1_ids text[];
  v_l2_ids text[];
  v_team_ids text[];
  v_claim_id text:='tcl_'||gen_random_uuid()::text;
BEGIN
  PERFORM public.assert_financial_operations_enabled();
  PERFORM 1 FROM public.users WHERE id=p_user_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='P0002'; END IF;

  SELECT level,target_amount,reward_amount,is_enabled
  INTO v_level,v_target,v_reward,v_enabled
  FROM public.team_tasks WHERE id=p_task_id;
  IF v_target IS NULL THEN RAISE EXCEPTION 'UNKNOWN_TASK_ID' USING ERRCODE='22023'; END IF;
  IF v_enabled IS NOT TRUE THEN RAISE EXCEPTION 'TASK_DISABLED' USING ERRCODE='22023'; END IF;

  SELECT COALESCE(array_agg(id),ARRAY[]::text[]) INTO v_l1_ids
  FROM public.users WHERE invited_by_user_id=p_user_id;
  SELECT COALESCE(array_agg(id),ARRAY[]::text[]) INTO v_l2_ids
  FROM public.users WHERE invited_by_user_id=ANY(v_l1_ids);
  v_team_ids:=v_l1_ids||v_l2_ids;

  SELECT COALESCE(round(sum(amount),2),0) INTO v_total
  FROM public.deposits
  WHERE user_id=ANY(v_team_ids) AND status='approved';
  IF v_total<v_target THEN RAISE EXCEPTION 'TASK_TARGET_NOT_REACHED' USING ERRCODE='22023'; END IF;

  INSERT INTO public.task_claims(id,user_id,task_id,amount,created_at)
  VALUES(v_claim_id,p_user_id,p_task_id,v_reward,now());
  PERFORM public.wallet_post_entry(
    p_user_id,'task_reward',v_reward,0,0,0,v_reward,0,v_claim_id,
    'Team deposit milestone reward · Level '||v_level,
    'team-task:'||p_user_id||':'||p_task_id
  );
  RETURN jsonb_build_object('claimId',v_claim_id,'taskId',p_task_id,'level',v_level,
    'targetAmount',v_target,'rewardAmount',v_reward,'verifiedDepositsTotal',v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  p_user_id text,
  p_idempotency_key text,
  p_gross_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_account public.payout_accounts%ROWTYPE;
  v_method public.payment_methods%ROWTYPE;
  v_balance numeric(14,2);
  v_gross numeric(14,2);
  v_fee numeric(14,2);
  v_net numeric(14,2);
  v_fee_percent numeric(8,4):=17;
  v_minimum numeric(14,2):=150;
  v_id text:='wdr_'||gen_random_uuid()::text;
  v_existing public.withdrawals%ROWTYPE;
  v_ledger public.ledger_entries%ROWTYPE;
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

  SELECT * INTO v_ledger FROM public.ledger_entries
  WHERE idempotency_key='withdrawal-reserve:'||p_user_id||':'||p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_existing FROM public.withdrawals WHERE id=v_ledger.reference_id;
    IF FOUND THEN
      RETURN jsonb_build_object('withdrawalId',v_existing.id,'grossAmount',v_existing.gross_amount,
        'feeAmount',v_existing.fee_amount,'netAmount',v_existing.net_amount,'status',v_existing.status);
    END IF;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.plan_purchases WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'PLAN_PURCHASE_REQUIRED_FOR_WITHDRAWAL' USING ERRCODE='42501';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.withdrawals w
    WHERE w.user_id=p_user_id
      AND (w.created_at AT TIME ZONE 'Africa/Addis_Ababa')::date=(now() AT TIME ZONE 'Africa/Addis_Ababa')::date
  ) THEN
    RAISE EXCEPTION 'WITHDRAWAL_ALREADY_REQUESTED_TODAY' USING ERRCODE='23505';
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

  INSERT INTO public.withdrawals(
    id,user_id,payout_account_id,method_name,account_number_snapshot,account_owner_snapshot,
    gross_amount,fee_amount,net_amount,status,created_at
  ) VALUES (
    v_id,p_user_id,v_account.id,v_method.name,v_account.account_number,v_account.account_owner_name,
    v_gross,v_fee,v_net,'pending',now()
  );
  PERFORM public.wallet_post_entry(
    p_user_id,'withdrawal_reserve',-v_gross,v_gross,0,0,0,0,v_id,
    'Withdrawal request reserved ('||v_fee_percent||'% fee)',
    'withdrawal-reserve:'||p_user_id||':'||p_idempotency_key
  );
  RETURN jsonb_build_object('withdrawalId',v_id,'grossAmount',v_gross,'feeAmount',v_fee,
    'netAmount',v_net,'status','pending');
END;
$function$;

REVOKE ALL ON FUNCTION public.purchase_plan_atomic(text,text,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_mining_atomic(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_checkin_atomic(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_team_value_task_atomic(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_withdrawal_atomic(text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_plan_atomic(text,text,numeric,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_mining_atomic(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin_atomic(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_team_value_task_atomic(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_atomic(text,text,numeric) TO service_role;
