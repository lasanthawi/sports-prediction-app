'use client'

<<<<<<< HEAD
import { useEffect, useState, type ReactNode } from 'react'
import { Bell, Calendar, TrendingUp, Trophy } from 'lucide-react'
=======
import { useState, useEffect } from 'react'
import { Trophy, Calendar, TrendingUp, Bell, LogIn } from 'lucide-react'
>>>>>>> 8db24d669de0e1b3043e5892cee75dfd733b3428
import MatchCard from './components/MatchCard'
import Link from 'next/link'

interface MatchRecord {
  id: number
  status: 'upcoming' | 'live' | 'finished' | 'cancelled'
  poll_team1_votes: number
  poll_team2_votes: number
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
<<<<<<< HEAD
      <header className="mb-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Trophy className="h-12 w-12 animate-bounce text-yellow-400" />
          <h1 className="text-glow bg-gradient-to-r from-green-400 via-yellow-400 to-pink-500 bg-clip-text text-5xl font-black text-transparent md:text-7xl">
=======
      {/* Header */}
      <header className="text-center mb-12">
        <div className="absolute top-4 right-4">
          <Link href="/login" className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition">
            <LogIn size={20} /> Login
          </Link>
        </div>
        
        <div className="flex justify-center items-center gap-3 mb-4">
          <Trophy className="w-12 h-12 text-yellow-400 animate-bounce" />
          <h1 className="text-5xl md:text-7xl font-black text-glow bg-gradient-to-r from-green-400 via-yellow-400 to-pink-500 bg-clip-text text-transparent">
>>>>>>> 8db24d669de0e1b3043e5892cee75dfd733b3428
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

      <div className="mx-auto max-w-6xl">
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
<<<<<<< HEAD
          <div className="rounded-lg bg-gray-800 p-12 text-center">
            <p className="mb-4 text-2xl text-gray-400">No matches scheduled yet</p>
            <p className="text-gray-500">Check back soon for upcoming games.</p>
            <a href="/admin" className="btn-game mt-6 inline-block">
              Go to Admin Panel
            </a>
=======
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-2xl text-gray-400 mb-4">No matches scheduled yet</p>
            <p className="text-gray-500">Check back soon for upcoming games!</p>
            <Link href="/login" className="inline-block mt-6 btn-game">
              Login to Admin Panel
            </Link>
>>>>>>> 8db24d669de0e1b3043e5892cee75dfd733b3428
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match as any} onVote={() => void fetchMatches()} />
            ))}
          </div>
        )}
      </div>

<<<<<<< HEAD
      <div className="mx-auto mt-16 max-w-4xl rounded-2xl border-2 border-green-400/50 bg-gradient-to-r from-green-400/20 to-pink-500/20 p-8 text-center">
        <h3 className="mb-4 text-3xl font-bold">Never Miss a Match</h3>
        <p className="mb-6 text-gray-300">Get notified when results are in and see how your predictions stacked up.</p>
        <button className="btn-game">
          <Bell className="mr-2 inline" /> Enable Notifications
        </button>
=======
      {/* CTA Section */}
      <div className="max-w-4xl mx-auto mt-16 bg-gradient-to-r from-green-400/20 to-pink-500/20 rounded-2xl p-8 text-center border-2 border-green-400/50">
        <h3 className="text-3xl font-bold mb-4">Never Miss a Match!</h3>
        <p className="text-gray-300 mb-6">Get notified when results are in and see how your predictions stacked up</p>
        <Link href="/login" className="btn-game inline-flex items-center gap-2">
          <Bell className="inline" /> Login to Enable Notifications
        </Link>
>>>>>>> 8db24d669de0e1b3043e5892cee75dfd733b3428
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
