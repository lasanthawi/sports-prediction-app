import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Community Guidelines | ${BRAND.name}`,
  description: `Read the community participation expectations for ${BRAND.name}.`,
}

export default function CommunityGuidelinesPage() {
  return (
    <LegalPageShell
      eyebrow="Community Guidelines"
      title="Standards for healthy participation on Vote League."
      intro="Vote League is built for fan expression, prediction, and community engagement. These guidelines help keep the platform safe, fair, and useful."
    >
      <h2>Be authentic</h2>
      <p>Do not use fake accounts, vote-farming tactics, scripted manipulation, or deceptive identity behavior.</p>
      <h2>Respect others</h2>
      <p>Harassment, hate, threats, abusive conduct, and targeted disruption are not allowed.</p>
      <h2>Protect integrity</h2>
      <p>Attempts to tamper with feeds, publishing pipelines, or voting outcomes may lead to restrictions or removal.</p>
      <h2>Report concerns</h2>
      <p>Suspected abuse, impersonation, rights issues, or safety concerns should be directed through the official support and compliance channels.</p>
    </LegalPageShell>
  )
}
