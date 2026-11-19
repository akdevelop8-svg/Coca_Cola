import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';
import type { UserRole } from '../src/types';

export const SESSION_COOKIE_NAME = 'cc_session';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    role: UserRole;
    status: 'active' | 'suspended';
    referralCode: string;
    invitedByUserId: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  sessionToken?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (
    storedHash.startsWith('$2a$') ||
    storedHash.startsWith('$2b$') ||
    storedHash.startsWith('$2y$')
  ) {
    return bcrypt.compareSync(password, storedHash);
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, expiresAt.toISOString(), now.toISOString());
  return token;
}

function isSecureRequest(req: Request): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') return true;
  return false;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = isSecureRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isSecureRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

export function attachAuthUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const cookies = parseCookies(req.headers.cookie);
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
  const token = cookies[SESSION_COOKIE_NAME] || bearerToken;
  if (!token) {
    next();
    return;
  }

  const row = db
    .prepare(
      `SELECT u.id, u.full_name, u.phone, u.email, u.role, u.status, u.referral_code,
              u.invited_by_user_id, u.avatar_url, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | {
        id: string;
        full_name: string;
        phone: string;
        email: string | null;
        role: UserRole;
        status: 'active' | 'suspended';
        referral_code: string;
        invited_by_user_id: string | null;
        avatar_url: string | null;
        created_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    if (row) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    }
    next();
    return;
  }

  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    row.id
  );

  req.sessionToken = token;
  req.authUser = {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    status: row.status,
    referralCode: row.referral_code,
    invitedByUserId: row.invited_by_user_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.authUser.status === 'suspended') {
    res.status(403).json({ error: 'Account is suspended. Please contact customer service.' });
    return;
  }
  next();
}

export const ADMIN_ROLES: UserRole[] = [
  'owner_admin',
  'finance_admin',
  'support_admin',
  'content_admin',
  'viewer',
];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function requireAdminRole(allowedRoles: UserRole[] = ADMIN_ROLES) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient administrative permissions.' });
      return;
    }
    next();
  };
}

// Simple in-memory rate limiter for sensitive endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}
