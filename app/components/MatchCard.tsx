'use client'

import { useState, useEffect } from 'react'
import { Clock, Users, TrendingUp } from 'lucide-react'

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
    status: 'upcoming' | 'live' | 'finished'
  }
  onVote?: () => void
}

export default function MatchCard({ match, onVote }: MatchCardProps) {
  const [voted, setVoted] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<any>({})
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
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

  const handleVote = async (team: number) => {
    if (match.status !== 'upcoming' || voting) return
    
    setVoting(true)
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, team })
      })
      
      if (res.ok) {
        setVoted(true)
        setSelectedTeam(team)
        if (onVote) onVote()
      } else {
        const data = await res.json()
        alert(data.error || 'Vote failed')
      }
    } catch (error) {
      console.error('Vote error:', error)
      alert('Failed to submit vote')
    } finally {
      setVoting(false)
    }
  }

  const isUpcoming = match.status === 'upcoming' && !timeLeft.expired

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden card-glow transform transition-all hover:scale-102">
      <div className="p-6">
        {/* Sport Badge */}
        <div className="flex justify-between items-center mb-4">
          <span className="px-3 py-1 bg-green-400/20 text-green-400 text-xs font-bold rounded-full">
            {match.sport.toUpperCase()}
          </span>
          {match.status === 'live' && (
            <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              🔴 LIVE
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-4xl mb-2">{match.team1_logo || '⚽'}</div>
            <p className="font-bold text-sm">{match.team1}</p>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-3xl font-black text-yellow-400">VS</span>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">{match.team2_logo || '⚽'}</div>
            <p className="font-bold text-sm">{match.team2}</p>
          </div>
        </div>

        {/* Countdown */}
        {isUpcoming && !timeLeft.expired && (
          <div className="bg-gradient-to-r from-green-400/10 to-pink-500/10 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Voting ends in:</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['days', 'hours', 'minutes', 'seconds'].map((unit) => (
                <div key={unit} className="text-center">
                  <div className="text-2xl font-black text-yellow-400">
                    {String(timeLeft[unit] || 0).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-gray-500 uppercase">{unit}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {timeLeft.expired && (
          <div className="text-center py-4 bg-red-500/20 rounded-lg mb-4">
            <span className="text-red-400 font-bold">⏰ VOTING CLOSED</span>
          </div>
        )}

        {/* Poll Results */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Users size={14} /> {totalVotes} predictions
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <TrendingUp size={14} /> Live Poll
            </span>
          </div>
          
          {/* Vote Bars */}
          <div className="space-y-2">
            <button
              onClick={() => handleVote(1)}
              disabled={!isUpcoming || voted || voting}
              className={`w-full p-3 rounded-lg relative overflow-hidden transition-all ${
                isUpcoming && !voted && !voting ? 'hover:scale-105 cursor-pointer' : 'cursor-not-allowed'
              } ${selectedTeam === 1 ? 'ring-2 ring-green-400' : ''}`}
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-green-400/50 to-green-400/20"
                style={{ width: `${team1Percentage}%` }}
              />
              <div className="relative flex justify-between items-center">
                <span className="font-bold">{match.team1}</span>
                <span className="font-bold text-green-400">{team1Percentage}%</span>
              </div>
            </button>

            <button
              onClick={() => handleVote(2)}
              disabled={!isUpcoming || voted || voting}
              className={`w-full p-3 rounded-lg relative overflow-hidden transition-all ${
                isUpcoming && !voted && !voting ? 'hover:scale-105 cursor-pointer' : 'cursor-not-allowed'
              } ${selectedTeam === 2 ? 'ring-2 ring-pink-500' : ''}`}
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-pink-500/50 to-pink-500/20"
                style={{ width: `${team2Percentage}%` }}
              />
              <div className="relative flex justify-between items-center">
                <span className="font-bold">{match.team2}</span>
                <span className="font-bold text-pink-500">{team2Percentage}%</span>
              </div>
            </button>
          </div>
        </div>

        {/* Status */}
        {voting && (
          <div className="text-center text-sm text-yellow-400">Submitting vote...</div>
        )}
        {voted && (
          <div className="text-center text-sm text-green-400">
            ✅ Prediction recorded! Check back after the match
          </div>
        )}
      </div>
    </div>
  )
}