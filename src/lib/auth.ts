import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { query, withTransaction } from './db';

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
  displayName: string;
};

type PasswordRow = {
  id: string;
  email: string;
  role: Account['role'];
  display_name: string;
  password_hash: string;
};

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

export async function registerAccount(email: string, password: string, displayName: string): Promise<Account> {
  const passwordHash = await hashPassword(password);
  const result = await query<Account>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, display_name AS "displayName"`,
    [email.toLowerCase(), passwordHash, displayName],
  );
  return result.rows[0];
}

export async function updateAccountDisplayName(accountId: string, displayName: string): Promise<Account | null> {
  const result = await query<Account>(
    `UPDATE users
     SET display_name = $2
     WHERE id = $1
     RETURNING id, email, role, display_name AS "displayName"`,
    [accountId, displayName],
  );
  return result.rows[0] ?? null;
}

export async function authenticateAccount(email: string, password: string): Promise<Account | null> {
  const result = await query<PasswordRow>(
    'SELECT id, email, role, display_name, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()],
  );
  const account = result.rows[0];
  if (!account) {
    await deriveKey(password, DUMMY_SALT, SCRYPT_OPTIONS);
    return null;
  }
  if (!(await verifyPassword(password, account.password_hash))) return null;

  return {
    id: account.id,
    email: account.email,
    role: account.role,
    displayName: account.display_name,
  };
}

export async function issuePasswordReset(email: string): Promise<{ email: string; token: string } | null> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await query<{ email: string }>(
    `WITH account AS (
       SELECT id, email FROM users WHERE email = $1
     ),
     issued AS (
       INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_at)
       SELECT id, $2, NOW() + INTERVAL '30 minutes', NOW() FROM account
       ON CONFLICT (user_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash,
           expires_at = EXCLUDED.expires_at,
           requested_at = EXCLUDED.requested_at
       WHERE password_reset_tokens.requested_at <= NOW() - INTERVAL '1 minute'
       RETURNING user_id
     )
     SELECT account.email FROM account
     JOIN issued ON issued.user_id = account.id`,
    [email, tokenHash],
  );
  const account = result.rows[0];
  return account ? { email: account.email, token } : null;
}

export async function completePasswordReset(token: string, password: string): Promise<boolean> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return withTransaction(async (client) => {
    const reset = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    const userId = reset.rows[0]?.user_id;
    if (!userId) return false;

    const passwordHash = await hashPassword(password);
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    return true;
  });
}

export async function cancelPasswordReset(token: string): Promise<void> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash]);
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
    `SELECT users.id, users.email, users.role, users.display_name AS "displayName"
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
