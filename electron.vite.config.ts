import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = { '@shared': resolve('src/shared') }

/** Strict CSP for the desktop UI in production builds (dev needs Vite's inline preamble). */
const fieldCsp: Plugin = {
  name: 'pahana-field-csp',
  apply: 'build',
  transformIndexHtml(html, ctx) {
    if (!ctx.filename.endsWith('index.html')) return html
    const csp =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'"
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
  },
}

export default defineConfig({
  main: {
    resolve: { alias: shared },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@ui': resolve('src/renderer/ui') },
    },
    plugins: [react(), tailwindcss(), fieldCsp],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          portal: resolve('src/renderer/portal.html'),
        },
      },
    },
  },
})
