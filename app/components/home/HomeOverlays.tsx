'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Trophy, X } from 'lucide-react'
import MatchCard from '@/app/components/MatchCard'
import type { HomePageMatchRecord } from '@/lib/homepage'

export function ArenaVotingOverlay({
  matches,
  activeMatchId,
  currentTimeMs,
  onClose,
  onVote,
}: {
  matches: HomePageMatchRecord[]
  activeMatchId: number | null
  currentTimeMs: number
  onClose: () => void
  onVote: () => Promise<void>
}) {
  const [removedMatchIds, setRemovedMatchIds] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchOffset, setTouchOffset] = useState(0)
  const [emptyState, setEmptyState] = useState<'idle' | 'voted' | 'swiped'>('idle')
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

    if (activeMatchId == null || previousActiveMatchIdRef.current === activeMatchId) {
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

  useEffect(() => {
    if (voteMatches.length === 0) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setCurrentIndex((current) => (current - 1 + voteMatches.length) % voteMatches.length)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setCurrentIndex((current) => (current + 1) % voteMatches.length)
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

  const hasInfiniteVote = voteMatches.length > 1
  const currentVoteMatch = voteMatches[currentIndex] || null

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

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,20,0.95),rgba(10,8,27,0.98))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(244,114,182,0.14),transparent_24%)]" />

      <div className="relative flex h-[100dvh] flex-col overflow-hidden px-4 py-4">
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
            <div className="max-w-sm rounded-[2rem] border border-white/10 bg-black/30 px-6 py-8">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/80">Voting Mode</p>
              <h3 className="mt-4 text-2xl font-black text-white">
                {emptyState === 'swiped' ? 'League Queue Cleared' : 'No More Cards Right Now'}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                {emptyState === 'swiped'
                  ? 'You swiped through every available clash. Come back later for the next wave of battle cards.'
                  : 'The current stack is finished. Fresh match cards will drop back into Vote League soon.'}
              </p>
              <button
                onClick={onClose}
                className="btn-game mt-6 inline-flex items-center justify-center rounded-[1.2rem] px-5 py-3"
              >
                Return To Vote League
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

              <div
                className="flex h-full w-full flex-1 md:hidden"
                style={{ overflow: 'hidden', touchAction: 'pan-y' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {currentVoteMatch ? (
                  <div
                    key={currentVoteMatch.id}
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      transform: `translateX(${touchOffset}px)`,
                      transition: touchStart == null ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                    }}
                  >
                    <div className="h-full w-full max-w-[min(24rem,90vw)]">
                      <MatchCard
                        match={currentVoteMatch}
                        onVote={(matchId) => void handleVoteMarked(matchId)}
                        onCardClick={() => {}}
                        interactive
                        priorityArtwork
                        countdownActive
                        currentTimeMs={currentTimeMs}
                        className="!h-full !min-h-0 !w-full !max-w-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="hidden h-full w-full flex-1 items-center justify-center overflow-visible md:flex">
                <div className="relative mx-auto h-[76dvh] min-h-[30rem] w-full max-w-[1280px] overflow-visible">
                  {voteMatches.map((match, index) => {
                    const position = getCarouselPosition(index, currentIndex, voteMatches.length, true)
                    if (position === 'hidden') {
                      return null
                    }

                    const isCurrent = position === 'current'
                    const anchorClass = position === 'current'
                      ? 'left-1/2 -translate-x-1/2'
                      : position === 'prev'
                        ? 'left-[28%] -translate-x-1/2 lg:left-[27%] xl:left-[26%]'
                        : position === 'next'
                          ? 'left-[72%] -translate-x-1/2 lg:left-[73%] xl:left-[74%]'
                          : position === 'prev-outer'
                            ? 'left-[8.5%] -translate-x-1/2'
                            : 'left-[91.5%] -translate-x-1/2'
                    const wrapperClass = position === 'current'
                      ? 'z-30 w-[min(28rem,38vw)] xl:w-[min(30rem,30vw)] opacity-100 scale-100'
                      : position === 'prev' || position === 'next'
                        ? 'z-20 w-[19.5rem] lg:w-[21.5rem] xl:w-[22.5rem] scale-[0.84] opacity-100'
                        : 'z-10 w-[14rem] xl:w-[15.5rem] scale-[0.68] opacity-[0.15]'

                    return (
                      <div
                        key={match.id}
                        className={`absolute top-1/2 aspect-[9/16] -translate-y-1/2 transform-gpu transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${anchorClass} ${wrapperClass}`}
                      >
                        <MatchCard
                          match={match}
                          onVote={(matchId) => void handleVoteMarked(matchId)}
                          onCardClick={() => {
                            if (position === 'prev') goToPrevious()
                            else if (position === 'next') goToNext()
                            else if (position === 'current') void 0
                          }}
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

export function ResultDetailModal({ match, onClose }: { match: HomePageMatchRecord | null; onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Match result detail">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full cursor-pointer items-center justify-center p-4" onClick={onClose}>
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
                alt={`${match.team1} vs ${match.team2} - result`}
                className="aspect-[9/16] w-full object-cover"
              />
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
                  Community split - {team1Pct}% / {team2Pct}% - {totalVotes} votes
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/60 text-left shadow-2xl" style={{ aspectRatio: 3 / 4, minHeight: 360 }}>
              {bgUrl ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})`, opacity: 0.7 }} />
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getCarouselPosition(
  index: number,
  currentIndex: number,
  total: number,
  includeOuterSides: boolean,
): 'prev' | 'current' | 'next' | 'prev-outer' | 'next-outer' | 'hidden' {
  if (total <= 0) return 'hidden'
  if (index === currentIndex) return 'current'
  if (total > 1 && index === (currentIndex - 1 + total) % total) return 'prev'
  if (total > 1 && index === (currentIndex + 1) % total) return 'next'
  if (includeOuterSides && total > 3 && index === (currentIndex - 2 + total) % total) return 'prev-outer'
  if (includeOuterSides && total > 3 && index === (currentIndex + 2) % total) return 'next-outer'
  return 'hidden'
}
