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
  onVote?: () => void
  interactive?: boolean
  footerSlot?: ReactNode
  className?: string
}

interface CountdownState {
  expired?: boolean
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

export default function MatchCard({ match, onVote, interactive = true, footerSlot, className = '' }: MatchCardProps) {
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
  const isVotingOpen = interactive && match.status === 'upcoming' && !timeLeft.expired
  const headline = match.league?.toUpperCase() || `${match.sport.toUpperCase()} SHOWDOWN`
  const versusTitle = `${match.team1} vs ${match.team2}`.toUpperCase()
  const backgroundArtworkUrl =
    (match.status === 'finished' ? match.result_artwork_url : match.prediction_artwork_url) ||
    match.card_asset_url ||
    null
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
        throw new Error(payload.error || 'Vote failed')
      }

      setVoted(true)
      setSelectedTeam(team)
      setVotedFlash(true)
      setTimeout(() => setVotedFlash(false), 450)
      onVote?.()
    } catch (error: any) {
      alert(error.message || 'Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  return (
    <article className={`match-poster pack-enter ${votedFlash ? 'vote-burst' : 'pack-float'} ${!interactive ? 'admin-poster' : ''} ${className}`}>
      <div className="poster-noise" />
      <div className="poster-vignette" />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundArtworkUrl
            ? `linear-gradient(180deg, rgba(7,10,20,0.18), rgba(7,10,20,0.82)), url(${backgroundArtworkUrl})`
            : 'linear-gradient(135deg, rgba(237,29,36,0.72), rgba(14,165,233,0.72))',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.18)_45%,rgba(2,6,23,0.78)_100%)]" />

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="text-center">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.42em] text-white/80">{headline}</p>
          <h3 className="mt-2 text-[2rem] font-black uppercase leading-none tracking-[0.05em] text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] md:text-[2.35rem]">
            {versusTitle}
          </h3>
          <p className="mt-3 text-[1rem] font-semibold text-white/90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]">{question}</p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="text-center text-[1.15rem] font-black uppercase tracking-[0.16em] text-white">
            {match.status === 'finished' ? 'Final Verdict' : 'Who Will Win?'}
          </div>

          <div className="grid gap-3">
            <SideButton
              tone="red"
              team={match.team1}
              logo={match.team1_logo}
              percentage={team1Percentage}
              disabled={!isVotingOpen || voted || voting}
              selected={selectedTeam === 1}
              interactive={interactive}
              onClick={() => void handleVote(1)}
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
            />
          </div>

          <div className="rounded-[1.6rem] border border-white/10 bg-black/35 px-4 py-3 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              <MapPin size={14} />
              <span>{match.venue || 'Venue TBA'}</span>
            </div>
            <div className="mt-2 text-lg font-black text-[#ffe495]">{formatMatchTime(match.match_time)}</div>
            {isVotingOpen ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/80">
                <Clock3 size={14} />
                <span>{formatCountdown(timeLeft)}</span>
              </div>
            ) : (
              <div className={`mt-3 text-xs font-bold uppercase tracking-[0.18em] ${match.status === 'finished' ? 'text-green-300' : 'text-red-300'}`}>
                {match.status === 'finished' ? 'Voting closed. Result in.' : interactive ? 'Voting closed' : 'Admin preview mode'}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-black/28 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/75">
            <span className="flex items-center gap-2">
              <TrendingUp size={14} />
              {totalVotes} picks
            </span>
            <span className="flex items-center gap-2">
              <Zap size={14} />
              {match.status}
            </span>
          </div>

          {voting ? <div className="text-center text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">Locking your prediction...</div> : null}
          {voted ? (
            <div className="flex items-center justify-center gap-2 text-center text-xs font-bold uppercase tracking-[0.18em] text-green-300">
              <Sparkles size={14} />
              Prediction powered up
            </div>
          ) : null}
          {footerSlot}
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
}: {
  tone: 'red' | 'blue'
  team: string
  logo?: string | null
  percentage: number
  disabled: boolean
  selected: boolean
  interactive: boolean
  onClick: () => void
}) {
  const toneClass =
    tone === 'red'
      ? 'poster-red border-red-400/70 shadow-[0_0_22px_rgba(239,68,68,0.38)]'
      : 'poster-blue border-sky-300/70 shadow-[0_0_22px_rgba(56,189,248,0.34)]'

  return (
    <button
      onClick={onClick}
      disabled={!interactive || disabled}
      className={`relative overflow-hidden rounded-[1.6rem] border bg-black/45 px-4 py-4 text-left transition ${toneClass} ${interactive && !disabled ? 'hover:-translate-y-1 hover:scale-[1.01]' : 'cursor-default'} ${selected ? 'ring-2 ring-yellow-300' : ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/35 text-center text-sm font-black text-white">
          {logo || initials(team)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/80">{interactive ? 'Vote' : 'Preview'}</div>
          <div className="line-clamp-2 text-[1.05rem] font-black uppercase leading-tight text-white">{team}</div>
        </div>
        <div className="rounded-full bg-black/35 px-3 py-2 text-sm font-black text-white">{percentage}%</div>
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
