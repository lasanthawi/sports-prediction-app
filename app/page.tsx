'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Bell, CalendarDays, LogIn, Sparkles, Swords, Target, Trophy, Waves } from 'lucide-react'
import MatchCard from './components/MatchCard'

interface MatchRecord {
  id: number
  team1: string
  team2: string
  sport: string
  league?: string | null
  venue?: string | null
  match_time: string
  status: 'upcoming' | 'live' | 'finished' | 'cancelled'
  poll_team1_votes: number
  poll_team2_votes: number
  result_summary?: string | null
  rivalry_tagline?: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  prediction_artwork_url?: string | null
  result_artwork_url?: string | null
  card_asset_url?: string | null
}

const COSMIC_BACKGROUND = 'https://img.freepik.com/free-photo/cosmic-lightning-storm-space-background_23-2151955881.jpg?semt=ais_hybrid&w=740&q=80'

export default function Home() {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchMatches()
  }, [])

  async function fetchMatches() {
    try {
      const res = await fetch('/api/matches', { cache: 'no-store' })
      const payload = await res.json()

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load matches')
      }

      setMatches(payload.matches || [])
      setError('')
    } catch (err: any) {
      console.error('Error fetching matches:', err)
      setError(err.message || 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const liveMatches = matches.filter((match) => match.status === 'live')
  const upcomingMatches = matches.filter((match) => match.status === 'upcoming')
  const finishedMatches = matches.filter((match) => match.status === 'finished')
  const featuredMatches = [...liveMatches, ...upcomingMatches].slice(0, 4)
  const totalVotes = matches.reduce((sum, match) => sum + match.poll_team1_votes + match.poll_team2_votes, 0)
  const spotlightResult = [...finishedMatches].sort((a, b) => (b.poll_team1_votes + b.poll_team2_votes) - (a.poll_team1_votes + a.poll_team2_votes))[0]

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(5,8,20,0.7), rgba(10,8,27,0.88)), url(${COSMIC_BACKGROUND})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_28%),radial-gradient(circle_at_20%_70%,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_85%_20%,rgba(244,114,182,0.1),transparent_24%)]" />

      <div className="relative mx-auto max-w-[1380px] px-4 py-6 md:px-8 md:py-8">
        <header className="mb-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <nav className="hidden gap-6 text-sm text-white/70 md:flex">
              <a href="#live-matches" className="hover:text-white">Live Matches</a>
              <a href="#upcoming-clashes" className="hover:text-white">Upcoming Clashes</a>
              <a href="#results-board" className="hover:text-white">Results</a>
              <a href="#how-it-works" className="hover:text-white">How It Works</a>
            </nav>
            <Link href="/login" className="glass-button ml-auto inline-flex items-center gap-2">
              <LogIn size={18} /> Login
            </Link>
          </div>

          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-5 py-2 text-sm font-bold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Prediction Arena
            </div>
            <h1 className="text-glow bg-gradient-to-r from-green-300 via-yellow-300 to-pink-300 bg-clip-text text-5xl font-black uppercase tracking-[0.04em] text-transparent md:text-7xl">
              Prediction Arena
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-2xl">
              Predict. Vote. Win Glory.
            </p>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
              Follow live clashes, back your side before kickoff, track the community split, and relive the biggest results with cinematic match cards built for battle-night energy.
            </p>
          </div>
        </header>

        <section className="mb-12 grid gap-4 md:grid-cols-3">
          <HeroStat icon={<CalendarDays />} label="Live Matches" value={String(liveMatches.length)} detail={`${upcomingMatches.length} upcoming battles`} />
          <HeroStat icon={<Target />} label="Pending Polls" value={String(upcomingMatches.length)} detail={`${matches.length} total matches on the board`} />
          <HeroStat icon={<Bell />} label="Total Votes" value={String(totalVotes)} detail={spotlightResult ? `Top result: ${spotlightResult.team1} vs ${spotlightResult.team2}` : 'Vote counts update live'} />
        </section>

        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-t-4 border-green-400" />
            <p className="mt-4 text-white/70">Loading the arena...</p>
          </div>
        ) : error ? (
          <div className="glass-panel mx-auto max-w-3xl p-10 text-center">
            <p className="text-xl text-red-300">{error}</p>
            <button onClick={() => void fetchMatches()} className="btn-game mt-6">
              Retry
            </button>
          </div>
        ) : (
          <>
            <section id="live-matches" className="mb-16">
              <SectionHeading
                eyebrow="Main Event"
                title="Live Matches"
                copy="The hottest prediction cards in the arena right now. Live and upcoming clashes are front and center so players can jump in fast."
              />
              {featuredMatches.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid justify-items-center gap-8 md:grid-cols-2 xl:grid-cols-3">
                  {featuredMatches.map((match) => (
                    <MatchCard key={match.id} match={match} onVote={() => void fetchMatches()} />
                  ))}
                </div>
              )}
            </section>

            <section id="upcoming-clashes" className="mb-16 grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
              <div className="glass-panel p-6 md:p-8">
                <SectionHeading
                  eyebrow="Clash Queue"
                  title="Upcoming Clashes"
                  copy="Scan the next wave of battles, see where the arena hype is building, and lock in predictions before the clock hits zero."
                  compact
                />
                <div className="space-y-4">
                  {upcomingMatches.slice(0, 5).map((match) => (
                    <UpcomingRow key={match.id} match={match} />
                  ))}
                  {upcomingMatches.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/60">
                      No upcoming matches right now. New clashes will appear here as soon as they are scheduled.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="glass-panel p-6 md:p-8">
                <SectionHeading
                  eyebrow="Arena Intel"
                  title="What Happens Here"
                  copy="Every match gets a cinematic battle card, a live community split, and a result recap when the final whistle blows."
                  compact
                />
                <div className="grid gap-4">
                  <FeatureCard icon={<Swords className="h-5 w-5" />} title="Battle Posters" copy="Each match is framed like a headline clash with high-energy visuals and clear vote calls." />
                  <FeatureCard icon={<Sparkles className="h-5 w-5" />} title="Live Community Split" copy="See where the crowd is leaning and how close the duel really is before kickoff." />
                  <FeatureCard icon={<Waves className="h-5 w-5" />} title="Result Recaps" copy="Finished matches transition into result cards so the arena stays alive after game time." />
                </div>
              </div>
            </section>

            <section id="results-board" className="mb-16">
              <SectionHeading
                eyebrow="Final Whistle"
                title="Results Board"
                copy="A snapshot of the latest finished battles so visitors can see which side won and how the arena voted."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {finishedMatches.slice(0, 6).map((match) => (
                  <ResultRow key={match.id} match={match} />
                ))}
                {finishedMatches.length === 0 ? (
                  <div className="glass-panel p-6 text-sm text-white/60">No results yet. Finished matches will show up here with final scorelines and vote history.</div>
                ) : null}
              </div>
            </section>

            <section className="mb-16 grid gap-6 xl:grid-cols-[1fr,320px]">
              <div className="glass-panel p-8 text-center">
                <h3 className="text-3xl font-black text-white md:text-4xl">Never Miss a Match</h3>
                <p className="mx-auto mt-4 max-w-3xl text-white/70">
                  Get notified when the biggest results are in, revisit your predictions, and stay ready for the next arena showdown.
                </p>
                <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/25 px-8 py-4 text-lg font-bold text-white shadow-[0_0_24px_rgba(59,130,246,0.2)]">
                  <Bell className="inline" /> Log in to Enable Notifications
                </Link>
              </div>

              <div id="how-it-works" className="glass-panel p-6">
                <h3 className="text-xl font-bold text-white">How It Works</h3>
                <div className="mt-4 space-y-4 text-sm text-white/70">
                  <StepRow index="01" title="Choose a clash" copy="Browse live and upcoming match cards with vote-ready calls to action." />
                  <StepRow index="02" title="Back your side" copy="Vote before kickoff and watch the community split evolve in real time." />
                  <StepRow index="03" title="Track the result" copy="Return for the result card and see how the arena called it." />
                </div>
              </div>
            </section>
          </>
        )}

        <footer className="glass-panel flex flex-col gap-6 px-6 py-8 text-center text-sm text-white/60 md:flex-row md:items-center md:justify-between md:text-left">
          <div>
            <p className="font-bold uppercase tracking-[0.2em] text-white/80">Prediction Arena</p>
            <p className="mt-2">Built for match-night energy, community rivalry, and high-contrast battle cards.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:justify-end">
            <a href="#live-matches" className="hover:text-white">Live Matches</a>
            <a href="#upcoming-clashes" className="hover:text-white">Upcoming</a>
            <a href="#results-board" className="hover:text-white">Results</a>
            <a href="#how-it-works" className="hover:text-white">How It Works</a>
          </div>
        </footer>
      </div>
    </main>
  )
}

function HeroStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="glass-panel card-glow p-6 text-center">
      <div className="mb-3 flex justify-center text-green-300">{icon}</div>
      <div className="text-4xl font-black text-yellow-300">{value}</div>
      <div className="mt-2 text-lg font-semibold text-white">{label}</div>
      <div className="mt-2 text-sm text-white/60">{detail}</div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  compact = false,
}: {
  eyebrow: string
  title: string
  copy: string
  compact?: boolean
}) {
  return (
    <div className={compact ? 'mb-5' : 'mb-8'}>
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">{copy}</p>
    </div>
  )
}

function UpcomingRow({ match }: { match: MatchRecord }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-white">{match.team1} vs {match.team2}</p>
          <p className="text-sm text-white/60">
            {match.sport}
            {match.league ? ` · ${match.league}` : ''}
            {match.venue ? ` · ${match.venue}` : ''}
          </p>
        </div>
        <div className="text-right text-sm text-white/65">
          <p>{new Date(match.match_time).toLocaleString()}</p>
          <p>{totalVotes} picks</p>
        </div>
      </div>
    </div>
  )
}

function ResultRow({ match }: { match: MatchRecord }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  return (
    <div className="glass-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-white">{match.team1} vs {match.team2}</p>
          <p className="mt-1 text-sm text-white/60">
            {match.sport}
            {match.league ? ` · ${match.league}` : ''}
          </p>
          <p className="mt-3 text-base font-semibold text-green-300">{match.result_summary || 'Final result recorded'}</p>
        </div>
        <div className="rounded-full border border-green-400/25 bg-green-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
          {totalVotes} votes
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 p-3 text-green-300">{icon}</div>
      <h4 className="text-lg font-bold text-white">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-white/65">{copy}</p>
    </div>
  )
}

function StepRow({ index, title, copy }: { index: string; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="flex items-start gap-4">
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
          {index}
        </div>
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-white/65">{copy}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass-panel p-12 text-center">
      <p className="text-2xl text-white/75">No featured matches yet</p>
      <p className="mt-3 text-white/55">New clashes will appear here as soon as the arena schedule goes live.</p>
      <Link href="/login" className="btn-game mt-6 inline-flex items-center gap-2">
        <LogIn size={18} /> Login to Admin Panel
      </Link>
    </div>
  )
}
