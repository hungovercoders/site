// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://hungovercoders.com',
  integrations: [mdx(), sitemap()],

  fonts: [
      {
          provider: fontProviders.google(),
          name: 'Lora',
          cssVariable: '--font-body',
          fallbacks: ['Georgia', 'Cambria', 'serif'],
          weights: [400, 500, 600, 700],
          styles: ['normal', 'italic'],
      },
      {
          provider: fontProviders.google(),
          name: 'JetBrains Mono',
          cssVariable: '--font-mono',
          fallbacks: ['Menlo', 'Consolas', 'monospace'],
          weights: [400, 700],
          styles: ['normal'],
      },
	],

  adapter: cloudflare(),
});