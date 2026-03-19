'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, LogIn, Sparkles, Swords, Target, Trophy, Waves, X } from 'lucide-react'
import MatchCard from './components/MatchCard'
import VotedMatchCard from './components/VotedMatchCard'

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
  winner?: number | null
  rivalry_tagline?: string | null
  team1_logo?: string | null
  team2_logo?: string | null
  prediction_artwork_url?: string | null
  result_artwork_url?: string | null
  result_card_url?: string | null
  card_asset_url?: string | null
  latest_published_at?: string | null
}

const COSMIC_BACKGROUND = 'https://img.freepik.com/free-photo/cosmic-lightning-storm-space-background_23-2151955881.jpg?semt=ais_hybrid&w=740&q=80'
const BRAND_IMAGE = 'https://i.ibb.co/qLsG4ByG/70325951-97a2-4fb3-ad27-a3c7ba251676.png'

const MATCHES_CACHE_MS = 20_000 // 20s: show cached matches immediately when revisiting home
let matchesCache: { at: number; data: MatchRecord[] } | null = null

function getCachedMatches(): MatchRecord[] | null {
  if (!matchesCache) return null
  if (Date.now() - matchesCache.at > MATCHES_CACHE_MS) return null
  return matchesCache.data
}

function setCachedMatches(data: MatchRecord[]) {
  matchesCache = { at: Date.now(), data }
}

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [votingMode, setVotingMode] = useState(false)
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null)
  const [resultDetailMatchId, setResultDetailMatchId] = useState<number | null>(null)
  const [desktopSlide, setDesktopSlide] = useState(0)
  const [votedMatches, setVotedMatches] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const voteModeCloseRequestedRef = useRef(false)

  useEffect(() => {
    const cached = getCachedMatches()
    if (cached != null && cached.length >= 0) {
      setMatches(cached)
      setLoading(false)
      void fetchMatches() // Revalidate in background
      return
    }
    void fetchMatches()
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

  async function fetchMatches() {
    try {
      // Load matches and auth in parallel so the page can show matches as soon as they arrive.
      const [matchesRes, authRes] = await Promise.all([
        fetch('/api/matches', { cache: 'no-store' }),
        fetch('/api/auth/me', { cache: 'no-store' }),
      ])

      const [matchesPayload, authPayload] = await Promise.all([
        matchesRes.json(),
        authRes.json(),
      ])

      if (!matchesRes.ok) {
        throw new Error(matchesPayload.error || 'Failed to load matches')
      }
      const matchList = matchesPayload.matches || []
      setMatches(matchList)
      setCachedMatches(matchList)
      setError('')

      if (authPayload.user) {
        setUser(authPayload.user)
        const votesRes = await fetch('/api/user/votes', { cache: 'no-store' })
        if (votesRes.ok) {
          const votesPayload = await votesRes.json()
          setVotedMatches(votesPayload.matches || [])
        }
      }
    } catch (err: any) {
      console.error('Error fetching matches:', err)
      setError(err.message || 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const orderedMatches = useMemo(() => sortMatchesForArena(matches), [matches])
  const liveMatches = orderedMatches.filter((match) => match.status === 'live')
  const upcomingMatches = orderedMatches.filter((match) => match.status === 'upcoming')
  const finishedMatches = matches.filter((match) => match.status === 'finished')
  const votingMatches = orderedMatches.filter((match) => match.status !== 'cancelled')
  const MAX_VOTE_MODE_CARDS = 20
  const votedMatchIdSet = useMemo(() => new Set(votedMatches.map((m) => m.id)), [votedMatches])
  const votingMatchesForVoteMode = useMemo(() => {
    const filtered = votingMatches.filter((match) => !votedMatchIdSet.has(match.id))
    return filtered.slice(0, MAX_VOTE_MODE_CARDS)
  }, [votingMatches, votedMatchIdSet])
  const featuredMatches = votingMatches.filter((match) => match.status !== 'finished').slice(0, 8)
  const mobileVotingMatches = votingMatches.slice(0, 8)
  const totalVotes = matches.reduce((sum, match) => sum + match.poll_team1_votes + match.poll_team2_votes, 0)
  const spotlightResult = [...finishedMatches].sort((a, b) => (b.poll_team1_votes + b.poll_team2_votes) - (a.poll_team1_votes + a.poll_team2_votes))[0]
  const maxDesktopSlide = Math.max(0, featuredMatches.length - 1)
  const hasInfiniteSlider = featuredMatches.length > 1

  useEffect(() => {
    setDesktopSlide((current) => Math.min(current, maxDesktopSlide))
  }, [maxDesktopSlide])

  useEffect(() => {
    const matchParam = searchParams.get('match')
    if (!matchParam) {
      voteModeCloseRequestedRef.current = false
      return
    }
    if (voteModeCloseRequestedRef.current) {
      return
    }
    if (loading) {
      return
    }

    const targetId = Number(matchParam)
    if (!Number.isFinite(targetId)) {
      return
    }

    const targetMatch = votingMatchesForVoteMode.find((match) => match.id === targetId)
    if (!targetMatch) {
      return
    }

    setActiveMatchId(targetId)
    setVotingMode(true)
  }, [loading, searchParams, votingMatchesForVoteMode])

  function openMatchViewer(matchId: number) {
    // Don't open vote mode on a match the user already voted on.
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
        backgroundImage: `linear-gradient(180deg, rgba(5,8,20,0.72), rgba(10,8,27,0.9)), url(${COSMIC_BACKGROUND})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_28%),radial-gradient(circle_at_20%_70%,rgba(34,211,238,0.08),transparent_22%),radial-gradient(circle_at_85%_20%,rgba(244,114,182,0.1),transparent_24%)]" />

      <MobileArenaApp
        matches={mobileVotingMatches}
        finishedMatches={finishedMatches}
        upcomingMatches={upcomingMatches}
        totalVotes={totalVotes}
        liveCount={liveMatches.length}
        upcomingCount={upcomingMatches.length}
        loading={loading}
        error={error}
        votingMode={votingMode}
        setVotingMode={setVotingMode}
        onOpenMatch={openMatchViewer}
        onOpenResultDetail={setResultDetailMatchId}
        onRefresh={fetchMatches}
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
            <Link href="/login" className="glass-button ml-auto inline-flex items-center gap-2">
              <LogIn size={18} /> Login
            </Link>
          </div>

          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-5 flex justify-center">
              <img
                src={BRAND_IMAGE}
                alt="Prediction Arena logo"
                className="h-32 w-32 object-contain drop-shadow-[0_0_28px_rgba(255,216,77,0.35)] md:h-40 md:w-40"
              />
            </div>
            <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/25 px-5 py-2 text-sm font-bold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
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
                <div className="space-y-6">
                  <div className="flex shrink-0 items-center justify-between gap-4 pb-5 mb-[5rem] md:mb-[7rem]">
                    <p className="text-sm uppercase tracking-[0.2em] text-white/60">
                      Slide through live and upcoming battle cards
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                        {desktopSlide + 1} / {featuredMatches.length}
                      </span>
                      <button
                        onClick={() => setDesktopSlide((current) => (current - 1 + featuredMatches.length) % featuredMatches.length)}
                        disabled={!hasInfiniteSlider}
                        className="glass-button !rounded-2xl !px-4 !py-3 disabled:opacity-40"
                        title="Previous match"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setDesktopSlide((current) => (current + 1) % featuredMatches.length)}
                        disabled={!hasInfiniteSlider}
                        className="glass-button !rounded-2xl !px-4 !py-3 disabled:opacity-40"
                        title="Next match"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 w-full items-center justify-center gap-4 pb-[5rem] md:pb-[7rem] md:gap-6">
                    <button
                      type="button"
                      onClick={() => setDesktopSlide((current) => (current - 1 + featuredMatches.length) % featuredMatches.length)}
                      disabled={!hasInfiniteSlider}
                      className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex"
                      aria-label="Previous match"
                      title="Previous match"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <MatchCarouselStage
                      matches={featuredMatches}
                      currentIndex={desktopSlide}
                      onPrevious={() => setDesktopSlide((current) => (current - 1 + featuredMatches.length) % featuredMatches.length)}
                      onNext={() => setDesktopSlide((current) => (current + 1) % featuredMatches.length)}
                      onSelectMatch={(match, index) => {
                        setDesktopSlide(index)
                        openMatchViewer(match.id)
                      }}
                      onVote={() => void fetchMatches()}
                      className="flex-1"
                      stageHeightClass="h-[30rem] lg:h-[34rem] xl:h-[37rem]"
                      centerWidthClass="w-[min(23.5rem,27vw)] lg:w-[min(25.5rem,28vw)] xl:w-[min(26.5rem,27vw)]"
                      sideWidthClass="w-[20rem] lg:w-[22rem] xl:w-[23rem]"
                    />

                    <button
                      type="button"
                      onClick={() => setDesktopSlide((current) => (current + 1) % featuredMatches.length)}
                      disabled={!hasInfiniteSlider}
                      className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex"
                      aria-label="Next match"
                      title="Next match"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section id="upcoming-clashes" className="mb-16 grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
              <div className="glass-panel p-6 md:p-8">
                <SectionHeading
                  eyebrow="Clash Queue"
                  title={upcomingMatches.length > 0 ? 'Upcoming Clashes' : 'Latest Clashes'}
                  copy={upcomingMatches.length > 0
                    ? 'Scan the next wave of battles, see where the arena hype is building, and lock in predictions before the clock hits zero.'
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
              {finishedMatches.length === 0 ? (
                <div className="glass-panel p-6 text-sm text-white/60">No results yet. Finished matches will show up here with final scorelines and vote history.</div>
              ) : (
                <ResultsCarousel
                  matches={finishedMatches}
                  onCardClick={(match) => setResultDetailMatchId(match.id)}
                />
              )}
            </section>

            <section className="mb-16 grid gap-6 xl:grid-cols-[1fr,320px]">
              <div className="glass-panel p-8 text-center flex flex-col items-center justify-center">
                <h3 className="text-3xl font-black text-white md:text-4xl mb-4">Never Miss a Match</h3>
                
                {user ? (
                  <div className="w-full mt-4 flex flex-col items-center">
                    <p className="font-bold tracking-[0.2em] text-cyan-300 mb-6 text-sm uppercase">Your Recent Predictions</p>
                    {votedMatches.length === 0 ? (
                      <p className="text-white/60 mb-6">You haven't made any predictions yet. Head to the arena and back your side!</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full mb-2">
                        {votedMatches.slice(0, 3).map((match) => (
                           <VotedMatchCard key={match.id} match={match} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="mx-auto mt-2 max-w-3xl text-white/70">
                      Get notified when the biggest results are in, revisit your predictions, and stay ready for the next arena showdown.
                    </p>
                    <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-gradient-to-r from-cyan-400/20 to-fuchsia-500/25 px-8 py-4 text-lg font-bold text-white shadow-[0_0_24px_rgba(59,130,246,0.2)] hover:scale-105 transition">
                      <Bell className="inline" /> Log in to Enable Notifications
                    </Link>
                  </>
                )}
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

      {votingMode ? (
        <ArenaVotingOverlay
          matches={votingMatchesForVoteMode}
          activeMatchId={activeMatchId}
          onClose={closeVotingMode}
          onVote={fetchMatches}
        />
      ) : null}

      {resultDetailMatchId ? (
        <ResultDetailModal
          match={matches.find((m) => m.id === resultDetailMatchId) ?? null}
          onClose={() => setResultDetailMatchId(null)}
        />
      ) : null}
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
  loading,
  error,
  votingMode,
  setVotingMode,
  onOpenMatch,
  onOpenResultDetail,
  onRefresh,
}: {
  matches: MatchRecord[]
  finishedMatches: MatchRecord[]
  upcomingMatches: MatchRecord[]
  totalVotes: number
  liveCount: number
  upcomingCount: number
  loading: boolean
  error: string
  votingMode: boolean
  setVotingMode: (value: boolean) => void
  onOpenMatch: (matchId: number) => void
  onOpenResultDetail: (matchId: number) => void
  onRefresh: () => Promise<void>
}) {
  return (
    <div className="relative md:hidden">
      <section className="mobile-arena-shell">
        <div className="mobile-arena-topbar">
          <div className="flex items-start gap-3">
            <img src={BRAND_IMAGE} alt="Prediction Arena logo" className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-black/25 object-cover p-1 shadow-[0_0_22px_rgba(255,216,77,0.2)]" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-green-300/80">Prediction Arena</p>
              <h1 className="mt-2 text-2xl font-black leading-none text-white sm:text-3xl">Arena App</h1>
            </div>
          </div>
          <Link href="/login" className="glass-button shrink-0 !rounded-2xl !px-4 !py-3 text-sm">
            <LogIn size={16} />
          </Link>
        </div>

        <div className="mobile-hero-card">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Pocket Control</p>
          <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">Enter Voting Mode</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Full-screen battle cards, swipe navigation, and zero cramped scrolling. Built for quick picks on mobile.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
            <MobileStat label="Live" value={String(liveCount)} />
            <MobileStat label="Queue" value={String(upcomingCount)} />
            <MobileStat label="Votes" value={String(totalVotes)} />
          </div>
          <button
            onClick={() => setVotingMode(true)}
            className="btn-game mt-4 flex w-full items-center justify-center gap-2 rounded-[1.35rem] py-3 text-base sm:mt-5 sm:py-4"
          >
            Start Voting <ArrowRight size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="shrink-0 rounded-[1.75rem] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Featured Tonight</p>
                <p className="text-xs text-white/60">{matches.length} ready-to-vote cards</p>
              </div>
              <button onClick={() => void onRefresh()} className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-green-300">
                Refresh
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
            {loading ? (
            <div className="flex items-center justify-center rounded-[2rem] border border-white/10 bg-black/25 px-6 text-center backdrop-blur-md">
              <div>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-t-4 border-green-400" />
                <p className="mt-4 text-sm text-white/70">Loading the arena...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center rounded-[2rem] border border-red-400/20 bg-black/25 px-6 text-center backdrop-blur-md">
              <div>
                <p className="text-base font-bold text-red-300">{error}</p>
                <button onClick={() => void onRefresh()} className="btn-game mt-4 rounded-xl px-4 py-3">
                  Retry
                </button>
              </div>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex items-center justify-center rounded-[2rem] border border-white/10 bg-black/25 px-6 text-center backdrop-blur-md">
              <div>
                <p className="text-xl font-bold text-white">No battles loaded yet</p>
                <p className="mt-2 text-sm text-white/65">Create or sync matches from Admin Studio and they’ll appear here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 overflow-hidden sm:gap-3">
              {matches.slice(0, 4).map((match) => (
                <div key={match.id} className="flex min-w-0 flex-col rounded-[1.25rem] border border-white/10 bg-black/20 p-1.5 backdrop-blur-md sm:rounded-[1.75rem] sm:p-2">
                  <div className="mb-1 flex shrink-0 items-center justify-between gap-1 px-0.5 sm:mb-2 sm:px-1">
                    <p className="min-w-0 truncate text-xs font-black text-white sm:text-sm" title={`${match.team1} vs ${match.team2}`}>
                      {match.team1} vs {match.team2}
                    </p>
                    <span className="shrink-0 rounded-full border border-green-300/20 bg-green-300/10 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-green-200 sm:px-2 sm:text-[0.6rem]">
                      {match.status}
                    </span>
                  </div>
                  <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-lg" style={{ aspectRatio: '9/16' }}>
                    <MatchCard
                      match={match}
                      onVote={() => void onRefresh()}
                      onCardClick={() => onOpenMatch(match.id)}
                      className="!h-full !min-h-0 !w-full !max-w-none"
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Results Board — mobile responsive */}
            <section id="results-board-mobile" className="w-full">
              <SectionHeading
                eyebrow="Final Whistle"
                title="Results Board"
                copy="Latest finished battles and how the arena voted."
                compact
              />
              {finishedMatches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-center text-sm text-white/60 backdrop-blur-md">
                  No results yet. Finished matches will show up here.
                </div>
              ) : (
                <div className="-mx-1 overflow-hidden">
                  <ResultsCarousel
                    matches={finishedMatches}
                    onCardClick={(match) => onOpenResultDetail(match.id)}
                  />
                </div>
              )}
            </section>

            {/* Upcoming Clashes — mobile responsive */}
            <section id="upcoming-clashes-mobile" className="w-full">
              <SectionHeading
                eyebrow="Clash Queue"
                title={upcomingMatches.length > 0 ? 'Upcoming Clashes' : 'Latest Clashes'}
                copy={upcomingMatches.length > 0
                  ? 'Next battles and where the arena hype is building.'
                  : 'Latest finished matches when no upcoming are scheduled.'}
                compact
              />
              <div className="space-y-2">
                {(upcomingMatches.length > 0 ? upcomingMatches.slice(0, 6) : finishedMatches.slice(0, 6)).map((match) => (
                  <MiniMatchCard key={match.id} match={match} />
                ))}
                {upcomingMatches.length === 0 && finishedMatches.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-center text-sm text-white/60 backdrop-blur-md">
                    No matches yet. New clashes will appear when scheduled.
                  </p>
                )}
              </div>
            </section>

            {/* How It Works — mobile responsive */}
            <section id="how-it-works-mobile" className="w-full">
              <h3 className="text-lg font-bold text-white sm:text-xl">How It Works</h3>
              <p className="mt-1 text-xs text-white/60 sm:text-sm">Three steps to join the arena.</p>
              <div className="mt-4 space-y-3">
                <StepRow index="01" title="Choose a clash" copy="Browse live and upcoming match cards with vote-ready calls to action." />
                <StepRow index="02" title="Back your side" copy="Vote before kickoff and watch the community split evolve in real time." />
                <StepRow index="03" title="Track the result" copy="Return for the result card and see how the arena called it." />
              </div>
            </section>

            {/* Swipe mode CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-black/25 px-4 py-4 text-sm text-white/70 backdrop-blur-md">
              <div className="min-w-0">
                <p className="font-bold text-white">Swipe mode ready</p>
                <p className="text-xs text-white/55">Full-screen voting cards on your phone</p>
              </div>
              <button
                onClick={() => setVotingMode(true)}
                className="shrink-0 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-200"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ArenaVotingOverlay({
  matches,
  activeMatchId,
  onClose,
  onVote,
}: {
  matches: MatchRecord[]
  activeMatchId: number | null
  onClose: () => void
  onVote: () => Promise<void>
}) {
  const [removedMatchIds, setRemovedMatchIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchOffset, setTouchOffset] = useState(0)
  const [emptyState, setEmptyState] = useState<'idle' | 'voted' | 'swiped'>('idle')
  // Throttle touchmove updates to avoid excessive re-renders on iOS Safari.
  const touchOffsetRafRef = useRef<number | null>(null)
  const touchOffsetPendingRef = useRef(0)
  const previousActiveMatchIdRef = useRef<number | null>(null)

  const voteMatches = useMemo(
    () => matches.filter((match) => !removedMatchIds.includes(match.id)),
    [matches, removedMatchIds]
  )

  useEffect(() => {
    setRemovedMatchIds((current) => current.filter((id) => matches.some((match) => match.id === id)))
    if (matches.length > 0) {
      setEmptyState('idle')
    }
  }, [matches])

  useEffect(() => {
    if (!voteMatches.length) {
      setCurrentIndex(0)
      return
    }

    if (activeMatchId == null) {
      return
    }

    if (previousActiveMatchIdRef.current === activeMatchId) {
      return
    }

    const nextIndex = voteMatches.findIndex((match) => match.id === activeMatchId)
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex)
      previousActiveMatchIdRef.current = activeMatchId
    }
  }, [activeMatchId, voteMatches])

  useEffect(() => {
    if (voteMatches.length === 0) {
      setCurrentIndex(0)
      return
    }

    setCurrentIndex((current) => Math.min(current, voteMatches.length - 1))
  }, [voteMatches.length])

  const hasInfiniteVote = voteMatches.length > 1

  function goToPrevious() {
    setCurrentIndex((current) => (current - 1 + voteMatches.length) % voteMatches.length)
  }

  function goToNext() {
    setCurrentIndex((current) => (current + 1) % voteMatches.length)
  }

  function removeCurrentCard(reason: 'voted' | 'swiped') {
    const currentMatch = voteMatches[currentIndex]
    if (!currentMatch) return

    const remainingCount = voteMatches.length - 1
    setRemovedMatchIds((current) => (current.includes(currentMatch.id) ? current : [...current, currentMatch.id]))
    setEmptyState(reason)

    if (remainingCount <= 0) {
      setCurrentIndex(0)
      return
    }

    setCurrentIndex((current) => Math.min(current, remainingCount - 1))
  }

  async function handleVoteMarked(matchId: number) {
    if (voteMatches[currentIndex]?.id === matchId) {
      removeCurrentCard('voted')
    } else {
      setRemovedMatchIds((current) => (current.includes(matchId) ? current : [...current, matchId]))
    }

    await onVote()
  }

  function handleTouchStart(event: React.TouchEvent) {
    const t = event.changedTouches[0]
    if (t) setTouchStart({ x: t.clientX, y: t.clientY })
    if (touchOffsetRafRef.current != null) {
      cancelAnimationFrame(touchOffsetRafRef.current)
      touchOffsetRafRef.current = null
    }
    setTouchOffset(0)
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (touchStart == null) return
    const t = event.changedTouches[0]
    if (!t) return

    const deltaX = t.clientX - touchStart.x
    const deltaY = t.clientY - touchStart.y
    touchOffsetPendingRef.current = Math.abs(deltaY) > Math.abs(deltaX) ? 0 : deltaX
    if (touchOffsetRafRef.current != null) return

    touchOffsetRafRef.current = requestAnimationFrame(() => {
      touchOffsetRafRef.current = null
      setTouchOffset(touchOffsetPendingRef.current)
    })
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchOffsetRafRef.current != null) {
      cancelAnimationFrame(touchOffsetRafRef.current)
      touchOffsetRafRef.current = null
    }

    if (touchStart == null) {
      setTouchStart(null)
      setTouchOffset(0)
      return
    }
    const t = event.changedTouches[0]
    if (!t) {
      setTouchStart(null)
      setTouchOffset(0)
      return
    }
    const deltaX = t.clientX - touchStart.x
    const deltaY = t.clientY - touchStart.y
    const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX)
    const isSwipeUp = isVerticalSwipe && deltaY < 0
    const isSwipeDown = isVerticalSwipe && deltaY > 0

    if (isSwipeDown && deltaY > 70) {
      onClose()
      setTouchStart(null)
      setTouchOffset(0)
      return
    }

    if (isSwipeUp && deltaY < -70) {
      removeCurrentCard('swiped')
      setTouchStart(null)
      setTouchOffset(0)
      return
    }

    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        goToPrevious()
      } else {
        goToNext()
      }
    }
    setTouchStart(null)
    setTouchOffset(0)
  }

  useEffect(() => {
    if (voteMatches.length === 0) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPrevious()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [voteMatches.length])

  useEffect(() => {
    return () => {
      if (touchOffsetRafRef.current != null) {
        cancelAnimationFrame(touchOffsetRafRef.current)
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,20,0.92),rgba(10,8,27,0.97)),url('https://img.freepik.com/free-photo/cosmic-lightning-storm-space-background_23-2151955881.jpg?semt=ais_hybrid&w=740&q=80')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(244,114,182,0.18),transparent_24%)]" />

      <div className="relative flex h-[100dvh] flex-col overflow-hidden px-4 py-4">
        {/* Top bar: hidden on mobile; on desktop shows Exit, title, slide count */}
        <div className="mb-4 hidden items-center justify-between gap-3 md:flex">
          <button
            onClick={onClose}
            className="glass-button inline-flex items-center gap-2 !rounded-xl px-4 py-2.5 text-sm"
            title="Exit"
          >
            <ChevronLeft size={18} className="shrink-0" />
            <span className="whitespace-nowrap">Exit</span>
          </button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-green-300/80">Voting Mode</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            {currentIndex + 1} / {voteMatches.length}
          </div>
        </div>

        {voteMatches.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div className="max-w-sm rounded-[2rem] border border-white/10 bg-black/30 px-6 py-8 backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/80">Voting Mode</p>
              <h3 className="mt-4 text-2xl font-black text-white">
                {emptyState === 'swiped' ? 'Arena Cleared' : 'No More Cards Right Now'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                {emptyState === 'swiped'
                  ? 'You swiped through every available clash. Come back later for the next wave of battle cards.'
                  : 'The current stack is finished. Fresh match cards will drop back into the arena soon.'}
              </p>
              <button
                onClick={onClose}
                className="btn-game mt-6 inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3"
              >
                Return To Arena
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-full flex-1 items-center justify-center gap-3 md:gap-8">
              <button
                onClick={goToPrevious}
                disabled={!hasInfiniteVote}
                className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex"
                title="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              {/* Mobile: swipeable single-card strip with swipe-down to close and swipe-up to skip */}
              <div
                className="flex h-full w-full flex-1 md:hidden"
                style={{ overflow: 'hidden', touchAction: 'pan-y' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="flex h-full w-full"
                  style={{
                    width: `${voteMatches.length * 100}%`,
                    transform: `translateX(calc(-${currentIndex * (100 / voteMatches.length)}% + ${touchOffset}px))`,
                    transition: touchStart == null ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                  }}
                >
                  {voteMatches.map((match) => (
                    <div key={match.id} className="flex h-full shrink-0 items-center justify-center" style={{ width: `${100 / voteMatches.length}%` }}>
                      <div className="h-full w-full max-w-[min(24rem,90vw)]">
                        <MatchCard
                          match={match}
                          onVote={(matchId) => void handleVoteMarked(matchId)}
                          onCardClick={() => {}}
                          interactive={voteMatches[currentIndex]?.id === match.id}
                          className="!h-full !min-h-0 !w-full !max-w-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Desktop: carousel stage with prev/current/next */}
              <div className="hidden h-full w-full flex-1 items-center justify-center overflow-visible md:flex">
                <MatchCarouselStage
                  matches={voteMatches}
                  currentIndex={currentIndex}
                  onPrevious={goToPrevious}
                  onNext={goToNext}
                  onSelectMatch={(_, index) => setCurrentIndex(index)}
                  onVote={(matchId) => void handleVoteMarked(matchId)}
                  className="flex-1"
                  stageHeightClass="h-[70dvh] min-h-[30rem] md:h-[76dvh]"
                  centerWidthClass="w-[min(24rem,90vw)] md:w-[min(28rem,38vw)] xl:w-[min(30rem,30vw)]"
                  sideWidthClass="w-[19.5rem] lg:w-[21.5rem] xl:w-[22.5rem]"
                  outerSideWidthClass="w-[14rem] xl:w-[15.5rem]"
                  showOuterSideCards
                />
              </div>
              <button
                onClick={goToNext}
                disabled={!hasInfiniteVote}
                className="glass-button hidden !rounded-2xl !px-4 !py-4 disabled:opacity-40 md:inline-flex"
                title="Next"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="mt-3 flex justify-center md:hidden">
              <p className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/65">
                Swipe up to skip. Swipe down to exit.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-3 py-3 text-center">
      <div className="text-xl font-black text-yellow-300">{value}</div>
      <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-white/60">{label}</div>
    </div>
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

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function hasLogo(url: string | null | undefined) {
  return typeof url === 'string' && /^(https?:\/\/|\/)/i.test(url.trim())
}

function MiniMatchCard({ match }: { match: MatchRecord }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const isFinished = match.status === 'finished'
  const summaryParts = [match.sport, match.league, match.venue].filter(Boolean)
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : match.sport
  const matchTime = new Date(match.match_time)
  const timeStr = matchTime.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const showLogo1 = hasLogo(match.team1_logo)
  const showLogo2 = hasLogo(match.team2_logo)

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/30">
          {showLogo1 ? (
            <img src={match.team1_logo!} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-white/90">{teamInitials(match.team1)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{match.team1}</p>
          <p className="truncate text-xs text-white/55">{summaryLine}</p>
        </div>
      </div>

      <div className="shrink-0 text-center">
        {isFinished ? (
          <p className="text-xs font-bold text-green-300">{match.result_summary || 'FT'}</p>
        ) : (
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/50">vs</p>
        )}
        <p className="mt-0.5 text-[0.6rem] text-white/45">{timeStr}</p>
        <p className="text-[0.6rem] text-white/50">{totalVotes} picks</p>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 justify-end">
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-bold text-white">{match.team2}</p>
          {match.rivalry_tagline ? (
            <p className="truncate text-xs text-white/55">{match.rivalry_tagline}</p>
          ) : (
            <p className="truncate text-xs text-white/55">{summaryLine}</p>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/30">
          {showLogo2 ? (
            <img src={match.team2_logo!} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-white/90">{teamInitials(match.team2)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

const RESULT_CARD_WIDTH = 300
const RESULT_CARD_ASPECT = 3 / 4

function ResultCard({ match, onClick }: { match: MatchRecord; onClick: () => void }) {
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Pct = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Pct = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50
  const league = match.league?.toUpperCase() || match.sport.toUpperCase()
  const bgUrl = match.result_artwork_url || null
  const winner = match.winner != null ? match.winner : (team1Pct >= team2Pct ? 1 : 2)
  const winnerName = winner === 1 ? match.team1 : match.team2
  const scoreText = match.result_summary || 'FT'

  return (
    <button
      type="button"
      onClick={onClick}
      className="result-card group relative flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/50 text-left shadow-xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/25 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-[#0a081b]"
      style={{
        width: RESULT_CARD_WIDTH,
        aspectRatio: RESULT_CARD_ASPECT,
        minHeight: Math.round(RESULT_CARD_WIDTH / RESULT_CARD_ASPECT),
      }}
    >
      {bgUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity group-hover:opacity-85"
          style={{ backgroundImage: `url(${bgUrl})`, opacity: 0.7 }}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="relative flex min-h-0 flex-1 flex-col justify-end p-4">
        <span className="inline-block w-fit rounded-md border border-white/20 bg-black/40 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-white/90">
          {league}
        </span>
        <h3 className="mt-2 line-clamp-2 min-h-[2.5rem] text-base font-bold leading-tight text-white drop-shadow-md">
          {match.team1} vs {match.team2}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-lg font-bold text-green-400">
          <Trophy className="h-4 w-4 shrink-0" />
          {scoreText}
        </p>
        <p className="mt-0.5 text-xs font-medium text-amber-300/90">
          Winner: {winnerName}
        </p>
        <div className="mt-3 flex h-1.5 shrink-0 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-l-full transition-all ${winner === 1 ? 'bg-amber-500' : 'bg-red-500/80'}`}
            style={{ width: `${team1Pct}%` }}
          />
          <div
            className={`h-full rounded-r-full transition-all ${winner === 2 ? 'bg-amber-500' : 'bg-sky-500/80'}`}
            style={{ width: `${team2Pct}%` }}
          />
        </div>
        <p className="mt-2 text-[0.65rem] font-medium uppercase tracking-wider text-white/50">
          {team1Pct}% – {team2Pct} · {totalVotes} votes
        </p>
      </div>
    </button>
  )
}

function ResultsCarousel({ matches, onCardClick }: { matches: MatchRecord[]; onCardClick: (match: MatchRecord) => void }) {
  if (matches.length === 0) return null
  const duplicated = [...matches, ...matches]
  return (
    <div className="relative -mx-4 overflow-hidden py-2 md:-mx-8">
      <div className="results-carousel-track gap-6">
        {duplicated.map((match, i) => (
          <ResultCard key={`result-${i}`} match={match} onClick={() => onCardClick(match)} />
        ))}
      </div>
    </div>
  )
}

function ResultDetailModal({ match, onClose }: { match: MatchRecord | null; onClose: () => void }) {
  if (!match) return null
  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Pct = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Pct = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50
  const league = match.league?.toUpperCase() || match.sport.toUpperCase()
  const bgUrl = match.result_artwork_url || null
  const resultCardUrl = match.result_card_url || match.card_asset_url || null
  const winner = match.winner != null ? match.winner : (team1Pct >= team2Pct ? 1 : 2)
  const winnerName = winner === 1 ? match.team1 : match.team2
  const scoreText = match.result_summary || 'FT'

  const resultStrip = (
    <div className="border-t border-white/10 bg-black/70 px-5 py-4">
      <p className="text-sm font-semibold uppercase tracking-wider text-white/60">{league}</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-bold text-green-400">
        <Trophy className="h-5 w-5 shrink-0" />
        {scoreText}
      </p>
      <p className="mt-1 text-sm font-medium text-amber-300/90">Winner: {winnerName}</p>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-l-full ${winner === 1 ? 'bg-amber-500' : 'bg-red-500/80'}`}
          style={{ width: `${team1Pct}%` }}
        />
        <div
          className={`h-full rounded-r-full ${winner === 2 ? 'bg-amber-500' : 'bg-sky-500/80'}`}
          style={{ width: `${team2Pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-medium text-white/50">
        Community split · {team1Pct}% – {team2Pct}% · {totalVotes} votes
      </p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Match result detail">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative flex h-full w-full cursor-pointer items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="relative w-full max-w-[min(24rem,90vw)] md:max-w-[28rem]">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-2 right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {resultCardUrl ? (
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/40 shadow-2xl">
              <img
                src={resultCardUrl}
                alt={`${match.team1} vs ${match.team2} – result`}
                className="aspect-[9/16] w-full object-cover"
              />
              {resultStrip}
            </div>
          ) : (
            <div
              className="relative flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/60 text-left shadow-2xl"
              style={{ aspectRatio: 3 / 4, minHeight: 360 }}
            >
              {bgUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${bgUrl})`, opacity: 0.7 }}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/50 to-transparent" />
              <div className="relative flex min-h-0 flex-1 flex-col justify-end p-5">
                <span className="inline-block w-fit rounded-md border border-white/20 bg-black/40 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-white/90">
                  {league}
                </span>
                <h3 className="mt-2 line-clamp-2 text-xl font-bold leading-tight text-white drop-shadow-lg">
                  {match.team1} vs {match.team2}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-xl font-bold text-green-400">
                  <Trophy className="h-5 w-5 shrink-0" />
                  {scoreText}
                </p>
                <p className="mt-0.5 text-sm font-medium text-amber-300/90">Winner: {winnerName}</p>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-l-full ${winner === 1 ? 'bg-amber-500' : 'bg-red-500/80'}`}
                    style={{ width: `${team1Pct}%` }}
                  />
                  <div
                    className={`h-full rounded-r-full ${winner === 2 ? 'bg-amber-500' : 'bg-sky-500/80'}`}
                    style={{ width: `${team2Pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">
                  {team1Pct}% – {team2Pct} · {totalVotes} votes
                </p>
              </div>
            </div>
          )}
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
            {match.league ? ` - ${match.league}` : ''}
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
    </div>
  )
}

function MatchCarouselStage({
  matches,
  currentIndex,
  onPrevious,
  onNext,
  onSelectMatch,
  onVote,
  className = '',
  stageHeightClass,
  centerWidthClass,
  sideWidthClass,
  outerSideWidthClass = 'w-[14rem]',
  showOuterSideCards = false,
}: {
  matches: MatchRecord[]
  currentIndex: number
  onPrevious: () => void
  onNext: () => void
  onSelectMatch: (match: MatchRecord, index: number) => void
  onVote: (matchId: number) => void
  className?: string
  stageHeightClass: string
  centerWidthClass: string
  sideWidthClass: string
  outerSideWidthClass?: string
  showOuterSideCards?: boolean
}) {
  if (matches.length === 0) {
    return null
  }

  return (
    <div className={`relative mx-auto w-full max-w-[1280px] overflow-visible ${stageHeightClass} ${className}`}>
      {matches.map((match, index) => {
        const position = getCarouselPosition(index, currentIndex, matches.length, showOuterSideCards)
        if (position === 'hidden') {
          return null
        }

        const isCurrent = position === 'current'
        const anchorClass = position === 'current'
          ? 'left-1/2 -translate-x-1/2'
          : position === 'prev'
            ? showOuterSideCards
              ? 'left-[28%] -translate-x-1/2 lg:left-[27%] xl:left-[26%]'
              : 'left-[18%] -translate-x-1/2 lg:left-[17%] xl:left-[16%]'
            : position === 'next'
              ? showOuterSideCards
                ? 'left-[72%] -translate-x-1/2 lg:left-[73%] xl:left-[74%]'
                : 'left-[82%] -translate-x-1/2 lg:left-[83%] xl:left-[84%]'
              : position === 'prev-outer'
                ? 'left-[8.5%] -translate-x-1/2'
                : 'left-[91.5%] -translate-x-1/2'
        const sideOpacity = showOuterSideCards ? 'opacity-100' : 'opacity-70'
        const wrapperClass = position === 'current'
          ? `z-30 ${centerWidthClass} opacity-100 scale-100`
          : position === 'prev'
            ? `z-20 ${sideWidthClass} hidden md:block scale-[0.84] ${sideOpacity}`
            : position === 'next'
              ? `z-20 ${sideWidthClass} hidden md:block scale-[0.84] ${sideOpacity}`
              : `z-10 ${outerSideWidthClass} hidden xl:block scale-[0.68] opacity-[0.15]`

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
  includeOuterSides: boolean,
): 'prev' | 'current' | 'next' | 'prev-outer' | 'next-outer' | 'hidden' {
  if (total <= 0) {
    return 'hidden'
  }

  if (index === currentIndex) {
    return 'current'
  }

  if (total > 1 && index === (currentIndex - 1 + total) % total) {
    return 'prev'
  }

  if (total > 1 && index === (currentIndex + 1) % total) {
    return 'next'
  }

  if (includeOuterSides && total > 3 && index === (currentIndex - 2 + total) % total) {
    return 'prev-outer'
  }

  if (includeOuterSides && total > 3 && index === (currentIndex + 2) % total) {
    return 'next-outer'
  }

  return 'hidden'
}

function sortMatchesForArena(list: MatchRecord[]) {
  const statusWeight = (match: MatchRecord) => {
    if (match.status === 'live') return 0
    if (match.status === 'upcoming') return 1
    if (match.status === 'finished') return 2
    return 3
  }

  return [...list].sort((a, b) => {
    const weightDifference = statusWeight(a) - statusWeight(b)
    if (weightDifference !== 0) {
      return weightDifference
    }

    const aPublished = a.latest_published_at ? new Date(a.latest_published_at).getTime() : 0
    const bPublished = b.latest_published_at ? new Date(b.latest_published_at).getTime() : 0

    if (aPublished !== bPublished) {
      return bPublished - aPublished
    }

    const aTime = new Date(a.match_time).getTime()
    const bTime = new Date(b.match_time).getTime()

    if (a.status === 'finished' && b.status === 'finished') {
      return bTime - aTime
    }

    return aTime - bTime
  })
}
