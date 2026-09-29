import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Band, Reading } from '@shared/types'

type Point = Pick<Reading, 'id' | 'takenAt' | 'sys' | 'dia' | 'glucose' | 'glucoseType'>

const PAD = { l: 34, r: 14, t: 12, b: 22 }
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface Series {
  key: string
  label: string
  values: (number | null)[]
  color: string
  hollow?: (i: number) => boolean
  width?: number
}

interface Band_ {
  from: number
  to: number
  label: string
}

/**
 * Small-multiple trend chart: blood pressure (systolic + diastolic) and glucose,
 * with the target zone shaded and the threshold that matters drawn in.
 */
export function TrendCharts({
  readings,
  latestBand,
  animateKey,
  compact = false,
}: {
  readings: Point[]
  latestBand?: Band
  animateKey?: string
  compact?: boolean
}) {
  const pts = useMemo(() => readings.slice().sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt)), [readings])
  const hasBp = pts.some((p) => p.sys != null)
  const hasGl = pts.some((p) => p.glucose != null)
  const h = compact ? 118 : 150

  return (
    <div className="grid gap-4">
      {hasBp && (
        <Chart
          title="Blood pressure"
          unit="mmHg"
          height={h}
          points={pts}
          animateKey={animateKey}
          latestBand={latestBand}
          domain={[60, 200]}
          target={{ from: 60, to: 140, label: 'Target <140/90' }}
          threshold={{ at: 160, label: '160' }}
          series={[
            { key: 'sys', label: 'Systolic', values: pts.map((p) => p.sys), color: 'var(--text)', width: 2 },
            { key: 'dia', label: 'Diastolic', values: pts.map((p) => p.dia), color: 'var(--text-3)', width: 1.5 },
          ]}
        />
      )}
      {hasGl && (
        <Chart
          title="Glucose"
          unit="mg/dL"
          height={h}
          points={pts}
          animateKey={animateKey}
          latestBand={latestBand}
          domain={[40, 320]}
          target={{ from: 70, to: 180, label: 'Target 70–180' }}
          threshold={{ at: 300, label: '300' }}
          series={[
            {
              key: 'gl',
              label: 'Glucose',
              values: pts.map((p) => p.glucose),
              color: 'var(--accent-text)',
              width: 2,
              hollow: (i) => pts[i].glucoseType === 'random',
            },
          ]}
          legend={
            <span className="flex items-center gap-3 text-[11px] text-fg-3">
              <span className="flex items-center gap-1">
                <svg width="8" height="8">
                  <circle cx="4" cy="4" r="3" fill="var(--accent-text)" />
                </svg>
                FBS
              </span>
              <span className="flex items-center gap-1">
                <svg width="8" height="8">
                  <circle cx="4" cy="4" r="2.5" fill="none" stroke="var(--accent-text)" strokeWidth="1.4" />
                </svg>
                RBS
              </span>
            </span>
          }
        />
      )}
    </div>
  )
}

function Chart({
  title,
  unit,
  height,
  points,
  series,
  domain,
  target,
  threshold,
  latestBand,
  animateKey,
  legend,
}: {
  title: string
  unit: string
  height: number
  points: Point[]
  series: Series[]
  domain: [number, number]
  target: Band_
  threshold: { at: number; label: string }
  latestBand?: Band
  animateKey?: string
  legend?: React.ReactNode
}) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
  const lo = Math.min(domain[0], Math.floor((Math.min(...all) - 10) / 20) * 20)
  const hi = Math.max(domain[1], Math.ceil((Math.max(...all) + 10) / 20) * 20)
  const times = points.map((p) => Date.parse(p.takenAt))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const span = Math.max(t1 - t0, 86_400_000 * 20)

  const innerW = Math.max(10, width - PAD.l - PAD.r)
  const innerH = height - PAD.t - PAD.b
  const x = (t: number) => PAD.l + ((t - (t1 - span)) / span) * innerW
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * innerH

  const ticks = niceTicks(lo, hi)
  const monthTicks = useMemo(() => {
    const out: { t: number; label: string }[] = []
    const d = new Date(t1 - span)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    d.setMonth(d.getMonth() + 1)
    while (d.getTime() <= t1) {
      out.push({ t: d.getTime(), label: MONTH.format(d) })
      d.setMonth(d.getMonth() + 1)
    }
    return out
  }, [t1, span])

  const paths = series.map((s) => {
    let d = ''
    s.values.forEach((v, i) => {
      if (v == null) return
      d += `${d ? 'L' : 'M'}${x(times[i]).toFixed(1)} ${y(v).toFixed(1)}`
    })
    return d
  })

  const last = points.length - 1
  const hovered = hover != null ? points[hover] : null

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-fg-2">{title}</span>
          <span className="text-[11px] text-fg-4">{unit}</span>
        </div>
        {legend}
      </div>
      <div ref={ref} className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} className="overflow-visible">
            {/* target zone */}
            <rect
              x={PAD.l}
              width={innerW}
              y={y(Math.min(hi, target.to))}
              height={Math.max(0, y(Math.max(lo, target.from)) - y(Math.min(hi, target.to)))}
              fill="var(--green)"
              opacity={0.07}
              rx={4}
            />
            <text x={PAD.l + innerW - 4} y={y(target.to) + 12} textAnchor="end" className="fill-[var(--green-text)] text-[10px] font-semibold" opacity={0.8}>
              {target.label}
            </text>
            {/* grid */}
            {ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={PAD.l + innerW} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
                <text x={PAD.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-[var(--text-4)] text-[10px] tnum">
                  {v}
                </text>
              </g>
            ))}
            {threshold.at < hi && (
              <line
                x1={PAD.l}
                x2={PAD.l + innerW}
                y1={y(threshold.at)}
                y2={y(threshold.at)}
                stroke="var(--red)"
                strokeOpacity={0.5}
                strokeDasharray="3 4"
              />
            )}
            {monthTicks.map((m) => (
              <text key={m.t} x={x(m.t)} y={height - 4} textAnchor="middle" className="fill-[var(--text-4)] text-[10px]">
                {m.label}
              </text>
            ))}
            {/* lines */}
            {series.map((s, i) => (
              <motion.path
                key={`${s.key}-${animateKey}`}
                d={paths[i]}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 + i * 0.08 }}
              />
            ))}
            {/* points */}
            {series.map((s) =>
              s.values.map((v, i) => {
                if (v == null) return null
                const isLast = i === last
                const color = isLast && latestBand ? `var(--${latestBand})` : s.color
                const hollow = s.hollow?.(i)
                return (
                  <motion.circle
                    key={`${s.key}-${i}-${animateKey}`}
                    cx={x(times[i])}
                    cy={y(v)}
                    r={isLast ? 4.5 : hover === i ? 4 : 3}
                    fill={hollow ? 'var(--panel)' : color}
                    stroke={color}
                    strokeWidth={hollow ? 1.6 : isLast ? 2 : 0}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.25 + (i / Math.max(1, last)) * 0.6 }}
                  />
                )
              }),
            )}
            {hover != null && (
              <line x1={x(times[hover])} x2={x(times[hover])} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--line-strong)" />
            )}
            {/* hover targets */}
            {points.map((p, i) => {
              const prev = i > 0 ? x(times[i - 1]) : PAD.l
              const next = i < last ? x(times[i + 1]) : PAD.l + innerW
              const cx = x(times[i])
              return (
                <rect
                  key={p.id}
                  x={(prev + cx) / 2}
                  width={Math.max(1, (next + cx) / 2 - (prev + cx) / 2)}
                  y={0}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              )
            })}
          </svg>
        )}
        <AnimatePresence>
          {hovered && hover != null && (
            <motion.div
              key="tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute top-0 z-10 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11.5px] shadow-[var(--pop-shadow)]"
              style={{
                left: Math.min(Math.max(0, x(times[hover]) - 70), width - 140),
              }}
            >
              <div className="font-semibold text-fg-2">{DAY.format(new Date(hovered.takenAt))}</div>
              <div className="tnum text-fg">
                {series.map((s) => {
                  const v = s.values[hover]
                  if (v == null) return null
                  return (
                    <span key={s.key} className="mr-2">
                      {s.label} <b>{v}</b>
                      {s.key === 'gl' ? ` ${hovered.glucoseType === 'fasting' ? 'FBS' : 'RBS'}` : ''}
                    </span>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function niceTicks(lo: number, hi: number): number[] {
  const range = hi - lo
  const step = range > 250 ? 100 : range > 120 ? 40 : 20
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
}
