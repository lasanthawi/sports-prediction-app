import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Cookies | ${BRAND.name}`,
  description: `Cookie and session notice for ${BRAND.name}.`,
}

export default function CookiesPage() {
  return (
    <LegalPageShell
      eyebrow="Cookies Notice"
      title="Session, storage, and cookie transparency."
      intro="Vote League may use cookies or comparable browser storage for login state, session continuity, security, and product functionality."
    >
      <h2>Essential use</h2>
      <p>Essential cookies or session identifiers may be used to keep users signed in, secure sessions, and preserve product state across requests.</p>
      <h2>Performance and analytics</h2>
      <p>Operators may add analytics or performance tooling later. If they do, this notice should be updated with the exact categories, providers, and controls offered to users.</p>
      <h2>User choices</h2>
      <p>Browser settings may affect storage behavior, but disabling essential storage may limit access to core functionality such as authenticated voting or dashboard access.</p>
    </LegalPageShell>
  )
}
