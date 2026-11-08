import { createHash, randomBytes } from 'node:crypto';
import type { Locale } from './i18n';
import { query } from './db';

const confirmationLifetimeHours = 24;
const pendingRetentionDays = 7;
const confirmedRetentionMonths = 12;
let cleanupTimerStarted = false;

export type WaitlistSubscriber = {
  id: string;
  email: string;
  locale: Locale;
  consent_at: Date | string;
  confirmed_at: Date | string;
  last_update_sent_at: Date | string | null;
  retention_until: Date | string;
};

function createToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function purgeExpiredWaitlistSignups(): Promise<void> {
  await query(
    `DELETE FROM skills_navigator_waitlist
     WHERE (status = 'pending' AND created_at <= NOW() - ($1::text || ' days')::interval)
        OR (status = 'confirmed' AND retention_until <= NOW())`,
    [pendingRetentionDays],
  );
}

export function scheduleWaitlistCleanup(): void {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;
  const timer = setInterval(() => {
    void purgeExpiredWaitlistSignups().catch((error: unknown) => {
      console.error('Abgelaufene Skills-Navigator-Anmeldungen konnten nicht gelöscht werden:', error instanceof Error ? error.name : 'unknown');
    });
  }, 60 * 60 * 1_000);
  timer.unref();
}

export async function createWaitlistSignup(
  email: string,
  locale: Locale,
): Promise<{ confirmationToken: string; unsubscribeToken: string } | null> {
  const confirmationToken = createToken();
  const unsubscribeToken = createToken();
  const signup = await query<{ id: string }>(
    `INSERT INTO skills_navigator_waitlist (
       email, locale, consent_at, status, confirmation_token_hash, confirmation_expires_at
     )
     VALUES (
       $1, $2, NOW(), 'pending', $3, NOW() + ($4::text || ' hours')::interval
     )
     ON CONFLICT (email) DO UPDATE SET
       locale = EXCLUDED.locale,
       consent_at = NOW(),
       status = 'pending',
       confirmation_token_hash = EXCLUDED.confirmation_token_hash,
       confirmation_expires_at = EXCLUDED.confirmation_expires_at,
       created_at = NOW()
     WHERE skills_navigator_waitlist.status = 'pending'
     RETURNING id`,
    [email, locale, hashToken(confirmationToken), confirmationLifetimeHours],
  );
  const signupId = signup.rows[0]?.id;
  if (!signupId) return null;

  await query(
    `INSERT INTO skills_navigator_waitlist_unsubscribe_tokens (token_hash, signup_id)
     VALUES ($1, $2)`,
    [hashToken(unsubscribeToken), signupId],
  );
  return { confirmationToken, unsubscribeToken };
}

export async function confirmWaitlistSignup(token: string): Promise<boolean> {
  const result = await query(
    `UPDATE skills_navigator_waitlist
     SET status = 'confirmed',
         confirmation_token_hash = NULL,
         confirmation_expires_at = NULL,
         confirmed_at = NOW(),
         retention_until = NOW() + ($2::text || ' months')::interval
     WHERE status = 'pending'
       AND confirmation_token_hash = $1
       AND confirmation_expires_at > NOW()
     RETURNING id`,
    [hashToken(token), confirmedRetentionMonths],
  );
  return result.rowCount === 1;
}

export async function unsubscribeWaitlistSignup(token: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM skills_navigator_waitlist
     WHERE id IN (
       SELECT signup_id
       FROM skills_navigator_waitlist_unsubscribe_tokens
       WHERE token_hash = $1
     )
     RETURNING id`,
    [hashToken(token)],
  );
  return result.rowCount === 1;
}

export async function listWaitlistSubscribers(
  limit: number,
  offset: number,
): Promise<{ subscribers: WaitlistSubscriber[]; total: number }> {
  await purgeExpiredWaitlistSignups();
  const [count, rows] = await Promise.all([
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM skills_navigator_waitlist
       WHERE status = 'confirmed' AND retention_until > NOW()`,
    ),
    query<WaitlistSubscriber>(
      `SELECT id, email, locale, consent_at, confirmed_at, last_update_sent_at, retention_until
       FROM skills_navigator_waitlist
       WHERE status = 'confirmed' AND retention_until > NOW()
       ORDER BY confirmed_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
  ]);
  return { subscribers: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
}

export async function getWaitlistSubscribersByIds(ids: string[]): Promise<WaitlistSubscriber[]> {
  await purgeExpiredWaitlistSignups();
  const result = await query<WaitlistSubscriber>(
    `SELECT id, email, locale, consent_at, confirmed_at, last_update_sent_at, retention_until
     FROM skills_navigator_waitlist
     WHERE id = ANY($1::uuid[])
       AND status = 'confirmed'
       AND retention_until > NOW()
     ORDER BY confirmed_at DESC`,
    [ids],
  );
  return result.rows;
}

export async function deleteWaitlistSignup(id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM skills_navigator_waitlist WHERE id = $1 RETURNING id',
    [id],
  );
  return result.rowCount === 1;
}

export async function getWaitlistCounts(): Promise<{ confirmed: number; pending: number }> {
  await purgeExpiredWaitlistSignups();
  const result = await query<{ status: 'pending' | 'confirmed'; total: string }>(
    `SELECT status, COUNT(*)::text AS total
     FROM skills_navigator_waitlist
     GROUP BY status`,
  );
  return result.rows.reduce(
    (counts, row) => ({ ...counts, [row.status]: Number(row.total) }),
    { confirmed: 0, pending: 0 },
  );
}

export async function sendWaitlistUpdate(
  subscriber: WaitlistSubscriber,
  subject: string,
  message: string,
  sendEmail: (email: string, locale: Locale, subject: string, message: string, token: string) => Promise<void>,
): Promise<void> {
  const unsubscribeToken = createToken();
  const tokenHash = hashToken(unsubscribeToken);
  await query(
    `INSERT INTO skills_navigator_waitlist_unsubscribe_tokens (token_hash, signup_id)
     VALUES ($1, $2)`,
    [tokenHash, subscriber.id],
  );

  try {
    await sendEmail(subscriber.email, subscriber.locale, subject, message, unsubscribeToken);
  } catch (error) {
    await query(
      'DELETE FROM skills_navigator_waitlist_unsubscribe_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    throw error;
  }

  await query(
    `UPDATE skills_navigator_waitlist
     SET last_update_sent_at = NOW(),
         retention_until = NOW() + ($2::text || ' months')::interval
     WHERE id = $1 AND status = 'confirmed'`,
    [subscriber.id, confirmedRetentionMonths],
  );
}
