import * as crypto from 'crypto';
import { executeQuery } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'trustlens-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

interface SessionUser {
  id: string;
  email: string;
  name?: string;
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
export async function createUser(email: string, password: string, name?: string): Promise<{ id: string; email: string; name?: string } | null> {
  const passwordHash = hashPassword(password);
  try {
    const result = await executeQuery<{ id: string; email: string; name: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name`,
      [email.toLowerCase(), name || null, passwordHash]
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

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  const result = await executeQuery<{ id: string; email: string; name: string; password_hash: string }>(
    `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
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
  };
}

// Get user by ID
export async function getUserById(id: string): Promise<SessionUser | null> {
  const result = await executeQuery<{ id: string; email: string; name: string }>(
    `SELECT id, email, name FROM users WHERE id = $1`,
    [id]
  );

  if (result.length === 0) return null;

  return {
    id: result[0].id,
    email: result[0].email,
    name: result[0].name,
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

// Hash password utility for direct export
export { hashPassword, verifyPassword, generateToken, generateJWT, verifyJWT };

// Export types
export type { SessionUser, Session };
