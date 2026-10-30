export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and PASSWORD_RESET_FROM must be configured.');
  }

  const siteUrl = process.env.SITE_URL || import.meta.env.SITE;
  if (!siteUrl) throw new Error('SITE_URL must be configured to send password reset links.');
  const resetUrl = new URL('/reset-password/', siteUrl);
  resetUrl.searchParams.set('token', token);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Passwort zurücksetzen – iftiin flow.',
      text: `Du hast das Zurücksetzen deines Passworts angefordert. Öffne diesen Link innerhalb von 30 Minuten:\n\n${resetUrl}\n\nWenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.`,
      html: `<p>Du hast das Zurücksetzen deines Passworts angefordert.</p><p><a href="${resetUrl.toString()}">Passwort jetzt zurücksetzen</a></p><p>Der Link ist 30 Minuten gültig. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`Resend rejected the password reset email (${response.status}).`);
}
