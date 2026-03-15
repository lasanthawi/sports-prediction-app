'use client'

import { useEffect, useState } from 'react'
import { Clock, TrendingUp, Users } from 'lucide-react'

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

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      const matchTime = new Date(match.match_time).getTime()
      const distance = matchTime - now

      if (distance < 0) {
        setTimeLeft({ expired: true })
        return
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [match.match_time])

  const totalVotes = match.poll_team1_votes + match.poll_team2_votes
  const team1Percentage = totalVotes > 0 ? Math.round((match.poll_team1_votes / totalVotes) * 100) : 50
  const team2Percentage = totalVotes > 0 ? Math.round((match.poll_team2_votes / totalVotes) * 100) : 50

  async function handleVote(team: number) {
    if (match.status !== 'upcoming' || voting) {
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
      onVote?.()
    } catch (error: any) {
      console.error('Vote error:', error)
      alert(error.message || 'Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  const isUpcoming = match.status === 'upcoming' && !timeLeft.expired

  return (
    <div className="card-glow overflow-hidden rounded-xl bg-gray-800 transition-all hover:scale-[1.02]">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full bg-green-400/20 px-3 py-1 text-xs font-bold text-green-400">
            {match.sport.toUpperCase()}
          </span>
          {match.status === 'live' ? (
            <span className="animate-pulse rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">LIVE</span>
          ) : null}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="mb-2 text-4xl">{match.team1_logo || 'T1'}</div>
            <p className="text-sm font-bold">{match.team1}</p>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-3xl font-black text-yellow-400">VS</span>
          </div>
          <div className="text-center">
            <div className="mb-2 text-4xl">{match.team2_logo || 'T2'}</div>
            <p className="text-sm font-bold">{match.team2}</p>
          </div>
        </div>

        {isUpcoming ? (
          <div className="mb-4 rounded-lg bg-gradient-to-r from-green-400/10 to-pink-500/10 p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-400">Voting ends in</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['days', 'hours', 'minutes', 'seconds'].map((unit) => (
                <div key={unit} className="text-center">
                  <div className="text-2xl font-black text-yellow-400">
                    {String(timeLeft[unit as keyof CountdownState] || 0).padStart(2, '0')}
                  </div>
                  <div className="text-xs uppercase text-gray-500">{unit}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {timeLeft.expired && match.status !== 'finished' ? (
          <div className="mb-4 rounded-lg bg-red-500/20 py-4 text-center">
            <span className="font-bold text-red-400">Voting closed</span>
          </div>
        ) : null}

        {match.status === 'finished' && match.result_summary ? (
          <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-300">
            Result: {match.result_summary}
          </div>
        ) : null}

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={14} /> {totalVotes} predictions
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUp size={14} /> Live poll
            </span>
          </div>

          <div className="space-y-2">
            <VoteButton
              label={match.team1}
              percentage={team1Percentage}
              accentClass="from-green-400/50 to-green-400/20"
              textClass="text-green-400"
              disabled={!isUpcoming || voted || voting}
              selected={selectedTeam === 1}
              onClick={() => void handleVote(1)}
            />
            <VoteButton
              label={match.team2}
              percentage={team2Percentage}
              accentClass="from-pink-500/50 to-pink-500/20"
              textClass="text-pink-500"
              disabled={!isUpcoming || voted || voting}
              selected={selectedTeam === 2}
              onClick={() => void handleVote(2)}
            />
          </div>
        </div>

        {voting ? <div className="text-center text-sm text-yellow-400">Submitting vote...</div> : null}
        {voted ? <div className="text-center text-sm text-green-400">Prediction recorded. Check back after the match.</div> : null}
      </div>
    </div>
  )
}

function VoteButton({
  label,
  percentage,
  accentClass,
  textClass,
  disabled,
  selected,
  onClick,
}: {
  label: string
  percentage: number
  accentClass: string
  textClass: string
  disabled: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full overflow-hidden rounded-lg p-3 transition-all ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'
      } ${selected ? 'ring-2 ring-green-400' : ''}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${accentClass}`} style={{ width: `${percentage}%` }} />
      <div className="relative flex items-center justify-between">
        <span className="font-bold">{label}</span>
        <span className={`font-bold ${textClass}`}>{percentage}%</span>
      </div>
    </button>
  )
}
