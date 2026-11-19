GOOGLE AI STUDIO — EXISTING PROJECT REVISION PROMPT

IMPORTANT: EDIT THE CURRENT PROJECT IN PLACE. DO NOT START OVER, DO NOT REGENERATE THE WHOLE DESIGN, AND DO NOT REMOVE OR SIMPLIFY ANY PART OF THE APPROVED DESKTOP OR MOBILE DESIGNS. First inspect the existing codebase, routes, components, assets, and current data model. Keep the accepted red-and-white visual design, page layout, typography, icons, spacing, Coca-Cola bottle/factory imagery supplied by the owner, and responsive behavior. Make only the changes described below, while preserving all existing working features.

REFERENCE INPUTS
- Use the approved mobile design reference (four app screens: Home, Income, Team, Task) as the visual source for mobile.
- Use the approved desktop dashboard reference as the visual source for desktop.
- Reuse the image assets already supplied in the project for the logo, bottles, factory/building, and promotional banners. Do not replace them with unrelated stock images.
- Use Coca-Cola brand assets only if the project owner has permission that specifically covers this website, its investment/product context, and online promotional use. Do not state or imply that this is the official Coca-Cola website or that The Coca-Cola Company guarantees returns unless a written agreement explicitly authorizes those exact claims.

CRITICAL FINANCIAL / SECURITY MODE
Build and test the complete user experience in SANDBOX / DEMO mode first. Do not enable real deposits, withdrawals, investment purchases, daily earnings, or referral payouts until the owner has independently verified the legal authority to offer the product, the real source of funds/revenue, the exact customer terms, and the appropriate payment-provider arrangements. The plan amounts and projected daily mining amounts below are user-provided draft values, not verified or guaranteed returns. In the interface and database, label them as illustrative/pending verification and keep purchase/claim/payment execution disabled while compliance approval is false. Never fabricate paid users, income, transactions, online counts, testimonials, or successful payouts. Show zero/empty states when there is no real data.

Do not calculate commissions from recruitment, registration, deposits, or a member's mere presence in a downline. Referral commissions may be activated only for verified, genuine product sales to real customers, if legally approved, and must be traceable to the underlying sale. Team deposit totals must not be presented as earnings or proof of a return. Reward tasks must not reward recruitment or deposits alone. Display all fees, restrictions, eligibility, and non-guaranteed nature clearly before a user confirms.

ADMIN SECURITY
Never hardcode an admin username or password in frontend code, prompts, source files, database seed data, or public environment variables. Do not use credentials supplied in chat as fixed login credentials. If any real password has already been shared, rotate it. Use Supabase Auth (or the project's existing secure authentication provider), secure password hashing handled by the provider, role-based authorization, admin MFA where available, server-side checks for every admin action, rate limiting, and audit logs. Create the first admin through a secure private setup/invitation process. Frontend route hiding is not access control.

1) STARTUP / LOADING / AUTHENTICATION
- Add a branded loading screen that appears while the app initializes. Use a short, tasteful animation/illustration of a person enjoying a cola drink, using an approved supplied asset or a newly created generic illustration. Do not use an identifiable person's likeness without permission.
- After loading, send signed-out visitors to the Sign Up / Log In gateway. No access to authenticated pages without authentication. Preserve deep links and return the user to the intended page after successful sign-in.
- Add complete Sign Up, Log In, Forgot Password, and Sign Out flows with validation, helpful errors, password visibility, loading states, and mobile-friendly layout.
- Referral registration URLs must capture the ref query parameter automatically (example structure: https://YOUR-REAL-DOMAIN/register?ref=INVITATION_CODE). Store the inviter once at registration, validate the code server-side, and do not allow a user to edit or replace their inviter later through the client.
- After registration, show an onboarding terms/summary page before opening the dashboard. It should clearly display the current configured registration bonus, minimum withdrawal, withdrawal fee, purchase limit, and referral terms. Require the user to scroll/read and actively accept the current terms version; save the accepted terms version and timestamp. Do not use a forced button that conceals material terms.

2) WELCOME / BONUS / DAILY CHECK-IN
- The requested draft values are: registration bonus ETB 150 and daily check-in ETB 2. The requested first-day total would be ETB 152 if both benefits are approved and awarded.
- Implement the user interface and ledger structure for these benefits, but keep real crediting disabled until compliance approval is enabled. Configure whether a bonus is withdrawable, spend-only, or conditional; show this clearly before acceptance. Never call a promotional credit cash or withdrawable balance unless it truly can be withdrawn.
- Daily check-in must be claimable at most once per user per Ethiopia calendar day (Africa/Addis_Ababa), enforced server-side with a unique database constraint and an idempotent transaction. Prevent duplicate claims by refreshing, using multiple devices, or replaying requests.

3) HOME DASHBOARD — PRESERVE APPROVED DESIGN
- Keep the approved hero/banner, quick action tiles, account summary cards, investment-plan section, company information, registration bonus card, referral commission card, withdrawal information strip, and bottom navigation.
- Add a hero carousel that changes every 3 seconds. Use only owner-approved images: people enjoying a cola drink, the requested “Coca-Cola Highland” visual, the supplied bottles/factory/building photos, and other approved company-related images. Use a smooth cross-fade, pause on hover/focus, provide accessible controls, and respect prefers-reduced-motion.
- Remove visible “Demo Fixture”, “Empty Fixture”, development toggles, test controls, and mock-data selectors from the customer UI. Keep test/demo tools only in a private development environment, never in production. When the system is in sandbox mode, show a discreet, truthful Sandbox label to testers; do not show fabricated activity as real.
- Preserve the exact visual hierarchy and all existing Home content from the approved reference. The company/bonus/referral/withdrawal information panels should remain on Home as designed. Their action buttons should navigate to the relevant details page rather than being removed from other pages.
- Do not show invented balance, income, member, or rewards figures. Bind each card to authenticated database values and use a proper zero state if no real records exist.

4) INVESTMENT PLAN CATALOGUE
Display the 13 draft plan rows exactly as provided, in the same red-and-white plan-card style. Each has a 365-day period:
A: investment ETB 600; draft daily mining ETB 100
B: investment ETB 1,500; draft daily mining ETB 200
C: investment ETB 3,000; draft daily mining ETB 500
D: investment ETB 5,000; draft daily mining ETB 750
E: investment ETB 8,000; draft daily mining ETB 1,200
F: investment ETB 12,000; draft daily mining ETB 2,000
G: investment ETB 25,000; draft daily mining ETB 5,000
H: investment ETB 50,000; draft daily mining ETB 12,000
I: investment ETB 75,000; draft daily mining ETB 20,000
J: investment ETB 100,000; draft daily mining ETB 30,000
K: investment ETB 150,000; draft daily mining ETB 35,000
L: investment ETB 500,000; draft daily mining ETB 50,000
M: investment ETB 1,000,000; draft daily mining ETB 100,000
- Keep the “Invest Now” button visually distinct. The requested motion is a very subtle button-only animation every 5 seconds; do not flip or rotate the entire plan card. Respect reduced-motion settings and ensure the button remains readable and accessible.
- Until compliance approval, display the daily mining numbers as unverified illustrative draft figures and disable real purchase/claim execution. Do not market them as guaranteed, fixed, risk-free, or company-backed returns. Do not invent an explanation of where the money comes from.
- When an approved real product model is supplied, make plan data admin-configurable and versioned; store price, duration, benefit formula, eligibility, purchase limits, effective dates, and terms server-side.

5) INCOME PAGE / MY PURCHASED PLANS
- Show only plans actually purchased by the signed-in user and verified by the backend. Never show every catalogue plan as an owned plan.
- Each purchased plan card should show plan name, purchase date, amount paid, status, start/end date, remaining period, and actual earned/claimed amounts from the transaction ledger.
- The detail page may show a daily claim action only when the backend confirms a real, eligible, unclaimed benefit for that date. Enforce once-per-day claims server-side, record the ledger transaction, and prevent duplicate claims. No client-side balance mutation.
- Keep income history with date, plan, amount, transaction ID, and status. Include useful filters and empty/loading/error states.

6) TEAM / REFERRALS — THREE LEVELS
- The Team page should show summary cards for Level 1, Level 2, Level 3, total qualifying members, and total qualifying product-sale volume. Use the requested commission rates (Level 1: 20%, Level 2: 2%, Level 3: 1%) only as pending configuration until approved.
- Define a qualifying team member as a referred user who registered with the inviter attribution and completed a verified qualifying product purchase. Registration alone does not make someone a qualifying active team member. A deposit alone must not qualify as a product sale or create a commission.
- Level 1: direct referred customers with a verified qualifying product purchase.
- Level 2: qualifying customers referred by the Level 1 users.
- Level 3: qualifying customers referred by the Level 2 users.
- Display members grouped by level, with registration date, qualifying purchase date/status, qualifying purchase value, and referral code. Do not expose private phone numbers, bank details, IDs, or other sensitive information to uplines.
- When a member has not made a qualifying purchase, show them as “Registered — not yet qualifying”, not as an active paid team member. A member who has not invited anyone remains listed at their own level if they qualify; do not incorrectly move them to another level simply because they have no referrals.
- Show the invitation code near the top and a copy button. Generate the invitation URL from the real deployed base URL and the user's own code. Do not hardcode a fake domain. The ref query parameter must be captured automatically at registration.
- Show commission calculations only for verified qualifying sales and only after the approved commission policy is active. Keep full audit trace from sale to commission.

7) TASK / REWARDS PAGE
- Preserve the approved Task page design with a progress header, task cards, progress bars, status chips, and claim buttons.
- Configure reward levels and amounts from the admin panel only after an approved task policy is supplied. Show eligibility and exact conditions on every task.
- Do not issue rewards for recruitment or deposit activity alone. Use verified product purchases or other genuine, clearly described activities. Claims must be server-validated, idempotent, and recorded in the ledger.

8) RECHARGE / DEPOSIT FLOW — SANDBOX UNTIL APPROVED
- Show the deposit page only to authenticated users. Ask for the amount, then list only payment methods enabled by admins for deposits, including method name and the designated receiver/account details.
- Payment methods must be database-configured by admins; customers must not see disabled methods. Each method can be added, edited, disabled, or deleted, with audit history.
- In sandbox mode, use a simulated payment flow and clearly label it as a test. Do not accept real money or credit a real balance.
- Once a compliant payment-provider integration is approved, show exact amount and recipient instructions, then allow the customer to enter the transaction reference/short code and upload receipt evidence. Validate file type and size; store privately; never trust receipt images alone as proof of payment.
- Create a pending deposit request with a unique reference. Show the current status and a review-time estimate only if an admin-configured service level exists. Do not promise that money will arrive in 15 minutes. A countdown may show elapsed/pending time, not a false guaranteed completion timer.
- Admins must independently verify the transaction in the provider/bank account before approval. On approval, credit exactly once using an atomic server-side ledger transaction. On rejection, require a reason and notify the customer. Prevent duplicate short codes/receipt reuse where appropriate.

9) WITHDRAWAL FLOW — SANDBOX UNTIL APPROVED
- Show the requested draft withdrawal terms: minimum ETB 150 and fee 17%, subject to final legal/provider approval. Show the gross request, fee amount, and net payout clearly before confirmation. Calculate on the server and recheck the available balance at submission.
- Ask the user to enter/select an amount. If balance is insufficient, explain the shortfall. Do not submit a request that violates the minimum, exceeds the available eligible balance, or uses an unapproved account/method.
- Before submitting, show the saved payout method, account number, account owner name, gross amount, fee, and net amount for confirmation. Never show this private information to other users.
- Create a pending withdrawal request and reserve the requested amount atomically to prevent double spending. Admins review and execute payout only through approved channels; record provider reference and completion status. Rejected/cancelled requests must release the reserved balance correctly.

10) BANK / PAYMENT ACCOUNT MANAGEMENT
- Admins manage payout payment-method names (for example, Telebirr) and can add, edit, enable, disable, or remove methods. The same configuration should immediately update the customer form. If the active method set changes, notify affected users and require them to review/update their saved payout details before another withdrawal.
- If no admin-enabled payout method exists, disable account setup and withdrawal submission and explain that payout setup is temporarily unavailable. Do not allow an empty or invalid method to be saved.
- When a user first saves a payout account, lock changes by default. Provide an “I need to change my account” request button. The user must submit a reason; admins can Accept or Reject with an explanation. Notify the user of the decision. Only after acceptance may the user replace the account, then lock it again.
- Store payment account data encrypted where feasible, restrict access by role, mask it in normal views, and log every access/change.

11) CUSTOMER SERVICE / COMPLAINTS / NOTIFICATIONS
- Add a customer service page that displays admin-configured support links/channels. Admins can add, edit, enable, disable, and reorder channel links; changes should appear to users without a code deployment. Validate URLs and show safe link labels.
- Add a support ticket / complaint form with category, subject, message, optional private attachment, status, and replies. Users can see only their own tickets; admins can manage tickets according to role.
- Add in-app notifications for deposit accepted/rejected, withdrawal status, payout-account change request accepted/rejected, payment method updates, bonus/task claims, and support replies. Store notifications server-side and provide read/unread state. Important account changes should be shown again at the relevant action screen if unread.

12) SIDE MENU, VISUAL EFFECTS, PROFILE
- Preserve the top-left hamburger menu and its existing navigation. Near the Logout item, add a small decorative image/animation of cola being poured from a bottle into a glass, using approved assets or a custom generic animation.
- A small cola-fountain visual may appear near the top of the menu, but it must not obscure text or controls.
- The owner requested a cola-liquid river animation flowing from a bottle at the bottom of pages toward another screen corner. Implement it only as a subtle decorative footer/background accent, not over content or buttons. Use CSS/SVG/canvas with low CPU usage, no external scripts, correct layering, and a static fallback. Respect prefers-reduced-motion and provide a way to disable animation.
- Do not assign the same photo of a person drinking cola as every customer's profile photo. Use each user's own uploaded avatar or a neutral default avatar. Brand/cola imagery may be used in page backgrounds or decorative elements only where rights allow.

13) ADMIN DASHBOARD
- Create a separate protected admin area, with no customer access. Use role-based permissions (Owner Admin, Finance Admin, Support Admin, Content Admin, Viewer) and server-side authorization on every endpoint/action.
- Dashboard overview: real registered users, active users (with a defined recent-activity window), online sessions only if tracked lawfully and accurately, verified product sales, pending deposits, pending withdrawals, open complaints, task claims, and ledger totals. Do not fabricate numbers. Add date filters and export permissions.
- User management: search/filter users, view account status, registration date, inviter/referral tree, verified product purchases, eligible balance, ledger, and support history. Mask sensitive personal and payment data unless the staff role requires access. Provide suspend/restore actions with reasons and audit records.
- Finance queue: deposit submissions with amount, receipt, transaction reference, user, date, status, duplicate checks, and Accept/Reject with mandatory reason. Withdrawal queue with gross, fee, net, payout method, account details (masked until authorized), and processing reference. All balance movements must be ledger-based and atomic.
- Payment settings: manage deposit methods and payout methods independently; change active state; configure instructions; log who changed what and when. If a payout method changes, automatically create notifications and require users to reconfirm account details as described above.
- Content/settings: edit support links/channels, carousel images, company text, plan catalogue, promotional terms, check-in settings, purchase limit, minimum withdrawal, withdrawal fee, commission policy, reward tasks, and maintenance mode. Sensitive finance settings require stronger permissions and a second confirmation.
- Support center: see customer complaints, respond, assign, close, reopen, and record resolution notes.
- Audit/security: record admin sign-ins, failed logins, viewed sensitive records, payment changes, approvals/rejections, balance adjustments, and role changes. Never provide an unlogged manual balance-edit shortcut.

14) DATA / BACKEND / RELIABILITY
- Inspect the current stack before making changes. Reuse the existing React/TypeScript architecture and Supabase setup if present; do not replace a working project without need.
- Use Supabase Auth, Postgres, Row Level Security, and secure server-side functions/RPCs for privileged money/ledger operations. Never rely on client-side validation for financial rules.
- Suggested entities: profiles, roles, terms_acceptances, referral_codes, referral_edges, plans, plan_purchases, daily_claims, ledger_accounts, ledger_transactions, deposits, withdrawals, payment_methods, payout_accounts, payout_change_requests, tasks, task_claims, notifications, support_tickets, support_messages, carousel_assets, app_settings, admin_audit_logs, sessions.
- Add unique constraints and idempotency keys for registrations, daily check-ins, daily claims, deposit approvals, withdrawals, referral commissions, and task claims.
- Use Ethiopia timezone (Africa/Addis_Ababa) for daily check-in and day-based claims. Store timestamps in UTC and display local time.
- Implement RLS so customers can access only their own profiles, balances, requests, notifications, and tickets; team members see only permitted aggregate/referral information; admins are restricted by roles.
- Use server-side transaction processing for all balance changes. Keep an immutable append-only ledger; never directly overwrite a balance without a corresponding ledger entry. Add reconciliation tools.
- Add loading, empty, error, offline, pending, success, and rejected states. Ensure responsive layout and accessible contrast, labels, keyboard navigation, and screen-reader names.

15) ACCEPTANCE TESTS — DO NOT MARK COMPLETE UNTIL THESE PASS
- Signed-out user cannot open Home, Income, Team, Task, My, Recharge, or Withdraw.
- Sign-up via a referral URL automatically records the correct inviter; users cannot alter inviter later.
- A user cannot claim daily check-in or daily plan income twice for the same Ethiopia calendar day, including simultaneous requests.
- Income page shows only the authenticated user's verified purchased plans.
- Unqualified registrations do not count as active team members or generate commissions.
- Referral levels are derived from the actual referral tree; only verified qualifying product sales can ever create eligible commissions, and only when policy approval is enabled.
- Deposit methods and payout methods update dynamically when admins change settings.
- A deposit is credited once only after independent verification and admin approval; rejected requests do not credit the wallet.
- Withdrawal cannot exceed available eligible balance; fee and net payout are shown accurately; pending amounts are reserved; rejection releases the reservation.
- A payout account cannot be changed without an approved change request.
- Customer support links and channels update without a code deployment.
- No test/demo fixture selectors or fabricated transaction/activity data appear in production.
- Admin endpoints reject unauthorized roles even if called directly; sensitive actions are audited.
- Reduced-motion settings disable decorative motion; animations never block reading or interacting.

FINAL INSTRUCTIONS TO THE CODING AGENT
Before editing, summarize the current app structure and list the files you plan to modify. Then implement the revisions in small logical groups. Do not delete existing approved design sections. After implementation, run the available tests/build, fix errors, and provide: (1) routes/pages changed, (2) components changed, (3) database migrations and RLS policies added, (4) environment variables required, (5) which items remain sandbox-only and why, and (6) exact manual test steps. Never claim that real deposits, withdrawals, bonuses, mining income, or referral commissions work unless the payment provider, backend ledger, compliance approval, and production credentials are actually configured and tested.
