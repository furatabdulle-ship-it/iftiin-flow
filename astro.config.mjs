import { defineConfig } from 'astro/config';

// SITE_URL: production origin, e.g. https://iftiin-flow.com
// BASE_PATH: needed only for GitHub project pages, e.g. /iftiin-flow
export default defineConfig({
  site: process.env.SITE_URL || 'https://iftiin-flow.com',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
});
