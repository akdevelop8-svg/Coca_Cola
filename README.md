# Coca-Cola-Inspired Platform

A Vite/React web platform with a Supabase-backed API and manual administrator review workflows. This is a community platform and must not be presented as operated, sponsored, or endorsed by The Coca-Cola Company unless separate written authorization exists.

## Production architecture

- Vite/React frontend deployed from this repository to Vercel.
- Vercel serves the SPA and routes `/api/*` to `api/handler.js`.
- The Vercel API handler forwards requests to the Supabase Edge Function.
- Supabase Postgres stores accounts, sessions, the wallet ledger, plans, deposit and withdrawal requests, notifications, and support data.
- The Edge Function uses server-side `SUPABASE_SERVICE_ROLE_KEY`; never expose that key to browser code.

## Required configuration

### Vercel environment variables

- `SUPABASE_EDGE_FUNCTION_URL` — `https://<project-ref>.supabase.co/functions/v1/coca-cola-api`
- `SUPABASE_PUBLISHABLE_KEY` — the project's publishable/anon key

### Supabase Edge Function secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only

The function is configured with `verify_jwt = false` because the application validates its own bearer session tokens in the Edge Function. Keep the function's application-level authentication checks in place.

## Financial safety

The database setting `financial_operations_enabled` is deliberately `false` by default. It gates plan purchases, income claims, task rewards, gift-code redemption, deposits, withdrawals, and administrator deposit/withdrawal settlement.

Registration and daily check-in wallet credits use a separate `promotional_rewards_enabled` setting, which is also `false` by default. When enabled, the 150 ETB registration bonus and 2 ETB daily check-in are real wallet ledger credits, not demo points, and therefore create funding liabilities even while deposits and withdrawals remain disabled. Do not enable promotional rewards until the reward budget and customer-facing terms are approved and funded.

Do not enable live financial operations until funding, legal authorization, customer disclosures, and actual bank transfer procedures have been independently verified. Deposit requests are not wallet credits until an authorized administrator approves them. Withdrawals require manual review and a bank transfer reference.

Current configured withdrawal rules: minimum ETB 150 and 17% fee. Plan terms and reward values are maintained in the shared application constants and Edge Function logic; keep those values synchronized when they are changed.

## First owner setup

Open `/owner-setup.html` on the deployed site. It accepts the first owner's name, Ethiopia phone number, username, a unique password (12+ characters), and a one-time bootstrap token. The token is stored only as a SHA-256 hash in `app_settings.owner_bootstrap_sha256` and is deleted after successful use. Do not commit a plaintext bootstrap token.

## Development checks

```bash
npm install
npm run build
npm run lint
npx tsx --test src/shared/finance.test.ts
```
