import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import bcrypt from "npm:bcryptjs@2.4.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Supabase Edge Function environment is incomplete.");

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
const nowIso = () => new Date().toISOString();
const ethiopiaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const uuid = (prefix: string) => prefix + crypto.randomUUID();
async function loginRateKey(scope: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${scope}:${value}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function consumeLoginLimit(keyHash: string, maxAttempts: number) {
  const rows = await checked<any[]>(
    db.rpc("consume_login_rate_limit", {
      p_key_hash: keyHash,
      p_max_attempts: maxAttempts,
      p_window_seconds: 900,
      p_block_seconds: 900,
    }),
    503,
  );
  const result = Array.isArray(rows) ? rows[0] : null;
  if (!result?.allowed) {
    throw new ApiError("Too many login attempts. Please wait 15 minutes and try again.", 429);
  }
}
const maskAccount = (value: string) => {
  const digits = String(value || "").replace(/\s/g, "");
  return digits.length <= 4 ? digits : "•••• •••• " + digits.slice(-4);
};
const normalizePhone = (value: string) => {
  const s = String(value || "").replace(/[^\d+]/g, "");
  if (s.startsWith("+251")) return s;
  if (s.startsWith("251")) return "+" + s;
  if (s.startsWith("09") && s.length === 10) return "+251" + s.slice(1);
  if (s.startsWith("9") && s.length === 9) return "+251" + s;
  return s;
};
const isPhone = (value: string) => /^\+2519\d{8}$/.test(normalizePhone(value));
const plans = [
  { code: "A", name: "Plan A", investment: 600, dailyMining: 100, periodDays: 365 },
  { code: "B", name: "Plan B", investment: 1500, dailyMining: 200, periodDays: 365 },
  { code: "C", name: "Plan C", investment: 3000, dailyMining: 500, periodDays: 365 },
  { code: "D", name: "Plan D", investment: 5000, dailyMining: 750, periodDays: 365 },
  { code: "E", name: "Plan E", investment: 8000, dailyMining: 1200, periodDays: 365 },
  { code: "F", name: "Plan F", investment: 12000, dailyMining: 2000, periodDays: 365 },
  { code: "G", name: "Plan G", investment: 25000, dailyMining: 5000, periodDays: 365 },
  { code: "H", name: "Plan H", investment: 50000, dailyMining: 12000, periodDays: 365 },
  { code: "I", name: "Plan I", investment: 75000, dailyMining: 20000, periodDays: 365 },
  { code: "J", name: "Plan J", investment: 100000, dailyMining: 30000, periodDays: 365 },
  { code: "K", name: "Plan K", investment: 150000, dailyMining: 35000, periodDays: 365 },
  { code: "L", name: "Plan L", investment: 500000, dailyMining: 50000, periodDays: 365 },
  { code: "M", name: "Plan M", investment: 1000000, dailyMining: 100000, periodDays: 365 },
];
const defaultSettings = {
  termsVersion: "v1.0",
  registrationBonus: 150,
  dailyCheckinAmount: 2,
  minWithdrawal: 150,
  withdrawalFeePercent: 17,
  purchaseLimit: 2,
  referralLevel1Percent: 20,
  referralLevel2Percent: 2,
  referralLevel3Percent: 1,
  depositCbeAccountName: "CBE (Commercial Bank of Ethiopia)",
  depositCbeAccountNumber: "1000673029578",
  withdrawalMethodOnly: "CBE (Commercial Bank of Ethiopia)",
  privacyPolicyUrl: "",
  maintenanceMode: false,
};
const companyInfo = {
  name: "Coca-Cola",
  founded: "",
  founder: "",
  headquarters: "",
  industry: "Beverage",
  summary: "Company and platform information is managed by the platform administrator.",
  authorizationDisclosure: "Any brand, sponsorship, or authorization statement must be supported by current written permission before publication.",
};

async function checked<T>(promise: PromiseLike<{ data: T; error: any }>, status = 400): Promise<T> {
  const result = await promise;
  if (result.error) {
    const message = String(result.error.message || "Database operation failed.");
    if (message.includes("FINANCIAL_OPERATIONS_DISABLED")) throw new ApiError("Financial operations are temporarily disabled.", 503);
    if (message.includes("PROMOTIONAL_REWARDS_DISABLED")) throw new ApiError("Promotional rewards are temporarily disabled.", 503);
    if (message.includes("ALREADY_CLAIMED_TODAY") || message.includes("ALREADY_CHECKED_IN_TODAY")) throw new ApiError("You have already claimed this reward today.", 409);
    if (message.includes("MAKER_CHECKER_REQUIRED")) throw new ApiError("Withdrawal completion is not available under the current administrator policy.", 403);
    if (message.includes("WITHDRAWAL_REVIEWER_REQUIRED")) throw new ApiError("This withdrawal must be approved before completion.", 409);
    if (message.includes("INSUFFICIENT_AVAILABLE_BALANCE")) throw new ApiError("Your available wallet balance is insufficient.", 400);
    if (message.includes("PAYOUT_ACCOUNT_NOT_APPROVED")) throw new ApiError("Your bank account must be approved before withdrawing.", 400);
    if (message.includes("MINIMUM_WITHDRAWAL_IS_150_ETB")) throw new ApiError("Minimum withdrawal is 150 ETB.", 400);
    if (message.includes("GIFT_CODE_INVALID")) throw new ApiError("Gift code is invalid or inactive.", 404);
    if (message.includes("GIFT_CODE_ALREADY_REDEEMED")) throw new ApiError("You have already redeemed this gift code.", 409);
    if (message.includes("GIFT_CODE_EXPIRED")) throw new ApiError("This gift code has expired.", 400);
    if (message.includes("GIFT_CODES_DISABLED")) throw new ApiError("Gift codes are currently disabled.", 503);
    if (message.includes("ACCOUNT_ALREADY_EXISTS")) throw new ApiError("An account with this phone number already exists.", 409);
    if (message.includes("INVALID_REFERRAL_CODE")) throw new ApiError("Invitation code is invalid or does not exist.", 400);
    if (message.includes("ACTIVE_PLAN_LIMIT_REACHED")) throw new ApiError("You already have the maximum number of active plans.", 400);
    if (message.includes("PLAN_NOT_CLAIMABLE")) throw new ApiError("This plan is not available for a daily claim.", 400);
    if (message.includes("TASK_TARGET_NOT_REACHED")) throw new ApiError("The team deposit target for this task has not been reached yet.", 400);
    if (message.includes("ALREADY_CLAIMED")) throw new ApiError("This task reward has already been claimed.", 409);
    if (message.includes("UNKNOWN_TASK_ID")) throw new ApiError("Unknown task level ID.", 400);
    throw new ApiError(message, status);
  }
  return result.data;
}
async function getAppSettings() {
  const rows = await checked<any[]>(db.from("app_settings").select("key,value"));
  const values: Record<string, string> = {};
  for (const row of rows || []) values[row.key] = row.value;
  const parsed: any = { ...defaultSettings };
  for (const key of Object.keys(defaultSettings)) {
    if (values[key] !== undefined) {
      const original = (defaultSettings as any)[key];
      parsed[key] = typeof original === "boolean"
        ? ["true", "1", "yes"].includes(String(values[key]).toLowerCase())
        : typeof original === "number" ? Number(values[key]) : values[key];
    }
  }
  parsed.maintenanceMode = parsed.maintenanceMode || false;
  const financialOperationsEnabled = ["true", "1", "yes", "enabled"].includes(
    String(values.financial_operations_enabled || "false").toLowerCase(),
  );
  const promotionalRewardsEnabled = ["true", "1", "yes", "enabled"].includes(
    String(values.promotional_rewards_enabled || "false").toLowerCase(),
  );
  return { settings: parsed, values, financialOperationsEnabled, promotionalRewardsEnabled };
}
async function profileFor(user: any) {
  const [termsResult, inviterResult] = await Promise.all([
    db.from("terms_acceptances").select("terms_version,accepted_at").eq("user_id", user.id).order("accepted_at", { ascending: false }).limit(1).maybeSingle(),
    user.invited_by_user_id
      ? db.from("users").select("referral_code").eq("id", user.invited_by_user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const terms = termsResult.data;
  return {
    id: user.id,
    fullName: user.full_name,
    nickname: user.nickname ?? null,
    displayName: user.nickname || user.full_name || "User",
    phone: user.phone,
    username: user.username ?? null,
    email: user.email ?? null,
    role: user.role,
    status: user.status,
    referralCode: user.referral_code,
    invitedByCode: inviterResult.data?.referral_code ?? null,
    avatarUrl: user.avatar_url ?? null,
    termsAcceptedVersion: terms?.terms_version ?? null,
    termsAcceptedAt: terms?.accepted_at ?? null,
    createdAt: user.created_at,
  };
}
async function unreadCount(userId: string) {
  const r = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", 0);
  if (r.error) return 0;
  return r.count || 0;
}
async function notifyUsers(
  userIds: string[],
  title: string,
  body: string,
  kind: string,
  actionUrl: string | null = null,
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  const rows = uniqueIds.map((userId) => ({
    id: uuid("ntf_"),
    user_id: userId,
    title,
    body,
    kind,
    action_url: actionUrl,
    image_url: null,
    broadcast_id: null,
    is_read: 0,
    created_at: nowIso(),
  }));
  try {
    const result = await db.from("notifications").insert(rows);
    if (result.error) console.error("Notification delivery failed:", result.error.message);
  } catch (error) {
    console.error("Notification delivery failed:", error instanceof Error ? error.message : "Unknown error");
  }
}
async function notifyCustomer(
  userId: string,
  title: string,
  body: string,
  kind: string,
  actionUrl: string | null = null,
) {
  await notifyUsers([userId], title, body, kind, actionUrl);
}
async function notifyAdmins(
  roles: string[],
  title: string,
  body: string,
  kind: string,
  actionUrl: string | null = "/admin",
) {
  try {
    const result = await db.from("users").select("id").in("role", roles).eq("status", "active");
    if (result.error) {
      console.error("Admin notification recipients could not be loaded:", result.error.message);
      return;
    }
    await notifyUsers((result.data || []).map((row: any) => row.id), title, body, kind, actionUrl);
  } catch (error) {
    console.error("Admin notification recipients could not be loaded:", error instanceof Error ? error.message : "Unknown error");
  }
}
async function createSession(userId: string) {
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await checked(db.from("sessions").insert({ token, user_id: userId, expires_at: expiresAt, created_at: nowIso() }));
  return token;
}
async function requireUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new ApiError("Please sign in to continue.", 401);
  const session = await checked<any>(
    db.from("sessions").select("token,user_id,expires_at").eq("token", token).gt("expires_at", nowIso()).maybeSingle(),
    401,
  );
  if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
  const user = await checked<any>(db.from("users").select("*").eq("id", session.user_id).maybeSingle(), 401);
  if (!user || user.status !== "active") throw new ApiError("This account is unavailable.", 403);
  return { user, token };
}
async function requireAdmin(user: any, allowed?: string[]) {
  const roles = allowed || ["owner_admin", "super_admin"];
  if (!roles.includes(user.role)) throw new ApiError("Administrator access is required.", 403);
}
async function getBalances(userId: string) {
  const entries = await checked<any[]>(
    db.from("ledger_entries")
      .select("amount_signed,reserved_delta,promo_delta,earnings_delta,reward_delta,commission_delta")
      .eq("user_id", userId),
  );
  const sums = (entries || []).reduce((acc: any, row: any) => {
    acc.available += Number(row.amount_signed || 0);
    acc.reserved += Number(row.reserved_delta || 0);
    acc.promo += Number(row.promo_delta || 0);
    acc.earnings += Number(row.earnings_delta || 0);
    acc.rewards += Number(row.reward_delta || 0);
    acc.commission += Number(row.commission_delta || 0);
    return acc;
  }, { available: 0, reserved: 0, promo: 0, earnings: 0, rewards: 0, commission: 0 });
  return {
    availableBalance: round2(sums.available),
    reservedBalance: round2(sums.reserved),
    promotionalCredit: round2(sums.promo),
    totalEarnings: round2(sums.earnings),
    totalRewards: round2(sums.rewards),
    teamCommission: round2(sums.commission),
  };
}
async function teamFor(userId: string) {
  const owner = await checked<any>(db.from("users").select("referral_code").eq("id", userId).maybeSingle());
  const l1 = await checked<any[]>(db.from("users").select("id,full_name,nickname,phone,created_at,referral_code").eq("invited_by_user_id", userId));
  const ids1 = (l1 || []).map((u: any) => u.id);
  const l2 = ids1.length ? await checked<any[]>(db.from("users").select("id,full_name,nickname,phone,created_at,referral_code,invited_by_user_id").in("invited_by_user_id", ids1)) : [];
  const ids2 = (l2 || []).map((u: any) => u.id);
  const l3 = ids2.length ? await checked<any[]>(db.from("users").select("id,full_name,nickname,phone,created_at,referral_code,invited_by_user_id").in("invited_by_user_id", ids2)) : [];
  const all = [
    ...(l1 || []).map((u: any) => ({ ...u, level: 1 })),
    ...(l2 || []).map((u: any) => ({ ...u, level: 2 })),
    ...(l3 || []).map((u: any) => ({ ...u, level: 3 })),
  ];
  const ids = all.map((u: any) => u.id);
  const purchases = ids.length ? await checked<any[]>(db.from("plan_purchases").select("id,user_id,amount,created_at,status").in("user_id", ids).order("created_at", { ascending: false })) : [];
  const latestPurchase = new Map<string, any>();
  for (const p of purchases || []) if (!latestPurchase.has(p.user_id)) latestPurchase.set(p.user_id, p);
  const balances = await getBalances(userId);
  const rewards = await checked<any[]>(db.from("referral_rewards").select("amount,level,created_at").eq("beneficiary_user_id", userId));
  const members = all.map((u: any) => {
    const purchase = latestPurchase.get(u.id);
    return {
      id: u.id,
      level: u.level,
      displayName: u.nickname || u.full_name || "User",
      maskedPhone: maskAccount(u.phone),
      referralCode: u.referral_code,
      registeredAt: u.created_at,
      qualified: !!purchase,
      qualifyingStatus: purchase ? purchase.status : "not_qualified",
      qualifyingPurchaseDate: purchase?.created_at || null,
      qualifyingPurchaseValue: Number(purchase?.amount || 0),
    };
  });
  const qualifying = members.filter((m: any) => m.qualified);
  const volume = round2(qualifying.reduce((sum: number, m: any) => sum + m.qualifyingPurchaseValue, 0));
  return {
    invitationCode: owner?.referral_code || "",
    rates: { level1: 20, level2: 2, level3: 1 },
    summary: {
      totalRegisteredMembers: members.length,
      qualifyingMembersCount: qualifying.length,
      totalQualifyingVolume: volume,
      teamCommission: balances.teamCommission,
      level1Count: ids1.length,
      level2Count: ids2.length,
      level3Count: (l3 || []).length,
    },
    levels: {
      level1: members.filter((m: any) => m.level === 1),
      level2: members.filter((m: any) => m.level === 2),
      level3: members.filter((m: any) => m.level === 3),
    },
    members,
    rewards: rewards || [],
  };
}

async function teamTaskSummary(userId: string) {
  const l1 = await checked<any[]>(db.from("users").select("id").eq("invited_by_user_id", userId));
  const ids1 = (l1 || []).map((x: any) => x.id);
  const l2 = ids1.length
    ? await checked<any[]>(db.from("users").select("id").in("invited_by_user_id", ids1))
    : [];
  const teamIds = [...ids1, ...(l2 || []).map((x: any) => x.id)];
  const deposits = teamIds.length
    ? await checked<any[]>(db.from("deposits").select("amount").in("user_id", teamIds).eq("status", "approved"))
    : [];
  const total = round2((deposits || []).reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0));
  const claimedRows = await checked<any[]>(db.from("task_claims").select("task_id").eq("user_id", userId));
  const claimed = new Set((claimedRows || []).map((x: any) => x.task_id));
  const definitions = [
    { id: "val_1", level: 1, targetAmount: 25000, rewardAmount: 1500 },
    { id: "val_2", level: 2, targetAmount: 50000, rewardAmount: 3000 },
    { id: "val_3", level: 3, targetAmount: 100000, rewardAmount: 6000 },
    { id: "val_4", level: 4, targetAmount: 150000, rewardAmount: 10000 },
    { id: "val_5", level: 5, targetAmount: 300000, rewardAmount: 20000 },
  ];
  const valueTasks = definitions.map((task) => ({
    ...task,
    progress: Math.min(total, task.targetAmount),
    remaining: Math.max(0, round2(task.targetAmount - total)),
    percent: Math.min(100, Math.round((total / task.targetAmount) * 100)),
    eligible: total >= task.targetAmount,
    claimed: claimed.has(task.id),
  }));
  return {
    verifiedDepositsTotal: total,
    qualifyingPurchasesVolume: total,
    maxTarget: 300000,
    overallPercent: Math.min(100, Math.round((total / 300000) * 100)),
    valueTasks,
  };
}
async function walletSummary(userId: string) {
  const [balances, purchases, team, checkin] = await Promise.all([
    getBalances(userId),
    checked<any[]>(db.from("plan_purchases").select("id").eq("user_id", userId).eq("status", "active").gt("end_date", nowIso())),
    teamFor(userId),
    db.from("daily_checkins").select("id").eq("user_id", userId).eq("ethiopia_date", ethiopiaDate()).maybeSingle(),
  ]);
  return {
    ...balances,
    activePlansCount: (purchases || []).length,
    maxActivePlans: 2,
    teamMembersCount: team.summary.totalRegisteredMembers,
    qualifyingTeamMembersCount: team.summary.qualifyingMembersCount,
    checkedInToday: !!checkin.data,
    todayEthiopiaDate: ethiopiaDate(),
  };
}
const paymentMethodDto = (m: any) => ({
  id: m.id, kind: m.kind, name: m.name, accountName: m.account_name,
  accountNumber: m.account_number, instructions: m.instructions,
  isActive: m.is_active === 1, sortOrder: m.sort_order, updatedAt: m.updated_at,
});
const payoutDto = (a: any) => a ? ({
  id: a.id, userId: a.user_id, methodName: a.method_name, accountNumber: a.account_number,
  maskedAccountNumber: maskAccount(a.account_number), accountOwnerName: a.account_owner_name,
  status: a.status, isLocked: a.is_locked === 1, reviewNote: a.review_note,
  updatedAt: a.updated_at,
}) : null;
const payoutChangeRequestDto = (r: any) => ({
  id: r.id, userId: r.user_id, reason: r.reason, newMethodName: r.new_method_name,
  newAccountNumber: r.new_account_number, newAccountOwnerName: r.new_account_owner_name,
  status: r.status, adminNote: r.admin_note ?? null, createdAt: r.created_at,
});
const depositDto = (d: any) => ({
  id: d.id, userId: d.user_id, paymentMethodId: d.payment_method_id,
  methodName: d.method_name, accountNumberSnapshot: d.account_number_snapshot,
  amount: Number(d.amount), txReference: d.tx_reference,
  hasReceipt: !!d.receipt_path, receiptMime: d.receipt_mime,
  status: d.status, rejectionReason: d.rejection_reason,
  reviewedAt: d.reviewed_at, createdAt: d.created_at,
});
const withdrawalDto = (w: any) => ({
  id: w.id, userId: w.user_id, methodName: w.method_name,
  accountNumberSnapshot: w.account_number_snapshot,
  maskedAccountNumber: maskAccount(w.account_number_snapshot),
  accountOwnerSnapshot: w.account_owner_snapshot, grossAmount: Number(w.gross_amount),
  feeAmount: Number(w.fee_amount), netAmount: Number(w.net_amount), status: w.status,
  providerReference: w.provider_reference, rejectionReason: w.rejection_reason,
  reviewedAt: w.reviewed_at, processedAt: w.processed_at || null,
  completedAt: w.completed_at || null, createdAt: w.created_at,
});

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionIndex = pathParts.lastIndexOf("coca-cola-api");
  const pathName = functionIndex >= 0 ? pathParts.slice(functionIndex + 1).join("/") : pathParts.join("/");
  const p = pathName.split("/").filter(Boolean).join("/");
  const method = request.method.toUpperCase();
  const query = url.searchParams;
  let body: any = {};
  let form: FormData | null = null;
  const contentType = request.headers.get("content-type") || "";
  if (method !== "GET" && method !== "HEAD") {
    if (contentType.includes("multipart/form-data")) {
      form = await request.formData();
    } else if (contentType.includes("application/json")) {
      body = await request.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      body = Object.fromEntries(new URLSearchParams(await request.text()).entries());
    }
  }

  if (p === "health" && method === "GET") {
    const settings = await getAppSettings();
    return json({ ok: true, database: "supabase-postgres", financialOperationsEnabled: settings.financialOperationsEnabled });
  }

  if (p === "config" && method === "GET") {
    const [app, admins, gift, methods, channels, assets] = await Promise.all([
      getAppSettings(),
      db.from("users").select("id", { count: "exact", head: true }).in("role", ["owner_admin", "finance_admin", "support_admin", "content_admin", "admin", "super_admin"]),
      db.from("gift_code_settings").select("is_enabled").eq("id", "default").maybeSingle(),
      db.from("payment_methods").select("*").eq("is_active", 1).order("sort_order"),
      db.from("support_channels").select("*").eq("is_active", 1).order("sort_order"),
      db.from("carousel_assets").select("*").eq("is_active", 1).order("sort_order"),
    ]);
    if (admins.error || methods.error || channels.error || assets.error) throw new ApiError("Unable to load platform configuration.", 503);
    return json({
      complianceApproved: app.financialOperationsEnabled,
      financialOperationsEnabled: app.financialOperationsEnabled,
      adminSetupRequired: (admins.count || 0) === 0,
      giftCodeEnabled: gift.data?.is_enabled === 1,
      publicSiteUrl: null,
      customDomainConfigured: false,
      settings: app.settings,
      activeDepositMethods: (methods.data || []).filter((m: any) => m.kind === "deposit").map(paymentMethodDto),
      activePayoutMethods: (methods.data || []).filter((m: any) => m.kind === "payout").map(paymentMethodDto),
      supportChannels: (channels.data || []).map((c: any) => ({
        id: c.id, label: c.label, handleOrUrl: c.handle_or_url, href: c.href,
        kind: c.kind, isActive: c.is_active === 1, sortOrder: c.sort_order,
      })),
      carouselAssets: (assets.data || []).map((a: any) => ({
        id: a.id, title: a.title, subtitle: a.subtitle, imageUrl: a.image_url,
        isActive: a.is_active === 1, sortOrder: a.sort_order,
      })),
      companyInfo,
    });
  }


  if (p === "auth/reset-owner-password" && method === "POST") {
    const resetToken = String(body.resetToken || "").trim().toLowerCase();
    const phone = normalizePhone(String(body.phone || "+251909090909"));
    const username = String(body.username || "coca_cola").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-f0-9]{64}$/.test(resetToken)) {
      throw new ApiError("The one-time password reset token is invalid.", 400);
    }
    if (!isPhone(phone) || !/^[a-z0-9_.-]{3,32}$/.test(username) || password.length < 12 || password.length > 128) {
      throw new ApiError("Enter a valid owner phone, username, and password of 12–128 characters.", 400);
    }

    const saved = await checked<any>(
      db.from("app_settings").select("value").eq("key", "owner_password_reset_sha256").maybeSingle(),
    );
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(resetToken));
    const suppliedHash = Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
    if (!saved?.value || String(saved.value).toLowerCase() !== suppliedHash) {
      throw new ApiError("The one-time password reset token is invalid or has already been used.", 403);
    }

    const owner = await checked<any>(
      db.from("users").select("*").eq("role", "owner_admin").eq("phone", phone).maybeSingle(),
    );
    if (!owner || owner.status !== "active") {
      throw new ApiError("The active owner account for this phone number was not found.", 404);
    }

    const updated = await checked<any>(
      db.from("users").update({
        username,
        phone,
        password_hash: await bcrypt.hash(password, 12),
        status: "active",
      }).eq("id", owner.id).select("*").single(),
    );
    await checked(db.from("sessions").delete().eq("user_id", owner.id));
    await checked(db.from("app_settings").delete().eq("key", "owner_password_reset_sha256"));
    return json({ success: true, user: await profileFor(updated), message: "Owner password reset successfully. Please sign in with your new password." });
  }

  if (p === "auth/bootstrap-owner" && method === "POST") {
    const bootstrapToken = String(body.bootstrapToken || "").trim();
    const fullName = String(body.fullName || "").trim().slice(0, 100);
    const phone = normalizePhone(String(body.phone || ""));
    const username = String(body.username || "owner").trim().toLowerCase();
    const password = String(body.password || "");
    if (bootstrapToken.length < 32) throw new ApiError("The one-time setup token is invalid.", 400);
    if (!isPhone(phone)) throw new ApiError("Enter a valid Ethiopia phone number.", 400);
    if (fullName.length < 2 || username.length < 3 || password.length < 12) {
      throw new ApiError("Enter your name, a username, and a password of at least 12 characters.", 400);
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bootstrapToken));
    const tokenHash = Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, "0")).join("");
    const passwordHash = await bcrypt.hash(password, 12);
    const referralCode = "COLA" + crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const created = await checked<string>(db.rpc("bootstrap_owner_atomic", {
      p_full_name: fullName,
      p_phone: phone,
      p_username: username,
      p_password_hash: passwordHash,
      p_referral_code: referralCode,
      p_token_hash: tokenHash,
    }), 400);
    const token = await createSession(created);
    const user = await checked<any>(db.from("users").select("*").eq("id", created).single());
    return json({ success: true, user: await profileFor(user) }, 201);
  }

  if (p === "auth/register" && method === "POST") {
    const phone = normalizePhone(body.phone || "");
    const password = String(body.password || "");
    if (!isPhone(phone)) throw new ApiError("Enter a valid Ethiopia phone number (+251 9XXXXXXXX or 09XXXXXXXX).", 400);
    if (password.length < 6) throw new ApiError("Password must be at least 6 characters long.", 400);
    if (password !== String(body.confirmPassword || "")) throw new ApiError("Password and confirmation password do not match.", 400);
    const reservedAdminPhone = Deno.env.get("ADMIN_PHONE");
    if (reservedAdminPhone && phone === normalizePhone(reservedAdminPhone)) {
      throw new ApiError("This phone number is reserved and cannot be registered.", 409);
    }
    const referralCode = String(body.referralCode || "").trim().toUpperCase() || null;
    const userId = uuid("usr_");
    const fullName = String(body.fullName || body.name || "Customer").trim().slice(0, 100);
    const passwordHash = await bcrypt.hash(password, 12);
    const registeredUserId = await checked<string>(db.rpc("register_customer_atomic", {
      p_user_id: userId,
      p_full_name: fullName,
      p_phone: phone,
      p_email: body.email ? String(body.email).trim().toLowerCase() : null,
      p_password_hash: passwordHash,
      p_referral_code: referralCode,
    }), 400);
    const token = await createSession(registeredUserId);
    const insertedUser = await checked<any>(
      db.from("users").select("*").eq("id", registeredUserId).single(),
    );
    const user = await profileFor(insertedUser);
    return json({ user, token, unreadNotifications: 0 }, 201);
  }

  if (p === "auth/login" && method === "POST") {
    const identifier = String(body.identifier || body.phone || "").trim();
    const isPhoneIdentifier = isPhone(identifier) || /^09\d{8}$/.test(identifier) || /^2519\d{8}$/.test(identifier);
    const normalizedIdentifier = isPhoneIdentifier
      ? normalizePhone(identifier)
      : identifier.toLowerCase();
    const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const identityKey = await loginRateKey("identity", normalizedIdentifier || "empty");
    const ipKey = await loginRateKey("ip", forwardedIp);
    await consumeLoginLimit(identityKey, 5);
    await consumeLoginLimit(ipKey, 30);

    let result: any;
    if (isPhoneIdentifier) result = await db.from("users").select("*").eq("phone", normalizedIdentifier).maybeSingle();
    else if (identifier.includes("@")) result = await db.from("users").select("*").eq("email", normalizedIdentifier).maybeSingle();
    else result = await db.from("users").select("*").ilike("username", identifier).maybeSingle();
    if (result?.error || !result?.data || result.data.status !== "active") throw new ApiError("Phone number or password is incorrect.", 401);
    const valid = await bcrypt.compare(String(body.password || ""), result.data.password_hash);
    if (!valid) throw new ApiError("Phone number or password is incorrect.", 401);
    // Reset the successfully authenticated identity bucket only.
    // Keep the shared IP bucket intact so one valid account cannot reset
    // the IP-wide brute-force protection for other customer accounts.
    await checked(db.rpc("clear_login_rate_limit", { p_key_hash: identityKey }), 503);
    await checked(db.from("users").update({ last_active_at: nowIso() }).eq("id", result.data.id));
    const token = await createSession(result.data.id);
    const [user, unreadNotifications] = await Promise.all([profileFor(result.data), unreadCount(result.data.id)]);
    return json({ user, token, unreadNotifications });
  }

  if (p === "auth/me" && method === "GET") {
    try {
      const { user } = await requireUser(request);
      const [dto, unreadNotifications] = await Promise.all([profileFor(user), unreadCount(user.id)]);
      return json({ user: dto, unreadNotifications });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return json({ user: null, unreadNotifications: 0 });
      throw e;
    }
  }
  if (p === "auth/logout" && method === "POST") {
    const auth = request.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (token) await checked(db.from("sessions").delete().eq("token", token));
    return json({ success: true });
  }

  const auth = await requireUser(request);
  const user = auth.user;

  // Keep every balance-changing operation closed until the platform owner explicitly enables live finance.
  const requiresFinancialApproval =
    method === "POST" &&
    (
      ["plans/purchase", "deposits", "withdrawals", "tasks/claim", "gift-codes/redeem"].includes(p) ||
      /^income\/claim\/[^/]+$/.test(p) ||
      /^admin\/deposits\/[^/]+\/approve$/.test(p) ||
      /^admin\/withdrawals\/[^/]+\/(approve|reject|complete)$/.test(p)
    );
  if (requiresFinancialApproval) {
    const financialSettings = await getAppSettings();
    if (!financialSettings.financialOperationsEnabled) {
      throw new ApiError("Financial operations are temporarily disabled. Contact the platform owner.", 503);
    }
  }

  if (p === "onboarding/accept-terms" && method === "POST") {
    const app = await getAppSettings();
    const acceptedVersion = String(body.termsVersion || app.settings.termsVersion);
    if (!body.accepted || !acceptedVersion) {
      throw new ApiError("Please confirm that you accept the current platform terms.", 400);
    }
    await checked(db.from("terms_acceptances").upsert({
      id: uuid("trm_"), user_id: user.id,
      terms_version: acceptedVersion,
      accepted_at: nowIso(), ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
    }, { onConflict: "user_id,terms_version" }));
    const refreshedUser = await checked<any>(
      db.from("users").select("*").eq("id", user.id).single(),
    );
    const profile = await profileFor(refreshedUser);
    if (profile.termsAcceptedVersion !== acceptedVersion) {
      throw new ApiError("Terms acceptance could not be verified. Please try again.", 503);
    }
    return json({
      ok: true,
      success: true,
      termsAccepted: true,
      acceptedVersion,
      user: profile,
    });
  }

  if (p === "profile/nickname" && method === "PUT") {
    const nickname = String(body.nickname || "").trim();
    if (nickname.length < 2 || nickname.length > 24 || !/^[\p{L}\p{N} _.-]+$/u.test(nickname)) {
      throw new ApiError("Nickname must be 2–24 characters and use letters or numbers.", 400);
    }
    const updated = await checked<any>(db.from("users").update({ nickname }).eq("id", user.id).select("*").single());
    return json({ user: await profileFor(updated) });
  }

  if (p === "dashboard/summary" && method === "GET") return json(await walletSummary(user.id));

  if (p === "checkin" && method === "GET") {
    const [app, wallet, history] = await Promise.all([
      getAppSettings(),
      walletSummary(user.id),
      checked<any[]>(db.from("daily_checkins").select("id,ethiopia_date,amount,status,created_at")
        .eq("user_id", user.id).order("ethiopia_date", { ascending: false }).limit(30)),
    ]);
    const rewardAmount = Number(app.settings.dailyCheckinAmount);
    return json({
      checkedInToday: wallet.checkedInToday,
      ethiopiaDate: wallet.todayEthiopiaDate,
      todayEthiopiaDate: wallet.todayEthiopiaDate,
      rewardAmount,
      amount: rewardAmount,
      availableBalance: wallet.availableBalance,
      history: history.map((x: any) => ({
        id: x.id, ethiopiaDate: x.ethiopia_date, amount: Number(x.amount),
        status: x.status, createdAt: x.created_at,
      })),
    });
  }
  if (p === "checkin" && method === "POST") {
    const rewardSettings = await getAppSettings();
    if (!rewardSettings.promotionalRewardsEnabled) {
      throw new ApiError("Promotional rewards are temporarily disabled.", 503);
    }
    const result = await checked<any>(db.rpc("claim_daily_checkin_atomic", { p_user_id: user.id }));
    await notifyCustomer(user.id, "Daily check-in credited", "Your daily check-in reward was successfully credited to your wallet.", "daily_checkin", "/checkin");
    return json({ message: "Daily check-in reward claimed.", ...result, availableBalance: (await getBalances(user.id)).availableBalance });
  }

  if (p === "plans/purchase" && method === "POST") {
    const code = String(body.planCode || body.code || "").toUpperCase();
    const plan = plans.find((x) => x.code === code);
    if (!plan) throw new ApiError("Selected plan is not available.", 400);
    const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID());
    const result = await checked<any>(db.rpc("purchase_plan_atomic", {
      p_user_id: user.id, p_plan_code: plan.code, p_amount: plan.investment,
      p_daily_rate: plan.dailyMining, p_idempotency_key: idempotencyKey,
    }));
    await notifyCustomer(user.id, "Plan activated", `Plan ${plan.code} was successfully activated. Your plan details are available in the Income section.`, "plan_purchase", "/income");
    return json({ message: "Plan purchase completed.", purchase: result, ...result });
  }

  if (p === "income" && method === "GET") {
    const [wallet, purchases, entries] = await Promise.all([
      walletSummary(user.id),
      checked<any[]>(db.from("plan_purchases").select("*").eq("user_id", user.id).order("created_at", { ascending: false })),
      checked<any[]>(db.from("ledger_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)),
    ]);
    const claims = purchases.length
      ? await checked<any[]>(db.from("daily_claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000))
      : [];
    const today = ethiopiaDate();
    const dayMs = (value: string) => Date.parse(value + "T00:00:00.000Z");
    const purchaseItems = purchases.map((x: any) => {
      const purchaseEthDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(x.start_date));
      const periodDays = Number(x.period_days) || 365;
      const rawElapsed = Math.max(0, Math.floor((dayMs(today) - dayMs(purchaseEthDate)) / 86400000));
      const daysElapsed = Math.max(0, Math.min(periodDays, rawElapsed));
      const remainingDays = Math.max(0, periodDays - daysElapsed);
      const isCompleted = rawElapsed >= periodDays || x.status === "completed";
      const claimedToday = claims.some((c: any) => c.purchase_id === x.id && c.ethiopia_date === today);
      const totalClaimed = round2(claims.filter((c: any) => c.purchase_id === x.id)
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0));
      const canClaim = !isCompleted && x.status === "active" && !claimedToday;
      return {
        id: x.id, planCode: x.plan_code, amount: Number(x.amount),
        dailyMiningRate: Number(x.daily_mining_rate), periodDays,
        status: isCompleted ? "completed" : x.status,
        startDate: x.start_date, endDate: x.end_date, purchaseEthDate,
        daysElapsed, remainingDays, isCompleted, canClaim,
        statusLabel: isCompleted ? "Plan Completed" : claimedToday ? "Claimed Today" : "Ready to Claim",
        claimedToday, totalClaimed, createdAt: x.created_at,
      };
    });
    return json({
      ...wallet,
      activePlansCount: purchaseItems.filter((x: any) => !x.isCompleted && x.status === "active").length,
      myIncome: Number(wallet.totalEarnings || 0),
      availableBalance: Number(wallet.availableBalance || 0),
      todayEthiopiaDate: today,
      purchases: purchaseItems,
      transactions: entries.map((x: any) => ({
        id: x.id, userId: x.user_id, type: x.type, amountSigned: Number(x.amount_signed),
        balanceAfter: Number(x.balance_after), referenceId: x.reference_id, note: x.note, createdAt: x.created_at,
      })),
    });
  }

  const incomeClaim = p.match(/^income\/claim\/([^/]+)$/);
  if (incomeClaim && method === "POST") {
    const result = await checked<any>(db.rpc("claim_daily_mining_atomic", {
      p_user_id: user.id, p_purchase_id: decodeURIComponent(incomeClaim[1]), p_ethiopia_date: ethiopiaDate(),
    }));
    await notifyCustomer(user.id, "Daily earnings credited", `Your daily mining earnings of ${Number(result.amount || 0).toFixed(2)} ETB were credited to your wallet.`, "daily_mining", "/income");
    return json({ message: "Daily mining reward claimed.", ...result, ...await getBalances(user.id) });
  }

  if (p === "team" && method === "GET") return json(await teamFor(user.id));

  if (p === "tasks" && method === "GET") return json(await teamTaskSummary(user.id));
  if (p === "tasks/claim" && method === "POST") {
    const result = await checked<any>(db.rpc("claim_team_value_task_atomic", {
      p_user_id: user.id, p_task_id: String(body.taskId || ""),
    }));
    await notifyCustomer(user.id, "Team task reward credited", `Your team task reward of ${Number(result.amount || result.rewardAmount || 0).toFixed(2)} ETB was credited to your wallet.`, "task_reward", "/task");
    return json({ message: "Team task reward claimed.", ...result, ...await teamTaskSummary(user.id) });
  }

  if (p === "payment-methods" && method === "GET") {
    const [depositMethods, payoutMethods] = await Promise.all([
      checked<any[]>(db.from("payment_methods").select("*").eq("kind", "deposit").eq("is_active", 1).order("sort_order")),
      checked<any[]>(db.from("payment_methods").select("*").eq("kind", "payout").eq("is_active", 1).order("sort_order")),
    ]);
    return json({
      depositMethods: depositMethods.map(paymentMethodDto),
      payoutMethods: payoutMethods.map(paymentMethodDto),
      methods: depositMethods.map(paymentMethodDto),
    });
  }

  if (p === "deposits" && method === "GET") {
    const rows = await checked<any[]>(db.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }));
    return json({ deposits: rows.map(depositDto) });
  }
  if (p === "deposits" && method === "POST") {
    const app = await getAppSettings();
    if (!app.financialOperationsEnabled) throw new ApiError("Deposits are temporarily unavailable while platform financial operations are being activated.", 503);
    const amount = Number(form?.get("amount") || body.amount);
    const methodId = String(form?.get("paymentMethodId") || body.paymentMethodId || "");
    const txReference = String(form?.get("txReference") || body.txReference || "").trim();
    const paymentMethod = await checked<any>(db.from("payment_methods").select("*").eq("id", methodId).eq("kind", "deposit").eq("is_active", 1).maybeSingle());
    if (!paymentMethod) throw new ApiError("Selected deposit method is unavailable.", 400);
    if (!Number.isFinite(amount) || amount <= 0 || !txReference) throw new ApiError("Enter a valid amount and bank reference.", 400);
    const receipt = form?.get("receipt");
    if (!(receipt instanceof File)) throw new ApiError("A payment receipt is required.", 400);
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(receipt.type) || receipt.size > 5 * 1024 * 1024) {
      throw new ApiError("Receipt must be JPG, PNG, WEBP, or PDF up to 5 MB.", 400);
    }
    const ext = receipt.type === "application/pdf" ? "pdf" : receipt.type.split("/")[1];
    const filePath = "deposits/" + user.id + "/" + crypto.randomUUID() + "." + ext;
    await checked(db.storage.from("platform-uploads").upload(filePath, receipt, { contentType: receipt.type, upsert: false }));
    const row = await checked<any>(db.from("deposits").insert({
      id: uuid("dep_"), user_id: user.id, payment_method_id: methodId,
      method_name: paymentMethod.name, account_number_snapshot: paymentMethod.account_number,
      amount: round2(amount), tx_reference: txReference, receipt_path: filePath,
      receipt_mime: receipt.type, status: "pending", created_at: nowIso(),
    }).select("*").single());
    const amountLabel = round2(amount).toFixed(2) + " ETB";
    await notifyCustomer(user.id, "Deposit request received", `Your deposit request for ${amountLabel} was submitted and is awaiting review.`, "deposit_submitted", "/recharge");
    await notifyAdmins(
      ["owner_admin", "finance_admin", "admin", "super_admin"],
      "New deposit request",
      `A customer submitted a ${amountLabel} deposit request. Review the receipt and bank reference.`,
      "admin_deposit",
    );
    return json({ message: "Deposit request submitted for administrator review.", deposit: depositDto(row) }, 201);
  }

  if (p === "payout-account" && method === "GET") {
    const [account, changeRequests] = await Promise.all([
      checked<any>(db.from("payout_accounts").select("*").eq("user_id", user.id).maybeSingle()),
      checked<any[]>(db.from("payout_change_requests").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(100)),
    ]);
    return json({
      account: payoutDto(account),
      changeRequests: changeRequests.map(payoutChangeRequestDto),
    });
  }
  if (p === "payout-account" && ["POST", "PUT", "PATCH"].includes(method)) {
    const methodId = String(body.methodId || "").trim();
    const accountNumber = String(body.accountNumber || "").trim();
    const ownerName = String(body.accountOwnerName || body.accountName || "").trim();
    if (!methodId || accountNumber.length < 5 || !ownerName) {
      throw new ApiError("Select a payout method and enter the account number and account owner.", 400);
    }
    const selectedMethod = await checked<any>(db.from("payment_methods").select("name")
      .eq("id", methodId).eq("kind", "payout").eq("is_active", 1).maybeSingle());
    if (!selectedMethod) throw new ApiError("Selected payout method is unavailable.", 400);
    const existing = await checked<any>(db.from("payout_accounts").select("id").eq("user_id", user.id).maybeSingle());
    const values = {
      method_name: selectedMethod.name,
      account_number: accountNumber,
      account_owner_name: ownerName,
      status: "approved",
      is_locked: 0,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: nowIso(),
    };
    const row = existing
      ? await checked<any>(db.from("payout_accounts").update(values).eq("user_id", user.id).select("*").single())
      : await checked<any>(db.from("payout_accounts").insert({ id: uuid("pay_"), user_id: user.id, ...values }).select("*").single());
    await notifyCustomer(
      user.id,
      "Payout account saved",
      `${selectedMethod.name} account ending ${accountNumber.slice(-4)} was saved and is ready to use for future withdrawal requests. You can update it any time.`,
      "payout_account_saved",
      "/my/bank-account",
    );
    return json({
      message: existing ? "Payout account updated. It is ready for withdrawals." : "Payout account saved. It is ready for withdrawals.",
      account: payoutDto(row),
    }, existing ? 200 : 201);
  }
  if (p === "payout-account/change-request" && method === "POST") {
    const reason = String(body.reason || "").trim();
    const newMethodId = String(body.newMethodId || "").trim();
    const number = String(body.newAccountNumber || "").trim();
    const ownerName = String(body.newAccountOwnerName || "").trim();
    if (!reason || !newMethodId || number.length < 5 || !ownerName) throw new ApiError("Select a payout method and complete all bank account change details.", 400);
    const selectedMethod = await checked<any>(db.from("payment_methods").select("name")
      .eq("id", newMethodId).eq("kind", "payout").eq("is_active", 1).maybeSingle());
    if (!selectedMethod) throw new ApiError("Selected payout method is unavailable.", 400);
    const row = await checked<any>(db.from("payout_change_requests").insert({
      id: uuid("pcr_"), user_id: user.id, reason, new_method_name: selectedMethod.name,
      new_account_number: number, new_account_owner_name: ownerName, status: "pending", created_at: nowIso(),
    }).select("*").single());
    return json({ message: "Bank account change request submitted.", request: payoutChangeRequestDto(row) }, 201);
  }

  if (p === "withdrawals" && method === "GET") {
    const rows = await checked<any[]>(db.from("withdrawals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }));
    return json({ withdrawals: rows.map(withdrawalDto) });
  }
  if (p === "withdrawals" && method === "POST") {
    const result = await checked<any>(db.rpc("request_withdrawal_atomic", {
      p_user_id: user.id, p_idempotency_key: String(body.idempotencyKey || crypto.randomUUID()),
      p_gross_amount: Number(body.amount),
    }));
    const gross = Number(result.grossAmount || body.amount || 0);
    const fee = Number(result.feeAmount || 0);
    const net = Number(result.netAmount || 0);
    const amountLabel = gross.toFixed(2) + " ETB";
    await notifyCustomer(
      user.id,
      "Withdrawal request received",
      `Your withdrawal request for ${amountLabel} (fee ${fee.toFixed(2)} ETB; net ${net.toFixed(2)} ETB) was received and is awaiting review.`,
      "withdrawal_requested",
      "/withdraw",
    );
    await notifyAdmins(
      ["owner_admin", "finance_admin", "admin", "super_admin"],
      "New withdrawal request",
      `A customer requested ${amountLabel}; net payout is ${net.toFixed(2)} ETB. Review the saved bank details and process the request.`,
      "admin_withdrawal",
    );
    return json({ message: "Withdrawal request submitted for administrator review.", withdrawal: result, ...result }, 201);
  }

  if (p === "notifications" && method === "GET") {
    const rows = await checked<any[]>(db.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100));
    return json({ notifications: rows.map((n: any) => ({
      id: n.id, title: n.title, body: n.body, kind: n.kind, actionUrl: n.action_url,
      imageUrl: n.image_url, broadcastId: n.broadcast_id, isRead: n.is_read === 1, createdAt: n.created_at,
    })) });
  }
  const notificationRead = p.match(/^notifications\/([^/]+)\/read$/);
  if (notificationRead && method === "POST") {
    await checked(db.from("notifications").update({ is_read: 1 }).eq("id", decodeURIComponent(notificationRead[1])).eq("user_id", user.id));
    return json({ success: true });
  }
  if (p === "notifications/read-all" && method === "POST") {
    await checked(db.from("notifications").update({ is_read: 1 }).eq("user_id", user.id));
    return json({ success: true });
  }

  if (p === "support/tickets" && method === "GET") {
    const tickets = await checked<any[]>(db.from("support_tickets").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }));
    const ticketIds = tickets.map((x: any) => x.id);
    const messages = ticketIds.length
      ? await checked<any[]>(db.from("support_messages").select("*").in("ticket_id", ticketIds).order("created_at"))
      : [];
    return json({ tickets: tickets.map((t: any) => ({
      id: t.id, userId: t.user_id, category: t.category, subject: t.subject, message: t.message,
      status: t.status, attachmentPath: t.attachment_path, createdAt: t.created_at, updatedAt: t.updated_at,
      messages: messages.filter((m: any) => m.ticket_id === t.id).map((m: any) => ({
        id: m.id, senderId: m.sender_id, senderRole: m.sender_role, message: m.message, createdAt: m.created_at,
      })),
    })) });
  }
  if (p === "support/tickets" && method === "POST") {
    const category = String(body.category || "general").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    if (!subject || !message) throw new ApiError("Enter a subject and message.", 400);
    const ticketId = uuid("tkt_");
    const inserted = await checked<any>(db.from("support_tickets").insert({
      id: ticketId, user_id: user.id, category, subject, message,
      status: "open", is_read_by_admin: 0, created_at: nowIso(), updated_at: nowIso(),
    }).select("*").single());
    await checked(db.from("support_messages").insert({
      id: uuid("msg_"), ticket_id: ticketId, sender_id: user.id, sender_role: user.role,
      message, created_at: nowIso(),
    }));
    await notifyAdmins(
      ["owner_admin", "support_admin", "admin", "super_admin"],
      "New customer support message",
      `${user.full_name || "A customer"} opened a support ticket: ${subject}`,
      "admin_support",
    );
    await notifyCustomer(user.id, "Support request received", `Your message “${subject}” was sent to Customer Service.`, "support_ticket", "/service");
    return json({ message: "Support ticket submitted.", ticket: inserted }, 201);
  }
  const supportReply = p.match(/^support\/tickets\/([^/]+)\/reply$/);
  if (supportReply && method === "POST") {
    const ticketId = decodeURIComponent(supportReply[1]);
    const ticket = await checked<any>(db.from("support_tickets").select("*").eq("id", ticketId).maybeSingle());
    if (!ticket || (ticket.user_id !== user.id && !["owner_admin","support_admin","admin","super_admin"].includes(user.role))) {
      throw new ApiError("Support ticket not found.", 404);
    }
    const message = String(body.message || "").trim();
    if (!message) throw new ApiError("Message cannot be empty.", 400);
    await checked(db.from("support_messages").insert({
      id: uuid("msg_"), ticket_id: ticketId, sender_id: user.id, sender_role: user.role,
      message, created_at: nowIso(),
    }));
    await checked(db.from("support_tickets").update({ updated_at: nowIso(), is_read_by_admin: user.role === "customer" ? 0 : 1 }).eq("id", ticketId));
    if (user.role === "customer") {
      await notifyAdmins(
        ["owner_admin", "support_admin", "admin", "super_admin"],
        "New customer support reply",
        `A customer sent a new reply on “${ticket.subject}”.`,
        "admin_support",
      );
    } else {
      await notifyCustomer(
        ticket.user_id,
        "Customer Service replied",
        `There is a new reply on your support request “${ticket.subject}”.`,
        "support_reply",
        "/service",
      );
    }
    return json({ success: true });
  }

  if (p === "gift-codes" && method === "GET") {
    const rows = await checked<any[]>(db.from("gift_code_redemptions").select("*").eq("user_id", user.id).order("redeemed_at", { ascending: false }));
    return json({ redemptions: rows.map((x: any) => ({
      id: x.id, giftCodeId: x.gift_code_id, code: x.code_snapshot,
      rewardAmount: Number(x.reward_amount), redeemedAt: x.redeemed_at,
    })) });
  }
  if (p === "gift-codes/redeem" && method === "POST") {
    const result = await checked<any>(db.rpc("redeem_gift_code_atomic", {
      p_user_id: user.id, p_code: String(body.code || "").trim(),
    }));
    await notifyCustomer(user.id, "Gift code redeemed", `Your gift code reward of ${Number(result.rewardAmount || result.reward_amount || 0).toFixed(2)} ETB was credited to your wallet.`, "gift_code", "/gift-codes");
    return json({ message: "Gift code redeemed successfully.", ...result });
  }

  if (p.startsWith("admin/")) {
    let allowed = ["owner_admin", "super_admin"];
    if (/^admin\/(overview|deposits|withdrawals|payment-methods|gift-codes)/.test(p)) {
      allowed = ["owner_admin", "finance_admin", "admin", "super_admin"];
    } else if (p.startsWith("admin/tickets")) {
      allowed = ["owner_admin", "support_admin", "admin", "super_admin"];
    } else if (/^admin\/(broadcasts|channels|content)/.test(p)) {
      allowed = ["owner_admin", "content_admin", "support_admin", "admin", "super_admin"];
    }
    await requireAdmin(user, allowed);
  }

  if (p === "admin/overview" && method === "GET") {
    const from=query.get("from")||"1970-01-01T00:00:00.000Z";
    const toInput=query.get("to"),to=toInput?toInput+"T23:59:59.999Z":"2999-12-31T23:59:59.999Z";
    const recent=new Date(Date.now()-15*60*1000).toISOString();
    const [users,sessions,recentUsers,pendingDeposits,approvedDeposits,pendingWithdrawals,approvedWithdrawals,completedWithdrawals,openTickets,unreadTickets,capSetting,exposureResult]=await Promise.all([
      db.from("users").select("id",{count:"exact",head:true}).eq("role","customer").gte("created_at",from).lte("created_at",to),
      db.from("sessions").select("user_id",{count:"exact",head:true}).gt("expires_at",nowIso()),
      db.from("users").select("id",{count:"exact",head:true}).eq("role","customer").gte("last_active_at",recent),
      db.from("deposits").select("id,amount",{count:"exact"}).eq("status","pending"),
      db.from("deposits").select("id,amount",{count:"exact"}).eq("status","approved").gte("created_at",from).lte("created_at",to),
      db.from("withdrawals").select("id,gross_amount",{count:"exact"}).eq("status","pending"),
      db.from("withdrawals").select("id,net_amount",{count:"exact"}).in("status",["approved","processed"]).gte("created_at",from).lte("created_at",to),
      db.from("withdrawals").select("id",{count:"exact",head:true}).eq("status","completed").gte("created_at",from).lte("created_at",to),
      db.from("support_tickets").select("id",{count:"exact",head:true}).in("status",["open","in_progress"]),
      db.from("support_tickets").select("id",{count:"exact",head:true}).eq("is_read_by_admin",0),
      db.from("app_settings").select("value").eq("key","global_exposure_cap_etb").maybeSingle(),
      db.rpc("current_global_financial_exposure_etb"),
    ]);
    const sum=(rows:any[],key:string)=>round2((rows||[]).reduce((n:number,x:any)=>n+Number(x[key]||0),0));
    return json({
      totalUsers:users.count||0,activeSessionsCount:sessions.count||0,recentlyActiveUsers:recentUsers.count||0,
      pendingDepositsCount:pendingDeposits.count||0,pendingDepositsAmount:sum(pendingDeposits.data||[],"amount"),
      approvedDepositsTotal:sum(approvedDeposits.data||[],"amount"),
      pendingWithdrawalsCount:pendingWithdrawals.count||0,pendingWithdrawalsAmount:sum(pendingWithdrawals.data||[],"gross_amount"),
      approvedWithdrawalsTotal:sum(approvedWithdrawals.data||[],"net_amount"),
      completedWithdrawalsCount:completedWithdrawals.count||0,
      unreadTickets:unreadTickets.count||0,openTickets:openTickets.count||0,
      verifiedSalesCount:approvedDeposits.count||0,verifiedSalesVolume:sum(approvedDeposits.data||[],"amount"),
      globalExposureCapEtb: capSetting.error ? null : Number(capSetting.data?.value ?? 0),
      currentFinancialExposureEtb: exposureResult.error ? null : Number(exposureResult.data ?? 0),
      remainingFinancialExposureEtb: capSetting.error || exposureResult.error ? null :
        Math.max(0, Number(capSetting.data?.value ?? 0) - Number(exposureResult.data ?? 0)),
    });
  }

  if (p === "admin/users" && method === "GET") {
    let q = db.from("users").select("id,full_name,nickname,phone,email,role,status,referral_code,created_at,last_active_at").order("created_at", { ascending: false }).limit(200);
    const term = String(query.get("q") || "").trim();
    if (term) q = q.or("phone.ilike.%" + term + "%,full_name.ilike.%" + term + "%,nickname.ilike.%" + term + "%");
    const rows = await checked<any[]>(q);
    return json({ users: rows.map((u: any) => ({
      id:u.id, fullName:u.nickname || u.full_name, phone:u.phone, email:u.email, role:u.role,
      status:u.status, referralCode:u.referral_code, createdAt:u.created_at, lastActiveAt:u.last_active_at,
    })) });
  }
  const adminCustomer = p.match(/^admin\/customers\/([^/]+)$/);
  if(adminCustomer && method==="GET"){
    const targetId=decodeURIComponent(adminCustomer[1]);
    const customer=await checked<any>(db.from("users").select("*").eq("id",targetId).maybeSingle());
    if(!customer) throw new ApiError("Customer not found.",404);
    const [wallet,purchases,ledger]=await Promise.all([
      getBalances(targetId),
      checked<any[]>(db.from("plan_purchases").select("*").eq("user_id",targetId).order("created_at",{ascending:false})),
      checked<any[]>(db.from("ledger_entries").select("*").eq("user_id",targetId).order("created_at",{ascending:false}).limit(100)),
    ]);
    return json({
      customer:await profileFor(customer),wallet,
      plans:purchases.map((p:any)=>({id:p.id,planCode:p.plan_code,amount:Number(p.amount),dailyMiningRate:Number(p.daily_mining_rate),periodDays:p.period_days,status:p.status,startDate:p.start_date,endDate:p.end_date,createdAt:p.created_at})),
      transactions:ledger.map((x:any)=>({id:x.id,userId:x.user_id,type:x.type,amountSigned:Number(x.amount_signed),balanceAfter:Number(x.balance_after),referenceId:x.reference_id,note:x.note,createdAt:x.created_at})),
    });
  }

  const adminStatus = p.match(/^admin\/users\/([^/]+)\/status$/);
  if (adminStatus && method === "POST") {
    const status = String(body.status || "");
    if (!["active","suspended"].includes(status)) throw new ApiError("Invalid account status.", 400);
    await checked(db.from("users").update({ status }).eq("id", decodeURIComponent(adminStatus[1])));
    return json({ success: true });
  }
  if (p === "admin/deposits" && method === "GET") {
    const rows = await checked<any[]>(db.from("deposits").select("*").order("created_at", { ascending: false }).limit(300));
    const ids = [...new Set(rows.map((x: any) => x.user_id))];
    const users = ids.length ? await checked<any[]>(db.from("users").select("id,full_name,nickname,phone").in("id", ids)) : [];
    const byId = new Map(users.map((u: any) => [u.id, u]));
    return json({ deposits: rows.map((d: any) => ({
      ...depositDto(d),
      customerName: byId.get(d.user_id)?.nickname || byId.get(d.user_id)?.full_name || "Customer",
      customerPhone: byId.get(d.user_id)?.phone || "",
    })) });
  }
  const depositReceipt = p.match(/^admin\/deposits\/([^/]+)\/receipt$/);
  if (depositReceipt && method === "GET") {
    const id = decodeURIComponent(depositReceipt[1]);
    const deposit = await checked<any>(db.from("deposits").select("receipt_path,receipt_mime").eq("id", id).maybeSingle());
    if (!deposit?.receipt_path) throw new ApiError("Receipt not found.", 404);
    const signed = await checked<any>(db.storage.from("platform-uploads").createSignedUrl(deposit.receipt_path, 60));
    const file = await fetch(signed.signedUrl);
    if (!file.ok) throw new ApiError("Receipt could not be loaded.", 404);
    return new Response(await file.arrayBuffer(), {
      headers: { "Content-Type": deposit.receipt_mime || "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  }

  const adminDeposit = p.match(/^admin\/deposits\/([^/]+)\/(approve|reject)$/);
  if (adminDeposit && method === "POST") {
    const depositId = decodeURIComponent(adminDeposit[1]);
    const action = adminDeposit[2];
    const deposit = await checked<any>(db.from("deposits").select("user_id,amount,tx_reference").eq("id", depositId).maybeSingle());
    if (!deposit) throw new ApiError("Deposit request not found.", 404);
    const reason = String(body.reason || "").trim();
    const result = await checked<any>(db.rpc("review_deposit_atomic", {
      p_admin_user_id: user.id, p_deposit_id: depositId,
      p_action: action, p_reason: reason,
    }));
    const amountLabel = Number(deposit.amount).toFixed(2) + " ETB";
    if (action === "approve") {
      await notifyCustomer(
        deposit.user_id,
        "Deposit approved",
        `Your deposit of ${amountLabel} was approved and credited to your wallet.`,
        "deposit_approved",
        "/recharge",
      );
    } else {
      await notifyCustomer(
        deposit.user_id,
        "Deposit rejected",
        `Your deposit of ${amountLabel} was rejected.${reason ? " Reason: " + reason : ""}`,
        "deposit_rejected",
        "/recharge",
      );
    }
    return json({ success: true, ...result });
  }
  if (p === "admin/withdrawals" && method === "GET") {
    const rows = await checked<any[]>(db.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(300));
    const customers = await checked<any[]>(db.from("users").select("id,full_name,phone").in("id", [...new Set(rows.map((w: any) => w.user_id))]));
    const map = new Map(customers.map((x: any) => [x.id, x]));
    return json({ withdrawals: rows.map((w: any) => ({ ...withdrawalDto(w), customerName: map.get(w.user_id)?.full_name, customerPhone: map.get(w.user_id)?.phone })) });
  }
  const adminWithdrawal = p.match(/^admin\/withdrawals\/([^/]+)\/(approve|reject|complete)$/);
  if (adminWithdrawal && method === "POST") {
    const withdrawalId = decodeURIComponent(adminWithdrawal[1]);
    const action = adminWithdrawal[2];
    const withdrawal = await checked<any>(db.from("withdrawals").select("user_id,gross_amount,fee_amount,net_amount,reviewed_by").eq("id", withdrawalId).maybeSingle());
    if (!withdrawal) throw new ApiError("Withdrawal request not found.", 404);
    const reason = String(body.reason || "").trim();
    const bankReference = String(body.providerReference || body.bankTransferReference || body.reference || "").trim();
    let result: any;
    if (action === "complete") {
      if (!withdrawal.reviewed_by) throw new ApiError("This withdrawal must be approved before completion.", 409);
      result = await checked<any>(db.rpc("complete_withdrawal_atomic", {
        p_admin_user_id: user.id, p_withdrawal_id: withdrawalId,
        p_bank_transfer_reference: bankReference,
      }));
      await notifyCustomer(
        withdrawal.user_id,
        "Withdrawal completed",
        `Your withdrawal of ${Number(withdrawal.gross_amount).toFixed(2)} ETB is marked completed. Net amount: ${Number(withdrawal.net_amount).toFixed(2)} ETB. Bank reference: ${bankReference}.`,
        "withdrawal_completed",
        "/withdraw",
      );
    } else if (action === "approve") {
      result = await checked<any>(db.rpc("review_withdrawal_atomic", {
        p_admin_user_id: user.id, p_withdrawal_id: withdrawalId,
        p_action: action, p_reason: reason,
      }));
      await notifyCustomer(
        withdrawal.user_id,
        "Withdrawal approved",
        `Your withdrawal request for ${Number(withdrawal.gross_amount).toFixed(2)} ETB was approved. The bank transfer is still awaiting processing.`,
        "withdrawal_approved",
        "/withdraw",
      );
    } else {
      result = await checked<any>(db.rpc("review_withdrawal_atomic", {
        p_admin_user_id: user.id, p_withdrawal_id: withdrawalId,
        p_action: action, p_reason: reason,
      }));
      await notifyCustomer(
        withdrawal.user_id,
        "Withdrawal rejected",
        `Your withdrawal request for ${Number(withdrawal.gross_amount).toFixed(2)} ETB was rejected. The reserved funds have been released.${reason ? " Reason: " + reason : ""}`,
        "withdrawal_rejected",
        "/withdraw",
      );
    }
    return json({ success: true, ...result });
  }
  if (p === "admin/tickets" && method === "GET") {
    const tickets = await checked<any[]>(db.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(300));
    const ids = tickets.map((x: any) => x.id);
    const userIds = [...new Set(tickets.map((x: any) => x.user_id))];
    const [messages, users] = await Promise.all([
      ids.length ? checked<any[]>(db.from("support_messages").select("*").in("ticket_id", ids).order("created_at")) : [],
      userIds.length ? checked<any[]>(db.from("users").select("id,full_name,nickname,phone").in("id", userIds)) : [],
    ]);
    const byUser = new Map(users.map((u: any) => [u.id, u]));
    return json({ tickets: tickets.map((t: any) => ({
      id:t.id,userId:t.user_id,customerName:byUser.get(t.user_id)?.nickname || byUser.get(t.user_id)?.full_name || "Customer",
      customerPhone:byUser.get(t.user_id)?.phone || "",category:t.category,subject:t.subject,message:t.message,
      status:t.status,attachmentPath:t.attachment_path,isReadByAdmin:t.is_read_by_admin===1,
      createdAt:t.created_at,updatedAt:t.updated_at,
      messages:messages.filter((m: any) => m.ticket_id===t.id).map((m: any) => ({
        id:m.id,senderId:m.sender_id,senderRole:m.sender_role,message:m.message,createdAt:m.created_at,
      })),
    })) });
  }
  

  const adminTicketReply = p.match(/^admin\/tickets\/([^/]+)\/reply$/);
  if (adminTicketReply && method === "POST") {
    const ticketId = decodeURIComponent(adminTicketReply[1]);
    const message = String(body.message || "").trim();
    if (!message) throw new ApiError("Message cannot be empty.",400);
    const ticket = await checked<any>(db.from("support_tickets").select("user_id,subject").eq("id", ticketId).maybeSingle());
    if (!ticket) throw new ApiError("Support ticket not found.", 404);
    await checked(db.from("support_messages").insert({
      id:uuid("msg_"),ticket_id:ticketId,sender_id:user.id,sender_role:user.role,message,created_at:nowIso(),
    }));
    await checked(db.from("support_tickets").update({updated_at:nowIso(),is_read_by_admin:1,...(body.status && ["in_progress","resolved","closed","open"].includes(String(body.status)) ? {status:String(body.status)} : {})}).eq("id",ticketId));
    await notifyCustomer(
      ticket.user_id,
      "Customer Service replied",
      `A support agent replied to your request “${ticket.subject}”: ${message}`,
      "support_reply",
      "/service",
    );
    return json({success:true});
  }
  const adminTicketStatus = p.match(/^admin\/tickets\/([^/]+)\/status$/);
  if (adminTicketStatus && method === "POST") {
    const status=String(body.status||"");
    if (!["open","in_progress","resolved","closed"].includes(status)) throw new ApiError("Invalid ticket status.",400);
    const ticketId=decodeURIComponent(adminTicketStatus[1]);
    const ticket=await checked<any>(db.from("support_tickets").select("user_id,subject").eq("id",ticketId).maybeSingle());
    if (!ticket) throw new ApiError("Support ticket not found.",404);
    await checked(db.from("support_tickets").update({status,updated_at:nowIso(),...(body.isRead!==undefined ? {is_read_by_admin:body.isRead?1:0} : {})}).eq("id",ticketId));
    await notifyCustomer(ticket.user_id, "Support request updated", `Your support request “${ticket.subject}” is now ${status.replace("_"," ")}.`, "support_status", "/service");
    return json({success:true});
  }
  if (p === "admin/gift-codes" && method === "GET") {
    const [rows, setting] = await Promise.all([
      checked<any[]>(db.from("gift_codes").select("*").order("created_at",{ascending:false})),
      checked<any>(db.from("gift_code_settings").select("*").eq("id","default").maybeSingle()),
    ]);
    const ids=rows.map((x:any)=>x.id);
    const redemptions=ids.length ? await checked<any[]>(db.from("gift_code_redemptions").select("*").in("gift_code_id",ids).order("redeemed_at",{ascending:false})) : [];
    const userIds=[...new Set(redemptions.map((x:any)=>x.user_id))];
    const users=userIds.length ? await checked<any[]>(db.from("users").select("id,phone,full_name,nickname").in("id",userIds)) : [];
    const byId=new Map(users.map((u:any)=>[u.id,u]));
    const counts=new Map<string,number>();
    for(const x of redemptions) counts.set(x.gift_code_id,(counts.get(x.gift_code_id)||0)+1);
    const codes=rows.map((x:any)=>({
      id:x.id,code:x.code,rewardAmount:Number(x.reward_amount),isActive:x.is_active===1,
      maxRedemptions:x.max_redemptions,redemptionCount:counts.get(x.id)||0,
      expiresAt:x.expires_at,createdAt:x.created_at,deactivatedAt:x.deactivated_at,
    }));
    return json({
      isEnabled:setting?.is_enabled===1,
      codes,
      giftCodes:codes,
      redemptions:redemptions.map((x:any)=>({
        id:x.id,giftCodeId:x.gift_code_id,code:x.code_snapshot,rewardAmount:Number(x.reward_amount),
        customerPhone:byId.get(x.user_id)?.phone || "",customerName:byId.get(x.user_id)?.nickname || byId.get(x.user_id)?.full_name || "Customer",
        redeemedAt:x.redeemed_at,
      })),
    });
  }

  if (p === "admin/gift-codes" && method === "POST") {
    const codeValue=String(body.code||"").trim().toUpperCase();
    const reward=Number(body.rewardAmount||0);
    if(!/^[A-Z0-9-]{4,32}$/.test(codeValue)||reward<=0) throw new ApiError("Enter a valid gift code and positive reward amount.",400);
    const row=await checked<any>(db.from("gift_codes").insert({
      id:uuid("gft_"),code:codeValue,reward_amount:round2(reward),is_active:1,
      max_redemptions:body.maxRedemptions?Number(body.maxRedemptions):null,
      expires_at:body.expiresAt||null,created_by:user.id,created_at:nowIso(),
    }).select("*").single());
    return json({success:true,giftCode:row},201);
  }
  const giftDeactivate = p.match(/^admin\/gift-codes\/([^/]+)\/deactivate$/);
  if(giftDeactivate && method==="POST"){
    await checked(db.from("gift_codes").update({is_active:0,deactivated_at:nowIso()}).eq("id",decodeURIComponent(giftDeactivate[1])));
    return json({success:true});
  }
  if(p==="admin/gift-codes/settings" && method==="GET"){
    const row=await checked<any>(db.from("gift_code_settings").select("*").eq("id","default").maybeSingle());
    return json({isEnabled:row?.is_enabled===1});
  }
  if(p==="admin/gift-codes/settings" && ["POST","PUT","PATCH"].includes(method)){
    await checked(db.from("gift_code_settings").upsert({id:"default",is_enabled:body.isEnabled?1:0,updated_by:user.id,updated_at:nowIso()}));
    return json({success:true});
  }

  if (p === "admin/payment-methods" && method === "GET") {
    const rows=await checked<any[]>(db.from("payment_methods").select("*").order("sort_order"));
    return json({methods:rows.map(paymentMethodDto)});
  }
  if (p === "admin/payment-methods" && method === "POST") {
    const kind=String(body.kind||"deposit");
    if(!["deposit","payout"].includes(kind)) throw new ApiError("Invalid payment method type.",400);
    const row=await checked<any>(db.from("payment_methods").insert({
      id:uuid("pmt_"),kind,name:String(body.name||"").trim(),account_name:String(body.accountName||""),
      account_number:String(body.accountNumber||""),instructions:String(body.instructions||""),
      is_active:body.isActive===false?0:1,sort_order:Number(body.sortOrder||0),updated_at:nowIso(),
    }).select("*").single());
    return json({success:true,method:paymentMethodDto(row)},201);
  }
  const adminPayment = p.match(/^admin\/payment-methods\/([^/]+)$/);
  if(adminPayment && ["PATCH","PUT"].includes(method)){
    const updates:any={updated_at:nowIso()};
    if(body.name!==undefined) updates.name=String(body.name);
    if(body.accountName!==undefined) updates.account_name=String(body.accountName);
    if(body.accountNumber!==undefined) updates.account_number=String(body.accountNumber);
    if(body.instructions!==undefined) updates.instructions=String(body.instructions);
    if(body.isActive!==undefined) updates.is_active=body.isActive?1:0;
    if(body.sortOrder!==undefined) updates.sort_order=Number(body.sortOrder);
    await checked(db.from("payment_methods").update(updates).eq("id",decodeURIComponent(adminPayment[1])));
    return json({success:true});
  }
  if(adminPayment && method==="DELETE"){
    await checked(db.from("payment_methods").update({is_active:0,updated_at:nowIso()}).eq("id",decodeURIComponent(adminPayment[1])));
    return json({success:true});
  }
  

  if (p === "admin/content" && method === "GET") {
    const [app,channels,assets] = await Promise.all([
      getAppSettings(),
      checked<any[]>(db.from("support_channels").select("*").order("sort_order")),
      checked<any[]>(db.from("carousel_assets").select("*").order("sort_order")),
    ]);
    return json({
      settings:{...app.settings,promotionalRewardsEnabled:app.promotionalRewardsEnabled},
      channels:channels.map((x:any)=>({id:x.id,label:x.label,handleOrUrl:x.handle_or_url,href:x.href,kind:x.kind,isActive:x.is_active===1,sortOrder:x.sort_order})),
      carouselAssets:assets,
    });
  }
  if (p === "admin/channels" && method === "GET") {
    const rows=await checked<any[]>(db.from("support_channels").select("*").order("sort_order"));
    return json({channels:rows.map((x:any)=>({id:x.id,label:x.label,handleOrUrl:x.handle_or_url,href:x.href,kind:x.kind,isActive:x.is_active===1,sortOrder:x.sort_order}))});
  }
  if (p === "admin/channels" && method === "POST") {
    const row=await checked<any>(db.from("support_channels").insert({
      id:uuid("chn_"),label:String(body.label||""),handle_or_url:String(body.handleOrUrl||""),
      href:String(body.href||body.handleOrUrl||""),kind:String(body.kind||"link"),
      is_active:body.isActive===false?0:1,sort_order:Number(body.sortOrder||0),
    }).select("*").single());
    return json({success:true,channel:row},201);
  }
  const adminChannel=p.match(/^admin\/channels\/([^/]+)$/);
  if(adminChannel && ["PATCH","PUT"].includes(method)){
    const updates:any={};
    if(body.label!==undefined) updates.label=String(body.label);
    if(body.handleOrUrl!==undefined) updates.handle_or_url=String(body.handleOrUrl);
    if(body.href!==undefined) updates.href=String(body.href);
    if(body.kind!==undefined) updates.kind=String(body.kind);
    if(body.isActive!==undefined) updates.is_active=body.isActive?1:0;
    if(body.sortOrder!==undefined) updates.sort_order=Number(body.sortOrder);
    await checked(db.from("support_channels").update(updates).eq("id",decodeURIComponent(adminChannel[1])));
    return json({success:true});
  }
  if(adminChannel && method==="DELETE"){
    await checked(db.from("support_channels").update({is_active:0}).eq("id",decodeURIComponent(adminChannel[1])));
    return json({success:true});
  }
  

  if(p==="admin/settings" && method==="GET"){
    const app=await getAppSettings();
    return json({settings:app.settings,financialOperationsEnabled:app.financialOperationsEnabled,promotionalRewardsEnabled:app.promotionalRewardsEnabled});
  }
  if(p==="admin/settings" && ["POST","PUT","PATCH"].includes(method)){
    const changes=body.settings||body;
    const allowed=new Set(Object.keys(defaultSettings).concat(["financial_operations_enabled","promotional_rewards_enabled"]));
    const normalizedChanges=Object.entries(changes).map(([key,value])=>[
      key==="promotionalRewardsEnabled" ? "promotional_rewards_enabled" : key, value,
    ]);
    const privacyPolicyChange=normalizedChanges.find(([key])=>key==="privacyPolicyUrl");
    if(privacyPolicyChange){
      const candidate=String(privacyPolicyChange[1]??"").trim();
      if(candidate){
        let parsed:URL;
        try{parsed=new URL(candidate);}catch{throw new ApiError("Privacy Policy URL must be a valid HTTPS link.",400);}
        if(parsed.protocol!=="https:"||!parsed.hostname||parsed.username||parsed.password){
          throw new ApiError("Privacy Policy URL must be a valid HTTPS link without embedded credentials.",400);
        }
        privacyPolicyChange[1]=parsed.toString();
      }else{
        privacyPolicyChange[1]="";
      }
    }
    const rows=normalizedChanges.filter(([k,v])=>allowed.has(String(k))&&v!==undefined).map(([key,value])=>({
      key,value:String(value),updated_at:nowIso(),
    }));
    if(rows.length) await checked(db.from("app_settings").upsert(rows,{onConflict:"key"}));
    return json({success:true});
  }
  if(p==="admin/audit-logs" && method==="GET"){
    const rows=await checked<any[]>(db.from("admin_audit_logs").select("*").order("created_at",{ascending:false}).limit(200));
    return json({logs:rows});
  }
  if(p==="admin/content" && method==="GET"){
    const assets=await checked<any[]>(db.from("carousel_assets").select("*").order("sort_order"));
    return json({carouselAssets:assets});
  }

  if (p === "admin/audit-logs" && method === "GET") {
    const logs = await checked<any[]>(db.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(250));
    return json({ logs });
  }

  if (p === "admin/broadcasts" && method === "GET") {
    const rows = await checked<any[]>(db.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(200));
    return json({ broadcasts: rows.map((x: any) => ({
      id: x.id, title: x.title, message: x.message,
      imageUrl: x.image_path ? "/api/broadcasts/" + x.id + "/image" : null,
      targetType: x.target_type, targetUserId: x.target_user_id,
      recipientCount: x.recipient_count, createdAt: x.created_at, sentBy: x.sent_by,
    })) });
  }

  if (p === "admin/broadcasts" && method === "POST") {
    const title=String(form?.get("title")||body.title||"").trim();
    const message=String(form?.get("message")||body.message||"").trim();
    const targetType=String(form?.get("targetType")||body.targetType||"all");
    const targetUserId=String(form?.get("targetUserId")||body.targetUserId||"");
    if(!title||!message) throw new ApiError("Enter an announcement title and message.",400);
    if(!["all","single"].includes(targetType)) throw new ApiError("Invalid announcement audience.",400);
    if(targetType==="single"&&!targetUserId) throw new ApiError("Select a customer recipient.",400);
    const imageFile=form?.get("image");
    let imagePath:string|null=null;
    let imageMime:string|null=null;
    if(imageFile instanceof File && imageFile.size>0){
      if(!["image/jpeg","image/png","image/webp"].includes(imageFile.type)||imageFile.size>5*1024*1024) throw new ApiError("Announcement image must be JPG, PNG, or WEBP up to 5 MB.",400);
      const ext=imageFile.type.split("/")[1];
      imagePath="broadcasts/"+crypto.randomUUID()+"."+ext;
      imageMime=imageFile.type;
      await checked(db.storage.from("platform-uploads").upload(imagePath,imageFile,{contentType:imageMime,upsert:false}));
    }
    const audience=targetType==="single"
      ? await checked<any[]>(db.from("users").select("id").eq("id",targetUserId).eq("status","active"))
      : await checked<any[]>(db.from("users").select("id").eq("status","active"));
    if(targetType==="single"&&audience.length===0) throw new ApiError("Selected customer was not found.",404);
    const id=uuid("bct_");
    await checked(db.from("broadcasts").insert({
      id,title,message,image_path:imagePath,image_mime:imageMime,target_type:targetType,
      target_user_id:targetType==="single"?targetUserId:null,sent_by:user.id,
      recipient_count:audience.length,created_at:nowIso(),
    }));
    for(let offset=0;offset<audience.length;offset+=500){
      const batch=audience.slice(offset,offset+500).map((u:any)=>({
        id:uuid("ntf_"),user_id:u.id,title,body:message,kind:"broadcast",
        action_url:null,image_url:imagePath?"/api/broadcasts/"+id+"/image":null,
        broadcast_id:id,is_read:0,created_at:nowIso(),
      }));
      if(batch.length) await checked(db.from("notifications").insert(batch));
    }
    return json({success:true,broadcastId:id,recipientCount:audience.length},201);
  }
  if(p==="admin/broadcasts" && method==="GET"){
    const rows=await checked<any[]>(db.from("broadcasts").select("*").order("created_at",{ascending:false}).limit(200));
    return json({broadcasts:rows.map((x:any)=>({
      id:x.id,title:x.title,message:x.message,imageUrl:x.image_path?"/api/broadcasts/"+x.id+"/image":null,
      targetType:x.target_type,targetUserId:x.target_user_id,recipientCount:x.recipient_count,
      createdAt:x.created_at,sentBy:x.sent_by,
    }))});
  }

  const broadcastImage = p.match(/^broadcasts\/([^/]+)\/image$/);
  if (broadcastImage && method === "GET") {
    const broadcast = await checked<any>(db.from("broadcasts").select("image_path,image_mime").eq("id", decodeURIComponent(broadcastImage[1])).maybeSingle());
    if (!broadcast?.image_path) throw new ApiError("This image is unavailable.", 404);
    const signed = await checked<any>(db.storage.from("platform-uploads").createSignedUrl(broadcast.image_path, 60));
    const file = await fetch(signed.signedUrl);
    if (!file.ok) throw new ApiError("This image is unavailable.", 404);
    return new Response(await file.arrayBuffer(), {
      headers: { "Content-Type": broadcast.image_mime || "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  }
  throw new ApiError("API route not found: " + method + " " + p, 404);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
  }
  try {
    return await route(request);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    if (status >= 500) console.error("Coca-Cola API failure:", message);
    return json({ error: status >= 500 ? "The platform could not complete this request. Please try again." : message }, status);
  }
});
