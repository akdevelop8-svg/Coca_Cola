export const MAX_ACTIVE_PLANS = 2;
export const PLAN_DURATION_DAYS = 365;
export const REGISTRATION_BONUS_ETB = 150;
export const DAILY_CHECKIN_REWARD_ETB = 2;

export function formatBr(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(showDecimals ? safe : Math.round(safe));
  return `Br ${formatted}`;
}

export function formatBrExact(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasFraction = Math.abs(safe % 1) > 0.001;
  return formatBr(safe, hasFraction);
}

export function formatEtb(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasFraction = Math.abs(safe % 1) > 0.001;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(hasFraction ? Math.round(safe * 100) / 100 : Math.round(safe));
  return `${formatted} ETB`;
}



export interface WithdrawalBreakdown {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  isValid: boolean;
  error?: string;
}

export function calculateWithdrawalBreakdown(
  grossAmount: number,
  availableBalance: number,
  minWithdrawal = 150,
  feePercent = 17
): WithdrawalBreakdown {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    return {
      grossAmount: 0,
      feeAmount: 0,
      netAmount: 0,
      isValid: false,
      error: 'Enter a valid withdrawal amount.',
    };
  }

  const roundedGross = Math.round(grossAmount * 100) / 100;
  const feeAmount = Math.round(roundedGross * (feePercent / 100) * 100) / 100;
  const netAmount = Math.round((roundedGross - feeAmount) * 100) / 100;

  if (roundedGross < minWithdrawal) {
    return {
      grossAmount: roundedGross,
      feeAmount,
      netAmount,
      isValid: false,
      error: `Minimum withdrawal is ${formatBr(minWithdrawal)}.`,
    };
  }

  if (roundedGross > availableBalance) {
    const shortfall = Math.round((roundedGross - availableBalance) * 100) / 100;
    return {
      grossAmount: roundedGross,
      feeAmount,
      netAmount,
      isValid: false,
      error: `Insufficient balance. Shortfall of ${formatBrExact(shortfall)}.`,
    };
  }

  return {
    grossAmount: roundedGross,
    feeAmount,
    netAmount,
    isValid: true,
  };
}

export function isSafeRedirectPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/home';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
    return '/home';
  }
  if (
    trimmed.startsWith('/onboarding-terms') ||
    trimmed.startsWith('/login') ||
    trimmed.startsWith('/register')
  ) {
    return '/home';
  }
  return trimmed;
}

export function getEthiopiaCalendarDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function parseYmdUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

export function ethiopiaDateDiffDays(startDateIso: string, targetEthDate?: string): number {
  const parsed = new Date(startDateIso);
  if (Number.isNaN(parsed.getTime())) return 0;
  const startEth = getEthiopiaCalendarDate(parsed);
  const endEth = targetEthDate || getEthiopiaCalendarDate();
  const diffMs = parseYmdUtcMs(endEth) - parseYmdUtcMs(startEth);
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export interface PlanProgressResult {
  purchaseEthDate: string;
  daysElapsed: number;
  remainingDays: number;
  isCompleted: boolean;
  canClaim: boolean;
  statusLabel: 'Ready to Claim' | 'Claimed Today' | 'Plan Completed';
}

export function computePlanProgress(
  startDateIso: string,
  periodDays: number,
  claimedToday: boolean,
  targetEthDate?: string
): PlanProgressResult {
  const parsed = new Date(startDateIso);
  const purchaseEthDate = Number.isNaN(parsed.getTime())
    ? getEthiopiaCalendarDate()
    : getEthiopiaCalendarDate(parsed);
  const rawElapsed = ethiopiaDateDiffDays(startDateIso, targetEthDate);
  const safePeriod = Math.max(1, periodDays || PLAN_DURATION_DAYS);
  const daysElapsed = Math.max(0, Math.min(safePeriod, rawElapsed));
  const remainingDays = Math.max(0, safePeriod - daysElapsed);
  const isCompleted = rawElapsed >= safePeriod;
  const canClaim = !isCompleted && !claimedToday;
  const statusLabel: PlanProgressResult['statusLabel'] = isCompleted
    ? 'Plan Completed'
    : claimedToday
    ? 'Claimed Today'
    : 'Ready to Claim';

  return {
    purchaseEthDate,
    daysElapsed,
    remainingDays,
    isCompleted,
    canClaim,
    statusLabel,
  };
}

export function canPurchasePlan(
  activePlansCount: number,
  availableBalance: number,
  planInvestment: number,
  maxActivePlans = MAX_ACTIVE_PLANS
): { ok: boolean; error?: string } {
  if (activePlansCount >= maxActivePlans) {
    return {
      ok: false,
      error: `Purchase limit reached: maximum ${maxActivePlans} active plans allowed per customer.`,
    };
  }
  if (!Number.isFinite(availableBalance) || availableBalance < planInvestment) {
    return {
      ok: false,
      error: `Insufficient ETB. You need ${formatEtb(planInvestment)}, available ${formatEtb(Math.max(0, availableBalance))}.`,
    };
  }
  return { ok: true };
}

export interface GiftCodeValidationInput {
  featureEnabled: boolean;
  codeExists: boolean;
  isActive: boolean;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  alreadyRedeemedByUser: boolean;
  nowMs?: number;
}

export function evaluateGiftCodeEligibility(
  input: GiftCodeValidationInput
): { ok: boolean; status: number; error?: string } {
  if (!input.featureEnabled) {
    return { ok: false, status: 403, error: 'Gift Code feature is currently disabled by Administrator.' };
  }
  if (!input.codeExists) {
    return { ok: false, status: 404, error: 'Gift code does not exist.' };
  }
  if (!input.isActive) {
    return { ok: false, status: 400, error: 'This gift code has been deactivated.' };
  }
  if (input.expiresAt) {
    const expMs = new Date(input.expiresAt).getTime();
    const now = input.nowMs ?? Date.now();
    if (Number.isFinite(expMs) && expMs <= now) {
      return { ok: false, status: 400, error: 'This gift code has expired.' };
    }
  }
  if (input.alreadyRedeemedByUser) {
    return { ok: false, status: 409, error: 'You have already redeemed this gift code.' };
  }
  if (
    input.maxRedemptions !== null &&
    Number.isFinite(input.maxRedemptions) &&
    input.redemptionCount >= input.maxRedemptions
  ) {
    return { ok: false, status: 400, error: 'This gift code has reached its maximum redemption limit.' };
  }
  return { ok: true, status: 200 };
}

export function calculateReferralRewards(
  planInvestment: number,
  rates = { level1: 20, level2: 2, level3: 1 }
): { level1: number; level2: number; level3: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    level1: round2(planInvestment * (rates.level1 / 100)),
    level2: round2(planInvestment * (rates.level2 / 100)),
    level3: round2(planInvestment * (rates.level3 / 100)),
  };
}

export function normalizeEthiopiaPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('2510') && digits.length === 13) {
    return `+251${digits.slice(4)}`;
  }
  if (digits.startsWith('251') && digits.length === 12 && /^251[79]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }
  if ((digits.startsWith('09') || digits.startsWith('07')) && digits.length === 10) {
    return `+251${digits.slice(1)}`;
  }
  if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length === 9) {
    return `+251${digits}`;
  }
  return '';
}

export function validateEthiopiaPhone(raw: string): boolean {
  const normalized = normalizeEthiopiaPhone(raw);
  return /^\+251[79]\d{8}$/.test(normalized);
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return '****';
  if (phone.length < 7) return '****';
  return `${phone.slice(0, 6)}****${phone.slice(-2)}`;
}

export function maskBankAccount(accountNumber: string): string {
  if (!accountNumber) return '****';
  const clean = accountNumber.trim();
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

const RESERVED_OR_INAPPROPRIATE_WORDS = [
  'admin',
  'administrator',
  'superadmin',
  'moderator',
  'system',
  'support',
  'staff',
  'official',
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'porn',
  'nigger',
  'whore',
  'slut',
  'scam',
];

export function validateNickname(raw: unknown): { ok: boolean; value: string; error?: string } {
  if (typeof raw !== 'string') {
    return { ok: false, value: '', error: 'Please enter a valid nickname.' };
  }
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return { ok: false, value: '', error: 'Nickname cannot be empty.' };
  }
  if (collapsed.length < 2 || collapsed.length > 24) {
    return { ok: false, value: '', error: 'Nickname must be between 2 and 24 characters.' };
  }
  if (!/^[\p{L}\p{N} _.-]+$/u.test(collapsed)) {
    return {
      ok: false,
      value: '',
      error: 'Nickname may only contain letters, numbers, spaces, hyphens, underscores, and periods.',
    };
  }
  const lowerTokens = collapsed.toLowerCase().split(/[\s_.-]+/).filter(Boolean);
  const lowerCompact = collapsed.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const blocked of RESERVED_OR_INAPPROPRIATE_WORDS) {
    if (lowerTokens.includes(blocked) || lowerCompact === blocked) {
      return {
        ok: false,
        value: '',
        error: 'This nickname is not permitted. Please choose a different nickname.',
      };
    }
  }
  return { ok: true, value: collapsed };
}

export function getCustomerDisplayName(
  user?: { nickname?: string | null; fullName?: string | null; role?: string } | null
): string {
  const nick = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
  if (nick) return nick;
  if (user?.role && user.role !== 'customer') {
    return (typeof user.fullName === 'string' && user.fullName.trim()) || 'Administrator';
  }
  return 'User';
}

export function normalizePublicSiteUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'MY_APP_URL' || trimmed.includes('YOUR-PURCHASED-DOMAIN')) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function normalizeLoginPhoneIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const standard = normalizeEthiopiaPhone(trimmed);
  if (standard) return standard;
  const compact = trimmed.replace(/\s+/g, '');
  if (/^\+\d{7,15}$/.test(compact)) {
    return compact;
  }
  return trimmed;
}

export interface TeamTaskLevelDef {
  id: string;
  level: number;
  targetAmount: number;
  rewardAmount: number;
}

export interface TeamTaskLevelProgress extends TeamTaskLevelDef {
  progress: number;
  remaining: number;
  percent: number;
  eligible: boolean;
  claimed: boolean;
}

export function computeTeamTaskLevels(
  verifiedDepositsTotal: number,
  tasks: readonly TeamTaskLevelDef[],
  claimedTaskIds: ReadonlySet<string> | readonly string[]
): {
  verifiedDepositsTotal: number;
  maxTarget: number;
  overallPercent: number;
  valueTasks: TeamTaskLevelProgress[];
} {
  const safeTotal =
    Number.isFinite(verifiedDepositsTotal) && verifiedDepositsTotal > 0
      ? Math.round(verifiedDepositsTotal * 100) / 100
      : 0;
  const claimedSet =
    claimedTaskIds instanceof Set ? claimedTaskIds : new Set(claimedTaskIds);
  const maxTarget = tasks.length > 0 ? tasks[tasks.length - 1].targetAmount : 300000;
  const overallPercent =
    maxTarget > 0 ? Math.min(100, Math.round((safeTotal / maxTarget) * 100)) : 0;

  const valueTasks = tasks.map((t) => {
    const progress = Math.min(safeTotal, t.targetAmount);
    const remaining = Math.max(0, Math.round((t.targetAmount - safeTotal) * 100) / 100);
    const percent =
      t.targetAmount > 0 ? Math.min(100, Math.round((safeTotal / t.targetAmount) * 100)) : 0;
    const eligible = safeTotal >= t.targetAmount;
    const claimed = claimedSet.has(t.id);
    return {
      ...t,
      progress,
      remaining,
      percent,
      eligible,
      claimed,
    };
  });

  return {
    verifiedDepositsTotal: safeTotal,
    maxTarget,
    overallPercent,
    valueTasks,
  };
}

