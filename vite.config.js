import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Один источник версии для самой игры и Android-сборки.
const appVersion = readFileSync(new URL('./version.txt', import.meta.url), 'utf8').trim();

export default defineConfig({
  base: './',
  plugins: [{
    name: 'wonder-meadow-version',
    transformIndexHtml(html) {
      return html.replaceAll('__APP_VERSION__', appVersion);
    },
  }],
  build: { outDir: 'dist' },
  server: { host: '0.0.0.0', allowedHosts: true },
});
