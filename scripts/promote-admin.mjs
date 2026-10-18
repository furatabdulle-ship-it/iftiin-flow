import pg from 'pg';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Verwendung: npm run admin:promote -- name@example.com');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ist nicht gesetzt. Lege eine .env-Datei an.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    'UPDATE users SET role = $1 WHERE email = $2 RETURNING email',
    ['admin', email],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Für ${email} wurde kein Konto gefunden. Registriere dich zuerst.`);
  }
  console.log(`${result.rows[0].email} ist jetzt Admin.`);
} finally {
  await pool.end();
}
