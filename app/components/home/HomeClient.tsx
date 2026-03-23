'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, LogIn, Sparkles, Swords, Target, Trophy, Waves } from 'lucide-react'
import MatchCard from '@/app/components/MatchCard'
import SiteFooter from '@/app/components/SiteFooter'
import VotedMatchCard from '@/app/components/VotedMatchCard'
import { BRAND } from '@/lib/brand'
import { formatMatchDateTime } from '@/lib/date-format'
import type { HomePageData, HomePageMatchRecord } from '@/lib/homepage'
import { buildArenaMatchStack, sortMatchesForArena } from '@/lib/homepage'

const ArenaVotingOverlay = dynamic(
  () => import('./HomeOverlays').then((mod) => mod.ArenaVotingOverlay),
  { ssr: false }
)

const ResultDetailModal = dynamic(
  () => import('./HomeOverlays').then((mod) => mod.ResultDetailModal),
  { ssr: false }
)

const SECTION_PRERENDER_STYLE = {
  contentVisibility: 'auto',
  containIntrinsicSize: '900px',
} as const

const MOBILE_SECTION_STYLE = {
  contentVisibility: 'auto',
  containIntrinsicSize: '700px',
} as const

export default function HomeClient({
  initialData,
  initialNowMs,
}: {
  initialData: HomePageData
  initialNowMs: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [homeData, setHomeData] = useState<HomePageData>(initialData)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [votingMode, setVotingMode] = useState(false)
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null)
  const [resultDetailMatchId, setResultDetailMatchId] = useState<number | null>(null)
  const [desktopSlide, setDesktopSlide] = useState(0)
  const [votedMatches, setVotedMatches] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [nowMs, setNowMs] = useState(initialNowMs)
  const voteModeCloseRequestedRef = useRef(false)
  const reportedMetricIdsRef = useRef(new Set<string>())

  useReportWebVitals((metric) => {
    if (reportedMetricIdsRef.current.has(metric.id)) {
      return
    }

    reportedMetricIdsRef.current.add(metric.id)

    const payload = JSON.stringify({
      id: metric.id,
      name: metric.name,
      value: Number(metric.value.toFixed(2)),
      rating: metric.rating,
      path: window.location.pathname,
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/perf', payload)
      return
    }

    void fetch('/api/perf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    if (votingMode) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [votingMode])

  useEffect(() => {
    let cancelled = false
    let handle: number | null = null

    const loadDeferredData = async () => {
      try {
        const authRes = await fetch('/api/auth/me', { cache: 'no-store' })
        const authPayload = await authRes.json()
        if (cancelled || !authPayload.user) return

        startTransition(() => setUser(authPayload.user))

        const votesRes = await fetch('/api/user/votes', { cache: 'no-store' })
        if (!votesRes.ok) return

        const votesPayload = await votesRes.json()
        if (cancelled) return

        startTransition(() => setVotedMatches(votesPayload.matches || []))
      } catch (fetchError) {
        console.error('Deferred home auth/vote fetch error:', fetchError)
      }
    }

    const maybeWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const hasIdleCallback = 'requestIdleCallback' in window

    if (hasIdleCallback && maybeWindow.requestIdleCallback) {
      handle = maybeWindow.requestIdleCallback(() => void loadDeferredData(), { timeout: 1200 })
    } else {
      handle = window.setTimeout(() => void loadDeferredData(), 200)
    }

    return () => {
      cancelled = true
      if (handle == null) return
      if (hasIdleCallback && maybeWindow.cancelIdleCallback) {
        maybeWindow.cancelIdleCallback(handle)
      } else {
        window.clearTimeout(handle)
      }
    }
  }, [])

  const votingMatches = useMemo(() => sortMatchesForArena(homeData.votingMatches), [homeData.votingMatches])
  const featuredMatches = homeData.featuredMatches
  const upcomingMatches = homeData.upcomingMatches
  const finishedMatches = homeData.finishedMatches
  const votedMatchIdSet = useMemo(() => new Set(votedMatches.map((match) => match.id)), [votedMatches])
  const arenaMatches = useMemo(
    () =>
      buildArenaMatchStack({
        votingMatches,
        finishedMatches,
        votedMatchIds: votedMatchIdSet,
        limit: 20,
      }),
    [finishedMatches, votedMatchIdSet, votingMatches]
  )
  const votingMatchesForVoteMode = useMemo(() => {
    const base = arenaMatches
    const targetId = Number(searchParams.get('match'))

    if (!Number.isFinite(targetId) || base.some((match) => match.id === targetId)) {
      return base
    }

    const targetMatch = [...votingMatches, ...finishedMatches].find((match) => match.id === targetId)
    if (!targetMatch) {
      return base
    }

    return [targetMatch, ...base.slice(0, 19)]
  }, [arenaMatches, finishedMatches, searchParams, votingMatches])
  const mobileVotingMatches = arenaMatches.slice(0, 8)
  const spotlightResult = [...finishedMatches].sort((a, b) => (b.poll_team1_votes + b.poll_team2_votes) - (a.poll_team1_votes + a.poll_team2_votes))[0]
  const maxDesktopSlide = Math.max(0, arenaMatches.length - 1)
  const hasInfiniteSlider = arenaMatches.length > 1

  useEffect(() => {
    setDesktopSlide((current) => Math.min(current, maxDesktopSlide))
  }, [maxDesktopSlide])

  useEffect(() => {
    const matchParam = searchParams.get('match')
    if (!matchParam) {
      voteModeCloseRequestedRef.current = false
      return
    }
    if (voteModeCloseRequestedRef.current) return

    const targetId = Number(matchParam)
    if (!Number.isFinite(targetId)) return

    const targetMatch = votingMatchesForVoteMode.find((match) => match.id === targetId)
    if (!targetMatch) return

    setActiveMatchId(targetId)
    setVotingMode(true)
  }, [searchParams, votingMatchesForVoteMode])

  const resultMatchMap = useMemo(() => {
    const map = new Map<number, HomePageMatchRecord>()
    for (const match of [...finishedMatches, ...votingMatches]) {
      map.set(match.id, match)
    }
    return map
  }, [finishedMatches, votingMatches])

  async function refreshHomeData() {
    try {
      setRefreshing(true)
      const response = await fetch('/api/matches?view=home', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to refresh homepage matches')
      }

      startTransition(() => {
        setHomeData(payload)
        setError('')
      })
    } catch (refreshError: any) {
      console.error('Home refresh error:', refreshError)
      setError(refreshError.message || 'Failed to refresh homepage matches')
    } finally {
      setRefreshing(false)
    }
  }

  function openMatchViewer(matchId: number) {
    if (votedMatchIdSet.has(matchId)) return
    setActiveMatchId(matchId)
    setVotingMode(true)
    router.push(`/?match=${matchId}`, { scroll: false })
  }

  function closeVotingMode() {
    voteModeCloseRequestedRef.current = true
    setVotingMode(false)
    setActiveMatchId(null)
    router.replace('/', { scroll: false })
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(5,8,20,0.94), rgba(10,8,27,0.98)), radial-gradient(circle at 20% 12%, rgba(34,211,238,0.12), transparent 24%), radial-gradient(circle at 85% 20%, rgba(244,114,182,0.14), transparent 24%), radial-gradient(circle at 50% 120%, rgba(255,216,77,0.08), transparent 28%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_20%_70%,rgba(34,211,238,0.06),transparent_22%),radial-gradient(circle_at_85%_20%,rgba(244,114,182,0.08),transparent_24%)]" />

      <MobileArenaApp
        matches={mobileVotingMatches}
        finishedMatches={finishedMatches.slice(0, 6)}
        upcomingMatches={upcomingMatches.slice(0, 6)}
        totalVotes={homeData.counts.totalVotes}
        liveCount={homeData.counts.live}
        upcomingCount={homeData.counts.upcoming}
        error={error}
        refreshing={refreshing}
        currentTimeMs={nowMs}
        onOpenMatch={openMatchViewer}
        onOpenResultDetail={setResultDetailMatchId}
        onRefresh={() => void refreshHomeData()}
      />

      <div className="relative mx-auto hidden max-w-[1380px] px-4 py-6 md:block md:px-8 md:py-8">
        <header className="mb-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <nav className="hidden gap-6 text-sm text-white/70 md:flex">
              <a href="#live-matches" className="hover:text-white">Live Matches</a>
              <a href="#upcoming-clashes" className="hover:text-white">Upcoming Clashes</a>
              <a href="#results-board" className="hover:text-white">Results</a>
              <a href="#how-it-works" className="hover:text-white">How It Works</a>
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => void refreshHomeData()}
                className="glass-button inline-flex items-center gap-2 !py-3 text-sm"
              >
                <Bell size={16} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <Link href="/login" className="glass-button inline-flex items-center gap-2">
                <LogIn size={18} /> Login
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-5 flex justify-center">
              <img
                src={BRAND.logoUrl}
                alt={`${BRAND.name} logo`}
                className="h-32 w-32 object-contain drop-shadow-[0_0_28px_rgba(255,216,77,0.35)] md:h-40 md:w-40"
              />
            </div>
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-5 py-2 text-sm font-bold uppercase tracking-[0.24em] text-white/80">
              {BRAND.shortName}
            </div>
            <h1 className="text-glow bg-gradient-to-r from-green-300 via-yellow-300 to-pink-300 bg-clip-text text-5xl font-black uppercase tracking-[0.04em] text-transparent md:text-7xl">
              {BRAND.name}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80 md:text-2xl">
              {BRAND.tagline}
            </p>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
              Follow live clashes, back your side before kickoff, track the community split, and relive the biggest results with cinematic match cards built for battle-night energy.
            </p>
          </div>
        </header>

        <section className="mb-12 grid gap-4 md:grid-cols-3">
          <HeroStat icon={<CalendarDays />} label="Live Matches" value={String(homeData.counts.live)} detail={`${homeData.counts.upcoming} upcoming battles`} />
          <HeroStat icon={<Target />} label="Visible Cards" value={String(homeData.counts.totalVisible)} detail="Only published cards are shown on the arena" />
          <HeroStat icon={<Bell />} label="Total Votes" value={String(homeData.counts.totalVotes)} detail={spotlightResult ? `Top result: ${spotlightResult.team1} vs ${spotlightResult.team2}` : 'Vote counts update live'} />
        </section>

        {error ? (
          <div className="glass-panel mx-auto mb-10 max-w-3xl p-6 text-center">
            <p className="text-base text-red-300">{error}</p>
          </div>
        ) : null}

        <section id="live-matches" className="mb-16">
          <SectionHeading eyebrow="Main Event" title="Live And Upcoming Battle Cards" copy="The public arena only shows published cards, so the live count always matches what visitors can actually open and vote on." />
          {arenaMatches.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              <div className="mb-[5rem] flex items-center justify-between gap-4 pb-5 md:mb-[7rem]">
                <p className="text-sm uppercase tracking-[0.2em] text-white/60">Slide through live and upcoming battle cards</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">{desktopSlide + 1} / {arenaMatches.length}</span>
                  <button onClick={() => setDesktopSlide((current) => (current - 1 + arenaMatches.length) % arenaMatches.length)} disabled={!hasInfiniteSlider} className="glass-button !rounded-2xl !px-4 !py-3 disabled:opacity-40" title="Previous match">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={() => setDesktopSlide((current) => (current + 1) % arenaMatches.length)} disabled={!hasInfiniteSlider} className="glass-button !rounded-2xl !px-4 !py-3 disabled:opacity-40" title="Next match">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 w-full items-center justify-center gap-4 pb-[5rem] md:gap-6 md:pb-[7rem]">
                <button type="button" onClick={() => setDesktopSlide((current) => (current - 1 + arenaMatches.length) % arenaMatches.length)} disabled={!hasInfiniteSlider} className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex" aria-label="Previous match">
                  <ChevronLeft size={20} />
                </button>
                <MatchCarouselStage
                  matches={arenaMatches}
                  currentIndex={desktopSlide}
                  onPrevious={() => setDesktopSlide((current) => (current - 1 + arenaMatches.length) % arenaMatches.length)}
                  onNext={() => setDesktopSlide((current) => (current + 1) % arenaMatches.length)}
                  onSelectMatch={(match, index) => {
                    setDesktopSlide(index)
                    openMatchViewer(match.id)
                  }}
                  onVote={() => void refreshHomeData()}
                  currentTimeMs={nowMs}
                  className="flex-1"
                  stageHeightClass="h-[30rem] lg:h-[34rem] xl:h-[37rem]"
                  centerWidthClass="w-[min(23.5rem,27vw)] lg:w-[min(25.5rem,28vw)] xl:w-[min(26.5rem,27vw)]"
                  sideWidthClass="w-[20rem] lg:w-[22rem] xl:w-[23rem]"
                />
                <button type="button" onClick={() => setDesktopSlide((current) => (current + 1) % arenaMatches.length)} disabled={!hasInfiniteSlider} className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex" aria-label="Next match">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section id="upcoming-clashes" className="mb-16 grid gap-8 xl:grid-cols-[1.1fr,0.9fr]" style={SECTION_PRERENDER_STYLE}>
          <div className="glass-panel p-6 md:p-8">
            <SectionHeading
              eyebrow="Clash Queue"
              title={upcomingMatches.length > 0 ? 'Upcoming Clashes' : 'Latest Clashes'}
              copy={upcomingMatches.length > 0
                ? 'Scan the next wave of battles, see where league momentum is building, and lock in predictions before the clock hits zero.'
                : 'Latest finished matches. New upcoming clashes will appear here when scheduled.'}
              compact
            />
            <div className="space-y-3">
              {(upcomingMatches.length > 0 ? upcomingMatches.slice(0, 6) : finishedMatches.slice(0, 6)).map((match) => (
                <MiniMatchCard key={match.id} match={match} />
              ))}
              {upcomingMatches.length === 0 && finishedMatches.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/60">
                  No matches yet. New clashes will appear here as soon as they are scheduled.
                </p>
              ) : null}
            </div>
          </div>

          <div className="glass-panel p-6 md:p-8">
            <SectionHeading
              eyebrow="League Intel"
              title="What Happens Here"
              copy="Every match gets a cinematic battle card, a live community split, and a result recap when the final whistle blows."
              compact
            />
            <div className="grid gap-4">
              <FeatureCard icon={<Swords className="h-5 w-5" />} title="Battle Posters" copy="Each match is framed like a headline clash with high-energy visuals and clear vote calls." />
              <FeatureCard icon={<Sparkles className="h-5 w-5" />} title="Live Community Split" copy="See where the crowd is leaning and how close the duel really is before kickoff." />
              <FeatureCard icon={<Waves className="h-5 w-5" />} title="Result Recaps" copy="Finished matches transition into result cards so the league story stays alive after game time." />
            </div>
          </div>
        </section>

        <section id="results-board" className="mb-16" style={SECTION_PRERENDER_STYLE}>
          <SectionHeading
            eyebrow="Final Whistle"
            title="Results Board"
            copy="A snapshot of the latest finished battles so visitors can see which side won and how the league voted."
          />
          {finishedMatches.length === 0 ? (
            <div className="glass-panel p-6 text-sm text-white/60">No results yet. Finished matches will show up here with final scorelines and vote history.</div>
          ) : (
            <ResultsCarousel matches={finishedMatches} onCardClick={(match) => setResultDetailMatchId(match.id)} />
          )}
        </section>

        <section className="mb-16 grid gap-6 xl:grid-cols-[1fr,320px]" style={SECTION_PRERENDER_STYLE}>
          <div className="glass-panel p-8 text-center">
            <h3 className="text-3xl font-black text-white md:text-4xl">Never Miss A Match</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/65">
              The player dashboard now reflects your vote history accurately, including final result summaries once a match closes.
            </p>

            {user ? (
              <div className="mt-8 flex flex-col items-center">
                <p className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Your Recent Predictions</p>
                {votedMatches.length === 0 ? (
                  <p className="mb-6 text-white/60">You have not locked in any picks yet. Open the arena and back your side.</p>
                ) : (
                  <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {votedMatches.slice(0, 3).map((match) => (
                      <VotedMatchCard key={match.id} match={match} className="min-h-[22rem]" />
                    ))}
                  </div>
                )}
                <Link href="/player/dashboard" className="btn-game mt-8 inline-flex items-center gap-2">
                  Open Dashboard <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <div className="mt-8">
                <p className="mx-auto max-w-xl text-white/60">
                  Sign in to track your predictions, view result summaries, and compare your hit rate with the rest of Vote League.
                </p>
                <Link href="/login" className="btn-game mt-8 inline-flex items-center gap-2">
                  Log In <ArrowRight size={18} />
                </Link>
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <p className="text-sm font-bold uppercase tracking-[0.26em] text-pink-300/80">Network Ranking</p>
            <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/25 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">Current Ladder Position</p>
              <div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full border border-pink-400/40 bg-pink-500/10 text-4xl font-black text-pink-300 shadow-[0_0_30px_rgba(244,114,182,0.25)]">
                #1
              </div>
              <p className="mt-5 text-3xl font-black text-white">{user?.name || 'Vote League'}</p>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/55">
                {user ? `${homeData.counts.totalVotes} total arena votes tracked` : 'Community pulse'}
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/35">Upcoming Rivals</p>
              <RankingRow rank="#2" name="NeonGamer" points="950" />
              <RankingRow rank="#3" name="CryptoKing" points="820" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mb-16 grid gap-8 xl:grid-cols-[0.95fr,1.05fr]" style={SECTION_PRERENDER_STYLE}>
          <div className="glass-panel p-8">
            <SectionHeading
              eyebrow="Game Loop"
              title="How Vote League Works"
              copy="The homepage now ships a slimmer payload, server-renders the opening state, and keeps the vote overlay hot only when you need it."
              compact
            />
            <div className="space-y-4">
              <StepRow index="01" title="Cards Go Live" copy="Once a prediction card is published, it becomes visible in the public arena and counts toward the live total instantly." />
              <StepRow index="02" title="Crowd Picks A Side" copy="Fans open voting mode, choose a side, and the community split updates in real time." />
              <StepRow index="03" title="Results Lock In" copy="Finished battles move onto the results board with their summary, winner, and vote percentages." />
            </div>
          </div>

          <div className="glass-panel p-8">
            <SectionHeading
              eyebrow="Quality Bar"
              title="What We Optimized"
              copy="Vote League now avoids shipping admin-only fields to the homepage and tones down the effects that hurt scroll smoothness."
              compact
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard icon={<Bell className="h-5 w-5" />} title="Slim Home Feed" copy="The public homepage now uses a dedicated lightweight response instead of the full match payload." />
              <FeatureCard icon={<Target className="h-5 w-5" />} title="Visible Live Count" copy="Live totals reflect only cards the public can actually see, so the count and carousel stay in sync." />
              <FeatureCard icon={<CalendarDays className="h-5 w-5" />} title="Shared Ticker" copy="Countdowns use one shared clock rather than spinning an interval inside every visible card." />
              <FeatureCard icon={<Sparkles className="h-5 w-5" />} title="Lower Motion Cost" copy="Only the active hero card floats, side cards lazy-load, and below-fold sections render on demand." />
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>

      {votingMode ? (
        <ArenaVotingOverlay
          matches={votingMatchesForVoteMode}
          activeMatchId={activeMatchId}
          currentTimeMs={nowMs}
          onClose={closeVotingMode}
          onVote={refreshHomeData}
        />
      ) : null}

      <ResultDetailModal
        match={resultDetailMatchId == null ? null : resultMatchMap.get(resultDetailMatchId) ?? null}
        onClose={() => setResultDetailMatchId(null)}
      />
    </main>
  )
}

function MobileArenaApp({
  matches,
  finishedMatches,
  upcomingMatches,
  totalVotes,
  liveCount,
  upcomingCount,
  error,
  refreshing,
  currentTimeMs,
  onOpenMatch,
  onOpenResultDetail,
  onRefresh,
}: {
  matches: HomePageMatchRecord[]
  finishedMatches: HomePageMatchRecord[]
  upcomingMatches: HomePageMatchRecord[]
  totalVotes: number
  liveCount: number
  upcomingCount: number
  error: string
  refreshing: boolean
  currentTimeMs: number
  onOpenMatch: (matchId: number) => void
  onOpenResultDetail: (matchId: number) => void
  onRefresh: () => void
}) {
  return (
    <div className="mobile-arena-shell md:hidden">
      <div className="mobile-arena-topbar">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.32em] text-green-300/80">{BRAND.shortName}</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.04em] text-white">{BRAND.name}</h1>
        </div>
        <Link href="/login" className="glass-button shrink-0 !rounded-2xl !px-4 !py-3 text-sm">
          <LogIn size={16} />
        </Link>
      </div>

      <section className="mobile-hero-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/50">Arena Pulse</p>
            <p className="mt-2 text-2xl font-black text-white">{liveCount} live now</p>
            <p className="mt-1 text-sm text-white/60">{upcomingCount} upcoming cards ready for the next wave</p>
          </div>
          <button onClick={onRefresh} className="glass-button !rounded-2xl !px-4 !py-3 text-sm">
            {refreshing ? '...' : 'Refresh'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <MobileStat label="Live" value={String(liveCount)} accent="text-green-300" />
          <MobileStat label="Upcoming" value={String(upcomingCount)} accent="text-cyan-300" />
          <MobileStat label="Votes" value={String(totalVotes)} accent="text-pink-300" />
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </section>

      <section style={MOBILE_SECTION_STYLE}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">Battle Cards</p>
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-white/40">Tap to vote</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {matches.length > 0 ? matches.map((match, index) => (
            <MatchCard
              key={match.id}
              match={match}
              onCardClick={() => onOpenMatch(match.id)}
              compact
              interactive
              priorityArtwork={index === 0}
              countdownActive={index === 0}
              currentTimeMs={currentTimeMs}
              className="!min-h-0"
            />
          )) : (
            <div className="glass-panel col-span-2 p-5 text-sm text-white/60">No published battle cards are visible yet.</div>
          )}
        </div>
      </section>

      <section style={MOBILE_SECTION_STYLE}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">Upcoming Clashes</p>
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{upcomingMatches.length} visible</span>
        </div>
        <div className="space-y-3">
          {upcomingMatches.length > 0 ? upcomingMatches.map((match) => (
            <MiniMatchCard key={match.id} match={match} />
          )) : (
            <div className="glass-panel p-4 text-sm text-white/60">No upcoming published matches are visible right now.</div>
          )}
        </div>
      </section>

      <section style={MOBILE_SECTION_STYLE}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">Results Board</p>
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{finishedMatches.length} latest</span>
        </div>
        <div className="space-y-3">
          {finishedMatches.length > 0 ? finishedMatches.map((match) => (
            <button key={match.id} type="button" onClick={() => onOpenResultDetail(match.id)} className="w-full text-left">
              <ResultRow match={match} />
            </button>
          )) : (
            <div className="glass-panel p-4 text-sm text-white/60">Finished results will appear here once matches are closed out.</div>
          )}
        </div>
      </section>

      <section className="glass-panel p-5" style={MOBILE_SECTION_STYLE}>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-300/80">How It Works</p>
        <div className="mt-4 space-y-3">
          <StepRow index="01" title="Published cards become public" copy="Only visible cards count toward the live number and public slider." />
          <StepRow index="02" title="Vote before kickoff" copy="Pick your side while the battle card is still upcoming." />
          <StepRow index="03" title="Review the verdict" copy="Finished matches move into the results board with the community split." />
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}

function HeroStat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">{label}</p>
          <p className="mt-4 text-5xl font-black text-white">{value}</p>
          <p className="mt-3 text-sm text-white/60">{detail}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-green-300">
          {icon}
        </div>
      </div>
    </div>
  )
}

function MobileStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/25 px-3 py-3 text-center">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  )
}

function SectionHeading({ eyebrow, title, copy, compact = false }: { eyebrow: string; title: string; copy: string; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-6' : 'mb-8'}>
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-green-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">{copy}</p>
    </div>
  )
}

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function hasLogo(url: string | null | undefined) {
  return typeof url === 'string' && /^(https?:\/\/|\/)/i.test(url.trim())
}

function MiniMatchCard({ match }: { match: HomePageMatchRecord }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const summaryParts = [match.sport, match.league, match.venue].filter(Boolean)
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : match.sport
  const timeStr = formatMatchDateTime(match.match_time)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <TeamBadge name={match.team1} logo={match.team1_logo} />
      <div className="min-w-0 flex-1 text-center">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/45">
          {match.status === 'finished' ? 'Final' : 'VS'}
        </p>
        <p className="truncate text-sm font-bold text-white">{match.team1} vs {match.team2}</p>
        <p className="mt-1 truncate text-xs text-white/55">{summaryLine}</p>
        <p className="mt-1 text-[0.68rem] text-white/45">{timeStr}</p>
        <p className="text-[0.68rem] text-white/45">{totalVotes} picks</p>
      </div>
      <TeamBadge name={match.team2} logo={match.team2_logo} />
    </div>
  )
}

function TeamBadge({ name, logo }: { name: string; logo?: string | null }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/30">
      {hasLogo(logo) ? (
        <img src={logo!} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="text-xs font-bold text-white/90">{teamInitials(name)}</span>
      )}
    </div>
  )
}

function ResultRow({ match }: { match: HomePageMatchRecord }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const winnerName = match.winner === 1 ? match.team1 : match.winner === 2 ? match.team2 : 'Result pending'

  return (
    <div className="glass-panel p-5 transition-transform duration-200 hover:scale-[1.01]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-white">{match.team1} vs {match.team2}</p>
          <p className="mt-1 text-sm text-white/60">
            {match.sport}
            {match.league ? ` - ${match.league}` : ''}
          </p>
          <p className="mt-3 text-base font-semibold text-green-300">{match.result_summary || 'Final result recorded'}</p>
          <p className="mt-1 text-sm text-white/60">Winner: {winnerName}</p>
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
      <p className="mt-3 text-white/55">New clashes will appear here as soon as the Vote League schedule goes live.</p>
    </div>
  )
}

function RankingRow({ rank, name, points }: { rank: string; name: string; points: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white/70">{rank}</div>
        <span className="font-semibold text-white/80">{name}</span>
      </div>
      <span className="text-sm font-black text-cyan-300">{points}</span>
    </div>
  )
}

const RESULT_CARD_WIDTH = 300
const RESULT_CARD_ASPECT = 3 / 4

function ResultCard({ match, onClick }: { match: HomePageMatchRecord; onClick: () => void }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Pct = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Pct = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50
  const league = match.league?.toUpperCase() || match.sport.toUpperCase()
  const winner = match.winner != null ? match.winner : (team1Pct >= team2Pct ? 1 : 2)
  const winnerName = winner === 1 ? match.team1 : match.team2

  return (
    <button
      type="button"
      onClick={onClick}
      className="result-card group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/50 text-left shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-white/25"
      style={{
        width: RESULT_CARD_WIDTH,
        aspectRatio: RESULT_CARD_ASPECT,
        minHeight: Math.round(RESULT_CARD_WIDTH / RESULT_CARD_ASPECT),
      }}
    >
      {match.result_artwork_url ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity group-hover:opacity-85"
          style={{ backgroundImage: `url(${match.result_artwork_url})`, opacity: 0.72 }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="relative flex min-h-0 flex-1 flex-col justify-end p-4">
        <span className="inline-block w-fit rounded-md border border-white/20 bg-black/40 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-white/90">
          {league}
        </span>
        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-base font-bold leading-tight text-white">
          {match.team1} vs {match.team2}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-lg font-bold text-green-400">
          <Trophy className="h-4 w-4 shrink-0" />
          {match.result_summary || 'FT'}
        </p>
        <p className="mt-0.5 text-xs font-medium text-amber-300/90">Winner: {winnerName}</p>
        <div className="mt-3 flex h-1.5 shrink-0 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-l-full ${winner === 1 ? 'bg-amber-500' : 'bg-red-500/80'}`} style={{ width: `${team1Pct}%` }} />
          <div className={`h-full rounded-r-full ${winner === 2 ? 'bg-amber-500' : 'bg-sky-500/80'}`} style={{ width: `${team2Pct}%` }} />
        </div>
        <p className="mt-2 text-[0.65rem] font-medium uppercase tracking-wider text-white/50">
          {team1Pct}% - {team2Pct}% · {totalVotes} votes
        </p>
      </div>
    </button>
  )
}

function ResultsCarousel({ matches, onCardClick }: { matches: HomePageMatchRecord[]; onCardClick: (match: HomePageMatchRecord) => void }) {
  if (matches.length === 0) return null

  const duplicated = [...matches.slice(0, 12), ...matches.slice(0, 12)]
  return (
    <>
      <div className="hidden overflow-hidden py-2 md:block">
        <div className="results-carousel-track gap-6">
          {duplicated.map((match, index) => (
            <ResultCard key={`${match.id}-${index}`} match={match} onClick={() => onCardClick(match)} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:hidden">
        {matches.slice(0, 6).map((match) => (
          <button key={match.id} type="button" onClick={() => onCardClick(match)} className="w-full text-left">
            <ResultRow match={match} />
          </button>
        ))}
      </div>
    </>
  )
}

function MatchCarouselStage({
  matches,
  currentIndex,
  onPrevious,
  onNext,
  onSelectMatch,
  onVote,
  currentTimeMs,
  className = '',
  stageHeightClass,
  centerWidthClass,
  sideWidthClass,
}: {
  matches: HomePageMatchRecord[]
  currentIndex: number
  onPrevious: () => void
  onNext: () => void
  onSelectMatch: (match: HomePageMatchRecord, index: number) => void
  onVote: (matchId: number) => void
  currentTimeMs: number
  className?: string
  stageHeightClass: string
  centerWidthClass: string
  sideWidthClass: string
}) {
  if (matches.length === 0) return null

  return (
    <div className={`relative mx-auto w-full max-w-[1280px] overflow-visible ${stageHeightClass} ${className}`}>
      {matches.map((match, index) => {
        const position = getCarouselPosition(index, currentIndex, matches.length)
        if (position === 'hidden') return null

        const isCurrent = position === 'current'
        const anchorClass = position === 'current'
          ? 'left-1/2 -translate-x-1/2'
          : position === 'prev'
            ? 'left-[18%] -translate-x-1/2 lg:left-[17%] xl:left-[16%]'
            : 'left-[82%] -translate-x-1/2 lg:left-[83%] xl:left-[84%]'
        const wrapperClass = position === 'current'
          ? `z-30 ${centerWidthClass} opacity-100 scale-100`
          : `z-20 ${sideWidthClass} hidden md:block scale-[0.84] opacity-70`

        const handleSelect = () => {
          if (position === 'prev') {
            onPrevious()
            return
          }
          if (position === 'next') {
            onNext()
            return
          }
          onSelectMatch(match, index)
        }

        return (
          <div
            key={match.id}
            className={`absolute top-1/2 aspect-[9/16] -translate-y-1/2 transform-gpu transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${anchorClass} ${wrapperClass}`}
          >
            <MatchCard
              match={match}
              onVote={(matchId) => onVote(matchId)}
              onCardClick={handleSelect}
              interactive={isCurrent}
              priorityArtwork={isCurrent}
              countdownActive={isCurrent}
              currentTimeMs={currentTimeMs}
              floating={isCurrent}
              className="!h-full !min-h-0 !w-full !max-w-none"
            />
          </div>
        )
      })}
    </div>
  )
}

function getCarouselPosition(
  index: number,
  currentIndex: number,
  total: number,
): 'prev' | 'current' | 'next' | 'hidden' {
  if (total <= 0) return 'hidden'
  if (index === currentIndex) return 'current'
  if (total > 1 && index === (currentIndex - 1 + total) % total) return 'prev'
  if (total > 1 && index === (currentIndex + 1) % total) return 'next'
  return 'hidden'
}
