import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Guide | ${BRAND.name}`,
  description: `Understand how matches, votes, published cards, and result recaps work on ${BRAND.name}.`,
}

export default function GuidePage() {
  return (
    <LegalPageShell
      eyebrow="Platform Guide"
      title="How Vote League works."
      intro="This guide explains how matches appear, how voting behaves, how published cards are surfaced, and what users should expect from automation and result updates."
    >
      <h2>1. Match discovery</h2>
      <p>
        Upcoming and live match cards appear when the platform has valid head-to-head competitor data and a published prediction card. Non-head-to-head feed items
        without reliable competitors may be skipped rather than displayed inaccurately.
      </p>
      <h2>2. Voting</h2>
      <p>
        Votes are available on eligible upcoming cards. Once a user votes, the platform stores that choice against the account session and updates the visible community split.
      </p>
      <h2>3. Published cards</h2>
      <p>
        Vote League may publish social story creatives, prediction cards, and result cards independently. Social publication does not always mean every asset variant
        will be visible in every interface at the same time.
      </p>
      <h2>4. Result handling</h2>
      <p>
        Finished matches may move into result presentation once the platform has enough data or editorial confirmation to show the outcome safely.
      </p>
      <h2>5. Admin workflow</h2>
      <p>
        Admin tools support syncing, generation, publishing, queue review, and compliance review. Automation may be rate-limited by external data providers and publishing integrations.
      </p>
    </LegalPageShell>
  )
}
