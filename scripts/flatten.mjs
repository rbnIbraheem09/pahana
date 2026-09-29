// Dev helper: composite a capturePage() PNG (transparent where macOS vibrancy shows) onto a backdrop.
import sharp from 'sharp'
const [, , input, output, bg = '#1b2233'] = process.argv
await sharp(input).flatten({ background: bg }).toFile(output)
