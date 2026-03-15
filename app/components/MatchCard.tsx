'use client'

import { useEffect, useState } from 'react'
import { Clock3, Sparkles, Swords, TrendingUp, Users } from 'lucide-react'

interface MatchCardProps {
  match: {
    id: number
    team1: string
    team2: string
    team1_logo?: string
    team2_logo?: string
    match_time: string
    sport: string
    poll_team1_votes: number
    poll_team2_votes: number
    status: 'upcoming' | 'live' | 'finished' | 'cancelled'
    result_summary?: string | null
    card_asset_url?: string | null
  }
  onVote?: () => void
}

interface CountdownState {
  expired?: boolean
  days?: number
  hours?: number
  minutes?: number
  seconds?: number
}

export default function MatchCard({ match, onVote }: MatchCardProps) {
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
  const isVotingOpen = match.status === 'upcoming' && !timeLeft.expired
  const titleText = match.status === 'finished' ? 'Result Locked In' : match.status === 'live' ? 'Live Clash' : 'Who Takes the Crown?'
  const subText =
    match.status === 'finished'
      ? match.result_summary || 'The showdown is over.'
      : match.status === 'live'
        ? 'Predictions are sealed. The battle is live.'
        : 'Pick your champion before kickoff.'

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
      console.error('Vote error:', error)
      alert(error.message || 'Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  return (
    <article className={`pack-card pack-enter pack-float mx-auto w-full max-w-[24rem] ${votedFlash ? 'vote-burst' : ''}`}>
      <div className="pack-ridge" />
      <div className="pack-shimmer" />
      <div className="arena-scan" />

      <div className="relative aspect-[3/5]">
        <div
          className="absolute inset-[4.6rem_0_5.4rem_0] bg-cover bg-center"
          style={{
            backgroundImage: match.card_asset_url
              ? `linear-gradient(180deg, rgba(9, 10, 19, 0.12), rgba(9, 10, 19, 0.8)), url(${match.card_asset_url})`
              : 'linear-gradient(180deg, rgba(255, 204, 0, 0.32), rgba(14, 16, 29, 0.88))',
          }}
        />

        <div className="absolute inset-x-0 top-[4.8rem] bg-black/88 px-4 py-4 text-center shadow-[0_10px_24px_rgba(0,0,0,0.38)]">
          <p className="text-[1.8rem] font-black uppercase tracking-[0.12em] text-yellow-300">{titleText}</p>
          <p className="mt-2 bg-white px-3 py-2 text-sm font-bold uppercase tracking-[0.08em] text-gray-900">{subText}</p>
        </div>

        <div className="absolute inset-x-0 top-[10.4rem] px-5">
          <div className="rounded-[1.5rem] border border-white/15 bg-black/30 px-4 py-4 backdrop-blur-[2px]">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/80">
              <span className="rounded-full bg-green-400/20 px-3 py-1 font-bold text-green-300">{match.sport}</span>
              <span className={`rounded-full px-3 py-1 font-bold ${match.status === 'live' ? 'bg-red-500 text-white idle-pulse' : 'bg-white/10 text-white/85'}`}>
                {match.status}
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <Competitor
                name={match.team1}
                logo={match.team1_logo}
                selected={selectedTeam === 1}
                percentage={team1Percentage}
              />
              <div className="pb-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-300 bg-black/70 text-yellow-300 shadow-[0_0_20px_rgba(255,216,77,0.28)]">
                  <Swords size={26} />
                </div>
                <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">Duel</div>
              </div>
              <Competitor
                name={match.team2}
                logo={match.team2_logo}
                selected={selectedTeam === 2}
                percentage={team2Percentage}
              />
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-[5.6rem] px-5">
          {isVotingOpen ? (
            <div className="mb-4 rounded-[1.4rem] border border-yellow-300/40 bg-black/68 px-4 py-3 text-center shadow-[0_0_18px_rgba(255,216,77,0.18)]">
              <div className="mb-2 flex items-center justify-center gap-2 text-yellow-300">
                <Clock3 size={15} />
                <span className="text-xs font-bold uppercase tracking-[0.16em]">Countdown To Kickoff</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['days', 'hours', 'minutes', 'seconds'].map((unit) => (
                  <div key={unit} className="rounded-2xl bg-white/8 px-2 py-2">
                    <div className="text-xl font-black text-white">{String(timeLeft[unit as keyof CountdownState] || 0).padStart(2, '0')}</div>
                    <div className="text-[0.58rem] uppercase tracking-[0.16em] text-white/60">{unit}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`mb-4 rounded-[1.3rem] px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.14em] ${match.status === 'finished' ? 'bg-green-500/18 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {match.status === 'finished' ? match.result_summary || 'Result sealed' : 'Voting closed'}
            </div>
          )}

          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-white/70">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {totalVotes} total picks
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={14} />
              Hype meter
            </span>
          </div>

          <div className="space-y-3">
            <VoteButton
              label={match.team1}
              percentage={team1Percentage}
              accent="from-emerald-300 via-green-400 to-lime-300"
              glow="shadow-[0_0_18px_rgba(92,255,155,0.24)]"
              disabled={!isVotingOpen || voted || voting}
              selected={selectedTeam === 1}
              onClick={() => void handleVote(1)}
            />
            <VoteButton
              label={match.team2}
              percentage={team2Percentage}
              accent="from-pink-300 via-fuchsia-400 to-rose-400"
              glow="shadow-[0_0_18px_rgba(255,79,163,0.22)]"
              disabled={!isVotingOpen || voted || voting}
              selected={selectedTeam === 2}
              onClick={() => void handleVote(2)}
            />
          </div>

          {voting ? <div className="mt-3 text-center text-xs font-bold uppercase tracking-[0.14em] text-yellow-300">Locking in your pick...</div> : null}
          {voted ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-bold uppercase tracking-[0.14em] text-green-300">
              <Sparkles size={14} />
              Prediction powered up
            </div>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-black/92 px-5 py-4 text-center">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.22em] text-yellow-300">
            <span>Season Pack</span>
            <span>{match.status === 'finished' ? 'Result Card' : 'Prediction Pack'}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function Competitor({
  name,
  logo,
  selected,
  percentage,
}: {
  name: string
  logo?: string
  selected: boolean
  percentage: number
}) {
  return (
    <div className={`text-center ${selected ? 'scale-[1.04]' : ''}`}>
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] border-2 text-2xl font-black shadow-[0_8px_20px_rgba(0,0,0,0.28)] ${
        selected ? 'border-yellow-300 bg-white/18 text-yellow-200' : 'border-white/15 bg-black/32 text-white'
      }`}>
        {logo || name.slice(0, 2).toUpperCase()}
      </div>
      <div className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-white">{name}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-yellow-300">{percentage}% backing</div>
    </div>
  )
}

function VoteButton({
  label,
  percentage,
  accent,
  glow,
  disabled,
  selected,
  onClick,
}: {
  label: string
  percentage: number
  accent: string
  glow: string
  disabled: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-[1.2rem] border px-4 py-4 text-left transition-all ${
        disabled ? 'cursor-not-allowed opacity-70' : `hover:-translate-y-1 hover:scale-[1.01] ${glow}`
      } ${selected ? 'border-yellow-300 bg-white/16' : 'border-white/15 bg-black/62'}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-[0.22] transition-opacity group-hover:opacity-[0.3]`} />
      <div className="absolute bottom-0 left-0 top-0 rounded-r-full bg-white/20" style={{ width: `${percentage}%` }} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-lg font-black uppercase tracking-[0.08em] text-white">{label}</div>
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/70">
            {disabled ? 'Selection locked' : 'Tap to back this side'}
          </div>
        </div>
        <div className="rounded-full bg-black/55 px-3 py-2 text-sm font-black text-yellow-300">{percentage}%</div>
      </div>
    </button>
  )
}
