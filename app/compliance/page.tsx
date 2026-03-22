import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Compliance | ${BRAND.name}`,
  description: `Compliance overview for content sourcing, moderation, platform integrity, and non-wager positioning on ${BRAND.name}.`,
}

export default function CompliancePage() {
  return (
    <LegalPageShell
      eyebrow="Compliance Overview"
      title="How Vote League approaches integrity, sourcing, and platform safety."
      intro="This page gives users, partners, and reviewers a clear overview of how the platform handles sports data, generated media, moderation, and non-wager product positioning."
    >
      <h2>Entertainment and community positioning</h2>
      <p>
        Vote League is intended as a fan-voting and match-engagement platform. Unless explicitly disclosed otherwise by operators, it is not presented as a sportsbook,
        gambling service, or financial-advice product.
      </p>
      <h2>Data sources</h2>
      <p>
        Match schedules and status details may depend on third-party sports-data providers. Feed anomalies, missing competitor data, and delayed status changes can occur and may be filtered or corrected by the platform.
      </p>
      <h2>Generated media</h2>
      <p>
        Promotional visuals and social assets may be generated or composed automatically. Where source data is incomplete or unsafe, the platform may skip publication rather than display inaccurate matchups.
      </p>
      <h2>Integrity controls</h2>
      <p>
        Vote League maintains controls for queue review, publication review, session handling, and operational logging. Abuse, manipulation, or policy violations may trigger moderation or access restrictions.
      </p>
    </LegalPageShell>
  )
}
