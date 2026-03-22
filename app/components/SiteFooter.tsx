import Link from 'next/link'
import { BRAND, LEGAL_LINKS } from '@/lib/brand'

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/20">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={BRAND.logoUrl}
                alt={`${BRAND.name} logo`}
                className="h-14 w-14 rounded-2xl border border-white/10 bg-black/30 object-contain p-1"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-green-300/80">{BRAND.shortName}</p>
                <h2 className="text-2xl font-black text-white">{BRAND.name}</h2>
              </div>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/65">{BRAND.description}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/50">Platform</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/70">
              <Link href="/">Home</Link>
              <Link href="/guide">How It Works</Link>
              <Link href="/about">About Vote League</Link>
              <Link href="/contact">Support</Link>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/50">Legal & Trust</p>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/70">
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs uppercase tracking-[0.2em] text-white/40 md:flex-row md:items-center md:justify-between">
          <p>{BRAND.name} © 2026</p>
          <p>{BRAND.tagline}</p>
        </div>
      </div>
    </footer>
  )
}
