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

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const config = getPasswordResetEmailConfig();
  if (!config) throw new Error('Gmail API password reset settings are missing or invalid.');
  if (!isEmailAddress(email)) throw new Error('The password reset recipient address is invalid.');

  const resetUrl = new URL('/reset-password/', config.siteUrl);
  resetUrl.searchParams.set('token', token);
  const subject = `=?UTF-8?B?${Buffer.from('Passwort zurücksetzen – iftiin flow.', 'utf8').toString('base64')}?=`;
  const message = [
    `From: ${config.senderEmail}`,
    `To: ${email}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    'Du hast das Zurücksetzen deines Passworts angefordert.',
    'Öffne diesen Link innerhalb von 30 Minuten:',
    '',
    resetUrl.toString(),
    '',
    'Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.',
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
  if (!response.ok) throw new Error(`Gmail API rejected the password reset email (HTTP ${response.status}).`);
}
