import Link from 'next/link'
import type { ReactNode } from 'react'
import { BRAND, LEGAL_LINKS } from '@/lib/brand'
import SiteFooter from './SiteFooter'

export default function LegalPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-green-300">
          <img src={BRAND.logoUrl} alt={`${BRAND.name} logo`} className="h-10 w-10 rounded-xl border border-white/10 bg-black/30 object-contain p-1" />
          Back To {BRAND.shortName}
        </Link>

        <div className="mt-10 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,21,38,0.9),rgba(10,14,28,0.82))] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-300/80">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black text-white md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/70">{intro}</p>

          <div className="mt-10 flex flex-wrap gap-3 border-y border-white/10 py-5 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full border border-white/10 px-4 py-2 hover:border-green-300/30 hover:text-green-200">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="prose prose-invert mt-10 max-w-none prose-headings:font-black prose-headings:text-white prose-p:text-white/75 prose-li:text-white/75">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
