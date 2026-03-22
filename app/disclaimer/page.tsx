import type { Metadata } from 'next'
import LegalPageShell from '@/app/components/LegalPageShell'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Disclaimer | ${BRAND.name}`,
  description: `Important platform disclaimers for match accuracy, vote interpretation, and non-wager use on ${BRAND.name}.`,
}

export default function DisclaimerPage() {
  return (
    <LegalPageShell
      eyebrow="Important Disclaimer"
      title="What Vote League does not promise."
      intro="This page clarifies the limits of platform data, publishing timing, and community sentiment so users understand what platform content means and what it does not mean."
    >
      <h2>Votes are not official outcomes</h2>
      <p>Community percentages reflect fan sentiment only. They do not represent official results, advice, or guaranteed predictions.</p>
      <h2>Data may change</h2>
      <p>Schedules, live status, venues, and publication timing may be updated, delayed, or corrected as external feeds and editorial workflows change.</p>
      <h2>No wagering assurance</h2>
      <p>Unless explicitly disclosed by operators, platform content is for engagement and entertainment rather than betting, gaming, or financial decision-making.</p>
      <h2>Publication discretion</h2>
      <p>Vote League may remove, delay, skip, or replace content where source data is incomplete, rights-sensitive, or operationally unsafe.</p>
    </LegalPageShell>
  )
}
