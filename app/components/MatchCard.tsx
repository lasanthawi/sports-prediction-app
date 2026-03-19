'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Clock3, MapPin, Sparkles, TrendingUp, Zap } from 'lucide-react'

interface MatchCardProps {
  match: {
    id: number
    team1: string
    team2: string
    team1_logo?: string | null
    team2_logo?: string | null
    match_time: string
    sport: string
    league?: string | null
    venue?: string | null
    poll_team1_votes: number
    poll_team2_votes: number
    status: 'upcoming' | 'live' | 'finished' | 'cancelled'
    result_summary?: string | null
    rivalry_tagline?: string | null
    prediction_artwork_url?: string | null
    result_artwork_url?: string | null
    card_asset_url?: string | null
  }
  onVote?: (matchId: number) => void | Promise<void>
  onCardClick?: () => void
  interactive?: boolean
  footerSlot?: ReactNode
  className?: string
  /** Use for mobile 2-col grid: smaller type, line-clamp, tighter footer so card fits without overflow */
  compact?: boolean
  /** When true, artwork image loads with priority (e.g. current carousel slide). When false, use loading="lazy". Omit for default eager. */
  priorityArtwork?: boolean
}

interface CountdownState {
  expired?: boolean
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

export default function MatchCard({ match, onVote, onCardClick, interactive = true, footerSlot, className = '', compact = false, priorityArtwork }: MatchCardProps) {
  const [voted, setVoted] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<CountdownState>({})
  const [voting, setVoting] = useState(false)
  const [votedFlash, setVotedFlash] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const matchTime = new Date(match.match_time).getTime()
      const distance = matchTime - now

      if (distance <= 0) {
        setTimeLeft({ expired: true })
        return
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      })
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [match.match_time])

  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Percentage = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Percentage = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50
  const isVotingOpen = interactive && match.status === 'upcoming'
  const headline = match.league?.toUpperCase() || `${match.sport.toUpperCase()} SHOWDOWN`
  const versusTitle = `${match.team1} vs ${match.team2}`.toUpperCase()
  const backgroundArtworkUrl =
    (match.status === 'finished' ? match.result_artwork_url : match.prediction_artwork_url) || null
  const question =
    match.status === 'finished'
      ? match.result_summary || 'Result locked in'
      : match.rivalry_tagline || `Who wins the battle of ${match.team1} and ${match.team2}?`

  async function handleVote(team: number) {
    if (!isVotingOpen || voting) {
      return
    }

    setVoting(true)
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, team }),
      })

      const payload = await res.json()
      if (!res.ok) {
        if (res.status === 401 && payload?.code === 'auth_required') {
          window.location.href = '/login?from=vote'
          return
        }
        throw new Error(payload.error || 'Vote failed')
      }

      setVoted(true)
      setSelectedTeam(team)
      setVotedFlash(true)
      setTimeout(() => setVotedFlash(false), 450)
      await onVote?.(match.id)
    } catch (error: any) {
      alert(error.message || 'Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  return (
    <article
      className={`match-poster pack-enter ${votedFlash ? 'vote-burst' : 'pack-float'} ${!interactive ? 'admin-poster' : ''} ${onCardClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onCardClick}
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={onCardClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onCardClick()
        }
      } : undefined}
    >
      <div className="poster-noise" />
      <div className="poster-vignette" />
      {backgroundArtworkUrl ? (
        <>
          <img
            src={backgroundArtworkUrl}
            alt=""
            loading={priorityArtwork === false ? 'lazy' : 'eager'}
            fetchPriority={priorityArtwork === true ? 'high' : undefined}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,20,0.14)_0%,rgba(7,10,20,0.22)_20%,rgba(7,10,20,0.08)_50%,rgba(7,10,20,0.48)_100%)]" />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'linear-gradient(145deg, rgba(18,34,64,0.96), rgba(13,18,32,0.96)), radial-gradient(circle at 22% 28%, rgba(239,68,68,0.2), transparent 26%), radial-gradient(circle at 78% 28%, rgba(59,130,246,0.22), transparent 28%), radial-gradient(circle at 50% 56%, rgba(250,204,21,0.1), transparent 22%)',
          }}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.48)_0%,rgba(2,6,23,0.12)_24%,rgba(2,6,23,0.01)_50%,rgba(2,6,23,0.08)_72%,rgba(2,6,23,0.56)_100%)]" />

      <div className={`relative flex h-full min-h-0 flex-col justify-between ${compact ? 'p-2' : 'p-4 md:p-5'}`}>
        <div className={compact ? 'min-w-0 shrink-0 space-y-0.5' : 'space-y-2'}>
          <div className="text-center">
            <p className={`truncate font-bold uppercase text-white/74 ${compact ? 'text-[0.5rem] tracking-[0.2em]' : 'text-[0.58rem] tracking-[0.34em]'}`}>{headline}</p>
            <h3 className={`min-w-0 truncate font-black uppercase leading-tight text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] ${compact ? 'mt-0.5 line-clamp-2 text-[0.65rem] tracking-tight' : 'mt-1 text-[1.4rem] leading-[0.92] tracking-[0.035em] md:text-[1.65rem]'}`}>
              {versusTitle}
            </h3>
          </div>

          {!compact && (
            <div className="mx-auto min-h-[2.2rem] max-w-[78%] px-2 text-center">
              <p className="text-[0.74rem] font-semibold leading-snug text-white/82 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]">
                {question}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0" />

        <div className={`min-h-0 shrink-0 ${compact ? 'space-y-1' : 'space-y-1.5'}`}>
          <div className={compact ? 'grid gap-1' : 'grid gap-2'}>
            <SideButton
              tone="red"
              team={match.team1}
              logo={match.team1_logo}
              percentage={team1Percentage}
              disabled={!isVotingOpen || voted || voting}
              selected={selectedTeam === 1}
              interactive={interactive}
              onClick={() => void handleVote(1)}
              compact={compact}
            />
            <SideButton
              tone="blue"
              team={match.team2}
              logo={match.team2_logo}
              percentage={team2Percentage}
              disabled={!isVotingOpen || voted || voting}
              selected={selectedTeam === 2}
              interactive={interactive}
              onClick={() => void handleVote(2)}
              compact={compact}
            />
          </div>

          <div className={`rounded-[1rem] border border-white/10 bg-black/18 backdrop-blur-[4px] ${compact ? 'px-2 py-1' : 'px-4 py-2'}`}>
            <div className={`flex items-center justify-center gap-1 text-white/66 ${compact ? 'text-[0.5rem]' : 'text-[0.58rem]'} font-bold uppercase tracking-[0.18em]`}>
              <MapPin size={compact ? 10 : 12} />
              <span className="truncate">{match.venue || 'Venue TBA'}</span>
            </div>
            <div className={`text-center font-black text-[#ffe495] ${compact ? 'text-[0.6rem]' : 'mt-1 text-[0.88rem]'}`}>{formatMatchTime(match.match_time)}</div>
            {match.status === 'upcoming' ? (
              <div className={`flex items-center justify-center gap-1 text-white/80 ${compact ? 'text-[0.5rem]' : 'mt-1 text-[0.58rem]'} font-bold uppercase tracking-[0.16em]`}>
                <Clock3 size={compact ? 10 : 12} />
                <span className="truncate">{formatCountdown(timeLeft)}</span>
              </div>
            ) : match.status === 'finished' ? (
              <div className={`text-center text-green-300 ${compact ? 'text-[0.5rem]' : 'mt-1 text-[0.58rem]'} font-bold uppercase tracking-[0.18em]`}>
                Result in
              </div>
            ) : !interactive ? (
              <div className={`text-center text-white/60 ${compact ? 'text-[0.5rem]' : 'mt-1 text-[0.58rem]'} font-bold uppercase tracking-[0.18em]`}>
                Preview
              </div>
            ) : (
              <div className={`text-center text-red-300 ${compact ? 'text-[0.5rem]' : 'mt-1 text-[0.58rem]'} font-bold uppercase tracking-[0.18em]`}>
                Closed
              </div>
            )}
            <div className={`flex items-center justify-between border-t border-white/10 pt-1 text-white/72 ${compact ? 'text-[0.48rem]' : 'mt-2 pt-2 text-[0.56rem]'} uppercase tracking-[0.16em]`}>
              <span className="flex items-center gap-1">
                <TrendingUp size={compact ? 10 : 12} />
                {totalVotes} picks
              </span>
              <span className="flex items-center gap-1">
                <Zap size={compact ? 10 : 12} />
                {match.status}
              </span>
            </div>
            {footerSlot && !compact ? <div className="mt-2">{footerSlot}</div> : null}
          </div>

          {!compact && voting ? <div className="text-center text-[0.58rem] font-bold uppercase tracking-[0.18em] text-yellow-300">Locking your prediction...</div> : null}
          {!compact && voted ? (
            <div className="flex items-center justify-center gap-2 text-center text-[0.58rem] font-bold uppercase tracking-[0.18em] text-green-300">
              <Sparkles size={12} />
              Prediction powered up
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function SideButton({
  tone,
  team,
  logo,
  percentage,
  disabled,
  selected,
  interactive,
  onClick,
  compact = false,
}: {
  tone: 'red' | 'blue'
  team: string
  logo?: string | null
  percentage: number
  disabled: boolean
  selected: boolean
  interactive: boolean
  onClick: () => void
  compact?: boolean
}) {
  const [showImage, setShowImage] = useState(isRenderableImageUrl(logo))
  const toneClass =
    tone === 'red'
      ? 'poster-red border-red-400/70 shadow-[0_0_22px_rgba(239,68,68,0.38)]'
      : 'poster-blue border-sky-300/70 shadow-[0_0_22px_rgba(56,189,248,0.34)]'

  useEffect(() => {
    setShowImage(isRenderableImageUrl(logo))
  }, [logo])

  return (
    <button
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      disabled={!interactive || disabled}
      className={`relative overflow-hidden rounded-[1rem] border bg-black/28 text-left transition ${toneClass} ${compact ? 'px-2 py-1' : 'px-3 py-2'} ${interactive && !disabled ? 'hover:-translate-y-1 hover:scale-[1.01]' : 'cursor-default'} ${selected ? 'ring-2 ring-yellow-300' : ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5" />
      <div className={`relative flex items-center ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-black/24 text-center font-black text-white ${compact ? 'h-7 w-7 text-[0.5rem]' : 'h-10 w-10 text-[0.68rem]'}`}>
          {showImage ? (
            <img
              src={logo || ''}
              alt={`${team} logo`}
              className="h-full w-full object-cover"
              onError={() => setShowImage(false)}
            />
          ) : (
            initials(team)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-bold uppercase text-white/76 ${compact ? 'text-[0.45rem] tracking-[0.1em]' : 'text-[0.54rem] tracking-[0.18em]'}`}>{interactive ? 'Vote' : 'Preview'}</div>
          <div className={`line-clamp-1 truncate font-black uppercase leading-tight text-white ${compact ? 'text-[0.6rem]' : 'line-clamp-2 text-[0.82rem]'}`}>{team}</div>
        </div>
        <div className={`flex shrink-0 items-center justify-center rounded-xl border border-white/25 bg-gradient-to-b from-white/12 to-black/50 shadow-[0_0_14px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.08)] ${compact ? 'px-2 py-1' : 'px-3.5 py-2'}`}>
          <span className={`font-black tabular-nums leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] ${compact ? 'text-[1rem]' : 'text-[1.5rem]'}`}>{percentage}%</span>
        </div>
      </div>
    </button>
  )
}

function initials(team: string) {
  return team
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function isRenderableImageUrl(value?: string | null) {
  if (!value) {
    return false
  }

  return /^(https?:\/\/|\/)/i.test(value.trim())
}

function formatMatchTime(matchTime: string) {
  return new Date(matchTime).toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCountdown(timeLeft: CountdownState) {
  if (timeLeft.expired) {
    return 'Kickoff time reached'
  }

  return `${String(timeLeft.days || 0).padStart(2, '0')}d ${String(timeLeft.hours || 0).padStart(2, '0')}h ${String(timeLeft.minutes || 0).padStart(2, '0')}m ${String(timeLeft.seconds || 0).padStart(2, '0')}s`
}
