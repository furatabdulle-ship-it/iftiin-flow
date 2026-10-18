import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const localEnvFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(localEnvFile)) process.loadEnvFile(localEnvFile);

export default defineConfig({
  site: process.env.SITE_URL || 'https://iftiin-flow.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'always',
});
