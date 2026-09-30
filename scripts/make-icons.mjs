// Generates the app icon (macOS icon grid: 824px body on a 1024 canvas) and the DMG background.
// Run with: npm run icons
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

mkdirSync('build', { recursive: true })

// Nexa Health mark on its 32-unit grid (same geometry as src/renderer/ui/Logo.tsx).
const mark = `
    <circle cx="24.64" cy="14.31" r="3.4" fill="url(#blue)"/>
    <circle cx="24.93" cy="5.0" r="4.66" fill="url(#cyan)"/>
    <circle cx="6.01" cy="17.9" r="4.37" fill="url(#blue)"/>
    <circle cx="6.69" cy="27.6" r="3.9" fill="url(#cyan)"/>
    <rect x="-1.54" y="8.63" width="35.27" height="11.06" rx="5.53" transform="translate(0.35 0.75) rotate(43.86 16.1 14.16)" fill="#020a24" opacity=".35"/>
    <rect x="-1.54" y="8.63" width="35.27" height="11.06" rx="5.53" transform="rotate(43.86 16.1 14.16)" fill="url(#bar)"/>`

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16357F"/>
      <stop offset="1" stop-color="#081436"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.3" cy="0.12" r="0.8">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".12"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1FE3F7"/>
      <stop offset=".55" stop-color="#1FB2F2"/>
      <stop offset="1" stop-color="#1F5FE0"/>
    </linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2=".4" y2="1">
      <stop offset="0" stop-color="#35E2F8"/>
      <stop offset="1" stop-color="#14B6EC"/>
    </linearGradient>
    <linearGradient id="blue" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#2F86F0"/>
      <stop offset="1" stop-color="#1F58DC"/>
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
    <rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="#FFFFFF" stroke-opacity=".1" stroke-width="2"/>
  </g>
  <g transform="translate(262 262) scale(15.625)">${mark}
  </g>
</svg>`

writeFileSync('build/icon.svg', icon)
await sharp(Buffer.from(icon)).png().toFile('build/icon.png')

// DMG background: 660×400 (+ @2x). Icons sit at (180, 190) and (480, 190).
const dmg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${660 * s}" height="${400 * s}" viewBox="0 0 660 400">
  <defs>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13295E"/>
      <stop offset="1" stop-color="#081432"/>
    </linearGradient>
    <radialGradient id="g" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#1FB2F2" stop-opacity=".1"/>
      <stop offset="1" stop-color="#1FB2F2" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="660" height="400" fill="url(#d)"/>
  <rect width="660" height="400" fill="url(#g)"/>
  <path d="M282 190h86" stroke="#AEC3E8" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 9"/>
  <path d="M362 181l12 9-12 9" fill="none" stroke="#AEC3E8" stroke-opacity=".7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="330" y="330" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="14" font-weight="500" fill="#D2DDF2" fill-opacity=".85">Drag Nexa Health into Applications</text>
  <text x="330" y="352" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-size="11.5" fill="#93A6CC" fill-opacity=".85">First launch: System Settings → Privacy &amp; Security → Open Anyway</text>
</svg>`
await sharp(Buffer.from(dmg(1))).png().toFile('build/background.png')
await sharp(Buffer.from(dmg(2))).png().toFile('build/background@2x.png')
console.log('icons written to build/')
