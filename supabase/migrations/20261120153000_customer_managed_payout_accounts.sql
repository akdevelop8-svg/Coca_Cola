-- Customer bank details are managed by the customer, not through an Admin approval queue.
-- The approved status is retained as the internal eligibility state required by the atomic
-- withdrawal RPC; it does not mean an external bank verification was performed.
UPDATE public.payout_accounts
SET status = 'approved',
    is_locked = 0,
    review_note = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now()
WHERE status = 'pending';
