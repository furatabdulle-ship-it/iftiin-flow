import type { Locale } from './i18n';

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

type PasswordResetEmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  siteUrl: URL;
};

function isEmailAddress(value: string): boolean {
  return /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(value);
}

function getPasswordResetEmailConfig(): PasswordResetEmailConfig | null {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN?.trim();
  const senderEmail = process.env.GMAIL_SENDER_EMAIL?.trim();
  const configuredSiteUrl = process.env.SITE_URL?.trim();
  if (!clientId || !clientSecret || !refreshToken || !senderEmail || !configuredSiteUrl) return null;
  if (!isEmailAddress(senderEmail)) return null;

  let siteUrl: URL;
  try {
    siteUrl = new URL(configuredSiteUrl);
  } catch {
    return null;
  }
  if (
    siteUrl.protocol !== 'https:' ||
    !siteUrl.hostname ||
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== '/' ||
    siteUrl.search ||
    siteUrl.hash
  ) return null;

  return { clientId, clientSecret, refreshToken, senderEmail, siteUrl };
}

export function isPasswordResetEmailConfigured(): boolean {
  return getPasswordResetEmailConfig() !== null;
}

async function getAccessToken(config: PasswordResetEmailConfig): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google OAuth token request failed (HTTP ${response.status}).`);

  const result: unknown = await response.json();
  if (
    typeof result !== 'object' ||
    result === null ||
    !('access_token' in result) ||
    typeof result.access_token !== 'string'
  ) {
    throw new Error('Google OAuth token response did not contain an access token.');
  }
  return result.access_token;
}

async function sendPlainTextEmail(
  config: PasswordResetEmailConfig,
  email: string,
  subjectText: string,
  content: string[],
): Promise<void> {
  if (!isEmailAddress(email)) throw new Error('The email recipient address is invalid.');
  const subject = `=?UTF-8?B?${Buffer.from(subjectText, 'utf8').toString('base64')}?=`;
  const message = [
    `From: ${config.senderEmail}`,
    `To: ${email}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    ...content,
  ].join('\r\n');
  const raw = Buffer.from(message, 'utf8').toString('base64url');
  const accessToken = await getAccessToken(config);
  const response = await fetch(GMAIL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Gmail API rejected the email (HTTP ${response.status}).`);
}

export async function sendPasswordResetEmail(email: string, token: string, locale: Locale = 'de'): Promise<void> {
  const config = getPasswordResetEmailConfig();
  if (!config) throw new Error('Gmail API password reset settings are missing or invalid.');

  const resetUrl = new URL('/reset-password/', config.siteUrl);
  resetUrl.searchParams.set('token', token);
  resetUrl.searchParams.set('lang', locale);
  const content = locale === 'en'
    ? [
        'You requested a password reset.',
        'Open this link within 30 minutes:',
        '',
        resetUrl.toString(),
        '',
        'If you did not make this request, you can ignore this email.',
      ]
    : [
        'Du hast das Zurücksetzen deines Passworts angefordert.',
        'Öffne diesen Link innerhalb von 30 Minuten:',
        '',
        resetUrl.toString(),
        '',
        'Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
      ];
  await sendPlainTextEmail(
    config,
    email,
    locale === 'en' ? 'Reset your password – iftiin flow.' : 'Passwort zurücksetzen – iftiin flow.',
    content,
  );
}

export function isGuestAccessEmailConfigured(): boolean {
  return getPasswordResetEmailConfig() !== null;
}

export async function sendGuestAccessEmail(email: string, token: string, locale: Locale = 'de'): Promise<void> {
  const config = getPasswordResetEmailConfig();
  if (!config) throw new Error('Gmail API guest access settings are missing or invalid.');

  const accessUrl = new URL('/guest-access/', config.siteUrl);
  accessUrl.searchParams.set('token', token);
  accessUrl.searchParams.set('lang', locale);
  const content = locale === 'en'
    ? [
        'Your purchase is confirmed. Open this personal access link within 30 minutes:',
        '',
        accessUrl.toString(),
        '',
        'The link can only be used once. Your guest library will then stay signed in for up to 30 days.',
        'You can request a new access link from the shop at any time.',
      ]
    : [
        'Dein Kauf ist bestätigt. Öffne diesen persönlichen Zugangslink innerhalb von 30 Minuten:',
        '',
        accessUrl.toString(),
        '',
        'Der Link ist einmalig. Danach bleibt deine konto-freie Bibliothek bis zu 30 Tage angemeldet.',
        'Über die Shopseite kannst du jederzeit einen neuen Zugangslink anfordern.',
      ];
  await sendPlainTextEmail(
    config,
    email,
    locale === 'en' ? 'Your iftiin flow. access' : 'Dein iftiin flow. Zugang',
    content,
  );
}
