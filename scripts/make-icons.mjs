// Generates the app icon (macOS icon grid: 824px body on a 1024 canvas) and the DMG background.
// Run with: npm run icons
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('build', { recursive: true })

const lamp = `
  <g transform="translate(178 188) scale(21.7)">
    <circle cx="9.5" cy="11.4" r="9" fill="url(#glow)"/>
    <path d="M9.5 4.6c2.3 3 3.5 5.1 3.5 7 0 2.1-1.55 3.6-3.5 3.6S6 13.7 6 11.6c0-1.9 1.2-4 3.5-7Z" fill="url(#flame)"/>
    <path d="M9.5 9.8c.95 1.25 1.4 2.05 1.4 2.85 0 .85-.62 1.45-1.4 1.45s-1.4-.6-1.4-1.45c0-.8.45-1.6 1.4-2.85Z" fill="#FFF8E6"/>
    <path d="M4.2 15.6h23.3c.5 0 .86.46.73.94C27 21.4 22.3 25 16.4 25c-5.1 0-9.3-2.7-11-6.6l-2.3-1.4c-.62-.38-.35-1.4.38-1.4h.72Z" fill="url(#clay)"/>
    <path d="M4.2 15.6h23.3c.5 0 .86.46.73.94l-.1.36H4.4Z" fill="#FFF6E6" opacity=".55"/>
    <rect x="12" y="25.6" width="9" height="2.4" rx="1.2" fill="url(#clay)" opacity=".75"/>
  </g>`

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26345C"/>
      <stop offset="1" stop-color="#0D1324"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.12" r="0.8">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".10"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.55" r="0.5">
      <stop offset="0" stop-color="#FFD37A" stop-opacity=".55"/>
      <stop offset=".6" stop-color="#FFB547" stop-opacity=".12"/>
      <stop offset="1" stop-color="#FFB547" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFEFB8"/>
      <stop offset="1" stop-color="#F29A2E"/>
    </linearGradient>
    <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F1E4CC"/>
      <stop offset="1" stop-color="#C9A77C"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".35"/>
    </filter>
  </defs>`

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs}
  <g filter="url(#shadow)">
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#sheen)"/>
    <rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="2"/>
  </g>
  ${lamp}
</svg>`

writeFileSync('build/icon.svg', icon)
await sharp(Buffer.from(icon)).png().toFile('build/icon.png')

// DMG background: 660×400 (+ @2x). Icons sit at (180, 190) and (480, 190).
const dmg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${660 * s}" height="${400 * s}" viewBox="0 0 660 400">
  <defs>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16203A"/>
      <stop offset="1" stop-color="#0B101D"/>
    </linearGradient>
    <radialGradient id="g" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#FFC45E" stop-opacity=".08"/>
      <stop offset="1" stop-color="#FFC45E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="660" height="400" fill="url(#d)"/>
  <rect width="660" height="400" fill="url(#g)"/>
  <path d="M282 190h86" stroke="#AEB9D1" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 9"/>
  <path d="M362 181l12 9-12 9" fill="none" stroke="#AEB9D1" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="330" y="330" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="14" font-weight="500" fill="#C9D2E3" fill-opacity=".8">Drag Pahana into Applications</text>
  <text x="330" y="352" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="11.5" fill="#8E9AB3" fill-opacity=".8">First launch: System Settings → Privacy &amp; Security → Open Anyway</text>
</svg>`
await sharp(Buffer.from(dmg(1))).png().toFile('build/background.png')
await sharp(Buffer.from(dmg(2))).png().toFile('build/background@2x.png')
console.log('icons written to build/')
