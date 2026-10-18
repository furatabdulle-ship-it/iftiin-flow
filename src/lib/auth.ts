import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { query } from './db';

const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = Buffer.alloc(16);
export const sessionLifetimeSeconds = SESSION_LIFETIME_SECONDS;

function deriveKey(password: string, salt: Buffer, options: typeof SCRYPT_OPTIONS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export type Account = {
  id: string;
  email: string;
  role: 'user' | 'admin';
};

type PasswordRow = { id: string; email: string; role: Account['role']; password_hash: string };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, n, r, p, saltValue, keyValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltValue || !keyValue) return false;

  const salt = Buffer.from(saltValue, 'base64url');
  const expected = Buffer.from(keyValue, 'base64url');
  if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;

  const key = await deriveKey(password, salt, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(key, expected);
}

export async function registerAccount(email: string, password: string): Promise<Account> {
  const passwordHash = await hashPassword(password);
  const result = await query<Account>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, role`,
    [email.toLowerCase(), passwordHash],
  );
  return result.rows[0];
}

export async function authenticateAccount(email: string, password: string): Promise<Account | null> {
  const result = await query<PasswordRow>(
    'SELECT id, email, role, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()],
  );
  const account = result.rows[0];
  if (!account) {
    await deriveKey(password, DUMMY_SALT, SCRYPT_OPTIONS);
    return null;
  }
  if (!(await verifyPassword(password, account.password_hash))) return null;

  return { id: account.id, email: account.email, role: account.role };
}

export async function createSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM sessions WHERE expires_at <= NOW()');
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))`,
    [accountId, tokenHash, SESSION_LIFETIME_SECONDS],
  );
  return token;
}

export async function getSessionAccount(token: string | undefined): Promise<Account | null> {
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await query<Account>(
    `SELECT users.id, users.email, users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}
