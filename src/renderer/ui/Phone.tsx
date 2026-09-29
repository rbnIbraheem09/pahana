import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Lang } from '@shared/types'
import { LampMark } from './Logo'

const LANG_FONT: Record<Lang, string> = {
  en: 'var(--font-ui)',
  si: "'Noto Sans Sinhala Variable', var(--font-ui)",
  ta: "'Noto Sans Tamil Variable', var(--font-ui)",
}

function useStage(key: string, delay = 950) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    setStage(0)
    const t = setTimeout(() => setStage(1), delay)
    return () => clearTimeout(t)
  }, [key, delay])
  return stage
}

/* ------------------------------------------------------------------ */
/* Smartphone                                                          */
/* ------------------------------------------------------------------ */

export function Smartphone({ text, lang, time = 'now', scale = 1 }: { text: string; lang: Lang; time?: string; scale?: number }) {
  const stage = useStage(text)
  return (
    <div style={{ width: 236 * scale, height: 470 * scale }} className="relative flex-none">
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: 236, height: 470, transform: `scale(${scale})` }}
      >
        <div className="relative h-full w-full rounded-[40px] bg-[oklch(0.16_0.01_258)] p-[7px] shadow-[0_0_0_1.5px_oklch(0.34_0.012_258),0_30px_60px_-20px_oklch(0.05_0.02_258/0.7),inset_0_0_0_1px_oklch(0.4_0.01_258/0.6)]">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[33px] bg-[oklch(0.985_0.003_258)] text-[oklch(0.2_0.02_258)]">
            {/* status bar */}
            <div className="flex h-[38px] flex-none items-end justify-between px-6 pb-1 text-[11.5px] font-bold">
              <span>9:41</span>
              <span className="flex items-center gap-1">
                <SignalBars />
                <span className="ml-0.5 inline-block h-[9px] w-[18px] rounded-[3px] border border-current p-[1px]">
                  <span className="block h-full w-[70%] rounded-[1px] bg-current" />
                </span>
              </span>
            </div>
            <div className="absolute top-[9px] left-1/2 h-[20px] w-[74px] -translate-x-1/2 rounded-full bg-black" />
            {/* thread header */}
            <div className="flex flex-none flex-col items-center gap-1 border-b border-[oklch(0.9_0.005_258)] pt-2 pb-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[oklch(0.25_0.04_258)] text-[oklch(0.92_0.02_80)]">
                <LampMark size={22} />
              </div>
              <div className="text-[11px] font-semibold tracking-wide">PAHANA</div>
            </div>
            {/* thread */}
            <div className="flex flex-1 flex-col justify-end gap-2 px-3 pb-3">
              <div className="text-center text-[10px] font-medium text-[oklch(0.55_0.01_258)]">Text message · {time}</div>
              <AnimatePresence mode="popLayout">
                {stage === 0 ? (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, scale: 0.8, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className="flex w-fit origin-bottom-left gap-1 rounded-[18px] bg-[oklch(0.92_0.005_258)] px-3.5 py-3"
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-[7px] w-[7px] rounded-full bg-[oklch(0.6_0.01_258)]"
                        animate={{ opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="msg"
                    initial={{ opacity: 0, scale: 0.85, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', duration: 0.45, bounce: 0 }}
                    className="max-w-[88%] origin-bottom-left rounded-[18px] rounded-bl-[6px] bg-[oklch(0.92_0.005_258)] px-3.5 py-2.5 text-[12.5px] leading-[1.45]"
                    style={{ fontFamily: LANG_FONT[lang] }}
                  >
                    {text}
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {stage === 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="pl-1 text-[10px] font-medium text-[oklch(0.55_0.01_258)]"
                  >
                    Delivered
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mx-3 mb-4 flex h-8 flex-none items-center rounded-full border border-[oklch(0.88_0.005_258)] px-3.5 text-[11.5px] text-[oklch(0.65_0.01_258)]">
              Text Message
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Basic (feature) phone: most estate workers carry one of these       */
/* ------------------------------------------------------------------ */

export function BasicPhone({ text, lang, time = 'now', scale = 1 }: { text: string; lang: Lang; time?: string; scale?: number }) {
  const stage = useStage(text, 1100)
  const lcd = 'oklch(0.86 0.04 175)'
  const ink = 'oklch(0.27 0.04 200)'
  return (
    <div style={{ width: 210 * scale, height: 440 * scale }} className="relative flex-none">
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: 210, height: 440, transform: `scale(${scale})` }}>
        <div className="relative flex h-full w-full flex-col items-center rounded-[34px] bg-[linear-gradient(160deg,oklch(0.3_0.012_258),oklch(0.18_0.01_258))] px-4 pt-4 shadow-[0_0_0_1.5px_oklch(0.36_0.012_258),0_30px_60px_-20px_oklch(0.05_0.02_258/0.7),inset_0_1px_0_oklch(1_0_0/0.12)]">
          <div className="mb-3 h-[5px] w-12 rounded-full bg-[oklch(0.12_0.01_258)] shadow-[inset_0_1px_2px_black]" />
          {/* screen */}
          <div className="w-full rounded-[10px] bg-[oklch(0.12_0.01_258)] p-[6px] shadow-[inset_0_2px_6px_black]">
            <div
              className="relative h-[178px] overflow-hidden rounded-[5px] px-2.5 py-2"
              style={{ background: lcd, color: ink, boxShadow: 'inset 0 0 18px oklch(0.6 0.06 180 / 0.35)' }}
            >
              <div className="flex items-center justify-between text-[9.5px] font-bold">
                <span className="flex items-end gap-[1.5px]">
                  {[3, 5, 7, 9].map((h) => (
                    <span key={h} className="w-[2.5px]" style={{ height: h, background: ink }} />
                  ))}
                </span>
                <span>{time === 'now' ? '10:24' : time}</span>
                <span className="inline-block h-[7px] w-[14px] border p-[1px]" style={{ borderColor: ink }}>
                  <span className="block h-full w-2/3" style={{ background: ink }} />
                </span>
              </div>
              <AnimatePresence mode="wait">
                {stage === 0 ? (
                  <motion.div
                    key="notice"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex h-[140px] flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <motion.svg
                      width="30"
                      height="22"
                      viewBox="0 0 30 22"
                      animate={{ y: [0, -2, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    >
                      <rect x="1" y="1" width="28" height="20" fill="none" stroke={ink} strokeWidth="2" />
                      <path d="M1 1 15 12 29 1" fill="none" stroke={ink} strokeWidth="2" />
                    </motion.svg>
                    <div className="text-[11px] font-bold">1 new message</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="msg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className="mt-1.5"
                  >
                    <div className="mb-1 border-b pb-0.5 text-[10px] font-bold" style={{ borderColor: ink }}>
                      From: PAHANA
                    </div>
                    <div className="text-[10.5px] leading-[1.35]" style={{ fontFamily: LANG_FONT[lang] }}>
                      {text}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="absolute inset-x-0 bottom-0 flex justify-between px-2.5 pb-1 text-[9.5px] font-bold" style={{ background: lcd }}>
                <span>{stage === 0 ? 'Read' : 'Reply'}</span>
                <span>Back</span>
              </div>
            </div>
          </div>
          {/* soft keys + d-pad */}
          <div className="mt-4 flex w-full items-center justify-between px-1">
            <Key w={40} h={16} />
            <div className="grid h-[46px] w-[64px] place-items-center rounded-[50%] bg-[oklch(0.24_0.01_258)] shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_2px_4px_oklch(0_0_0/0.5)]">
              <div className="h-[18px] w-[26px] rounded-[40%] bg-[oklch(0.3_0.012_258)] shadow-[inset_0_1px_0_oklch(1_0_0/0.12)]" />
            </div>
            <Key w={40} h={16} />
          </div>
          <div className="mt-3 grid w-full grid-cols-3 gap-x-3 gap-y-2 px-1">
            {['1', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz', '*', '0 ⎵', '#'].map((k) => {
              const [n, l] = k.split(' ')
              return (
                <div
                  key={k}
                  className="flex h-[26px] items-baseline justify-center gap-1 rounded-[9px] bg-[oklch(0.24_0.01_258)] pt-[5px] text-[oklch(0.85_0.01_258)] shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_2px_3px_oklch(0_0_0/0.45)]"
                >
                  <span className="text-[12px] font-bold">{n}</span>
                  {l && <span className="text-[7px] font-semibold tracking-wide opacity-60 uppercase">{l}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Key({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{ width: w, height: h }}
      className="rounded-full bg-[oklch(0.24_0.01_258)] shadow-[inset_0_1px_0_oklch(1_0_0/0.1),0_2px_3px_oklch(0_0_0/0.45)]"
    />
  )
}

function SignalBars() {
  return (
    <span className="flex items-end gap-[1.5px]">
      {[4, 6, 8, 10].map((h) => (
        <span key={h} className="w-[3px] rounded-[1px] bg-current" style={{ height: h }} />
      ))}
    </span>
  )
}
