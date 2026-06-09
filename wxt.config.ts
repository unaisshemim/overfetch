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
    permissions: ['activeTab', 'scripting'],
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
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
