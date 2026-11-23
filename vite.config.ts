import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Requirement 9.4: ship a Content Security Policy with connect-src 'self'.
// Injected at build time only, so the dev server (HMR inline scripts and
// websocket) keeps working.
const CSP = [
  "default-src 'self'",
  "connect-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
