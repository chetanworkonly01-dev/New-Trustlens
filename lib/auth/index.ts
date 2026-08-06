import * as crypto from 'crypto';
import { executeQuery } from '../db';

const JWT_SECRET = process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? process.env.PROD_JWT_SECRET
    : process.env.DEV_JWT_SECRET) ||
  'trustlens-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

interface SessionUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface Session {
  user: SessionUser;
  expires: string;
  token: string;
}

// Generate a cryptographically secure random token
function generateToken(size: number = 32): string {
  return crypto.randomBytes(size).toString('hex');
}

// Hash password using PBKDF2
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password
function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

// Generate JWT token
function generateJWT(payload: Record<string, unknown>, expiresIn: string = JWT_EXPIRES_IN): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresIn === '30d' ? 30 * 24 * 60 * 60 : 24 * 60 * 60);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Verify JWT token
function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Create a new user
export async function createUser(
  email: string,
  password: string,
  name?: string,
  role: string = 'user'
): Promise<{ id: string; email: string; name?: string } | null> {
  const passwordHash = hashPassword(password);
  try {
    const result = await executeQuery<{ id: string; email: string; name: string }>(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name`,
      [email.toLowerCase(), name || null, passwordHash, role]
    );
    if (result.length > 0) {
      return { id: result[0].id, email: result[0].email, name: result[0].name };
    }
    return null;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('23505')) {
      throw new Error('User already exists');
    }
    throw err;
  }
}

// Check if any users exist (to determine if this is the first user / super admin)
export async function userCount(): Promise<number> {
  const result = await executeQuery<{ count: string }>(
    `SELECT COUNT(*) as count FROM users`
  );
  return result.length > 0 ? parseInt(result[0].count, 10) : 0;
}

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const result = await executeQuery<{ id: string; email: string; name: string; password_hash: string; role: string }>(
    `SELECT id, email, name, password_hash, role FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.length === 0) return null;

  const user = result[0];
  if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

// Get user by ID
export async function getUserById(id: string): Promise<SessionUser | null> {
  const result = await executeQuery<{ id: string; email: string; name: string; role: string }>(
    `SELECT id, email, name, role FROM users WHERE id = $1`,
    [id]
  );

  if (result.length === 0) return null;

  return {
    id: result[0].id,
    email: result[0].email,
    name: result[0].name,
    role: result[0].role,
  };
}

// Get user by email
export async function getUserByEmail(email: string): Promise<{ id: string; email: string; name: string | null; created_at: string } | null> {
  const result = await executeQuery<{ id: string; email: string; name: string | null; created_at: string }>(
    `SELECT id, email, name, created_at FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.length === 0) return null;
  return result[0];
}

// Generate password reset token
export async function generateResetToken(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const token = generateToken(32);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await executeQuery(
    `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
    [token, expiry.toISOString(), user.id]
  );

  return token;
}

// Reset password using token
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const result = await executeQuery<{ id: string }>(
    `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
    [token]
  );

  if (result.length === 0) return false;

  const passwordHash = hashPassword(newPassword);
  await executeQuery(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2`,
    [passwordHash, result[0].id]
  );

  return true;
}

// Create session (JWT)
export function createSession(user: SessionUser): Session {
  const token = generateJWT({ userId: user.id });
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return {
    user,
    expires: expires.toISOString(),
    token,
  };
}

// Verify session token
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const payload = verifyJWT(token) as { userId?: string } | null;
  if (!payload || !payload.userId) return null;

  return getUserById(payload.userId);
}

// Extract session from request cookies (for server-side use)
export function getSessionFromCookies(request: Request): { user: SessionUser } | null {
  const cookies = request.headers.get('cookie');
  const tokenMatch = cookies?.match(/auth-token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : undefined;
  if (!token) return null;

  const payload = verifyJWT(token) as { userId?: string } | null;
  if (!payload || !payload.userId) return null;

  // Synchronous verification - return the payload info immediately
  // Full user lookup can be done async if needed
  return {
    user: {
      id: payload.userId,
      email: '',
      name: undefined,
      role: undefined,
    },
  };
}

// Extract session from request cookies (async version with full user lookup)
export async function getSessionFromCookiesAsync(request: Request): Promise<{ user: SessionUser } | null> {
  const cookies = request.headers.get('cookie');
  const tokenMatch = cookies?.match(/auth-token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : undefined;
  if (!token) return null;

  const user = await verifySession(token);
  if (!user) return null;

  return { user };
}

// Hash password utility for direct export
export { hashPassword, verifyPassword, generateToken, generateJWT, verifyJWT };

// Export types
export type { SessionUser, Session };

// ── System Settings ──────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const result = await executeQuery<{ value: string }>(
    `SELECT value FROM system_settings WHERE key = $1`,
    [key]
  );
  return result.length > 0 ? result[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await executeQuery(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

export async function isSignupAllowed(): Promise<boolean> {
  const value = await getSetting('is_signup_allowed');
  return value === 'true';
}

export async function setSignupAllowed(allowed: boolean): Promise<void> {
  await setSetting('is_signup_allowed', allowed ? 'true' : 'false');
}
