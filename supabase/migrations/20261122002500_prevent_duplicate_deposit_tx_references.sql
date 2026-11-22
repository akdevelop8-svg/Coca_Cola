-- Prevent the same bank transfer reference from being submitted more than once.
-- Normalize case and surrounding whitespace so alternate spellings cannot bypass uniqueness.
create unique index if not exists deposits_tx_reference_normalized_uidx
on public.deposits (lower(btrim(tx_reference)))
where nullif(btrim(tx_reference), '') is not null;
