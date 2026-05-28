import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  alias: {
    '@': resolve(import.meta.dirname),
  },
  manifest: {
    name: 'Overfetch',
    description:
      'Analyzes runtime API payload usage — tracks which response fields the UI actually uses.',
    permissions: ['tabs'],
    host_permissions: [
      'http://localhost/*',
      'http://127.0.0.1/*',
      'http://*/*',
      'https://*/*',
    ],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    action: {
      default_title: 'Overfetch',
      default_popup: '/popup.html',
    },
    web_accessible_resources: [
      {
        resources: ['inject.js'],
        matches: ['<all_urls>'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
