import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Privacy | ${BRAND.name}`,
  description: `See how ${BRAND.name} handles account, session, vote, and platform data.`,
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy Policy"
      title="How Vote League handles user and platform data."
      intro="This summary covers the categories of information the platform may process, why it is used, and how product operators should maintain transparency for launch."
    >
      <h2>Data collected</h2>
      <p>
        Vote League may process account identifiers, session data, vote selections, match interaction data, and operational logs required for security, moderation, and product reliability.
      </p>
      <h2>Why data is used</h2>
      <p>
        Data supports authentication, vote integrity, personalization, abuse prevention, analytics, publishing workflows, and core platform operations.
      </p>
      <h2>Third-party services</h2>
      <p>
        The product may rely on hosting, database, social publishing, and external sports-data providers. Operators should review and disclose the final provider list before production launch.
      </p>
      <h2>Retention and control</h2>
      <p>
        Account and voting data should be retained only as long as necessary for product operation, security, analytics, or legal compliance. Users should be given clear support channels for requests where required.
      </p>
    </LegalPageShell>
  )
}
