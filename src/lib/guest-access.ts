import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from './db';

const accessLinkLifetimeMinutes = 30;
const accessSessionLifetimeDays = 30;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createGuestAccessToken(client: PoolClient, email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await client.query(
    `INSERT INTO guest_access_tokens (token_hash, email, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,
    [hashToken(token), email, accessLinkLifetimeMinutes],
  );
  return token;
}

export async function sendGuestAccessToken(email: string): Promise<string | null> {
  const token = randomBytes(32).toString('base64url');
  const result = await query(
    `INSERT INTO guest_access_tokens (token_hash, email, expires_at)
     SELECT $1, $2, NOW() + ($3 * INTERVAL '1 minute')
     WHERE (
       SELECT COUNT(*) FROM guest_access_tokens
       WHERE email = $2 AND created_at > NOW() - INTERVAL '15 minutes'
     ) < 3
     RETURNING token_hash`,
    [hashToken(token), email, accessLinkLifetimeMinutes],
  );
  return result.rowCount ? token : null;
}

export async function discardGuestAccessToken(token: string): Promise<void> {
  if (!tokenPattern.test(token)) return;
  await query('DELETE FROM guest_access_tokens WHERE token_hash = $1 AND consumed_at IS NULL', [hashToken(token)]);
}

export async function redeemGuestAccessToken(token: string): Promise<{ sessionToken: string; email: string } | null> {
  if (!tokenPattern.test(token)) return null;
  const sessionToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const sessionHash = hashToken(sessionToken);

  return withTransaction(async (client) => {
    const result = await client.query<{ email: string }>(
      `SELECT email FROM guest_access_tokens
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    const email = result.rows[0]?.email;
    if (!email) return null;

    const orders = await client.query(
      `SELECT 1 FROM orders
       WHERE user_id IS NULL AND guest_email = $1 AND status = 'paid'
       LIMIT 1`,
      [email],
    );
    if (!orders.rowCount) return null;

    await client.query(
      'UPDATE guest_access_tokens SET consumed_at = NOW() WHERE token_hash = $1',
      [tokenHash],
    );
    await client.query(
      `INSERT INTO guest_access_sessions (token_hash, email, expires_at)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
      [sessionHash, email, accessSessionLifetimeDays],
    );
    return { sessionToken, email };
  });
}

export async function getGuestAccessEmail(sessionToken: string | undefined): Promise<string | null> {
  if (!sessionToken || !tokenPattern.test(sessionToken)) return null;
  const result = await query<{ email: string }>(
    `SELECT s.email
     FROM guest_access_sessions s
     WHERE s.token_hash = $1 AND s.expires_at > NOW()
       AND EXISTS (
         SELECT 1 FROM orders o
         WHERE o.user_id IS NULL AND o.guest_email = s.email AND o.status = 'paid'
       )`,
    [hashToken(sessionToken)],
  );
  return result.rows[0]?.email ?? null;
}

export async function revokeGuestAccessSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken || !tokenPattern.test(sessionToken)) return;
  await query('DELETE FROM guest_access_sessions WHERE token_hash = $1', [hashToken(sessionToken)]);
}

export async function hasGuestOrders(email: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM orders
       WHERE user_id IS NULL AND guest_email = $1 AND status = 'paid'
     ) AS allowed`,
    [email],
  );
  return result.rows[0]?.allowed === true;
}
