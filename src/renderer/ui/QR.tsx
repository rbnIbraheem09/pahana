import QRCode from 'qrcode'
import { useMemo } from 'react'

/**
 * Crisp SVG QR code with softened modules and rounded finder patterns.
 * Error correction M keeps it scannable from a printed card or a screen.
 */
export function QR({
  value,
  size = 160,
  fg = 'currentColor',
  bg = 'transparent',
  className = '',
}: {
  value: string
  size?: number
  fg?: string
  bg?: string
  className?: string
}) {
  const { n, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const data = qr.modules.data
    const inFinder = (x: number, y: number) =>
      (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
    let d = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!data[y * n + x] || inFinder(x, y)) continue
        // 0.9-unit modules with a small radius read as "designed" but stay scannable
        d += `M${x + 0.05} ${y + 0.3}a.25 .25 0 0 1 .25 -.25h.4a.25 .25 0 0 1 .25 .25v.4a.25 .25 0 0 1 -.25 .25h-.4a.25 .25 0 0 1 -.25 -.25z`
      }
    }
    return { n, path: d }
  }, [value])

  const quiet = 2
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.6} fill="none" stroke={fg} strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} fill={fg} />
    </g>
  )

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`}
      className={className}
      role="img"
      aria-label={`QR code: ${value}`}
      shapeRendering="geometricPrecision"
    >
      <rect x={-quiet} y={-quiet} width={n + quiet * 2} height={n + quiet * 2} fill={bg} rx={2} />
      <path d={path} fill={fg} />
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  )
}
