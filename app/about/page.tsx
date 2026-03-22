import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `About | ${BRAND.name}`,
  description: `Learn what ${BRAND.name} is, who it is for, and how the platform approaches fan voting and match storytelling.`,
}

export default function AboutPage() {
  return (
    <LegalPageShell
      eyebrow="About Vote League"
      title="A premium home for fan voting and match storytelling."
      intro={`${BRAND.name} brings live and upcoming matchups into one place so fans can discover fixtures, vote on outcomes, and follow how the community leans before and after kickoff.`}
    >
      <h2>What Vote League does</h2>
      <p>
        Vote League curates match cards, community prediction moments, result recaps, and social-ready visuals into a single fan-facing experience.
        The platform is designed for discovery, audience engagement, and editorial presentation rather than wagering or sportsbook operations.
      </p>
      <h2>Who it is for</h2>
      <p>
        The product is aimed at sports audiences, communities, creators, and operators who want a polished voting-first experience around scheduled fixtures,
        live momentum, and finished result storytelling.
      </p>
      <h2>How the platform thinks about trust</h2>
      <p>
        Vote League separates fan sentiment from official outcomes. Community votes reflect audience preference, not guaranteed results, and published match data
        may depend on external providers, editorial review, and platform rules.
      </p>
    </LegalPageShell>
  )
}
