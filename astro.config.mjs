import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://example.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  compressHTML: true,
  build: { inlineStylesheets: 'auto' }
});
