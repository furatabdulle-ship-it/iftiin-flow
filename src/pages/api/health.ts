import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { json } from '../../lib/http';

export const GET: APIRoute = async () => {
  try {
    await query('SELECT 1');
    return json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    return json({ status: 'unavailable' }, 503);
  }
};
