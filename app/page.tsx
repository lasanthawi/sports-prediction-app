'use client'

import { useState, useEffect } from 'react'
import { Trophy, Calendar, TrendingUp, Bell, LogIn } from 'lucide-react'
import MatchCard from './components/MatchCard'
import Link from 'next/link'

export default function Home() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches', { cache: 'no-store' })
      const data = await res.json()
      setMatches(data.matches || [])
      setError('')
    } catch (err) {
      console.error('Error fetching matches:', err)
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
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
            PREDICTION ARENA
          </h1>
        </div>
        <p className="text-xl text-gray-300">Predict. Vote. Win Glory! 🏆</p>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
        <StatCard icon={<Calendar />} label="Live Matches" value={matches.length.toString()} />
        <StatCard icon={<TrendingUp />} label="Active Polls" value={matches.filter(m => m.status === 'upcoming').length.toString()} />
        <StatCard icon={<Bell />} label="Total Votes" value={matches.reduce((acc, m) => acc + (m.poll_team1_votes || 0) + (m.poll_team2_votes || 0), 0).toString()} />
      </div>

      {/* Matches Grid */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-green-400">🔥 LIVE MATCHES</h2>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-400 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading matches...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 text-center">
            <p className="text-red-400 text-xl">{error}</p>
            <button onClick={fetchMatches} className="mt-4 btn-game">Retry</button>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-2xl text-gray-400 mb-4">No matches scheduled yet</p>
            <p className="text-gray-500">Check back soon for upcoming games!</p>
            <Link href="/login" className="inline-block mt-6 btn-game">
              Login to Admin Panel
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} onVote={fetchMatches} />
            ))}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto mt-16 bg-gradient-to-r from-green-400/20 to-pink-500/20 rounded-2xl p-8 text-center border-2 border-green-400/50">
        <h3 className="text-3xl font-bold mb-4">Never Miss a Match!</h3>
        <p className="text-gray-300 mb-6">Get notified when results are in and see how your predictions stacked up</p>
        <Link href="/login" className="btn-game inline-flex items-center gap-2">
          <Bell className="inline" /> Login to Enable Notifications
        </Link>
      </div>
    </main>
  )
}

function StatCard({ icon, label, value }: any) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 card-glow text-center transform transition hover:scale-105">
      <div className="text-green-400 mb-2 flex justify-center">{icon}</div>
      <div className="text-3xl font-bold text-yellow-400">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}