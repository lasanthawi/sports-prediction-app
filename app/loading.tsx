'use client'

import { useEffect, useState } from 'react'
import { BRAND } from '@/lib/brand'

const COSMIC_BACKGROUND = 'https://img.freepik.com/free-photo/cosmic-lightning-storm-space-background_23-2151955881.jpg?semt=ais_hybrid&w=740&q=80'

export default function Loading() {
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) {
          return current
        }

        const step = current < 40 ? 9 : current < 70 ? 5 : current < 85 ? 3 : 1
        return Math.min(94, current + step)
      })
    }, 180)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,8,20,0.78), rgba(10,8,27,0.92)), url(${COSMIC_BACKGROUND})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%),radial-gradient(circle_at_20%_70%,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_85%_20%,rgba(244,114,182,0.1),transparent_24%)]" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 px-6 text-center">
        <img
          src={BRAND.logoUrl}
          alt={`${BRAND.name} logo`}
          className="h-36 w-36 animate-pulse object-contain drop-shadow-[0_0_40px_rgba(255,216,77,0.35)] md:h-44 md:w-44"
        />
        <div>
          <p className="bg-gradient-to-r from-green-300 via-yellow-300 to-pink-300 bg-clip-text text-3xl font-black uppercase tracking-[0.2em] text-transparent md:text-4xl">
            {BRAND.name}
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.35em] text-white/60">Loading Vote League</p>
        </div>
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.28em] text-white/60">
            <span>Initializing Arena</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#5cff9b,#ffd84d,#ff4fa3)] transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
