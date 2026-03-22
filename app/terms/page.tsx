import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Terms | ${BRAND.name}`,
  description: `Review the terms governing access to and use of ${BRAND.name}.`,
}

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms of Use"
      title="Terms for accessing and using Vote League."
      intro="These terms explain the rules for using the platform, participating in community voting, and interacting with Vote League content and services."
    >
      <h2>Acceptance</h2>
      <p>By accessing Vote League, users agree to these terms and to any related platform policies referenced by this legal hub.</p>
      <h2>Platform use</h2>
      <p>
        Users may browse, vote, and access platform features only in lawful ways. Abuse, scraping, account misuse, automation abuse, or attempts to manipulate vote integrity are prohibited.
      </p>
      <h2>No guarantees</h2>
      <p>
        Match timing, outcome data, social publication timing, artwork generation, and feed completeness may change. Vote League provides the service on an as-available basis.
      </p>
      <h2>Content and IP</h2>
      <p>
        Vote League branding, layouts, generated visuals, and platform content remain protected by applicable intellectual property rights except where third-party rights apply.
      </p>
      <h2>Termination</h2>
      <p>Accounts or access may be limited or suspended where necessary to protect platform security, legal compliance, or community integrity.</p>
    </LegalPageShell>
  )
}
