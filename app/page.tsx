'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Bell, Calendar, LogIn, TrendingUp, Trophy } from 'lucide-react'
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
  card_asset_url?: string | null
}

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

  return (
    <main className="min-h-screen p-4 md:p-8">
      <header className="mb-12 text-center">
        <div className="mb-4 flex justify-end">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-green-500/20 px-4 py-2 text-green-400 transition hover:bg-green-500/30">
            <LogIn size={18} /> Login
          </Link>
        </div>
        <div className="mb-4 flex items-center justify-center gap-3">
          <Trophy className="h-12 w-12 animate-bounce text-yellow-400" />
          <h1 className="text-glow bg-gradient-to-r from-green-400 via-yellow-400 to-pink-500 bg-clip-text text-5xl font-black text-transparent md:text-7xl">
            PREDICTION ARENA
          </h1>
        </div>
        <p className="text-xl text-gray-300">Predict. Vote. Win Glory.</p>
      </header>

      <div className="mx-auto mb-12 grid max-w-4xl grid-cols-3 gap-4">
        <StatCard icon={<Calendar />} label="Live Matches" value={matches.length.toString()} />
        <StatCard icon={<TrendingUp />} label="Active Polls" value={matches.filter((match) => match.status === 'upcoming').length.toString()} />
        <StatCard
          icon={<Bell />}
          label="Total Votes"
          value={matches.reduce((acc, match) => acc + (match.poll_team1_votes || 0) + (match.poll_team2_votes || 0), 0).toString()}
        />
      </div>

      <div className="mx-auto max-w-7xl">
        <h2 className="mb-6 text-3xl font-bold text-green-400">Live Matches</h2>

        {loading ? (
          <div className="py-12 text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-t-4 border-green-400" />
            <p className="mt-4 text-gray-400">Loading matches...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500 bg-red-900/20 p-8 text-center">
            <p className="text-xl text-red-400">{error}</p>
            <button onClick={() => void fetchMatches()} className="btn-game mt-4">
              Retry
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-lg bg-gray-800 p-12 text-center">
            <p className="mb-4 text-2xl text-gray-400">No matches scheduled yet</p>
            <p className="text-gray-500">Check back soon for upcoming games.</p>
            <Link href="/login" className="btn-game mt-6 inline-flex items-center gap-2">
              <LogIn size={18} /> Login to Admin Panel
            </Link>
          </div>
        ) : (
          <div className="grid justify-items-center gap-8 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} onVote={() => void fetchMatches()} />
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto mt-16 max-w-4xl rounded-2xl border-2 border-green-400/50 bg-gradient-to-r from-green-400/20 to-pink-500/20 p-8 text-center">
        <h3 className="mb-4 text-3xl font-bold">Never Miss a Match</h3>
        <p className="mb-6 text-gray-300">Get notified when results are in and see how your predictions stacked up.</p>
        <Link href="/login" className="btn-game inline-flex items-center gap-2">
          <Bell className="inline" /> Login to Enable Notifications
        </Link>
      </div>
    </main>
  )
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card-glow transform rounded-lg bg-gray-800 p-4 text-center transition hover:scale-105">
      <div className="mb-2 flex justify-center text-green-400">{icon}</div>
      <div className="text-3xl font-bold text-yellow-400">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}
