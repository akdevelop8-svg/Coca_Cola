import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import {
  ADMIN_ROLES,
  attachAuthUser,
  clearSessionCookie,
  createSession,
  hashPassword,
  isAdminRole,
  rateLimit,
  requireAdminRole,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthenticatedRequest,
} from './auth';
import {
  appendDemoTransaction,
  createNotification,
  db,
  getUserBalances,
  getUserWallet,
  grantRegistrationDemoBonus,
  isGiftCodeFeatureEnabled,
  logAdminAudit,
  refreshUserCompletedPlans,
  uploadDir,
} from './db';
import {
  COMPANY_INFO,
  DEFAULT_PLATFORM_SETTINGS,
  INVESTMENT_PLANS,
  TEAM_VALUE_TASKS,
} from '../src/shared/constants';
import {
  calculateReferralRewards,
  calculateWithdrawalBreakdown,
  canPurchasePlan,
  computePlanProgress,
  computeTeamTaskLevels,
  DAILY_CHECKIN_REWARD_ETB,
  REGISTRATION_BONUS_ETB,
  evaluateGiftCodeEligibility,
  getCustomerDisplayName,
  getEthiopiaCalendarDate,
  maskBankAccount,
  maskPhoneNumber,
  MAX_ACTIVE_PLANS,
  normalizeEthiopiaPhone,
  normalizeLoginPhoneIdentifier,
  normalizePublicSiteUrl,
  validateEthiopiaPhone,
  validateNickname,
} from '../src/shared/finance';
import type { UserRole } from '../src/types';

function getPlatformSettings() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'platform_settings'").get() as
    | { value: string }
    | undefined;
  const parsed = row ? JSON.parse(row.value) : {};
  return { ...DEFAULT_PLATFORM_SETTINGS, ...parsed };
}

function getCompanyInfo() {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'company_info'").get() as
    | { value: string }
    | undefined;
  const parsed = row ? JSON.parse(row.value) : {};
  return { ...COMPANY_INFO, ...parsed };
}

function isSandboxMode(): boolean {
  return process.env.SANDBOX_MODE !== 'false';
}

function isComplianceApproved(): boolean {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'compliance_approved'").get() as
    | { value: string }
    | undefined;
  if (row) return row.value === 'true';
  return process.env.COMPLIANCE_APPROVED === 'true';
}

function requireLiveFinance(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (isSandboxMode() || !isComplianceApproved()) {
    res.status(503).json({
      error: 'Financial operations are not enabled yet. The production database, sponsor funding, and required legal/compliance approvals must be verified first.',
    });
    return;
  }
  next();
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 15; attempt++) {
    let code = 'CC';
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    const exists = db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code);
    if (!exists) return code;
  }
  return `CC${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const allowedReceiptMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedReceiptMimes.has(file.mimetype)) {
      cb(new Error('Only JPG, PNG, WEBP, or PDF files up to 5MB are allowed.'));
      return;
    }
    cb(null, true);
  },
});

const allowedBroadcastMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const broadcastUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `broadcast-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedBroadcastMimes.has(file.mimetype)) {
      cb(new Error('Only JPG, PNG, or WEBP images up to 5MB are allowed for broadcasts.'));
      return;
    }
    cb(null, true);
  },
});

function buildUserResponse(userId: string) {
  const row = db
    .prepare(
      `SELECT id, full_name, nickname, phone, username, email, role, status, referral_code, invited_by_user_id, avatar_url, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as any;
  if (!row) return null;

  const settings = getPlatformSettings();
  const acceptance = db
    .prepare(
      `SELECT terms_version, accepted_at FROM terms_acceptances
       WHERE user_id = ? AND terms_version = ?
       ORDER BY accepted_at DESC LIMIT 1`
    )
    .get(userId, settings.termsVersion) as
    | { terms_version: string; accepted_at: string }
    | undefined;

  let invitedByCode: string | null = null;
  if (row.invited_by_user_id) {
    const inviter = db
      .prepare('SELECT referral_code FROM users WHERE id = ?')
      .get(row.invited_by_user_id) as { referral_code: string } | undefined;
    invitedByCode = inviter?.referral_code || null;
  }

  const nickname = typeof row.nickname === 'string' && row.nickname.trim() ? row.nickname.trim() : null;
  const displayName = getCustomerDisplayName({
    nickname,
    fullName: row.full_name,
    role: row.role,
  });

  return {
    id: row.id,
    fullName: displayName,
    nickname,
    displayName,
    phone: row.phone,
    username: row.username || null,
    email: row.email,
    role: row.role as UserRole,
    status: row.status,
    referralCode: row.referral_code,
    invitedByCode,
    avatarUrl: row.avatar_url,
    termsAcceptedVersion: acceptance?.terms_version || null,
    termsAcceptedAt: acceptance?.accepted_at || null,
    createdAt: row.created_at,
  };
}

export function createApiRouter() {
  const router = express.Router();
  router.use(attachAuthUser);

  router.get('/health', (_req, res) => {
    res.json({ ok: true, sandboxMode: isSandboxMode(), complianceApproved: isComplianceApproved() });
  });

  // Public runtime configuration (never exposes secrets)
  router.get('/config', (_req, res) => {
    const supportChannels = db
      .prepare('SELECT id, label, handle_or_url, href, kind, is_active, sort_order FROM support_channels WHERE is_active = 1 ORDER BY sort_order ASC')
      .all()
      .map((r: any) => ({
        id: r.id,
        label: r.label,
        handleOrUrl: r.handle_or_url,
        href: r.href,
        kind: r.kind,
        isActive: Boolean(r.is_active),
        sortOrder: r.sort_order,
      }));

    const carouselAssets = db
      .prepare('SELECT id, title, subtitle, image_url, is_active, sort_order FROM carousel_assets WHERE is_active = 1 ORDER BY sort_order ASC')
      .all()
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        imageUrl: r.image_url,
        isActive: Boolean(r.is_active),
        sortOrder: r.sort_order,
      }));

    const activeMethods = db
      .prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order ASC, updated_at DESC')
      .all()
      .map((r: any) => ({
        id: r.id,
        kind: r.kind as 'deposit' | 'payout',
        name: r.name,
        accountName: r.account_name,
        accountNumber: r.account_number,
        instructions: r.instructions,
        isActive: Boolean(r.is_active),
        sortOrder: r.sort_order,
        updatedAt: r.updated_at,
      }));

    const activeDepositMethods = activeMethods.filter((m) => m.kind === 'deposit');
    const activePayoutMethods = activeMethods.filter((m) => m.kind === 'payout');
    const settings = getPlatformSettings();
    if (activeDepositMethods[0]) {
      settings.depositCbeAccountName = activeDepositMethods[0].name;
      settings.depositCbeAccountNumber = activeDepositMethods[0].accountNumber;
    }
    if (activePayoutMethods[0]) {
      settings.withdrawalMethodOnly = activePayoutMethods[0].name;
    }

    const configuredPublicUrl = normalizePublicSiteUrl(
      process.env.PUBLIC_SITE_URL || process.env.CUSTOM_DOMAIN || process.env.VITE_PUBLIC_SITE_URL
    );

    res.json({
      sandboxMode: isSandboxMode(),
      complianceApproved: isComplianceApproved(),
      adminSetupRequired: false,
      giftCodeEnabled: isGiftCodeFeatureEnabled(),
      publicSiteUrl: configuredPublicUrl,
      customDomainConfigured: Boolean(configuredPublicUrl),
      settings,
      activeDepositMethods,
      activePayoutMethods,
      supportChannels,
      carouselAssets,
      companyInfo: getCompanyInfo(),
    });
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION ROUTES
  // ---------------------------------------------------------------------------
  router.post('/auth/register', rateLimit(20, 60_000), requireLiveFinance, (req, res) => {
    try {
      const { phone, password, confirmPassword, referralCode } = req.body || {};
      if (!phone || !validateEthiopiaPhone(String(phone))) {
        res.status(400).json({ error: 'Enter a valid Ethiopia phone number (+251 9XXXXXXXX or 09XXXXXXXX).' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }
      if (password !== confirmPassword) {
        res.status(400).json({ error: 'Password and confirmation password do not match.' });
        return;
      }

      const normalizedPhone = normalizeEthiopiaPhone(String(phone));
      const reservedAdminPhone =
        normalizeLoginPhoneIdentifier(process.env.ADMIN_PHONE || '+25190909090') || '+25190909090';
      if (normalizedPhone === reservedAdminPhone) {
        res.status(409).json({ error: 'This phone number is reserved and cannot be registered.' });
        return;
      }

      const existingPhone = db.prepare('SELECT 1 FROM users WHERE phone = ?').get(normalizedPhone);
      if (existingPhone) {
        res.status(409).json({ error: 'An account with this phone number already exists.' });
        return;
      }

      let invitedByUserId: string | null = null;
      if (referralCode && String(referralCode).trim()) {
        const cleanCode = String(referralCode).trim().toUpperCase();
        const inviter = db
          .prepare('SELECT id FROM users WHERE referral_code = ?')
          .get(cleanCode) as { id: string } | undefined;
        if (!inviter) {
          res.status(400).json({ error: 'Invitation code is invalid or does not exist.' });
          return;
        }
        invitedByUserId = inviter.id;
      }

      const userId = `usr_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const myCode = generateReferralCode();
      const pwHash = hashPassword(password);

      const settings = getPlatformSettings();
      const regBonus = Number(settings.registrationBonus) > 0 ? Number(settings.registrationBonus) : REGISTRATION_BONUS_ETB;

      const regTx = db.transaction(() => {
        db.prepare(
          `INSERT INTO users (id, full_name, nickname, phone, email, password_hash, role, status, referral_code, invited_by_user_id, created_at, last_active_at)
           VALUES (?, 'User', NULL, ?, NULL, ?, 'customer', 'active', ?, ?, ?, ?)`
        ).run(
          userId,
          normalizedPhone,
          pwHash,
          myCode,
          invitedByUserId,
          now,
          now
        );

        grantRegistrationDemoBonus(userId, regBonus, now);

        createNotification(
          userId,
          'Welcome to the Platform',
          `You received +${regBonus} ETB as your Registration Bonus. Review and accept the Platform Terms & Summary to continue.`,
          'system',
          '/onboarding-terms'
        );
      });
      regTx();

      const token = createSession(userId);
      setSessionCookie(req, res, token);

      res.status(201).json({
        user: buildUserResponse(userId),
        unreadNotifications: 1,
        sessionToken: token,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Registration failed.' });
    }
  });

  router.post('/auth/login', rateLimit(30, 60_000), (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      res.status(400).json({ error: 'Phone number and password are required.' });
      return;
    }

    const rawId = String(identifier).trim();
    const normalizedPhone = normalizeLoginPhoneIdentifier(rawId);
    const userRow = db
      .prepare(
        `SELECT id, password_hash, role, status FROM users
         WHERE phone = ? OR phone = ? OR LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)`
      )
      .get(normalizedPhone || rawId, rawId, rawId, rawId) as
      | { id: string; password_hash: string; role: UserRole; status: string }
      | undefined;

    if (!userRow || !verifyPassword(String(password), userRow.password_hash)) {
      if (userRow && isAdminRole(userRow.role)) {
        logAdminAudit(userRow.id, userRow.role, 'admin_login_failed', 'user', userRow.id, {
          ip: req.ip,
        });
      }
      res.status(401).json({ error: 'Invalid credentials. Please check your phone number and password.' });
      return;
    }

    if (userRow.status === 'suspended') {
      res.status(403).json({ error: 'Your account has been suspended. Contact Customer Service.' });
      return;
    }

    if (isAdminRole(userRow.role)) {
      logAdminAudit(userRow.id, userRow.role, 'admin_login_success', 'user', userRow.id, {
        ip: req.ip,
      });
    }

    const token = createSession(userRow.id);
    setSessionCookie(req, res, token);

    const unread = (
      db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userRow.id) as {
        c: number;
      }
    ).c;

    res.json({
      user: buildUserResponse(userRow.id),
      unreadNotifications: unread,
      sessionToken: token,
    });
  });

  router.post('/auth/logout', (req: AuthenticatedRequest, res) => {
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.get('/auth/me', (req: AuthenticatedRequest, res) => {
    if (!req.authUser) {
      res.json({ user: null, unreadNotifications: 0 });
      return;
    }
    const unread = (
      db
        .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0')
        .get(req.authUser.id) as { c: number }
    ).c;
    res.json({
      user: buildUserResponse(req.authUser.id),
      unreadNotifications: unread,
    });
  });

  router.post('/auth/forgot-password', rateLimit(10, 60_000), (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) {
      res.status(400).json({ error: 'Enter your registered phone number or email.' });
      return;
    }
    const rawId = String(identifier).trim();
    const normalizedPhone = normalizeEthiopiaPhone(rawId);
    const userRow = db
      .prepare('SELECT id FROM users WHERE phone = ? OR LOWER(email) = LOWER(?)')
      .get(normalizedPhone || rawId, rawId) as { id: string } | undefined;

    if (!userRow) {
      res.json({
        ok: true,
        message: 'If an account matches that identifier, a password reset code has been generated.',
      });
      return;
    }

    const resetCode = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO password_resets (id, user_id, reset_code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(`rst_${crypto.randomUUID()}`, userRow.id, resetCode, expiresAt, new Date().toISOString());

    res.json({
      ok: true,
      message: isSandboxMode()
        ? `Sandbox reset code generated (valid 15 min): ${resetCode}`
        : 'Password reset instructions sent.',
      sandboxResetCode: isSandboxMode() ? resetCode : undefined,
    });
  });

  router.post('/auth/reset-password', rateLimit(10, 60_000), (req, res) => {
    const { identifier, resetCode, newPassword } = req.body || {};
    if (!identifier || !resetCode || !newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: 'Valid identifier, 6-digit reset code, and new password (min 6 chars) are required.' });
      return;
    }
    const rawId = String(identifier).trim();
    const normalizedPhone = normalizeEthiopiaPhone(rawId);
    const userRow = db
      .prepare('SELECT id FROM users WHERE phone = ? OR LOWER(email) = LOWER(?)')
      .get(normalizedPhone || rawId, rawId) as { id: string } | undefined;

    if (!userRow) {
      res.status(400).json({ error: 'Invalid reset request.' });
      return;
    }

    const resetRow = db
      .prepare(
        `SELECT id, expires_at, used_at FROM password_resets
         WHERE user_id = ? AND reset_code = ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(userRow.id, String(resetCode).trim()) as
      | { id: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!resetRow || resetRow.used_at || new Date(resetRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Reset code is invalid or expired.' });
      return;
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
        hashPassword(String(newPassword)),
        userRow.id
      );
      db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRow.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userRow.id);
    });
    tx();

    res.json({ ok: true, message: 'Password updated successfully. Please log in.' });
  });

  // ---------------------------------------------------------------------------
  // ONBOARDING TERMS ACCEPTANCE (TASK 1 FIX)
  // ---------------------------------------------------------------------------
  router.post('/onboarding/accept-terms', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { accepted, termsVersion } = req.body || {};
      if (accepted !== true) {
        res.status(400).json({ error: 'You must check the box to accept the Platform Terms & Summary.' });
        return;
      }

      const settings = getPlatformSettings();
      const targetVersion =
        typeof termsVersion === 'string' && termsVersion.trim()
          ? termsVersion.trim()
          : settings.termsVersion;

      if (targetVersion !== settings.termsVersion) {
        res.status(400).json({ error: 'Terms version has changed. Please refresh and review the latest terms.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO terms_acceptances (id, user_id, terms_version, accepted_at, ip_address)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, terms_version) DO UPDATE SET
           accepted_at = excluded.accepted_at,
           ip_address = excluded.ip_address`
      ).run(`trm_${crypto.randomUUID()}`, req.authUser!.id, targetVersion, now, req.ip || null);

      const user = buildUserResponse(req.authUser!.id);
      res.json({ ok: true, user, acceptedVersion: targetVersion, acceptedAt: now });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not save terms acceptance.' });
    }
  });

  // Update Customer Nickname / Display Name
  router.put('/profile/nickname', requireAuth, (req: AuthenticatedRequest, res) => {
    const validation = validateNickname(req.body?.nickname);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    db.prepare('UPDATE users SET nickname = ?, full_name = ? WHERE id = ?').run(
      validation.value,
      validation.value,
      req.authUser!.id
    );

    res.json({
      ok: true,
      nickname: validation.value,
      user: buildUserResponse(req.authUser!.id),
      message: 'Nickname saved successfully.',
    });
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATED USER DASHBOARD, CHECK-IN, PLANS, INCOME, TEAM, TASKS
  // ---------------------------------------------------------------------------
  router.get('/dashboard/summary', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    refreshUserCompletedPlans(userId);
    const balances = getUserBalances(userId);
    const demoWallet = getUserWallet(userId);
    const activePlansCount = (
      db.prepare("SELECT COUNT(*) as c FROM plan_purchases WHERE user_id = ? AND status = 'active'").get(userId) as {
        c: number;
      }
    ).c;

    const todayEth = getEthiopiaCalendarDate();
    const checkinRow = db
      .prepare('SELECT 1 FROM daily_checkins WHERE user_id = ? AND ethiopia_date = ?')
      .get(userId, todayEth);

    // Count 3-level team members & qualifying members
    const l1 = db.prepare('SELECT id FROM users WHERE invited_by_user_id = ?').all(userId) as Array<{ id: string }>;
    const l1Ids = l1.map((u) => u.id);
    const l2Ids: string[] = [];
    const l3Ids: string[] = [];
    if (l1Ids.length > 0) {
      const l2 = db
        .prepare(`SELECT id FROM users WHERE invited_by_user_id IN (${l1Ids.map(() => '?').join(',')})`)
        .all(...l1Ids) as Array<{ id: string }>;
      l2Ids.push(...l2.map((u) => u.id));
    }
    if (l2Ids.length > 0) {
      const l3 = db
        .prepare(`SELECT id FROM users WHERE invited_by_user_id IN (${l2Ids.map(() => '?').join(',')})`)
        .all(...l2Ids) as Array<{ id: string }>;
      l3Ids.push(...l3.map((u) => u.id));
    }
    const allTeamIds = [...l1Ids, ...l2Ids, ...l3Ids];
    let qualifyingTeamMembersCount = 0;
    if (allTeamIds.length > 0) {
      const qRow = db
        .prepare(
          `SELECT COUNT(DISTINCT user_id) as c FROM plan_purchases WHERE user_id IN (${allTeamIds
            .map(() => '?')
            .join(',')})`
        )
        .get(...allTeamIds) as { c: number };
      qualifyingTeamMembersCount = qRow.c;
    }

    res.json({
      ...balances,
      ...demoWallet,
      activePlansCount,
      maxActivePlans: MAX_ACTIVE_PLANS,
      teamMembersCount: allTeamIds.length,
      qualifyingTeamMembersCount,
      checkedInToday: Boolean(checkinRow),
      todayEthiopiaDate: todayEth,
    });
  });

  // Read-only Daily Check-in status & history (NEVER auto-awards Demo ETB on GET)
  router.get('/checkin', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const todayEth = getEthiopiaCalendarDate();
    const settings = getPlatformSettings();
    const rewardAmount = Number(settings.dailyCheckinAmount) > 0 ? Number(settings.dailyCheckinAmount) : DAILY_CHECKIN_REWARD_ETB;
    const existing = db
      .prepare('SELECT id FROM daily_checkins WHERE user_id = ? AND ethiopia_date = ?')
      .get(userId, todayEth);
    const history = db
      .prepare('SELECT id, ethiopia_date, amount, status, created_at FROM daily_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 60')
      .all(userId)
      .map((r: any) => ({
        id: r.id,
        ethiopiaDate: r.ethiopia_date,
        amount: r.amount,
        status: r.status,
        createdAt: r.created_at,
      }));
    const demoWallet = getUserWallet(userId);
    res.json({
      checkedInToday: Boolean(existing),
      ethiopiaDate: todayEth,
      rewardAmount,
      demoBalance: demoWallet.demoBalance,
      history,
    });
  });

  // Manual Daily Check-In Claim (2 Demo ETB once per Ethiopia calendar day)
  router.post('/checkin', requireAuth, requireLiveFinance, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const todayEth = getEthiopiaCalendarDate();
    const settings = getPlatformSettings();
    const checkinAmount = Number(settings.dailyCheckinAmount) > 0 ? Number(settings.dailyCheckinAmount) : DAILY_CHECKIN_REWARD_ETB;
    const now = new Date().toISOString();

    try {
      let nextBalance = 0;
      const tx = db.transaction(() => {
        const existing = db
          .prepare('SELECT id FROM daily_checkins WHERE user_id = ? AND ethiopia_date = ?')
          .get(userId, todayEth);
        if (existing) {
          throw new Error('ALREADY_CLAIMED');
        }

        db.prepare(
          `INSERT INTO daily_checkins (id, user_id, ethiopia_date, amount, status, created_at)
           VALUES (?, ?, ?, ?, 'credited', ?)`
        ).run(
          `chk_${crypto.randomUUID()}`,
          userId,
          todayEth,
          checkinAmount,
          now
        );

        nextBalance = appendDemoTransaction({
          userId,
          type: 'daily_checkin',
          amountSigned: checkinAmount,
          referenceId: todayEth,
          note: `Manual Daily Check-In (+${checkinAmount} ETB · ${todayEth})`,
          idempotencyKey: `checkin:${userId}:${todayEth}`,
          createdAt: now,
        });
      });
      tx();

      res.json({
        ok: true,
        ethiopiaDate: todayEth,
        amount: checkinAmount,
        demoBalance: nextBalance,
        message: `Claimed +${checkinAmount} ETB for ${todayEth}.`,
      });
    } catch {
      res.status(409).json({ error: `Already claimed for ${todayEth} (Ethiopia time).` });
    }
  });

  // Demo Investment Plan Purchase (Max 2 active plans, Demo ETB deducted atomically, 365-day manual claim)
  router.post('/plans/purchase', requireAuth, requireLiveFinance, (req: AuthenticatedRequest, res) => {
    const { planCode } = req.body || {};
    const plan = INVESTMENT_PLANS.find((p) => p.code === planCode);
    if (!plan) {
      res.status(400).json({ error: 'Invalid investment plan selected.' });
      return;
    }

    const userId = req.authUser!.id;
    const settings = getPlatformSettings();
    const purchaseId = `pur_${crypto.randomUUID()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const end = new Date(now.getTime() + plan.periodDays * 86400 * 1000);

    try {
      let nextBalance = 0;
      const tx = db.transaction(() => {
        refreshUserCompletedPlans(userId);
        const activeCount = (
          db.prepare("SELECT COUNT(*) as c FROM plan_purchases WHERE user_id = ? AND status = 'active'").get(userId) as {
            c: number;
          }
        ).c;

        const demoWallet = getUserWallet(userId);
        const validation = canPurchasePlan(activeCount, demoWallet.demoBalance, plan.investment, MAX_ACTIVE_PLANS);
        if (!validation.ok) {
          throw new Error(validation.error || 'Cannot complete plan purchase.');
        }

        db.prepare(
          `INSERT INTO plan_purchases (id, user_id, plan_code, amount, daily_mining_rate, period_days, status, start_date, end_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        ).run(
          purchaseId,
          userId,
          plan.code,
          plan.investment,
          plan.dailyMining,
          plan.periodDays,
          nowIso,
          end.toISOString(),
          nowIso
        );

        nextBalance = appendDemoTransaction({
          userId,
          type: 'plan_purchase',
          amountSigned: -plan.investment,
          referenceId: purchaseId,
          note: `Purchased ${plan.name} (-${plan.investment.toLocaleString()} ETB · 365 Days)`,
          idempotencyKey: `purchase:${purchaseId}`,
          createdAt: nowIso,
        });

        // Referral Demo ETB Rewards (Level 1: 20%, Level 2: 2%, Level 3: 1%)
        const rewardAmounts = calculateReferralRewards(plan.investment, {
          level1: Number(settings.referralLevel1Percent) || 20,
          level2: Number(settings.referralLevel2Percent) || 2,
          level3: Number(settings.referralLevel3Percent) || 1,
        });
        const ratesByLevel: Array<{ level: 1 | 2 | 3; rate: number; amount: number }> = [
          { level: 1, rate: Number(settings.referralLevel1Percent) || 20, amount: rewardAmounts.level1 },
          { level: 2, rate: Number(settings.referralLevel2Percent) || 2, amount: rewardAmounts.level2 },
          { level: 3, rate: Number(settings.referralLevel3Percent) || 1, amount: rewardAmounts.level3 },
        ];

        const visited = new Set<string>([userId]);
        let currentChildId = userId;
        for (const tier of ratesByLevel) {
          const childRow = db
            .prepare('SELECT invited_by_user_id FROM users WHERE id = ?')
            .get(currentChildId) as { invited_by_user_id: string | null } | undefined;
          const ancestorId = childRow?.invited_by_user_id;
          if (!ancestorId || visited.has(ancestorId)) break;
          visited.add(ancestorId);

          const ancestorRow = db
            .prepare("SELECT id, role, status FROM users WHERE id = ? AND role = 'customer' AND status = 'active'")
            .get(ancestorId) as { id: string } | undefined;
          if (ancestorRow && tier.amount > 0) {
            db.prepare(
              `INSERT INTO referral_demo_rewards (id, beneficiary_user_id, source_user_id, purchase_id, level, rate_percent, amount, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              `rdr_${crypto.randomUUID()}`,
              ancestorId,
              userId,
              purchaseId,
              tier.level,
              tier.rate,
              tier.amount,
              nowIso
            );

            appendDemoTransaction({
              userId: ancestorId,
              type: 'referral_reward',
              amountSigned: tier.amount,
              referenceId: purchaseId,
              note: `Level ${tier.level} referral reward (${tier.rate}% of ${plan.name})`,
              idempotencyKey: `ref_reward:${purchaseId}:L${tier.level}`,
              createdAt: nowIso,
            });
          }
          currentChildId = ancestorId;
        }
      });
      tx();

      res.status(201).json({ ok: true, purchaseId, demoBalance: nextBalance });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Plan purchase failed.' });
    }
  });

  router.get('/income', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    refreshUserCompletedPlans(userId);
    const todayEth = getEthiopiaCalendarDate();
    const purchases = db
      .prepare('SELECT * FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId)
      .map((p: any) => {
        const claimedToday = Boolean(
          db
            .prepare('SELECT 1 FROM daily_claims WHERE purchase_id = ? AND ethiopia_date = ?')
            .get(p.id, todayEth)
        );
        const totalClaimed = (
          db
            .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM daily_claims WHERE purchase_id = ?')
            .get(p.id) as { s: number }
        ).s;
        const progress = computePlanProgress(p.start_date, p.period_days, claimedToday, todayEth);
        return {
          id: p.id,
          planCode: p.plan_code,
          amount: p.amount,
          dailyMiningRate: p.daily_mining_rate,
          periodDays: p.period_days,
          status: progress.isCompleted ? 'completed' : p.status,
          startDate: p.start_date,
          endDate: p.end_date,
          purchaseEthDate: progress.purchaseEthDate,
          daysElapsed: progress.daysElapsed,
          remainingDays: progress.remainingDays,
          isCompleted: progress.isCompleted,
          canClaim: progress.canClaim,
          statusLabel: progress.statusLabel,
          claimedToday,
          totalClaimed,
          createdAt: p.created_at,
        };
      });

    const demoTransactions = db
      .prepare(
        `SELECT id, user_id, type, amount_signed, balance_after, reference_id, note, created_at
         FROM ledger_entries
         WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 150`
      )
      .all(userId)
      .map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        amountSigned: t.amount_signed,
        balanceAfter: t.balance_after,
        referenceId: t.reference_id,
        note: t.note,
        createdAt: t.created_at,
      }));

    const demoWallet = getUserWallet(userId);
    res.json({
      activePlansCount: purchases.filter((p) => !p.isCompleted && p.status === 'active').length,
      myIncome: demoWallet.demoTotalEarnings,
      demoBalance: demoWallet.demoBalance,
      todayEthiopiaDate: todayEth,
      purchases,
      demoTransactions,
    });
  });

  // Manual Daily Mining Claim per purchased plan (once per Ethiopia calendar day, disabled after 365 days)
  router.post('/income/claim/:purchaseId', requireAuth, requireLiveFinance, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { purchaseId } = req.params;
    const todayEth = getEthiopiaCalendarDate();
    const nowIso = new Date().toISOString();

    try {
      let claimedAmount = 0;
      let nextBalance = 0;
      const tx = db.transaction(() => {
        refreshUserCompletedPlans(userId);
        const purchase = db
          .prepare('SELECT * FROM plan_purchases WHERE id = ? AND user_id = ?')
          .get(purchaseId, userId) as any;
        if (!purchase) {
          throw Object.assign(new Error('Purchased plan not found.'), { statusCode: 404 });
        }

        const progress = computePlanProgress(purchase.start_date, purchase.period_days, false, todayEth);
        if (progress.isCompleted || purchase.status === 'completed') {
          db.prepare("UPDATE plan_purchases SET status = 'completed' WHERE id = ?").run(purchaseId);
          throw Object.assign(new Error('Plan Completed: 365-day term has finished.'), { statusCode: 400 });
        }

        const existingClaim = db
          .prepare('SELECT 1 FROM daily_claims WHERE purchase_id = ? AND ethiopia_date = ?')
          .get(purchaseId, todayEth);
        if (existingClaim) {
          throw Object.assign(new Error(`Claimed Today: already claimed for ${todayEth}.`), { statusCode: 409 });
        }

        claimedAmount = purchase.daily_mining_rate;
        db.prepare(
          `INSERT INTO daily_claims (id, user_id, purchase_id, ethiopia_date, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(`clm_${crypto.randomUUID()}`, userId, purchaseId, todayEth, claimedAmount, nowIso);

        nextBalance = appendDemoTransaction({
          userId,
          type: 'daily_mining_claim',
          amountSigned: claimedAmount,
          referenceId: purchaseId,
          note: `Manual daily mining claim for Plan ${purchase.plan_code} (+${claimedAmount.toLocaleString()} ETB · ${todayEth})`,
          idempotencyKey: `claim:${purchaseId}:${todayEth}`,
          createdAt: nowIso,
        });
      });
      tx();
      res.json({
        ok: true,
        amount: claimedAmount,
        demoBalance: nextBalance,
        ethiopiaDate: todayEth,
        message: `Claimed +${claimedAmount.toLocaleString()} ETB!`,
      });
    } catch (err: any) {
      const code = err?.statusCode || 409;
      res.status(code).json({ error: err?.message || `Already claimed for ${todayEth}.` });
    }
  });

  // ---------------------------------------------------------------------------
  // TEAM (TRUE 3-LEVEL TREE WITH QUALIFYING STATUS & PRIVACY MASKING)
  // ---------------------------------------------------------------------------
  router.get('/team', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const settings = getPlatformSettings();

    const fetchChildren = (parentIds: string[]) => {
      if (parentIds.length === 0) return [] as any[];
      return db
        .prepare(
          `SELECT id, nickname, full_name, phone, referral_code, created_at
           FROM users WHERE invited_by_user_id IN (${parentIds.map(() => '?').join(',')})
           ORDER BY created_at DESC`
        )
        .all(...parentIds) as any[];
    };

    const l1Raw = fetchChildren([userId]);
    const l2Raw = fetchChildren(l1Raw.map((u) => u.id));
    const l3Raw = fetchChildren(l2Raw.map((u) => u.id));

    const enrichMembers = (rows: any[], level: 1 | 2 | 3) =>
      rows.map((u) => {
        const purchaseAgg = db
          .prepare(
            `SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as vol, MIN(created_at) as first_date
             FROM plan_purchases WHERE user_id = ?`
          )
          .get(u.id) as { cnt: number; vol: number; first_date: string | null };

        const qualified = purchaseAgg.cnt > 0;
        return {
          id: u.id,
          level,
          displayName: getCustomerDisplayName({ nickname: u.nickname, fullName: u.full_name, role: 'customer' }),
          maskedPhone: maskPhoneNumber(u.phone),
          referralCode: u.referral_code,
          registeredAt: u.created_at,
          qualified,
          qualifyingStatus: qualified ? 'Qualifying Purchase Verified' : 'Registered — not yet qualifying',
          qualifyingPurchaseDate: purchaseAgg.first_date,
          qualifyingPurchaseValue: purchaseAgg.vol,
        };
      });

    const level1 = enrichMembers(l1Raw, 1);
    const level2 = enrichMembers(l2Raw, 2);
    const level3 = enrichMembers(l3Raw, 3);
    const all = [...level1, ...level2, ...level3];
    const qualifyingMembers = all.filter((m) => m.qualified);
    const totalQualifyingVolume = qualifyingMembers.reduce((sum, m) => sum + m.qualifyingPurchaseValue, 0);
    const demoWallet = getUserWallet(userId);

    res.json({
      invitationCode: req.authUser!.referralCode,
      rates: {
        level1: settings.referralLevel1Percent,
        level2: settings.referralLevel2Percent,
        level3: settings.referralLevel3Percent,
      },
      summary: {
        totalRegisteredMembers: all.length,
        qualifyingMembersCount: qualifyingMembers.length,
        totalQualifyingVolume,
        teamCommission: demoWallet.demoTeamCommission,
        level1Count: level1.length,
        level2Count: level2.length,
        level3Count: level3.length,
      },
      levels: { level1, level2, level3 },
    });
  });

  // ---------------------------------------------------------------------------
  // TASKS (L1 + L2 VERIFIED CBE DEPOSIT MILESTONES — ZERO DEDUCTIONS)
  // ---------------------------------------------------------------------------
  function getVerifiedL1L2DepositsTotal(userId: string): number {
    const l1Ids = (
      db.prepare('SELECT id FROM users WHERE invited_by_user_id = ?').all(userId) as Array<{ id: string }>
    ).map((u) => u.id);
    if (l1Ids.length === 0) return 0;

    const l2Ids = (
      db
        .prepare(`SELECT id FROM users WHERE invited_by_user_id IN (${l1Ids.map(() => '?').join(',')})`)
        .all(...l1Ids) as Array<{ id: string }>
    ).map((u) => u.id);

    const l1L2Ids = [...l1Ids, ...l2Ids];
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM deposits
         WHERE user_id IN (${l1L2Ids.map(() => '?').join(',')})
           AND status = 'approved'`
      )
      .get(...l1L2Ids) as { total: number };

    return Math.round((row.total || 0) * 100) / 100;
  }

  router.get('/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const verifiedDepositsTotal = getVerifiedL1L2DepositsTotal(userId);
    const claimedRows = db
      .prepare('SELECT task_id FROM task_claims WHERE user_id = ?')
      .all(userId) as Array<{ task_id: string }>;
    const claimedSet = new Set(claimedRows.map((r) => r.task_id));

    const summary = computeTeamTaskLevels(verifiedDepositsTotal, TEAM_VALUE_TASKS, claimedSet);

    res.json({
      ...summary,
      qualifyingPurchasesVolume: summary.verifiedDepositsTotal,
    });
  });

  router.post('/tasks/claim', requireAuth, requireLiveFinance, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { taskId } = req.body || {};
    const task = TEAM_VALUE_TASKS.find((t) => t.id === taskId);
    if (!task) {
      res.status(400).json({ error: 'Unknown task level ID.' });
      return;
    }

    const verifiedDepositsTotal = getVerifiedL1L2DepositsTotal(userId);
    if (verifiedDepositsTotal < task.targetAmount) {
      res.status(400).json({
        error: `Level ${task.level} target (ETB ${task.targetAmount.toLocaleString('en-US')}) has not been reached yet.`,
      });
      return;
    }

    const now = new Date().toISOString();
    try {
      let nextBalance = 0;
      const tx = db.transaction(() => {
        const alreadyClaimed = db
          .prepare('SELECT id FROM task_claims WHERE user_id = ? AND task_id = ?')
          .get(userId, task.id);
        if (alreadyClaimed) {
          throw new Error('ALREADY_CLAIMED');
        }

        db.prepare(
          `INSERT INTO task_claims (id, user_id, task_id, amount, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(`tcl_${crypto.randomUUID()}`, userId, task.id, task.rewardAmount, now);

        nextBalance = appendDemoTransaction({
          userId,
          type: 'task_reward',
          amountSigned: task.rewardAmount,
          referenceId: task.id,
          note: `Team Task Level ${task.level} Reward (+ETB ${task.rewardAmount.toLocaleString('en-US')})`,
          idempotencyKey: `task_claim:${userId}:${task.id}`,
          createdAt: now,
        });

        createNotification(
          userId,
          `Level ${task.level} Task Reward Settled`,
          `+ETB ${task.rewardAmount.toLocaleString('en-US')} has been credited to your wallet without any deductions.`,
          'task_reward',
          '/income'
        );
      });
      tx();

      res.json({
        ok: true,
        taskId: task.id,
        level: task.level,
        rewardAmount: task.rewardAmount,
        demoBalance: nextBalance,
        message: `Level ${task.level} reward (+ETB ${task.rewardAmount.toLocaleString('en-US')}) settled and credited to your wallet.`,
      });
    } catch (err: any) {
      if (err?.message === 'ALREADY_CLAIMED') {
        res.status(409).json({ error: `Level ${task.level} reward has already been claimed.` });
        return;
      }
      res.status(500).json({ error: 'Unable to settle task reward right now.' });
    }
  });

  // ---------------------------------------------------------------------------
  // PAYMENT METHODS, DEPOSITS (CBE 1000673029578), PAYOUT ACCOUNTS & WITHDRAWALS (CBE ONLY)
  // ---------------------------------------------------------------------------
  router.get('/payment-methods', requireAuth, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order ASC, updated_at DESC')
      .all()
      .map((r: any) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        accountName: r.account_name,
        accountNumber: r.account_number,
        instructions: r.instructions,
        isActive: Boolean(r.is_active),
        sortOrder: r.sort_order,
        updatedAt: r.updated_at,
      }));
    res.json({
      depositMethods: rows.filter((r) => r.kind === 'deposit'),
      payoutMethods: rows.filter((r) => r.kind === 'payout'),
    });
  });

  router.get('/deposits', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.authUser!.id)
      .map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        paymentMethodId: d.payment_method_id,
        methodName: d.method_name,
        accountNumberSnapshot: d.account_number_snapshot,
        amount: d.amount,
        txReference: d.tx_reference,
        hasReceipt: Boolean(d.receipt_path),
        receiptMime: d.receipt_mime,
        status: d.status,
        rejectionReason: d.rejection_reason,
        reviewedAt: d.reviewed_at,
        createdAt: d.created_at,
      }));
    res.json({ deposits: rows });
  });

  router.post(
    '/deposits',
    requireAuth,
    requireLiveFinance,
    (req: AuthenticatedRequest, res, next) => {
      upload.single('receipt')(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || 'Receipt upload failed.' });
          return;
        }
        next();
      });
    },
    (req: AuthenticatedRequest, res) => {
      const { amount, paymentMethodId, txReference } = req.body || {};
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 10) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Enter a valid deposit amount (minimum Br 10).' });
        return;
      }

      const cleanRef = typeof txReference === 'string' ? txReference.trim() : '';
      if (cleanRef.length < 4) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Please provide your CBE transaction reference / short code (min 4 chars).' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'Please upload your payment receipt image or PDF.' });
        return;
      }

      const method = db
        .prepare("SELECT * FROM payment_methods WHERE id = ? AND kind = 'deposit' AND is_active = 1")
        .get(String(paymentMethodId || 'pm_cbe_deposit')) as any;

      if (!method) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'Selected deposit payment method is unavailable.' });
        return;
      }

      const dupRef = db
        .prepare("SELECT id FROM deposits WHERE payment_method_id = ? AND LOWER(tx_reference) = LOWER(?) AND status != 'rejected'")
        .get(method.id, cleanRef);
      if (dupRef) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(409).json({ error: 'This transaction reference has already been submitted.' });
        return;
      }

      const depositId = `dep_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO deposits (id, user_id, payment_method_id, method_name, account_number_snapshot, amount, tx_reference, receipt_path, receipt_mime, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        depositId,
        req.authUser!.id,
        method.id,
        method.name,
        method.account_number,
        Math.round(parsedAmount * 100) / 100,
        cleanRef,
        req.file.filename,
        req.file.mimetype,
        now
      );

      res.status(201).json({
        ok: true,
        depositId,
        message: 'Deposit request submitted to Admin Dashboard for verification. Your wallet will be credited only after approval.',
      });
    }
  );

  // Payout Account Management (CBE ONLY)
  router.get('/payout-account', requireAuth, (req: AuthenticatedRequest, res) => {
    const account = db
      .prepare('SELECT * FROM payout_accounts WHERE user_id = ?')
      .get(req.authUser!.id) as any;

    const changeRequests = db
      .prepare('SELECT * FROM payout_change_requests WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.authUser!.id)
      .map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        reason: r.reason,
        newMethodName: r.new_method_name,
        newAccountNumber: r.new_account_number,
        newAccountOwnerName: r.new_account_owner_name,
        status: r.status,
        adminNote: r.admin_note,
        createdAt: r.created_at,
      }));

    res.json({
      account: account
        ? {
            id: account.id,
            userId: account.user_id,
            methodName: account.method_name,
            accountNumber: account.account_number,
            maskedAccountNumber: maskBankAccount(account.account_number),
            accountOwnerName: account.account_owner_name,
            status: account.status,
            isLocked: Boolean(account.is_locked),
            reviewNote: account.review_note,
            updatedAt: account.updated_at,
          }
        : null,
      changeRequests,
    });
  });

  router.post('/payout-account', requireAuth, (req: AuthenticatedRequest, res) => {
    const { accountNumber, accountOwnerName, methodId } = req.body || {};
    const activePayoutMethod = methodId
      ? (db
          .prepare("SELECT * FROM payment_methods WHERE id = ? AND kind = 'payout' AND is_active = 1")
          .get(String(methodId)) as any)
      : (db
          .prepare("SELECT * FROM payment_methods WHERE kind = 'payout' AND is_active = 1 ORDER BY sort_order ASC LIMIT 1")
          .get() as any);

    if (!activePayoutMethod) {
      res.status(400).json({ error: 'Payout setup is temporarily unavailable because no active payout method is enabled.' });
      return;
    }

    const cleanAcct = typeof accountNumber === 'string' ? accountNumber.replace(/\s+/g, '') : '';
    const cleanOwner = typeof accountOwnerName === 'string' ? accountOwnerName.trim() : '';

    if (!/^\d{6,24}$/.test(cleanAcct)) {
      res.status(400).json({ error: 'Enter a valid payout account number (6 to 24 digits).' });
      return;
    }
    if (cleanOwner.length < 3) {
      res.status(400).json({ error: 'Enter the full account holder name.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, is_locked FROM payout_accounts WHERE user_id = ?')
      .get(req.authUser!.id) as { id: string; is_locked: number } | undefined;

    if (existing && existing.is_locked) {
      res.status(403).json({
        error: 'Your saved payout account is locked. Submit an "I need to change my account" request for Admin approval.',
      });
      return;
    }

    const now = new Date().toISOString();
    if (existing) {
      db.prepare(
        `UPDATE payout_accounts
         SET method_name = ?, account_number = ?, account_owner_name = ?, status = 'pending', is_locked = 1, review_note = NULL, updated_at = ?
         WHERE id = ?`
      ).run(activePayoutMethod.name, cleanAcct, cleanOwner, now, existing.id);
    } else {
      db.prepare(
        `INSERT INTO payout_accounts (id, user_id, method_name, account_number, account_owner_name, status, is_locked, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 1, ?)`
      ).run(`pay_${crypto.randomUUID()}`, req.authUser!.id, activePayoutMethod.name, cleanAcct, cleanOwner, now);
    }

    res.status(201).json({
      ok: true,
      message: `${activePayoutMethod.name} payout account saved and locked. Submitted for Admin verification before withdrawal.`,
    });
  });

  router.post('/payout-account/change-request', requireAuth, (req: AuthenticatedRequest, res) => {
    const { reason, newAccountNumber, newAccountOwnerName, newMethodId } = req.body || {};
    const existing = db
      .prepare('SELECT * FROM payout_accounts WHERE user_id = ?')
      .get(req.authUser!.id) as any;

    if (!existing) {
      res.status(400).json({ error: 'Save an initial payout account before requesting a change.' });
      return;
    }

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    const cleanAcct = typeof newAccountNumber === 'string' ? newAccountNumber.replace(/\s+/g, '') : '';
    const cleanOwner = typeof newAccountOwnerName === 'string' ? newAccountOwnerName.trim() : '';

    if (cleanReason.length < 5) {
      res.status(400).json({ error: 'Please explain why you need to change your payout account.' });
      return;
    }
    if (!/^\d{6,24}$/.test(cleanAcct) || cleanOwner.length < 3) {
      res.status(400).json({ error: 'Provide the new valid account number and account holder name.' });
      return;
    }

    const pending = db
      .prepare("SELECT 1 FROM payout_change_requests WHERE user_id = ? AND status = 'pending'")
      .get(req.authUser!.id);
    if (pending) {
      res.status(409).json({ error: 'You already have a pending account change request.' });
      return;
    }

    const activePayoutMethod = newMethodId
      ? (db
          .prepare("SELECT name FROM payment_methods WHERE id = ? AND kind = 'payout' AND is_active = 1")
          .get(String(newMethodId)) as { name: string } | undefined)
      : (db
          .prepare("SELECT name FROM payment_methods WHERE kind = 'payout' AND is_active = 1 ORDER BY sort_order ASC LIMIT 1")
          .get() as { name: string } | undefined);

    if (!activePayoutMethod) {
      res.status(400).json({ error: 'No active payout method is enabled.' });
      return;
    }

    db.prepare(
      `INSERT INTO payout_change_requests (id, user_id, reason, new_method_name, new_account_number, new_account_owner_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      `pcr_${crypto.randomUUID()}`,
      req.authUser!.id,
      cleanReason,
      activePayoutMethod.name,
      cleanAcct,
      cleanOwner,
      new Date().toISOString()
    );

    res.status(201).json({ ok: true, message: 'Account change request sent to Admin for review.' });
  });

  // Withdrawals (Active Payout Method Required, Atomic Reserve)
  router.get('/withdrawals', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.authUser!.id)
      .map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        methodName: w.method_name,
        accountNumberSnapshot: w.account_number_snapshot,
        maskedAccountNumber: maskBankAccount(w.account_number_snapshot),
        accountOwnerSnapshot: w.account_owner_snapshot,
        grossAmount: w.gross_amount,
        feeAmount: w.fee_amount,
        netAmount: w.net_amount,
        status: w.status,
        providerReference: w.provider_reference,
        rejectionReason: w.rejection_reason,
        reviewedAt: w.reviewed_at,
        processedAt: w.processed_at || null,
        completedAt: w.completed_at || null,
        createdAt: w.created_at,
      }));
    res.json({ withdrawals: rows });
  });

  router.post('/withdrawals', requireAuth, requireLiveFinance, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const settings = getPlatformSettings();

    const activePayout = db
      .prepare("SELECT * FROM payment_methods WHERE kind = 'payout' AND is_active = 1 ORDER BY sort_order ASC LIMIT 1")
      .get() as any;
    if (!activePayout) {
      res.status(400).json({ error: 'Withdrawals are temporarily unavailable. No payout method is active.' });
      return;
    }

    const payoutAccount = db
      .prepare('SELECT * FROM payout_accounts WHERE user_id = ?')
      .get(userId) as any;

    if (!payoutAccount) {
      res.status(400).json({ error: 'Please save your payout account under Bank Account Management before withdrawing.' });
      return;
    }

    if (payoutAccount.status !== 'approved') {
      res.status(400).json({
        error:
          payoutAccount.status === 'rejected'
            ? 'Your saved payout account was rejected. Submit an account change request before withdrawing.'
            : 'Your saved payout account is pending Admin approval. Withdrawal requires an approved account.',
      });
      return;
    }

    const grossInput = Number(req.body?.amount);
    const balances = getUserBalances(userId);
    const breakdown = calculateWithdrawalBreakdown(
      grossInput,
      balances.availableBalance,
      settings.minWithdrawal,
      settings.withdrawalFeePercent
    );

    if (!breakdown.isValid) {
      res.status(400).json({ error: breakdown.error });
      return;
    }

    const withdrawalId = `wdr_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      const freshBal = getUserBalances(userId);
      if (freshBal.availableBalance < breakdown.grossAmount) {
        throw new Error('Insufficient available balance.');
      }

      db.prepare(
        `INSERT INTO withdrawals (id, user_id, payout_account_id, method_name, account_number_snapshot, account_owner_snapshot, gross_amount, fee_amount, net_amount, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        withdrawalId,
        userId,
        payoutAccount.id,
        payoutAccount.method_name || activePayout.name,
        payoutAccount.account_number,
        payoutAccount.account_owner_name,
        breakdown.grossAmount,
        breakdown.feeAmount,
        breakdown.netAmount,
        now
      );

      db.prepare(
        `INSERT INTO ledger_entries (id, user_id, type, amount_signed, reserved_delta, balance_after, status, reference_id, note, idempotency_key, created_at)
         VALUES (?, ?, 'withdrawal_reserve', ?, ?, ?, 'posted', ?, ?, ?, ?)`
      ).run(
        `ldg_${crypto.randomUUID()}`,
        userId,
        -breakdown.grossAmount,
        breakdown.grossAmount,
        freshBal.availableBalance - breakdown.grossAmount,
        withdrawalId,
        `Reserved for withdrawal ${withdrawalId}`,
        `wdr_reserve:${withdrawalId}`,
        now
      );
    });

    try {
      tx();
      res.status(201).json({
        ok: true,
        withdrawalId,
        breakdown,
        message: 'Withdrawal request submitted to Admin Dashboard for manual processing.',
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Withdrawal request failed.' });
    }
  });

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS, BROADCAST MEDIA & CUSTOMER SERVICE TICKETS
  // ---------------------------------------------------------------------------
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 80')
      .all(req.authUser!.id)
      .map((n: any) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        kind: n.kind,
        actionUrl: n.action_url,
        imageUrl: n.image_url || null,
        broadcastId: n.broadcast_id || null,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      }));
    res.json({ notifications: rows });
  });

  router.get('/broadcasts/:id/image', requireAuth, (req: AuthenticatedRequest, res) => {
    const broadcast = db
      .prepare('SELECT id, image_path, image_mime, target_type, target_user_id FROM broadcasts WHERE id = ?')
      .get(req.params.id) as
      | { id: string; image_path: string | null; image_mime: string | null; target_type: string; target_user_id: string | null }
      | undefined;

    if (!broadcast || !broadcast.image_path) {
      res.status(404).json({ error: 'Broadcast image not found.' });
      return;
    }

    const userIsAdmin = isAdminRole(req.authUser!.role);
    if (!userIsAdmin) {
      const hasNotice = db
        .prepare('SELECT 1 FROM notifications WHERE user_id = ? AND broadcast_id = ? LIMIT 1')
        .get(req.authUser!.id, broadcast.id);
      if (!hasNotice && !(broadcast.target_type === 'all') && broadcast.target_user_id !== req.authUser!.id) {
        res.status(403).json({ error: 'Forbidden.' });
        return;
      }
    }

    const fullPath = path.join(uploadDir, path.basename(broadcast.image_path));
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Image file not found on server.' });
      return;
    }

    res.type(broadcast.image_mime || 'image/png');
    res.sendFile(fullPath);
  });

  router.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.authUser!.id
    );
    res.json({ ok: true });
  });

  router.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.authUser!.id);
    res.json({ ok: true });
  });

  router.get('/support/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const tickets = db
      .prepare('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC')
      .all(req.authUser!.id)
      .map((t: any) => {
        const msgs = db
          .prepare(
            `SELECT m.id, m.sender_role, u.nickname, u.role as user_role, u.full_name as sender_name, m.message, m.created_at
             FROM support_messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.ticket_id = ? ORDER BY m.created_at ASC`
          )
          .all(t.id)
          .map((m: any) => ({
            id: m.id,
            senderRole: m.sender_role,
            senderName: getCustomerDisplayName({
              nickname: m.nickname,
              fullName: m.sender_name,
              role: m.user_role,
            }),
            message: m.message,
            createdAt: m.created_at,
          }));
        return {
          id: t.id,
          userId: t.user_id,
          category: t.category,
          subject: t.subject,
          message: t.message,
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          messages: msgs,
        };
      });
    res.json({ tickets });
  });

  router.post('/support/tickets', requireAuth, (req: AuthenticatedRequest, res) => {
    const { category, subject, message } = req.body || {};
    if (!subject || String(subject).trim().length < 3 || !message || String(message).trim().length < 5) {
      res.status(400).json({ error: 'Please provide a subject and detailed message.' });
      return;
    }

    const ticketId = `tkt_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO support_tickets (id, user_id, category, subject, message, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
      ).run(
        ticketId,
        req.authUser!.id,
        String(category || 'general'),
        String(subject).trim(),
        String(message).trim(),
        now,
        now
      );

      db.prepare(
        `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message, created_at)
         VALUES (?, ?, ?, 'customer', ?, ?)`
      ).run(`msg_${crypto.randomUUID()}`, ticketId, req.authUser!.id, String(message).trim(), now);
    });
    tx();
    res.status(201).json({ ok: true, ticketId });
  });

  router.post('/support/tickets/:id/reply', requireAuth, (req: AuthenticatedRequest, res) => {
    const { message } = req.body || {};
    if (!message || String(message).trim().length < 2) {
      res.status(400).json({ error: 'Reply message cannot be empty.' });
      return;
    }
    const ticket = db
      .prepare('SELECT id FROM support_tickets WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.authUser!.id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message, created_at)
       VALUES (?, ?, ?, 'customer', ?, ?)`
    ).run(`msg_${crypto.randomUUID()}`, req.params.id, req.authUser!.id, String(message).trim(), now);
    db.prepare('UPDATE support_tickets SET updated_at = ? WHERE id = ?').run(now, req.params.id);
    res.status(201).json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // ADMIN REGISTRATION DISABLED (PROVISIONED VIA SERVER ENV SECRETS)
  // ---------------------------------------------------------------------------
  router.post('/admin/setup', (_req, res) => {
    res.status(403).json({ error: 'Public admin registration is disabled.' });
  });

  // ---------------------------------------------------------------------------
  // PROTECTED ADMIN DASHBOARD ROUTES (RBAC + AUDIT LOGGED)
  // ---------------------------------------------------------------------------
  router.get('/admin/overview', requireAuth, requireAdminRole(ADMIN_ROLES), (req, res) => {
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : '1970-01-01';
    const toDate = typeof req.query.to === 'string' && req.query.to ? `${req.query.to}T23:59:59.999Z` : '2999-12-31';

    const totalUsers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND created_at BETWEEN ? AND ?").get(fromDate, toDate) as { c: number }
    ).c;
    const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const activeSessionsCount = (
      db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM sessions WHERE expires_at > ?').get(new Date().toISOString()) as { c: number }
    ).c;
    const recentlyActiveUsers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer' AND last_active_at >= ?").get(recentCutoff) as { c: number }
    ).c;
    const pendingDeposits = (
      db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s FROM deposits WHERE status = 'pending'").get() as {
        c: number;
        s: number;
      }
    );
    const approvedDepositsTotal = (
      db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM deposits WHERE status = 'approved' AND created_at BETWEEN ? AND ?").get(fromDate, toDate) as {
        s: number;
      }
    ).s;
    const pendingWithdrawals = (
      db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(gross_amount), 0) as s FROM withdrawals WHERE status = 'pending'").get() as {
        c: number;
        s: number;
      }
    );
    const approvedWithdrawalsTotal = (
      db.prepare("SELECT COALESCE(SUM(net_amount), 0) as s FROM withdrawals WHERE status IN ('approved','processed','completed') AND created_at BETWEEN ? AND ?").get(fromDate, toDate) as {
        s: number;
      }
    ).s;
    const completedWithdrawalsCount = (
      db.prepare("SELECT COUNT(*) as c FROM withdrawals WHERE status IN ('processed','completed') AND created_at BETWEEN ? AND ?").get(fromDate, toDate) as {
        c: number;
      }
    ).c;
    const openTickets = (
      db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status NOT IN ('resolved','closed')").get() as { c: number }
    ).c;
    const unreadTickets = (
      db.prepare('SELECT COUNT(*) as c FROM support_tickets WHERE is_read_by_admin = 0').get() as { c: number }
    ).c;
    const pendingPayoutAccounts = (
      db.prepare("SELECT COUNT(*) as c FROM payout_accounts WHERE status = 'pending'").get() as { c: number }
    ).c;
    const verifiedProductSales = (
      db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s FROM plan_purchases').get() as {
        c: number;
        s: number;
      }
    );
    const totalBroadcasts = (
      db.prepare('SELECT COUNT(*) as c FROM broadcasts').get() as { c: number }
    ).c;

    res.json({
      totalUsers,
      recentlyActiveUsers,
      activeSessionsCount,
      pendingDepositsCount: pendingDeposits.c,
      pendingDepositsAmount: pendingDeposits.s,
      approvedDepositsTotal,
      pendingWithdrawalsCount: pendingWithdrawals.c,
      pendingWithdrawalsAmount: pendingWithdrawals.s,
      approvedWithdrawalsTotal,
      completedWithdrawalsCount,
      openTickets,
      unreadTickets,
      pendingPayoutAccounts,
      verifiedSalesCount: verifiedProductSales.c,
      verifiedSalesVolume: verifiedProductSales.s,
      totalBroadcasts,
    });
  });

  // Deposits Queue + Receipt Viewer + Approve/Reject
  router.get(
    '/admin/deposits',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'viewer']),
    (req: AuthenticatedRequest, res) => {
      const canViewPhone = req.authUser!.role === 'owner_admin' || req.authUser!.role === 'finance_admin';
      const rows = db
        .prepare(
          `SELECT d.*, u.full_name as customer_name, u.phone as customer_phone
           FROM deposits d
           JOIN users u ON u.id = d.user_id
           ORDER BY CASE WHEN d.status = 'pending' THEN 0 ELSE 1 END, d.created_at DESC`
        )
        .all()
        .map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          customerName: d.customer_name,
          customerPhone: canViewPhone ? d.customer_phone : maskPhoneNumber(d.customer_phone),
          paymentMethodId: d.payment_method_id,
          methodName: d.method_name,
          accountNumberSnapshot: d.account_number_snapshot,
          amount: d.amount,
          txReference: d.tx_reference,
          hasReceipt: Boolean(d.receipt_path),
          receiptMime: d.receipt_mime,
          status: d.status,
          rejectionReason: d.rejection_reason,
          reviewedAt: d.reviewed_at,
          createdAt: d.created_at,
        }));
      res.json({ deposits: rows });
    }
  );

  router.get(
    '/admin/deposits/:id/receipt',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      const dep = db
        .prepare('SELECT receipt_path, receipt_mime FROM deposits WHERE id = ?')
        .get(req.params.id) as { receipt_path: string; receipt_mime: string } | undefined;
      if (!dep) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      const fullPath = path.join(uploadDir, path.basename(dep.receipt_path));
      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Receipt file not found on server.' });
        return;
      }
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'view_deposit_receipt', 'deposit', req.params.id);
      res.type(dep.receipt_mime || 'application/octet-stream');
      res.sendFile(fullPath);
    }
  );

  router.post(
    '/admin/deposits/:id/approve',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    requireLiveFinance,
    (req: AuthenticatedRequest, res) => {
      const dep = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id) as any;
      if (!dep) {
        res.status(404).json({ error: 'Deposit request not found.' });
        return;
      }
      if (dep.status !== 'pending') {
        res.status(409).json({ error: `Deposit is already ${dep.status}.` });
        return;
      }

      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        const updated = db
          .prepare("UPDATE deposits SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
          .run(req.authUser!.id, now, dep.id);
        if (updated.changes !== 1) {
          throw new Error('Deposit already processed.');
        }

        const current = getUserBalances(dep.user_id);
        const newBal = Math.round((current.availableBalance + dep.amount) * 100) / 100;
        db.prepare(
          `INSERT INTO ledger_entries (id, user_id, type, amount_signed, balance_after, status, reference_id, note, idempotency_key, created_at)
           VALUES (?, ?, 'deposit_credit', ?, ?, 'posted', ?, ?, ?, ?)`
        ).run(
          `ldg_${crypto.randomUUID()}`,
          dep.user_id,
          dep.amount,
          newBal,
          dep.id,
          `Approved CBE deposit (${dep.tx_reference})`,
          `dep_approve:${dep.id}`,
          now
        );

        createNotification(
          dep.user_id,
          'Deposit Approved',
          `Your deposit of Br ${dep.amount.toLocaleString()} (Ref: ${dep.tx_reference}) has been approved and credited to your wallet.`,
          'deposit_approved',
          '/recharge'
        );

        logAdminAudit(req.authUser!.id, req.authUser!.role, 'approve_deposit', 'deposit', dep.id, {
          userId: dep.user_id,
          amount: dep.amount,
          txReference: dep.tx_reference,
        });
      });

      try {
        tx();
        res.json({ ok: true });
      } catch (err: any) {
        res.status(409).json({ error: err?.message || 'Could not approve deposit.' });
      }
    }
  );

  router.post(
    '/admin/deposits/:id/reject',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    requireLiveFinance,
    (req: AuthenticatedRequest, res) => {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (reason.length < 3) {
        res.status(400).json({ error: 'A clear rejection reason is required.' });
        return;
      }

      const dep = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id) as any;
      if (!dep) {
        res.status(404).json({ error: 'Deposit not found.' });
        return;
      }
      if (dep.status !== 'pending') {
        res.status(409).json({ error: `Deposit is already ${dep.status}.` });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        "UPDATE deposits SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'"
      ).run(reason, req.authUser!.id, now, dep.id);

      createNotification(
        dep.user_id,
        'Deposit Rejected',
        `Your deposit of Br ${dep.amount.toLocaleString()} (Ref: ${dep.tx_reference}) was rejected. Reason: ${reason}`,
        'deposit_rejected',
        '/recharge'
      );

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'reject_deposit', 'deposit', dep.id, {
        userId: dep.user_id,
        amount: dep.amount,
        reason,
      });

      res.json({ ok: true });
    }
  );

  // Withdrawals Queue + Approve / Mark Processed or Completed / Reject
  router.get(
    '/admin/withdrawals',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'viewer']),
    (req: AuthenticatedRequest, res) => {
      const canSeeFullAcct = req.authUser!.role === 'owner_admin' || req.authUser!.role === 'finance_admin';
      const rows = db
        .prepare(
          `SELECT w.*, u.full_name as customer_name, u.phone as customer_phone
           FROM withdrawals w
           JOIN users u ON u.id = w.user_id
           ORDER BY CASE
             WHEN w.status = 'pending' THEN 0
             WHEN w.status = 'approved' THEN 1
             WHEN w.status = 'processed' THEN 2
             ELSE 3
           END, w.created_at DESC`
        )
        .all()
        .map((w: any) => ({
          id: w.id,
          userId: w.user_id,
          customerName: w.customer_name,
          customerPhone: canSeeFullAcct ? w.customer_phone : maskPhoneNumber(w.customer_phone),
          methodName: w.method_name,
          accountNumberSnapshot: canSeeFullAcct ? w.account_number_snapshot : maskBankAccount(w.account_number_snapshot),
          maskedAccountNumber: maskBankAccount(w.account_number_snapshot),
          accountOwnerSnapshot: w.account_owner_snapshot,
          grossAmount: w.gross_amount,
          feeAmount: w.fee_amount,
          netAmount: w.net_amount,
          status: w.status,
          providerReference: w.provider_reference,
          rejectionReason: w.rejection_reason,
          reviewedAt: w.reviewed_at,
          processedAt: w.processed_at || null,
          completedAt: w.completed_at || null,
          createdAt: w.created_at,
        }));
      res.json({ withdrawals: rows });
    }
  );

  router.post(
    '/admin/withdrawals/:id/approve',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    requireLiveFinance,
    (req: AuthenticatedRequest, res) => {
      const wdr = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id) as any;
      if (!wdr) {
        res.status(404).json({ error: 'Withdrawal request not found.' });
        return;
      }
      if (wdr.status !== 'pending') {
        res.status(409).json({ error: 'Withdrawal is already ' + wdr.status + '.' });
        return;
      }

      // Approval authorizes a manual bank transfer only. Funds stay reserved
      // until the actual bank reference is recorded as completed.
      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        const upd = db.prepare(
          "UPDATE withdrawals SET status = 'approved', provider_reference = NULL, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'"
        ).run(req.authUser!.id, now, wdr.id);
        if (upd.changes !== 1) throw new Error('Withdrawal already reviewed.');

        createNotification(
          wdr.user_id,
          'Withdrawal Approved',
          'Your ' + wdr.method_name + ' withdrawal of Br ' + wdr.gross_amount.toLocaleString() +
            ' (Net: Br ' + wdr.net_amount.toLocaleString() +
            ') has been approved. The Admin will make the bank transfer manually. Funds remain reserved until the transfer is recorded as completed.',
          'withdrawal_approved',
          '/withdraw'
        );
        logAdminAudit(req.authUser!.id, req.authUser!.role, 'approve_withdrawal', 'withdrawal', wdr.id, {
          userId: wdr.user_id,
          grossAmount: wdr.gross_amount,
          netAmount: wdr.net_amount,
          transferMethod: 'manual_bank_transfer',
          fundsRemainReserved: true,
        });
      });
      try {
        tx();
        res.json({ ok: true, fundsRemainReserved: true });
      } catch (err: any) {
        res.status(409).json({ error: err?.message || 'Could not approve withdrawal.' });
      }
    }
  );

  router.post(
    '/admin/withdrawals/:id/complete',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    requireLiveFinance,
    (req: AuthenticatedRequest, res) => {
      const targetStatus = req.body?.status === 'processed' ? 'processed' : 'completed';
      const wdr = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id) as any;
      if (!wdr) {
        res.status(404).json({ error: 'Withdrawal request not found.' });
        return;
      }
      if (wdr.status === 'rejected') {
        res.status(409).json({ error: 'Rejected withdrawals cannot be marked processed or completed.' });
        return;
      }
      if (wdr.status === 'pending') {
        res.status(409).json({ error: 'Approve the withdrawal request first before marking it processed or completed.' });
        return;
      }
      if (wdr.status === 'completed') {
        res.status(409).json({ error: 'Withdrawal is already marked completed.' });
        return;
      }
      if (wdr.status === 'processed' && targetStatus === 'processed') {
        res.status(409).json({ error: 'Withdrawal is already marked processed.' });
        return;
      }

      const bankReference = typeof req.body?.providerReference === 'string'
        ? req.body.providerReference.trim()
        : '';
      if (!bankReference) {
        res.status(400).json({ error: 'Enter the actual bank transfer reference after making the manual bank transfer.' });
        return;
      }

      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        if (targetStatus === 'processed') {
          const updated = db.prepare(
            "UPDATE withdrawals SET status = 'processed', provider_reference = ?, processed_at = ? WHERE id = ? AND status = 'approved'"
          ).run(bankReference, now, wdr.id);
          if (updated.changes !== 1) throw new Error('Withdrawal status changed. Refresh and try again.');
        } else {
          const updated = db.prepare(
            "UPDATE withdrawals SET status = 'completed', provider_reference = ?, processed_at = COALESCE(processed_at, ?), completed_at = ?, completed_by = ? WHERE id = ? AND status IN ('approved', 'processed')"
          ).run(bankReference, now, now, req.authUser!.id, wdr.id);
          if (updated.changes !== 1) throw new Error('Withdrawal status changed. Refresh and try again.');

          const current = getUserBalances(wdr.user_id);
          db.prepare(
            "INSERT INTO ledger_entries (id, user_id, type, amount_signed, reserved_delta, balance_after, status, reference_id, note, idempotency_key, created_at) " +
            "VALUES (?, ?, 'withdrawal_settle', 0, ?, ?, 'posted', ?, ?, ?, ?)"
          ).run(
            'ldg_' + crypto.randomUUID(),
            wdr.user_id,
            -wdr.gross_amount,
            current.availableBalance,
            wdr.id,
            'Manual bank transfer completed (' + wdr.method_name + ', bank reference: ' + bankReference + ')',
            'wdr_settle:' + wdr.id,
            now
          );
        }

        createNotification(
          wdr.user_id,
          targetStatus === 'processed' ? 'Withdrawal Processing Update' : 'Withdrawal Completed',
          targetStatus === 'processed'
            ? 'Your withdrawal of Br ' + wdr.net_amount.toLocaleString() + ' net payout (' + wdr.method_name + ') is being processed manually. Bank Ref: ' + bankReference
            : 'Your withdrawal of Br ' + wdr.net_amount.toLocaleString() + ' net payout (' + wdr.method_name + ') has been marked completed. Bank Ref: ' + bankReference,
          'withdrawal_' + targetStatus,
          '/withdraw'
        );
        logAdminAudit(req.authUser!.id, req.authUser!.role, 'mark_withdrawal_' + targetStatus, 'withdrawal', wdr.id, {
          userId: wdr.user_id,
          bankReference,
          transferMethod: 'manual_bank_transfer',
        });
      });

      try {
        tx();
        res.json({ ok: true, status: targetStatus });
      } catch (err: any) {
        res.status(409).json({ error: err?.message || 'Could not update withdrawal status.' });
      }
    }
  );

  router.post(
    '/admin/withdrawals/:id/reject',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    requireLiveFinance,
    (req: AuthenticatedRequest, res) => {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (reason.length < 3) {
        res.status(400).json({ error: 'Rejection reason is required.' });
        return;
      }

      const wdr = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id) as any;
      if (!wdr) {
        res.status(404).json({ error: 'Withdrawal request not found.' });
        return;
      }
      if (wdr.status !== 'pending') {
        res.status(409).json({ error: `Withdrawal is already ${wdr.status}.` });
        return;
      }

      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        const upd = db
          .prepare(
            "UPDATE withdrawals SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'"
          )
          .run(reason, req.authUser!.id, now, wdr.id);
        if (upd.changes !== 1) {
          throw new Error('Withdrawal already reviewed.');
        }

        const current = getUserBalances(wdr.user_id);
        db.prepare(
          `INSERT INTO ledger_entries (id, user_id, type, amount_signed, reserved_delta, balance_after, status, reference_id, note, idempotency_key, created_at)
           VALUES (?, ?, 'withdrawal_release', ?, ?, ?, 'posted', ?, ?, ?, ?)`
        ).run(
          `ldg_${crypto.randomUUID()}`,
          wdr.user_id,
          wdr.gross_amount,
          -wdr.gross_amount,
          current.availableBalance + wdr.gross_amount,
          wdr.id,
          `Released reserved funds from rejected withdrawal (${reason})`,
          `wdr_reject:${wdr.id}`,
          now
        );

        createNotification(
          wdr.user_id,
          'Withdrawal Rejected',
          `Your withdrawal of Br ${wdr.gross_amount.toLocaleString()} was rejected and funds returned to your available balance. Reason: ${reason}`,
          'withdrawal_rejected',
          '/withdraw'
        );

        logAdminAudit(req.authUser!.id, req.authUser!.role, 'reject_withdrawal', 'withdrawal', wdr.id, {
          userId: wdr.user_id,
          grossAmount: wdr.gross_amount,
          reason,
        });
      });
      try {
        tx();
        res.json({ ok: true });
      } catch (err: any) {
        res.status(409).json({ error: err?.message || 'Could not reject withdrawal.' });
      }
    }
  );

  // Payout Accounts & Change Requests Approval
  router.get(
    '/admin/payout-accounts',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'viewer']),
    (req: AuthenticatedRequest, res) => {
      const canSeePhone = req.authUser!.role !== 'viewer';
      const accounts = db
        .prepare(
          `SELECT p.*, u.full_name as customer_name, u.phone as customer_phone
           FROM payout_accounts p
           JOIN users u ON u.id = p.user_id
           ORDER BY CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END, p.updated_at DESC`
        )
        .all()
        .map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          customerName: a.customer_name,
          customerPhone: canSeePhone ? a.customer_phone : maskPhoneNumber(a.customer_phone),
          methodName: a.method_name,
          accountNumber: a.account_number,
          accountOwnerName: a.account_owner_name,
          status: a.status,
          isLocked: Boolean(a.is_locked),
          reviewNote: a.review_note,
          updatedAt: a.updated_at,
        }));

      const changeRequests = db
        .prepare(
          `SELECT r.*, u.full_name as customer_name, u.phone as customer_phone
           FROM payout_change_requests r
           JOIN users u ON u.id = r.user_id
           ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC`
        )
        .all()
        .map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          customerName: r.customer_name,
          customerPhone: canSeePhone ? r.customer_phone : maskPhoneNumber(r.customer_phone),
          reason: r.reason,
          newMethodName: r.new_method_name,
          newAccountNumber: r.new_account_number,
          newAccountOwnerName: r.new_account_owner_name,
          status: r.status,
          adminNote: r.admin_note,
          createdAt: r.created_at,
        }));

      res.json({ accounts, changeRequests });
    }
  );

  router.post(
    '/admin/payout-accounts/:id/review',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      const { status, note } = req.body || {};
      if (status !== 'approved' && status !== 'rejected') {
        res.status(400).json({ error: 'Status must be approved or rejected.' });
        return;
      }
      if (status === 'rejected' && (!note || String(note).trim().length < 3)) {
        res.status(400).json({ error: 'Provide an explanation when rejecting a payout account.' });
        return;
      }

      const acct = db.prepare('SELECT * FROM payout_accounts WHERE id = ?').get(req.params.id) as any;
      if (!acct) {
        res.status(404).json({ error: 'Payout account not found.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE payout_accounts SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
      ).run(status, note ? String(note).trim() : null, req.authUser!.id, now, now, acct.id);

      createNotification(
        acct.user_id,
        status === 'approved' ? 'Payout Account Approved' : 'Payout Account Rejected',
        status === 'approved'
          ? `Your ${acct.method_name} account (${maskBankAccount(acct.account_number)}) is approved for withdrawals.`
          : `Your ${acct.method_name} account (${maskBankAccount(acct.account_number)}) was rejected. Note: ${note}`,
        'payout_account_review',
        '/my/bank-account'
      );

      logAdminAudit(req.authUser!.id, req.authUser!.role, `payout_account_${status}`, 'payout_account', acct.id, {
        userId: acct.user_id,
        note,
      });

      res.json({ ok: true });
    }
  );

  router.post(
    '/admin/payout-change-requests/:id/review',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      const { status, note } = req.body || {};
      if (status !== 'approved' && status !== 'rejected') {
        res.status(400).json({ error: 'Status must be approved or rejected.' });
        return;
      }

      const cr = db.prepare('SELECT * FROM payout_change_requests WHERE id = ?').get(req.params.id) as any;
      if (!cr || cr.status !== 'pending') {
        res.status(404).json({ error: 'Pending change request not found.' });
        return;
      }

      const now = new Date().toISOString();
      const tx = db.transaction(() => {
        db.prepare(
          `UPDATE payout_change_requests SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`
        ).run(status, note ? String(note).trim() : null, req.authUser!.id, now, cr.id);

        if (status === 'approved') {
          db.prepare(
            `UPDATE payout_accounts
             SET method_name = ?, account_number = ?, account_owner_name = ?, status = 'approved', is_locked = 1, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
             WHERE user_id = ?`
          ).run(
            cr.new_method_name,
            cr.new_account_number,
            cr.new_account_owner_name,
            note || 'Approved via account change request',
            req.authUser!.id,
            now,
            now,
            cr.user_id
          );
        }

        createNotification(
          cr.user_id,
          status === 'approved' ? 'Account Change Approved' : 'Account Change Rejected',
          status === 'approved'
            ? `Your ${cr.new_method_name} account change to ${maskBankAccount(cr.new_account_number)} has been approved and locked.`
            : `Your payout account change request was rejected. Note: ${note || 'No reason provided.'}`,
          'payout_change_review',
          '/my/bank-account'
        );

        logAdminAudit(req.authUser!.id, req.authUser!.role, `payout_change_${status}`, 'payout_change_request', cr.id, {
          userId: cr.user_id,
          note,
        });
      });
      tx();
      res.json({ ok: true });
    }
  );

  // Payment Methods Admin Management
  router.get(
    '/admin/payment-methods',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'viewer']),
    (_req, res) => {
      const methods = db
        .prepare('SELECT * FROM payment_methods ORDER BY kind ASC, sort_order ASC')
        .all()
        .map((r: any) => ({
          id: r.id,
          kind: r.kind,
          name: r.name,
          accountName: r.account_name,
          accountNumber: r.account_number,
          instructions: r.instructions,
          isActive: Boolean(r.is_active),
          sortOrder: r.sort_order,
          updatedAt: r.updated_at,
        }));
      res.json({ methods });
    }
  );

  router.post(
    '/admin/payment-methods',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      const { kind, name, accountName, accountNumber, instructions, isActive } = req.body || {};
      if ((kind !== 'deposit' && kind !== 'payout') || !name || !accountNumber) {
        res.status(400).json({ error: 'Kind, method name, and account number are required.' });
        return;
      }
      const id = `pm_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO payment_methods (id, kind, name, account_name, account_number, instructions, is_active, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?)`
      ).run(
        id,
        kind,
        String(name).trim(),
        String(accountName || '').trim(),
        String(accountNumber).trim(),
        String(instructions || '').trim(),
        isActive === false ? 0 : 1,
        now
      );

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'create_payment_method', 'payment_method', id, {
        kind,
        name,
      });
      res.status(201).json({ ok: true, id });
    }
  );

  router.patch(
    '/admin/payment-methods/:id',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      const existing = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Payment method not found.' });
        return;
      }

      const { name, accountName, accountNumber, instructions, isActive } = req.body || {};
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE payment_methods
         SET name = ?, account_name = ?, account_number = ?, instructions = ?, is_active = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        name !== undefined ? String(name).trim() : existing.name,
        accountName !== undefined ? String(accountName).trim() : existing.account_name,
        accountNumber !== undefined ? String(accountNumber).trim() : existing.account_number,
        instructions !== undefined ? String(instructions).trim() : existing.instructions,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        now,
        existing.id
      );

      if (existing.kind === 'payout') {
        const usersWithAccts = db.prepare('SELECT DISTINCT user_id FROM payout_accounts').all() as Array<{
          user_id: string;
        }>;
        for (const u of usersWithAccts) {
          createNotification(
            u.user_id,
            'Payout Method Updated',
            'Administrator updated payout payment method settings. Please review your saved CBE payout details.',
            'payment_method_update',
            '/my/bank-account'
          );
        }
      }

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'update_payment_method', 'payment_method', existing.id, req.body);
      res.json({ ok: true });
    }
  );

  router.delete(
    '/admin/payment-methods/:id',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin']),
    (req: AuthenticatedRequest, res) => {
      db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id);
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'delete_payment_method', 'payment_method', req.params.id);
      res.json({ ok: true });
    }
  );

  // Admin Customer Management (NO wallet balances or passwords exposed)
  router.get('/admin/users', requireAuth, requireAdminRole(ADMIN_ROLES), (req: AuthenticatedRequest, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const q = rawQ ? `%${rawQ}%` : '%';
    const rows = db
      .prepare(
        `SELECT u.id, u.full_name, u.nickname, u.phone, u.role, u.status, u.referral_code, u.invited_by_user_id, u.created_at, u.last_active_at,
                inv.referral_code as invited_by_code, inv.phone as invited_by_phone
         FROM users u
         LEFT JOIN users inv ON inv.id = u.invited_by_user_id
         WHERE u.role = 'customer'
           AND (u.phone LIKE ? OR u.referral_code LIKE ? OR u.full_name LIKE ? OR COALESCE(u.nickname, '') LIKE ?)
         ORDER BY u.created_at DESC LIMIT 300`
      )
      .all(q, q, q, q)
      .map((u: any) => {
        const purchases = (
          db.prepare('SELECT COUNT(*) as c FROM plan_purchases WHERE user_id = ?').get(u.id) as { c: number }
        ).c;
        const depositsCount = (
          db.prepare('SELECT COUNT(*) as c FROM deposits WHERE user_id = ?').get(u.id) as { c: number }
        ).c;
        const withdrawalsCount = (
          db.prepare('SELECT COUNT(*) as c FROM withdrawals WHERE user_id = ?').get(u.id) as { c: number }
        ).c;
        return {
          id: u.id,
          fullName: getCustomerDisplayName({ nickname: u.nickname, fullName: u.full_name, role: u.role }),
          nickname: u.nickname || null,
          phone: req.authUser!.role === 'viewer' ? maskPhoneNumber(u.phone) : u.phone,
          role: u.role,
          status: u.status,
          referralCode: u.referral_code,
          invitedByCode: u.invited_by_code || null,
          invitedByPhone: u.invited_by_phone
            ? req.authUser!.role === 'viewer'
              ? maskPhoneNumber(u.invited_by_phone)
              : u.invited_by_phone
            : null,
          purchasesCount: purchases,
          depositsCount,
          withdrawalsCount,
          createdAt: u.created_at,
          lastActiveAt: u.last_active_at,
        };
      });
    res.json({ users: rows });
  });

  // Full Customer Detail Profile for Admin (strictly excludes wallet balances, passwords, and secrets)
  router.get('/admin/customers/:id', requireAuth, requireAdminRole(ADMIN_ROLES), (req: AuthenticatedRequest, res) => {
    const canSeeFullPhone = req.authUser!.role !== 'viewer';
    const customer = db
      .prepare(
        `SELECT id, full_name, nickname, phone, role, status, referral_code, invited_by_user_id, created_at, last_active_at
         FROM users WHERE id = ? AND role = 'customer'`
      )
      .get(req.params.id) as any;

    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    let invitedBy: { id: string; phone: string; referralCode: string } | null = null;
    if (customer.invited_by_user_id) {
      const inv = db
        .prepare('SELECT id, phone, referral_code FROM users WHERE id = ?')
        .get(customer.invited_by_user_id) as { id: string; phone: string; referral_code: string } | undefined;
      if (inv) {
        invitedBy = {
          id: inv.id,
          phone: canSeeFullPhone ? inv.phone : maskPhoneNumber(inv.phone),
          referralCode: inv.referral_code,
        };
      }
    }

    const termsAcceptance = db
      .prepare('SELECT terms_version, accepted_at FROM terms_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1')
      .get(customer.id) as { terms_version: string; accepted_at: string } | undefined;

    // 3-Level team referral tree
    const fetchChildren = (parentIds: string[]) => {
      if (parentIds.length === 0) return [] as any[];
      return db
        .prepare(
          `SELECT id, phone, referral_code, status, created_at
           FROM users WHERE invited_by_user_id IN (${parentIds.map(() => '?').join(',')})
           ORDER BY created_at DESC`
        )
        .all(...parentIds) as any[];
    };

    const l1 = fetchChildren([customer.id]);
    const l2 = fetchChildren(l1.map((x) => x.id));
    const l3 = fetchChildren(l2.map((x) => x.id));
    const mapMember = (m: any, level: 1 | 2 | 3) => {
      const pCnt = (
        db.prepare('SELECT COUNT(*) as c FROM plan_purchases WHERE user_id = ?').get(m.id) as { c: number }
      ).c;
      return {
        id: m.id,
        level,
        phone: canSeeFullPhone ? m.phone : maskPhoneNumber(m.phone),
        referralCode: m.referral_code,
        status: m.status,
        qualified: pCnt > 0,
        registeredAt: m.created_at,
      };
    };
    const teamMembers = [
      ...l1.map((m) => mapMember(m, 1)),
      ...l2.map((m) => mapMember(m, 2)),
      ...l3.map((m) => mapMember(m, 3)),
    ];

    const deposits = db
      .prepare('SELECT id, method_name, account_number_snapshot, amount, tx_reference, status, rejection_reason, reviewed_at, created_at FROM deposits WHERE user_id = ? ORDER BY created_at DESC')
      .all(customer.id)
      .map((d: any) => ({
        id: d.id,
        methodName: d.method_name,
        accountNumberSnapshot: d.account_number_snapshot,
        amount: d.amount,
        txReference: d.tx_reference,
        status: d.status,
        rejectionReason: d.rejection_reason,
        reviewedAt: d.reviewed_at,
        createdAt: d.created_at,
      }));

    const withdrawals = db
      .prepare('SELECT id, method_name, account_number_snapshot, account_owner_snapshot, gross_amount, fee_amount, net_amount, status, provider_reference, rejection_reason, reviewed_at, processed_at, completed_at, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC')
      .all(customer.id)
      .map((w: any) => ({
        id: w.id,
        methodName: w.method_name,
        accountNumberSnapshot: canSeeFullPhone ? w.account_number_snapshot : maskBankAccount(w.account_number_snapshot),
        accountOwnerSnapshot: w.account_owner_snapshot,
        grossAmount: w.gross_amount,
        feeAmount: w.fee_amount,
        netAmount: w.net_amount,
        status: w.status,
        providerReference: w.provider_reference,
        rejectionReason: w.rejection_reason,
        reviewedAt: w.reviewed_at,
        processedAt: w.processed_at,
        completedAt: w.completed_at,
        createdAt: w.created_at,
      }));

    const payoutAccountRow = db
      .prepare('SELECT id, method_name, account_number, account_owner_name, status, updated_at FROM payout_accounts WHERE user_id = ?')
      .get(customer.id) as any;

    const planPurchases = db
      .prepare('SELECT id, plan_code, amount, daily_mining_rate, period_days, status, start_date, end_date, created_at FROM plan_purchases WHERE user_id = ? ORDER BY created_at DESC')
      .all(customer.id)
      .map((p: any) => ({
        id: p.id,
        planCode: p.plan_code,
        amount: p.amount,
        dailyMiningRate: p.daily_mining_rate,
        periodDays: p.period_days,
        status: p.status,
        startDate: p.start_date,
        endDate: p.end_date,
        createdAt: p.created_at,
      }));

    const dailyCheckins = db
      .prepare('SELECT id, ethiopia_date, status, created_at FROM daily_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(customer.id)
      .map((c: any) => ({
        id: c.id,
        ethiopiaDate: c.ethiopia_date,
        status: c.status,
        createdAt: c.created_at,
      }));

    const dailyClaims = db
      .prepare(
        `SELECT dc.id, dc.ethiopia_date, dc.amount, dc.created_at, pp.plan_code
         FROM daily_claims dc
         JOIN plan_purchases pp ON pp.id = dc.purchase_id
         WHERE dc.user_id = ? ORDER BY dc.created_at DESC LIMIT 50`
      )
      .all(customer.id)
      .map((c: any) => ({
        id: c.id,
        ethiopiaDate: c.ethiopia_date,
        amount: c.amount,
        planCode: c.plan_code,
        createdAt: c.created_at,
      }));

    const tickets = db
      .prepare('SELECT id, category, subject, status, is_read_by_admin, created_at, updated_at FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC')
      .all(customer.id)
      .map((t: any) => ({
        id: t.id,
        category: t.category,
        subject: t.subject,
        status: t.status,
        isReadByAdmin: Boolean(t.is_read_by_admin),
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));

    // Sanitized activity timeline (never exposes wallet balance_after)
    const activities = [
      { id: 'reg', type: 'registration', description: 'Customer registered account', timestamp: customer.created_at },
      ...(termsAcceptance
        ? [{ id: 'trm', type: 'terms', description: `Accepted platform terms (${termsAcceptance.terms_version})`, timestamp: termsAcceptance.accepted_at }]
        : []),
      ...deposits.map((d) => ({
        id: `act_${d.id}`,
        type: 'deposit',
        description: `Deposit request Br ${d.amount} (${d.txReference}) — ${d.status}`,
        timestamp: d.createdAt,
      })),
      ...withdrawals.map((w) => ({
        id: `act_${w.id}`,
        type: 'withdrawal',
        description: `Withdrawal request Br ${w.grossAmount} (${w.methodName}) — ${w.status}`,
        timestamp: w.createdAt,
      })),
      ...planPurchases.map((p) => ({
        id: `act_${p.id}`,
        type: 'purchase',
        description: `Purchased Plan ${p.planCode} (Br ${p.amount})`,
        timestamp: p.createdAt,
      })),
      ...dailyCheckins.map((c) => ({
        id: `act_${c.id}`,
        type: 'checkin',
        description: `Daily check-in (${c.ethiopiaDate}) — ${c.status}`,
        timestamp: c.createdAt,
      })),
      ...dailyClaims.map((c) => ({
        id: `act_${c.id}`,
        type: 'claim',
        description: `Claimed daily mining for Plan ${c.planCode} (${c.ethiopiaDate})`,
        timestamp: c.createdAt,
      })),
      ...tickets.map((t) => ({
        id: `act_${t.id}`,
        type: 'ticket',
        description: `Submitted feedback/ticket "${t.subject}" — ${t.status}`,
        timestamp: t.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    logAdminAudit(req.authUser!.id, req.authUser!.role, 'view_customer_profile', 'user', customer.id);

    res.json({
      customer: {
        id: customer.id,
        fullName: getCustomerDisplayName({ nickname: customer.nickname, fullName: customer.full_name, role: customer.role }),
        nickname: customer.nickname || null,
        phone: canSeeFullPhone ? customer.phone : maskPhoneNumber(customer.phone),
        role: customer.role,
        status: customer.status,
        referralCode: customer.referral_code,
        invitedBy,
        termsAcceptedVersion: termsAcceptance?.terms_version || null,
        termsAcceptedAt: termsAcceptance?.accepted_at || null,
        createdAt: customer.created_at,
        lastActiveAt: customer.last_active_at,
      },
      team: {
        level1Count: l1.length,
        level2Count: l2.length,
        level3Count: l3.length,
        members: teamMembers,
      },
      payoutAccount: payoutAccountRow
        ? {
            id: payoutAccountRow.id,
            methodName: payoutAccountRow.method_name,
            accountNumber: canSeeFullPhone
              ? payoutAccountRow.account_number
              : maskBankAccount(payoutAccountRow.account_number),
            accountOwnerName: payoutAccountRow.account_owner_name,
            status: payoutAccountRow.status,
            updatedAt: payoutAccountRow.updated_at,
          }
        : null,
      deposits,
      withdrawals,
      planPurchases,
      dailyCheckins,
      dailyClaims,
      tickets,
      activities,
    });
  });

  router.post(
    '/admin/users/:id/status',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'support_admin']),
    (req: AuthenticatedRequest, res) => {
      const { status, reason } = req.body || {};
      if (status !== 'active' && status !== 'suspended') {
        res.status(400).json({ error: 'Invalid status.' });
        return;
      }
      if (req.params.id === req.authUser!.id) {
        res.status(400).json({ error: 'You cannot suspend your own admin account.' });
        return;
      }
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
      logAdminAudit(req.authUser!.id, req.authUser!.role, `user_${status}`, 'user', req.params.id, { reason });
      res.json({ ok: true });
    }
  );

  router.post(
    '/admin/users/:id/role',
    requireAuth,
    requireAdminRole(['owner_admin']),
    (req: AuthenticatedRequest, res) => {
      const { role } = req.body || {};
      const validRoles: UserRole[] = ['customer', ...ADMIN_ROLES];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role.' });
        return;
      }
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'change_user_role', 'user', req.params.id, { role });
      res.json({ ok: true });
    }
  );

  // Admin Feedback & Complaints Center
  router.get(
    '/admin/tickets',
    requireAuth,
    requireAdminRole(['owner_admin', 'support_admin', 'viewer']),
    (req: AuthenticatedRequest, res) => {
      const canSeePhone = req.authUser!.role !== 'viewer';
      const tickets = db
        .prepare(
          `SELECT t.*, u.nickname as customer_nickname, u.full_name as customer_name, u.phone as customer_phone
           FROM support_tickets t
           JOIN users u ON u.id = t.user_id
           ORDER BY t.is_read_by_admin ASC,
             CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'in_progress' THEN 1 WHEN t.status = 'resolved' THEN 2 ELSE 3 END,
             t.updated_at DESC`
        )
        .all()
        .map((t: any) => {
          const msgs = db
            .prepare(
              `SELECT m.id, m.sender_role, u.nickname, u.role as user_role, u.full_name as sender_name, m.message, m.created_at
               FROM support_messages m JOIN users u ON u.id = m.sender_id
               WHERE m.ticket_id = ? ORDER BY m.created_at ASC`
            )
            .all(t.id)
            .map((m: any) => ({
              id: m.id,
              senderRole: m.sender_role,
              senderName: getCustomerDisplayName({
                nickname: m.nickname,
                fullName: m.sender_name,
                role: m.user_role,
              }),
              message: m.message,
              createdAt: m.created_at,
            }));
          return {
            id: t.id,
            userId: t.user_id,
            customerName: getCustomerDisplayName({
              nickname: t.customer_nickname,
              fullName: t.customer_name,
              role: 'customer',
            }),
            customerPhone: canSeePhone ? t.customer_phone : maskPhoneNumber(t.customer_phone),
            category: t.category,
            subject: t.subject,
            message: t.message,
            status: t.status,
            isReadByAdmin: Boolean(t.is_read_by_admin),
            readAt: t.read_at || null,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            messages: msgs,
          };
        });
      res.json({ tickets });
    }
  );

  router.post(
    '/admin/tickets/:id/status',
    requireAuth,
    requireAdminRole(['owner_admin', 'support_admin']),
    (req: AuthenticatedRequest, res) => {
      const { status, isRead } = req.body || {};
      const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id) as any;
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }
      const now = new Date().toISOString();
      const allowedStatuses = new Set(['open', 'in_progress', 'resolved', 'closed']);
      const nextStatus = typeof status === 'string' && allowedStatuses.has(status) ? status : ticket.status;
      const nextRead = isRead !== undefined ? (isRead ? 1 : 0) : 1;
      const nextReadAt = nextRead ? ticket.read_at || now : null;

      db.prepare(
        `UPDATE support_tickets SET status = ?, is_read_by_admin = ?, read_at = ?, updated_at = ? WHERE id = ?`
      ).run(nextStatus, nextRead, nextReadAt, now, ticket.id);

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'update_ticket_status', 'support_ticket', ticket.id, {
        nextStatus,
        isRead: Boolean(nextRead),
      });
      res.json({ ok: true });
    }
  );

  router.post(
    '/admin/tickets/:id/reply',
    requireAuth,
    requireAdminRole(['owner_admin', 'support_admin']),
    (req: AuthenticatedRequest, res) => {
      const { message, status } = req.body || {};
      if (!message || String(message).trim().length < 2) {
        res.status(400).json({ error: 'Reply message is required.' });
        return;
      }
      const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id) as any;
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found.' });
        return;
      }
      const now = new Date().toISOString();
      const allowedStatuses = new Set(['open', 'in_progress', 'resolved', 'closed']);
      const nextStatus = typeof status === 'string' && allowedStatuses.has(status) ? status : 'in_progress';
      db.prepare(
        `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message, created_at)
         VALUES (?, ?, ?, 'admin', ?, ?)`
      ).run(`msg_${crypto.randomUUID()}`, ticket.id, req.authUser!.id, String(message).trim(), now);
      db.prepare(
        'UPDATE support_tickets SET status = ?, assigned_to = ?, is_read_by_admin = 1, read_at = COALESCE(read_at, ?), updated_at = ? WHERE id = ?'
      ).run(nextStatus, req.authUser!.id, now, now, ticket.id);

      createNotification(
        ticket.user_id,
        'Support Ticket Reply',
        `Customer Service replied to your ticket "${ticket.subject}".`,
        'support_reply',
        '/service'
      );

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'reply_ticket', 'support_ticket', ticket.id, { nextStatus });
      res.json({ ok: true });
    }
  );

  // Admin Broadcast Messages with Image Upload
  router.get(
    '/admin/broadcasts',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin', 'support_admin', 'viewer']),
    (req: AuthenticatedRequest, res) => {
      const canSeePhone = req.authUser!.role !== 'viewer';
      const rows = db
        .prepare(
          `SELECT b.*, u.phone as target_phone, s.full_name as sender_name
           FROM broadcasts b
           LEFT JOIN users u ON u.id = b.target_user_id
           LEFT JOIN users s ON s.id = b.sent_by
           ORDER BY b.created_at DESC LIMIT 100`
        )
        .all()
        .map((b: any) => ({
          id: b.id,
          title: b.title,
          message: b.message,
          imageUrl: b.image_path ? `/api/broadcasts/${b.id}/image` : null,
          targetType: b.target_type,
          targetUserId: b.target_user_id,
          targetPhone: b.target_phone ? (canSeePhone ? b.target_phone : maskPhoneNumber(b.target_phone)) : null,
          sentByName: b.sender_name || 'Administrator',
          recipientCount: b.recipient_count,
          createdAt: b.created_at,
        }));
      res.json({ broadcasts: rows });
    }
  );

  router.post(
    '/admin/broadcasts',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin', 'support_admin']),
    (req: AuthenticatedRequest, res, next) => {
      broadcastUpload.single('image')(req, res, (err: any) => {
        if (err) {
          res.status(400).json({ error: err.message || 'Broadcast image upload failed.' });
          return;
        }
        next();
      });
    },
    (req: AuthenticatedRequest, res) => {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      const targetType = req.body?.targetType === 'single' ? 'single' : 'all';
      const targetUserIdRaw = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
      const targetPhoneRaw = typeof req.body?.targetPhone === 'string' ? req.body.targetPhone.trim() : '';

      const cleanupFile = () => {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      };

      if (title.length < 2 || message.length < 2) {
        cleanupFile();
        res.status(400).json({ error: 'Broadcast title and message are required (min 2 characters each).' });
        return;
      }

      let recipients: Array<{ id: string; phone: string }> = [];
      let singleTargetId: string | null = null;

      if (targetType === 'single') {
        let userRow: { id: string; phone: string } | undefined;
        if (targetUserIdRaw) {
          userRow = db
            .prepare("SELECT id, phone FROM users WHERE id = ? AND role = 'customer'")
            .get(targetUserIdRaw) as { id: string; phone: string } | undefined;
        } else if (targetPhoneRaw) {
          const norm = normalizeEthiopiaPhone(targetPhoneRaw) || targetPhoneRaw;
          userRow = db
            .prepare("SELECT id, phone FROM users WHERE phone = ? AND role = 'customer'")
            .get(norm) as { id: string; phone: string } | undefined;
        }
        if (!userRow) {
          cleanupFile();
          res.status(404).json({ error: 'Selected customer account was not found.' });
          return;
        }
        recipients = [userRow];
        singleTargetId = userRow.id;
      } else {
        recipients = db
          .prepare("SELECT id, phone FROM users WHERE role = 'customer' AND status = 'active'")
          .all() as Array<{ id: string; phone: string }>;
      }

      const broadcastId = `brd_${crypto.randomUUID()}`;
      const imageUrl = req.file ? `/api/broadcasts/${broadcastId}/image` : null;
      const now = new Date().toISOString();

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO broadcasts (id, title, message, image_path, image_mime, target_type, target_user_id, sent_by, recipient_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          broadcastId,
          title,
          message,
          req.file ? req.file.filename : null,
          req.file ? req.file.mimetype : null,
          targetType,
          singleTargetId,
          req.authUser!.id,
          recipients.length,
          now
        );

        for (const r of recipients) {
          createNotification(
            r.id,
            title,
            message,
            'broadcast',
            '/notifications',
            imageUrl,
            broadcastId
          );
        }

        logAdminAudit(req.authUser!.id, req.authUser!.role, 'send_broadcast', 'broadcast', broadcastId, {
          targetType,
          targetUserId: singleTargetId,
          recipientCount: recipients.length,
          hasImage: Boolean(req.file),
        });
      });

      tx();
      res.status(201).json({
        ok: true,
        broadcastId,
        recipientCount: recipients.length,
        imageUrl,
      });
    }
  );

  // Admin Content, Channels, Settings, Carousel & Audit Logs
  router.get('/admin/content', requireAuth, requireAdminRole(ADMIN_ROLES), (_req, res) => {
    const channels = db.prepare('SELECT * FROM support_channels ORDER BY sort_order ASC').all();
    const carousel = db.prepare('SELECT * FROM carousel_assets ORDER BY sort_order ASC').all();
    res.json({
      settings: getPlatformSettings(),
      companyInfo: getCompanyInfo(),
      complianceApproved: isComplianceApproved(),
      channels,
      carousel,
    });
  });

  router.put(
    '/admin/settings',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin']),
    (req: AuthenticatedRequest, res) => {
      const { settings, companyInfo } = req.body || {};
      const now = new Date().toISOString();
      if (settings) {
        const merged = { ...getPlatformSettings(), ...settings };
        db.prepare(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)'
        ).run('platform_settings', JSON.stringify(merged), now);
      }
      if (companyInfo) {
        const mergedCo = { ...getCompanyInfo(), ...companyInfo };
        db.prepare(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)'
        ).run('company_info', JSON.stringify(mergedCo), now);
      }
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'update_platform_settings', 'app_settings', 'platform_settings');
      res.json({ ok: true });
    }
  );

  router.post(
    '/admin/channels',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin', 'support_admin']),
    (req: AuthenticatedRequest, res) => {
      const { label, handleOrUrl, href, kind } = req.body || {};
      if (!label || !handleOrUrl || !href || !/^https?:\/\//i.test(String(href))) {
        res.status(400).json({ error: 'Valid label, handle, and https:// URL are required.' });
        return;
      }
      const id = `chn_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO support_channels (id, label, handle_or_url, href, kind, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, 1, 10)`
      ).run(id, String(label).trim(), String(handleOrUrl).trim(), String(href).trim(), String(kind || 'link'));
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'create_support_channel', 'support_channel', id);
      res.status(201).json({ ok: true, id });
    }
  );

  router.patch(
    '/admin/channels/:id',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin', 'support_admin']),
    (req: AuthenticatedRequest, res) => {
      const existing = db.prepare('SELECT * FROM support_channels WHERE id = ?').get(req.params.id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Channel not found.' });
        return;
      }
      const { label, handleOrUrl, href, isActive, sortOrder } = req.body || {};
      db.prepare(
        `UPDATE support_channels SET label = ?, handle_or_url = ?, href = ?, is_active = ?, sort_order = ? WHERE id = ?`
      ).run(
        label !== undefined ? String(label).trim() : existing.label,
        handleOrUrl !== undefined ? String(handleOrUrl).trim() : existing.handle_or_url,
        href !== undefined ? String(href).trim() : existing.href,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
        existing.id
      );
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'update_support_channel', 'support_channel', existing.id);
      res.json({ ok: true });
    }
  );

  router.delete(
    '/admin/channels/:id',
    requireAuth,
    requireAdminRole(['owner_admin', 'content_admin']),
    (req: AuthenticatedRequest, res) => {
      db.prepare('DELETE FROM support_channels WHERE id = ?').run(req.params.id);
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'delete_support_channel', 'support_channel', req.params.id);
      res.json({ ok: true });
    }
  );

  router.get('/admin/audit-logs', requireAuth, requireAdminRole(ADMIN_ROLES), (_req, res) => {
    const logs = db
      .prepare(
        `SELECT a.*, u.full_name as actor_name
         FROM admin_audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         ORDER BY a.created_at DESC LIMIT 150`
      )
      .all();
    res.json({ logs });
  });

  // ---------------------------------------------------------------------------
  // CUSTOMER GIFT CODE REDEMPTION (SERVER-GATED BY ADMIN ENABLE/DISABLE SETTING)
  // ---------------------------------------------------------------------------
  router.get('/gift-codes', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const isEnabled = isGiftCodeFeatureEnabled();
    const redemptions = db
      .prepare(
        `SELECT id, gift_code_id, code_snapshot, reward_amount, redeemed_at
         FROM gift_code_redemptions
         WHERE user_id = ?
         ORDER BY redeemed_at DESC LIMIT 50`
      )
      .all(userId)
      .map((r: any) => ({
        id: r.id,
        giftCodeId: r.gift_code_id,
        code: r.code_snapshot,
        rewardAmount: r.reward_amount,
        redeemedAt: r.redeemed_at,
      }));
    const demoWallet = getUserWallet(userId);
    res.json({
      giftCodeEnabled: isEnabled,
      demoBalance: demoWallet.demoBalance,
      redemptions,
    });
  });

  router.post('/gift-codes/redeem', requireAuth, requireLiveFinance, rateLimit(20, 60_000), (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!rawCode) {
      res.status(400).json({ error: 'Please enter a gift code.' });
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      let creditedAmount = 0;
      let nextBalance = 0;
      let cleanCode = rawCode;

      const tx = db.transaction(() => {
        const featureEnabled = isGiftCodeFeatureEnabled();
        const codeRow = db
          .prepare('SELECT * FROM gift_codes WHERE UPPER(code) = UPPER(?)')
          .get(rawCode) as any;

        const redemptionCount = codeRow
          ? (
              db
                .prepare('SELECT COUNT(*) as c FROM gift_code_redemptions WHERE gift_code_id = ?')
                .get(codeRow.id) as { c: number }
            ).c
          : 0;
        const alreadyRedeemed = codeRow
          ? Boolean(
              db
                .prepare('SELECT 1 FROM gift_code_redemptions WHERE gift_code_id = ? AND user_id = ?')
                .get(codeRow.id, userId)
            )
          : false;

        const check = evaluateGiftCodeEligibility({
          featureEnabled,
          codeExists: Boolean(codeRow),
          isActive: Boolean(codeRow?.is_active),
          expiresAt: codeRow?.expires_at || null,
          maxRedemptions: codeRow?.max_redemptions ?? null,
          redemptionCount,
          alreadyRedeemedByUser: alreadyRedeemed,
        });

        if (!check.ok) {
          throw Object.assign(new Error(check.error || 'Cannot redeem gift code.'), {
            statusCode: check.status,
          });
        }

        creditedAmount = Number(codeRow.reward_amount);
        cleanCode = codeRow.code;

        db.prepare(
          `INSERT INTO gift_code_redemptions (id, gift_code_id, user_id, code_snapshot, reward_amount, redeemed_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(`gcr_${crypto.randomUUID()}`, codeRow.id, userId, codeRow.code, creditedAmount, nowIso);

        nextBalance = appendDemoTransaction({
          userId,
          type: 'gift_code',
          amountSigned: creditedAmount,
          referenceId: codeRow.id,
          note: `Gift Code Redeemed (${codeRow.code} · +${creditedAmount.toLocaleString()} ETB)`,
          idempotencyKey: `gift:${codeRow.id}:${userId}`,
          createdAt: nowIso,
        });
      });
      tx();

      res.json({
        ok: true,
        code: cleanCode,
        rewardAmount: creditedAmount,
        demoBalance: nextBalance,
        message: `Gift code ${cleanCode} redeemed! +${creditedAmount.toLocaleString()} ETB added to your Wallet.`,
      });
    } catch (err: any) {
      const code = err?.statusCode || 400;
      res.status(code).json({ error: err?.message || 'Gift code redemption failed.' });
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN GIFT CODE MANAGEMENT (NO CUSTOMER BALANCES EXPOSED)
  // ---------------------------------------------------------------------------
  router.get('/admin/gift-codes', requireAuth, requireAdminRole(ADMIN_ROLES), (req: AuthenticatedRequest, res) => {
    const canSeePhone = req.authUser!.role !== 'viewer';
    const isEnabled = isGiftCodeFeatureEnabled();

    const codes = db
      .prepare(
        `SELECT g.*, (SELECT COUNT(*) FROM gift_code_redemptions r WHERE r.gift_code_id = g.id) as redemption_count
         FROM gift_codes g
         ORDER BY g.created_at DESC`
      )
      .all()
      .map((g: any) => ({
        id: g.id,
        code: g.code,
        rewardAmount: g.reward_amount,
        isActive: Boolean(g.is_active),
        maxRedemptions: g.max_redemptions,
        redemptionCount: g.redemption_count,
        expiresAt: g.expires_at,
        createdAt: g.created_at,
        deactivatedAt: g.deactivated_at,
      }));

    const redemptions = db
      .prepare(
        `SELECT r.id, r.gift_code_id, r.code_snapshot, r.reward_amount, r.redeemed_at, u.phone as customer_phone
         FROM gift_code_redemptions r
         JOIN users u ON u.id = r.user_id
         ORDER BY r.redeemed_at DESC LIMIT 200`
      )
      .all()
      .map((r: any) => ({
        id: r.id,
        giftCodeId: r.gift_code_id,
        code: r.code_snapshot,
        rewardAmount: r.reward_amount,
        customerPhone: canSeePhone ? r.customer_phone : maskPhoneNumber(r.customer_phone),
        redeemedAt: r.redeemed_at,
      }));

    res.json({ isEnabled, codes, redemptions });
  });

  router.patch(
    '/admin/gift-codes/settings',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'content_admin']),
    (req: AuthenticatedRequest, res) => {
      const { isEnabled } = req.body || {};
      const nextVal = isEnabled ? 1 : 0;
      const nowIso = new Date().toISOString();
      db.prepare(
        `INSERT INTO gift_code_settings (id, is_enabled, updated_by, updated_at)
         VALUES ('default', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET is_enabled = excluded.is_enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
      ).run(nextVal, req.authUser!.id, nowIso);

      logAdminAudit(
        req.authUser!.id,
        req.authUser!.role,
        nextVal ? 'enable_gift_code_feature' : 'disable_gift_code_feature',
        'gift_code_settings',
        'default',
        { isEnabled: Boolean(nextVal) }
      );
      res.json({ ok: true, isEnabled: Boolean(nextVal) });
    }
  );

  router.post(
    '/admin/gift-codes',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'content_admin']),
    (req: AuthenticatedRequest, res) => {
      const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      const rewardAmount = Number(req.body?.rewardAmount);
      const maxRedemptionsRaw = req.body?.maxRedemptions;
      const expiresAtRaw = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : '';

      if (!/^[A-Z0-9_-]{3,32}$/.test(rawCode)) {
        res.status(400).json({
          error: 'Gift code must be 3–32 characters using letters, numbers, hyphens, or underscores.',
        });
        return;
      }
      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        res.status(400).json({ error: 'Reward amount must be a positive ETB value.' });
        return;
      }

      let maxRedemptions: number | null = null;
      if (maxRedemptionsRaw !== undefined && maxRedemptionsRaw !== null && String(maxRedemptionsRaw).trim() !== '') {
        const parsedMax = Number(maxRedemptionsRaw);
        if (!Number.isInteger(parsedMax) || parsedMax < 1) {
          res.status(400).json({ error: 'Maximum redemptions must be a whole number >= 1.' });
          return;
        }
        maxRedemptions = parsedMax;
      }

      let expiresAt: string | null = null;
      if (expiresAtRaw) {
        const parsedDate = new Date(expiresAtRaw);
        if (Number.isNaN(parsedDate.getTime())) {
          res.status(400).json({ error: 'Invalid expiry date.' });
          return;
        }
        expiresAt = parsedDate.toISOString();
      }

      const duplicate = db
        .prepare('SELECT id FROM gift_codes WHERE UPPER(code) = UPPER(?)')
        .get(rawCode);
      if (duplicate) {
        res.status(409).json({ error: `Gift code "${rawCode}" already exists.` });
        return;
      }

      const id = `gft_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const roundedReward = Math.round(rewardAmount * 100) / 100;

      db.prepare(
        `INSERT INTO gift_codes (id, code, reward_amount, is_active, max_redemptions, expires_at, created_by, created_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
      ).run(id, rawCode, roundedReward, maxRedemptions, expiresAt, req.authUser!.id, nowIso);

      logAdminAudit(req.authUser!.id, req.authUser!.role, 'create_gift_code', 'gift_code', id, {
        code: rawCode,
        rewardAmount: roundedReward,
        maxRedemptions,
        expiresAt,
      });

      res.status(201).json({ ok: true, id, code: rawCode });
    }
  );

  router.post(
    '/admin/gift-codes/:id/deactivate',
    requireAuth,
    requireAdminRole(['owner_admin', 'finance_admin', 'content_admin']),
    (req: AuthenticatedRequest, res) => {
      const codeRow = db.prepare('SELECT id, code, is_active FROM gift_codes WHERE id = ?').get(req.params.id) as any;
      if (!codeRow) {
        res.status(404).json({ error: 'Gift code not found.' });
        return;
      }
      if (!codeRow.is_active) {
        res.json({ ok: true });
        return;
      }
      const nowIso = new Date().toISOString();
      db.prepare('UPDATE gift_codes SET is_active = 0, deactivated_at = ? WHERE id = ?').run(nowIso, codeRow.id);
      logAdminAudit(req.authUser!.id, req.authUser!.role, 'deactivate_gift_code', 'gift_code', codeRow.id, {
        code: codeRow.code,
      });
      res.json({ ok: true });
    }
  );

  return router;
}
