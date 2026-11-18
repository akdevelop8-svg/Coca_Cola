import crypto from 'crypto';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  COMPANY_INFO,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_SUPPORT_CHANNELS,
  SUPPLIED_ASSETS,
} from '../src/shared/constants';
import {
  computePlanProgress,
  getEthiopiaCalendarDate,
  normalizeLoginPhoneIdentifier,
} from '../src/shared/finance';

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/platform.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      status TEXT NOT NULL DEFAULT 'active',
      referral_code TEXT UNIQUE NOT NULL,
      invited_by_user_id TEXT REFERENCES users(id),
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      terms_version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      ip_address TEXT,
      UNIQUE(user_id, terms_version)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount_signed REAL NOT NULL,
      reserved_delta REAL NOT NULL DEFAULT 0,
      promo_delta REAL NOT NULL DEFAULT 0,
      earnings_delta REAL NOT NULL DEFAULT 0,
      reward_delta REAL NOT NULL DEFAULT 0,
      commission_delta REAL NOT NULL DEFAULT 0,
      balance_after REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'posted',
      reference_id TEXT,
      note TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_checkins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ethiopia_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, ethiopia_date)
    );

    CREATE TABLE IF NOT EXISTS plan_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_code TEXT NOT NULL,
      amount REAL NOT NULL,
      daily_mining_rate REAL NOT NULL,
      period_days INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purchase_id TEXT NOT NULL REFERENCES plan_purchases(id) ON DELETE CASCADE,
      ethiopia_date TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(purchase_id, ethiopia_date)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('deposit', 'payout')),
      name TEXT NOT NULL,
      account_name TEXT NOT NULL DEFAULT '',
      account_number TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_method_id TEXT NOT NULL,
      method_name TEXT NOT NULL,
      account_number_snapshot TEXT NOT NULL,
      amount REAL NOT NULL,
      tx_reference TEXT NOT NULL,
      receipt_path TEXT NOT NULL,
      receipt_mime TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payout_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_owner_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      is_locked INTEGER NOT NULL DEFAULT 1,
      review_note TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payout_change_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      new_method_name TEXT NOT NULL,
      new_account_number TEXT NOT NULL,
      new_account_owner_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      admin_note TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payout_account_id TEXT NOT NULL REFERENCES payout_accounts(id),
      method_name TEXT NOT NULL,
      account_number_snapshot TEXT NOT NULL,
      account_owner_snapshot TEXT NOT NULL,
      gross_amount REAL NOT NULL,
      fee_amount REAL NOT NULL,
      net_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      provider_reference TEXT,
      rejection_reason TEXT,
      reviewed_by TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_channels (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      handle_or_url TEXT NOT NULL,
      href TEXT NOT NULL,
      kind TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_path TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'closed')),
      assigned_to TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      action_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carousel_assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reset_code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      image_path TEXT,
      image_mime TEXT,
      target_type TEXT NOT NULL CHECK(target_type IN ('all', 'single')),
      target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      sent_by TEXT REFERENCES users(id),
      recipient_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gift_code_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      is_enabled INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gift_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      max_redemptions INTEGER,
      expires_at TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      deactivated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_codes_code_nocase ON gift_codes(UPPER(code));

    CREATE TABLE IF NOT EXISTS gift_code_redemptions (
      id TEXT PRIMARY KEY,
      gift_code_id TEXT NOT NULL REFERENCES gift_codes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_snapshot TEXT NOT NULL,
      reward_amount REAL NOT NULL,
      redeemed_at TEXT NOT NULL,
      UNIQUE(gift_code_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS demo_credit_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount_signed REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_id TEXT,
      note TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_demo_tx_user_created ON demo_credit_transactions(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS referral_demo_rewards (
      id TEXT PRIMARY KEY,
      beneficiary_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purchase_id TEXT NOT NULL REFERENCES plan_purchases(id) ON DELETE CASCADE,
      level INTEGER NOT NULL CHECK(level IN (1, 2, 3)),
      rate_percent REAL NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(purchase_id, level)
    );
  `);

  runSchemaMigrations();

  const now = new Date().toISOString();

  // Seed default app settings if missing (never overwrites admin edits)
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)'
  );
  insertSetting.run('platform_settings', JSON.stringify(DEFAULT_PLATFORM_SETTINGS), now);
  insertSetting.run('company_info', JSON.stringify(COMPANY_INFO), now);

  // Seed Gift Code global setting (disabled by default until Admin enables)
  db.prepare(
    `INSERT OR IGNORE INTO gift_code_settings (id, is_enabled, updated_by, updated_at) VALUES ('default', 0, NULL, ?)`
  ).run(now);

  // Ensure existing customers have their 150 Demo ETB Registration Bonus idempotently
  const customersWithoutBonus = db
    .prepare(
      `SELECT u.id, u.created_at FROM users u
       WHERE u.role = 'customer'
         AND NOT EXISTS (
           SELECT 1 FROM demo_credit_transactions d
           WHERE d.user_id = u.id AND d.idempotency_key = ('reg_bonus:' || u.id)
         )`
    )
    .all() as Array<{ id: string; created_at: string }>;
  for (const c of customersWithoutBonus) {
    grantRegistrationDemoBonus(c.id, DEFAULT_PLATFORM_SETTINGS.registrationBonus, c.created_at || now);
  }

  // Seed default CBE deposit & CBE ONLY payout payment methods if empty
  const methodCount = (db.prepare('SELECT COUNT(*) as c FROM payment_methods').get() as { c: number }).c;
  if (methodCount === 0) {
    const insertMethod = db.prepare(
      `INSERT INTO payment_methods (id, kind, name, account_name, account_number, instructions, is_active, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertMethod.run(
      'pm_cbe_deposit',
      'deposit',
      'CBE (Commercial Bank of Ethiopia)',
      'Commercial Bank of Ethiopia — Registered Business Account',
      '1000673029578',
      'Transfer your exact deposit amount to CBE Account 1000673029578, then enter the transaction reference/short code and upload your payment receipt.',
      1,
      1,
      now
    );
    insertMethod.run(
      'pm_cbe_payout',
      'payout',
      'CBE (Commercial Bank of Ethiopia)',
      'CBE Account Only',
      'CBE ONLY',
      'Withdrawals are processed strictly via Commercial Bank of Ethiopia (CBE). Save and verify your CBE account before requesting a withdrawal.',
      1,
      1,
      now
    );
  }

  // Seed required Customer Service Telegram channels if empty
  const channelCount = (db.prepare('SELECT COUNT(*) as c FROM support_channels').get() as { c: number }).c;
  if (channelCount === 0) {
    const insertChannel = db.prepare(
      `INSERT INTO support_channels (id, label, handle_or_url, href, kind, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    );
    DEFAULT_SUPPORT_CHANNELS.forEach((ch, idx) => {
      insertChannel.run(ch.id, ch.label, ch.handleOrUrl, ch.href, ch.kind, idx + 1);
    });
  }

  // Seed supplied owner-approved carousel assets if empty
  const carouselCount = (db.prepare('SELECT COUNT(*) as c FROM carousel_assets').get() as { c: number }).c;
  if (carouselCount === 0) {
    const insertCarousel = db.prepare(
      `INSERT INTO carousel_assets (id, title, subtitle, image_url, is_active, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`
    );
    insertCarousel.run(
      'car_1',
      'Invest Today — Build a Better Tomorrow',
      'Together for a Prosperous Future',
      SUPPLIED_ASSETS.splashDrinkHero,
      1
    );
    insertCarousel.run(
      'car_2',
      'Coca-Cola Original Taste Collection',
      'Iconic beverage products enjoyed globally',
      SUPPLIED_ASSETS.bottles,
      2
    );
    insertCarousel.run(
      'car_3',
      'Modern Bottling & Production Operations',
      'High-capacity bottling infrastructure',
      SUPPLIED_ASSETS.factory,
      3
    );
  }
}

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function runSchemaMigrations(): void {
  // 1. Add optional username & nickname columns on users
  if (!hasColumn('users', 'username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT;');
  }
  if (!hasColumn('users', 'nickname')) {
    db.exec('ALTER TABLE users ADD COLUMN nickname TEXT;');
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase ON users(LOWER(username)) WHERE username IS NOT NULL;'
  );

  // Normalize legacy Demo copy in existing records to ETB / Platform / Wallet
  db.exec(`
    UPDATE demo_credit_transactions
    SET note = REPLACE(REPLACE(REPLACE(note, 'Demo Credits', 'ETB'), 'Demo ETB', 'ETB'), 'Demo Wallet', 'Wallet')
    WHERE note LIKE '%Demo%';
    UPDATE notifications
    SET title = REPLACE(REPLACE(title, 'Demo Simulator', 'Platform'), 'Demo ', ''),
        body = REPLACE(REPLACE(REPLACE(body, 'Demo Credits', 'ETB'), 'Demo ETB', 'ETB'), 'Demo ', '')
    WHERE title LIKE '%Demo%' OR body LIKE '%Demo%';
  `);

  // 2. Extend withdrawals CHECK constraint to allow processed/completed + audit columns
  const wdrSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'withdrawals'")
    .get() as { sql: string } | undefined;
  if (wdrSqlRow && !wdrSqlRow.sql.includes("'completed'")) {
    db.pragma('foreign_keys = OFF');
    const migrateWithdrawals = db.transaction(() => {
      db.exec(`
        CREATE TABLE withdrawals_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payout_account_id TEXT NOT NULL REFERENCES payout_accounts(id),
          method_name TEXT NOT NULL,
          account_number_snapshot TEXT NOT NULL,
          account_owner_snapshot TEXT NOT NULL,
          gross_amount REAL NOT NULL,
          fee_amount REAL NOT NULL,
          net_amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'processed', 'completed', 'rejected')),
          provider_reference TEXT,
          rejection_reason TEXT,
          reviewed_by TEXT REFERENCES users(id),
          reviewed_at TEXT,
          processed_at TEXT,
          completed_at TEXT,
          completed_by TEXT REFERENCES users(id),
          created_at TEXT NOT NULL
        );
        INSERT INTO withdrawals_new (
          id, user_id, payout_account_id, method_name, account_number_snapshot, account_owner_snapshot,
          gross_amount, fee_amount, net_amount, status, provider_reference, rejection_reason,
          reviewed_by, reviewed_at, created_at
        )
        SELECT
          id, user_id, payout_account_id, method_name, account_number_snapshot, account_owner_snapshot,
          gross_amount, fee_amount, net_amount, status, provider_reference, rejection_reason,
          reviewed_by, reviewed_at, created_at
        FROM withdrawals;
        DROP TABLE withdrawals;
        ALTER TABLE withdrawals_new RENAME TO withdrawals;
      `);
    });
    migrateWithdrawals();
    db.pragma('foreign_keys = ON');
  } else {
    if (!hasColumn('withdrawals', 'processed_at')) {
      db.exec('ALTER TABLE withdrawals ADD COLUMN processed_at TEXT;');
    }
    if (!hasColumn('withdrawals', 'completed_at')) {
      db.exec('ALTER TABLE withdrawals ADD COLUMN completed_at TEXT;');
    }
    if (!hasColumn('withdrawals', 'completed_by')) {
      db.exec('ALTER TABLE withdrawals ADD COLUMN completed_by TEXT;');
    }
  }

  // 3. Extend support_tickets CHECK constraint to include 'resolved' + read tracking
  const tktSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'support_tickets'")
    .get() as { sql: string } | undefined;
  if (tktSqlRow && !tktSqlRow.sql.includes("'resolved'")) {
    db.pragma('foreign_keys = OFF');
    const migrateTickets = db.transaction(() => {
      db.exec(`
        CREATE TABLE support_tickets_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          attachment_path TEXT,
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
          assigned_to TEXT REFERENCES users(id),
          is_read_by_admin INTEGER NOT NULL DEFAULT 0,
          read_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO support_tickets_new (
          id, user_id, category, subject, message, attachment_path, status, assigned_to, created_at, updated_at
        )
        SELECT
          id, user_id, category, subject, message, attachment_path, status, assigned_to, created_at, updated_at
        FROM support_tickets;
        DROP TABLE support_tickets;
        ALTER TABLE support_tickets_new RENAME TO support_tickets;
      `);
    });
    migrateTickets();
    db.pragma('foreign_keys = ON');
  } else {
    if (!hasColumn('support_tickets', 'is_read_by_admin')) {
      db.exec('ALTER TABLE support_tickets ADD COLUMN is_read_by_admin INTEGER NOT NULL DEFAULT 0;');
    }
    if (!hasColumn('support_tickets', 'read_at')) {
      db.exec('ALTER TABLE support_tickets ADD COLUMN read_at TEXT;');
    }
  }

  // 4. Add broadcast image support to notifications
  if (!hasColumn('notifications', 'image_url')) {
    db.exec('ALTER TABLE notifications ADD COLUMN image_url TEXT;');
  }
  if (!hasColumn('notifications', 'broadcast_id')) {
    db.exec('ALTER TABLE notifications ADD COLUMN broadcast_id TEXT;');
  }
}

export function syncEnvAdminAccount(hashPasswordFn: (pw: string) => string): void {
  const adminPhone =
    normalizeLoginPhoneIdentifier(process.env.ADMIN_PHONE || '+25190909090') || '+25190909090';
  const adminUsername = process.env.ADMIN_USERNAME?.trim() || null;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const existing = db
    .prepare(
      `SELECT id, phone FROM users WHERE role = 'owner_admin' OR phone = ? ORDER BY created_at ASC LIMIT 1`
    )
    .get(adminPhone) as { id: string; phone: string } | undefined;

  if (!adminPassword) {
    // Preserve existing Admin password hash untouched; ensure Admin login phone matches +25190909090
    if (existing && existing.phone !== adminPhone) {
      db.prepare(
        `UPDATE users SET phone = ?, role = 'owner_admin', status = 'active' WHERE id = ?`
      ).run(adminPhone, existing.id);
    }
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = hashPasswordFn(adminPassword);
  const settingsRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'platform_settings'")
    .get() as { value: string } | undefined;
  const termsVersion = settingsRow
    ? JSON.parse(settingsRow.value).termsVersion || DEFAULT_PLATFORM_SETTINGS.termsVersion
    : DEFAULT_PLATFORM_SETTINGS.termsVersion;

  let adminId: string;
  if (existing) {
    adminId = existing.id;
    db.prepare(
      `UPDATE users
       SET phone = ?, username = COALESCE(?, username), full_name = ?, password_hash = ?, role = 'owner_admin', status = 'active'
       WHERE id = ?`
    ).run(adminPhone, adminUsername, 'Platform Administrator', passwordHash, adminId);
  } else {
    adminId = `usr_admin_${crypto.randomUUID()}`;
    const refCode = `ADM${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    db.prepare(
      `INSERT INTO users (id, full_name, phone, username, email, password_hash, role, status, referral_code, created_at, last_active_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'owner_admin', 'active', ?, ?, ?)`
    ).run(adminId, 'Platform Administrator', adminPhone, adminUsername, passwordHash, refCode, now, now);
  }

  db.prepare(
    `INSERT OR IGNORE INTO terms_acceptances (id, user_id, terms_version, accepted_at)
     VALUES (?, ?, ?, ?)`
  ).run(`trm_${crypto.randomUUID()}`, adminId, termsVersion, now);
}

export function getUserBalances(userId: string) {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(amount_signed), 0) as available_balance,
        COALESCE(SUM(reserved_delta), 0) as reserved_balance,
        COALESCE(SUM(promo_delta), 0) as promotional_credit,
        COALESCE(SUM(earnings_delta), 0) as total_earnings,
        COALESCE(SUM(reward_delta), 0) as total_rewards,
        COALESCE(SUM(commission_delta), 0) as team_commission
       FROM ledger_entries WHERE user_id = ?`
    )
    .get(userId) as {
    available_balance: number;
    reserved_balance: number;
    promotional_credit: number;
    total_earnings: number;
    total_rewards: number;
    team_commission: number;
  };
  return {
    availableBalance: Math.round((row.available_balance || 0) * 100) / 100,
    reservedBalance: Math.round((row.reserved_balance || 0) * 100) / 100,
    promotionalCredit: Math.round((row.promotional_credit || 0) * 100) / 100,
    totalEarnings: Math.round((row.total_earnings || 0) * 100) / 100,
    totalRewards: Math.round((row.total_rewards || 0) * 100) / 100,
    teamCommission: Math.round((row.team_commission || 0) * 100) / 100,
  };
}

export function createNotification(
  userId: string,
  title: string,
  body: string,
  kind: string,
  actionUrl: string | null = null,
  imageUrl: string | null = null,
  broadcastId: string | null = null
) {
  const id = `ntf_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, kind, action_url, image_url, broadcast_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, title, body, kind, actionUrl, imageUrl, broadcastId, now);
  return id;
}

export function logAdminAudit(
  actorUserId: string | null,
  actorRole: string | null,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
  details: Record<string, unknown> = {}
) {
  db.prepare(
    `INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `aud_${crypto.randomUUID()}`,
    actorUserId,
    actorRole,
    action,
    targetType,
    targetId,
    JSON.stringify(details),
    new Date().toISOString()
  );
}

export function isGiftCodeFeatureEnabled(): boolean {
  const row = db
    .prepare("SELECT is_enabled FROM gift_code_settings WHERE id = 'default'")
    .get() as { is_enabled: number } | undefined;
  return Boolean(row?.is_enabled);
}

export function getUserDemoWallet(userId: string) {
  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(amount_signed), 0) as demo_balance,
        COALESCE(SUM(CASE WHEN type = 'daily_mining_claim' THEN amount_signed ELSE 0 END), 0) as demo_total_earnings,
        COALESCE(SUM(CASE WHEN type IN ('registration_bonus', 'daily_checkin', 'gift_code', 'task_reward') THEN amount_signed ELSE 0 END), 0) as demo_total_rewards,
        COALESCE(SUM(CASE WHEN type = 'referral_reward' THEN amount_signed ELSE 0 END), 0) as demo_team_commission
       FROM demo_credit_transactions WHERE user_id = ?`
    )
    .get(userId) as {
    demo_balance: number;
    demo_total_earnings: number;
    demo_total_rewards: number;
    demo_team_commission: number;
  };

  const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
  return {
    demoBalance: round2(row.demo_balance),
    demoTotalEarnings: round2(row.demo_total_earnings),
    demoTotalRewards: round2(row.demo_total_rewards),
    demoTeamCommission: round2(row.demo_team_commission),
  };
}

export function appendDemoTransaction(params: {
  userId: string;
  type:
    | 'registration_bonus'
    | 'daily_checkin'
    | 'gift_code'
    | 'plan_purchase'
    | 'daily_mining_claim'
    | 'referral_reward'
    | 'task_reward';
  amountSigned: number;
  referenceId?: string | null;
  note: string;
  idempotencyKey: string;
  createdAt?: string;
}): number {
  const current = getUserDemoWallet(params.userId).demoBalance;
  const nextBalance = Math.round((current + params.amountSigned) * 100) / 100;
  db.prepare(
    `INSERT INTO demo_credit_transactions (id, user_id, type, amount_signed, balance_after, reference_id, note, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `dtx_${crypto.randomUUID()}`,
    params.userId,
    params.type,
    params.amountSigned,
    nextBalance,
    params.referenceId ?? null,
    params.note,
    params.idempotencyKey,
    params.createdAt || new Date().toISOString()
  );
  return nextBalance;
}

export function grantRegistrationDemoBonus(
  userId: string,
  amount = DEFAULT_PLATFORM_SETTINGS.registrationBonus,
  createdAt?: string
): void {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 150;
  const exists = db
    .prepare('SELECT 1 FROM demo_credit_transactions WHERE idempotency_key = ?')
    .get(`reg_bonus:${userId}`);
  if (exists) return;
  appendDemoTransaction({
    userId,
    type: 'registration_bonus',
    amountSigned: safeAmount,
    referenceId: userId,
    note: `Registration bonus (+${safeAmount} ETB)`,
    idempotencyKey: `reg_bonus:${userId}`,
    createdAt,
  });
}

export function refreshUserCompletedPlans(userId: string): void {
  const todayEth = getEthiopiaCalendarDate();
  const activeRows = db
    .prepare("SELECT id, start_date, period_days FROM plan_purchases WHERE user_id = ? AND status = 'active'")
    .all(userId) as Array<{ id: string; start_date: string; period_days: number }>;
  for (const row of activeRows) {
    const progress = computePlanProgress(row.start_date, row.period_days, false, todayEth);
    if (progress.isCompleted) {
      db.prepare("UPDATE plan_purchases SET status = 'completed' WHERE id = ?").run(row.id);
    }
  }
}
