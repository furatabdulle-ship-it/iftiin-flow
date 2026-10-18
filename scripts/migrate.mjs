import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ist nicht gesetzt. Lege eine .env-Datei an.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const migrationsUrl = new URL('../database/migrations/', import.meta.url);
  const migrationsPath = fileURLToPath(migrationsUrl);
  const migrations = (await readdir(migrationsPath))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  for (const name of migrations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [7_410_182_026]);
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name],
      );
      if (alreadyApplied.rowCount) {
        await client.query('ROLLBACK');
        continue;
      }
      const migration = await readFile(new URL(name, migrationsUrl), 'utf8');
      await client.query(migration);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Datenbankmigration ${name} erfolgreich angewendet.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  console.error('Datenbankmigration fehlgeschlagen:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
