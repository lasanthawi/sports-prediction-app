import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Contact | ${BRAND.name}`,
  description: `Support, legal, and compliance contact guidance for ${BRAND.name}.`,
}

export default function ContactPage() {
  return (
    <LegalPageShell
      eyebrow="Contact & Support"
      title="Get in touch with Vote League."
      intro="Use this page for product support, policy requests, compliance questions, and rights-related notices. Replace placeholder operational details here with your production contact stack before launch if needed."
    >
      <h2>General support</h2>
      <p>Email: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></p>
      <h2>Compliance and rights notices</h2>
      <p>
        Use the same support channel for copyright concerns, moderation escalations, data correction requests, and policy inquiries unless operators later publish a dedicated mailbox.
      </p>
      <h2>Launch note</h2>
      <p>Before public rollout, replace any placeholder support details with the official production support email, business address, and response expectations.</p>
    </LegalPageShell>
  )
}
