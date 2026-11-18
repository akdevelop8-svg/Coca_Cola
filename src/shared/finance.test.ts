import test from 'node:test';
import assert from 'node:assert/strict';
import { INVESTMENT_PLANS, DEFAULT_PLATFORM_SETTINGS, DEFAULT_SUPPORT_CHANNELS } from './constants';
import {
  formatBr,
  formatDemoCredits,
  calculateWithdrawalBreakdown,
  isSafeRedirectPath,
  getEthiopiaCalendarDate,
  ethiopiaDateDiffDays,
  computePlanProgress,
  canPurchaseDemoPlan,
  evaluateGiftCodeEligibility,
  calculateReferralDemoRewards,
  normalizeEthiopiaPhone,
  validateEthiopiaPhone,
  maskBankAccount,
  validateNickname,
  getCustomerDisplayName,
  normalizePublicSiteUrl,
  normalizeLoginPhoneIdentifier,
} from './finance';

test('INVESTMENT_PLANS contains exact 13 plans A through M with 365-day terms', () => {
  assert.equal(INVESTMENT_PLANS.length, 13);
  assert.equal(INVESTMENT_PLANS[0].code, 'A');
  assert.equal(INVESTMENT_PLANS[0].investment, 600);
  assert.equal(INVESTMENT_PLANS[0].dailyMining, 100);
  assert.equal(INVESTMENT_PLANS[12].code, 'M');
  assert.equal(INVESTMENT_PLANS[12].investment, 1000000);
  assert.equal(INVESTMENT_PLANS[12].dailyMining, 100000);
  for (const plan of INVESTMENT_PLANS) {
    assert.equal(plan.periodDays, 365);
  }
});

test('CBE deposit and withdrawal settings match required configuration', () => {
  assert.equal(DEFAULT_PLATFORM_SETTINGS.depositCbeAccountNumber, '1000673029578');
  assert.equal(DEFAULT_PLATFORM_SETTINGS.minWithdrawal, 150);
  assert.equal(DEFAULT_PLATFORM_SETTINGS.withdrawalFeePercent, 17);
  assert.equal(DEFAULT_PLATFORM_SETTINGS.purchaseLimit, 2);
  assert.equal(DEFAULT_SUPPORT_CHANNELS[0].handleOrUrl, '@Coca_cola_Custemer_service1');
  assert.equal(DEFAULT_SUPPORT_CHANNELS[1].href, 'https://t.me/Cocacolacampany');
});

test('formatBr and formatDemoCredits format amounts consistently in Demo ETB', () => {
  assert.equal(formatBr(600), 'Br 600');
  assert.equal(formatBr(1500), 'Br 1,500');
  assert.equal(formatBr(0, true), 'Br 0.00');
  assert.equal(formatDemoCredits(600), '600 Demo ETB');
  assert.equal(formatDemoCredits(1500), '1,500 Demo ETB');
  assert.equal(formatDemoCredits(12.5), '12.50 Demo ETB');
});

test('calculateWithdrawalBreakdown enforces minimum 150, available balance, and 17% fee', () => {
  const valid = calculateWithdrawalBreakdown(500, 1000, 150, 17);
  assert.equal(valid.isValid, true);
  assert.equal(valid.feeAmount, 85);
  assert.equal(valid.netAmount, 415);

  const belowMin = calculateWithdrawalBreakdown(100, 1000, 150, 17);
  assert.equal(belowMin.isValid, false);
  assert.match(belowMin.error || '', /Minimum withdrawal/i);

  const overBalance = calculateWithdrawalBreakdown(600, 500, 150, 17);
  assert.equal(overBalance.isValid, false);
  assert.match(overBalance.error || '', /Insufficient balance/i);
});

test('canPurchaseDemoPlan enforces max 2 active plans and sufficient Demo ETB', () => {
  assert.equal(canPurchaseDemoPlan(0, 600, 600).ok, true);
  assert.equal(canPurchaseDemoPlan(1, 1500, 1500).ok, true);

  const overLimit = canPurchaseDemoPlan(2, 5000, 600);
  assert.equal(overLimit.ok, false);
  assert.match(overLimit.error || '', /maximum 2 active/i);

  const lowBalance = canPurchaseDemoPlan(0, 150, 600);
  assert.equal(lowBalance.ok, false);
  assert.match(lowBalance.error || '', /Insufficient Demo ETB/i);
});

test('computePlanProgress calculates elapsed days, remaining days out of 365, and completion', () => {
  const start = '2026-01-01T10:00:00.000Z';
  const sameDay = computePlanProgress(start, 365, false, '2026-01-01');
  assert.equal(sameDay.daysElapsed, 0);
  assert.equal(sameDay.remainingDays, 365);
  assert.equal(sameDay.isCompleted, false);
  assert.equal(sameDay.canClaim, true);
  assert.equal(sameDay.statusLabel, 'Ready to Claim');

  const day10Claimed = computePlanProgress(start, 365, true, '2026-01-11');
  assert.equal(day10Claimed.daysElapsed, 10);
  assert.equal(day10Claimed.remainingDays, 355);
  assert.equal(day10Claimed.canClaim, false);
  assert.equal(day10Claimed.statusLabel, 'Claimed Today');

  const completed = computePlanProgress(start, 365, false, '2027-01-01');
  assert.equal(completed.daysElapsed, 365);
  assert.equal(completed.remainingDays, 0);
  assert.equal(completed.isCompleted, true);
  assert.equal(completed.canClaim, false);
  assert.equal(completed.statusLabel, 'Plan Completed');
  assert.equal(ethiopiaDateDiffDays('2026-01-01T10:00:00.000Z', '2026-01-05'), 4);
});

test('evaluateGiftCodeEligibility enforces enabled, active, expiry, duplicate, and max limit checks', () => {
  const base = {
    featureEnabled: true,
    codeExists: true,
    isActive: true,
    expiresAt: '2099-01-01T00:00:00.000Z',
    maxRedemptions: 5,
    redemptionCount: 1,
    alreadyRedeemedByUser: false,
    nowMs: Date.UTC(2026, 10, 17),
  };
  assert.equal(evaluateGiftCodeEligibility(base).ok, true);
  assert.equal(evaluateGiftCodeEligibility({ ...base, featureEnabled: false }).status, 403);
  assert.equal(evaluateGiftCodeEligibility({ ...base, codeExists: false }).status, 404);
  assert.equal(evaluateGiftCodeEligibility({ ...base, isActive: false }).status, 400);
  assert.equal(evaluateGiftCodeEligibility({ ...base, expiresAt: '2025-01-01T00:00:00.000Z' }).status, 400);
  assert.equal(evaluateGiftCodeEligibility({ ...base, alreadyRedeemedByUser: true }).status, 409);
  assert.equal(evaluateGiftCodeEligibility({ ...base, redemptionCount: 5 }).status, 400);
});

test('calculateReferralDemoRewards computes 20%, 2%, 1% Demo ETB tiers', () => {
  const rewards = calculateReferralDemoRewards(3000);
  assert.deepEqual(rewards, { level1: 600, level2: 60, level3: 30 });
});

test('isSafeRedirectPath allows safe internal routes and blocks open redirects', () => {
  assert.equal(isSafeRedirectPath('/income'), '/income');
  assert.equal(isSafeRedirectPath('/withdraw?tab=1'), '/withdraw?tab=1');
  assert.equal(isSafeRedirectPath('https://evil.com'), '/home');
  assert.equal(isSafeRedirectPath('//evil.com'), '/home');
  assert.equal(isSafeRedirectPath('/onboarding-terms'), '/home');
  assert.equal(isSafeRedirectPath(null), '/home');
});

test('Ethiopia phone validation and normalization works for +251 and 09/07 formats', () => {
  assert.equal(normalizeEthiopiaPhone('0911223344'), '+251911223344');
  assert.equal(normalizeEthiopiaPhone('911223344'), '+251911223344');
  assert.equal(normalizeEthiopiaPhone('+251711223344'), '+251711223344');
  assert.equal(validateEthiopiaPhone('0911223344'), true);
  assert.equal(validateEthiopiaPhone('12345'), false);
});

test('getEthiopiaCalendarDate returns YYYY-MM-DD in Africa/Addis_Ababa', () => {
  const result = getEthiopiaCalendarDate(new Date('2026-11-16T21:30:00.000Z'));
  assert.equal(result, '2026-11-17');
});

test('maskBankAccount masks prefix and leaves last 4 digits', () => {
  assert.equal(maskBankAccount('1000673029578'), '*********9578');
});

test('validateNickname validates length, characters, empty, and blocked words', () => {
  assert.deepEqual(validateNickname('  Abebe   Tesfaye  '), { ok: true, value: 'Abebe Tesfaye' });
  assert.equal(validateNickname('').ok, false);
  assert.equal(validateNickname('   ').ok, false);
  assert.equal(validateNickname('A').ok, false);
  assert.equal(validateNickname('A'.repeat(25)).ok, false);
  assert.equal(validateNickname('<script>alert(1)</script>').ok, false);
  assert.equal(validateNickname('Admin').ok, false);
  assert.equal(validateNickname('Support Team').ok, false);
});

test('getCustomerDisplayName defaults to User when nickname is not set', () => {
  assert.equal(getCustomerDisplayName({ nickname: null, fullName: 'Member CC123', role: 'customer' }), 'User');
  assert.equal(getCustomerDisplayName({ nickname: '  Selam  ', fullName: 'Member CC123', role: 'customer' }), 'Selam');
  assert.equal(getCustomerDisplayName({ nickname: null, fullName: 'Platform Administrator', role: 'owner_admin' }), 'Platform Administrator');
});

test('normalizePublicSiteUrl normalizes valid custom domains and rejects placeholders', () => {
  assert.equal(normalizePublicSiteUrl('https://mybrand.com/'), 'https://mybrand.com');
  assert.equal(normalizePublicSiteUrl('mybrand.com'), 'https://mybrand.com');
  assert.equal(normalizePublicSiteUrl('MY_APP_URL'), null);
  assert.equal(normalizePublicSiteUrl('https://YOUR-PURCHASED-DOMAIN.com'), null);
  assert.equal(normalizePublicSiteUrl(''), null);
});

test('normalizeLoginPhoneIdentifier handles customer phones and admin phone +25190909090', () => {
  assert.equal(normalizeLoginPhoneIdentifier('0911223344'), '+251911223344');
  assert.equal(normalizeLoginPhoneIdentifier('+25190909090'), '+25190909090');
  assert.equal(normalizeLoginPhoneIdentifier('+251 90909090'), '+25190909090');
});
