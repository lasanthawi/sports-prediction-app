'use client'

import { useState, useEffect } from 'react'
import { Trophy, Target, TrendingUp, Award, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import VotedMatchCard from '@/app/components/VotedMatchCard'

export default function PlayerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [votedMatches, setVotedMatches] = useState<any[]>([])

  useEffect(() => {
    checkAuth()
    fetchVotedMatches()
  }, [])

  const checkAuth = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    const data = await res.json()
    
    if (!data.user) {
      router.push('/login')
      return
    }
    
    setUser(data.user)
  }

  const fetchVotedMatches = async () => {
    try {
      const res = await fetch('/api/user/votes', { cache: 'no-store' })
      if (!res.ok) {
        console.error('Failed to fetch voted matches - ensuring dev server is completely hot reloaded')
        return
      }
      const data = await res.json()
      setVotedMatches(data.matches || [])
    } catch(err) {
      console.error('Fetch error:', err)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  const accuracy = user.predictions_count > 0 
    ? Math.round((user.correct_predictions / user.predictions_count) * 100) 
    : 0

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-black text-green-400">Player Dashboard</h1>
              <p className="text-gray-400">Welcome back, {user.name}!</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition">
            <LogOut size={20} /> Logout
          </button>
        </div>

        {/* Player Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-6 card-glow border-2 border-yellow-500/50">
            <div className="flex items-center justify-between mb-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <span className="text-xs text-gray-400">Total Points</span>
            </div>
            <p className="text-4xl font-black text-yellow-400">{user.points}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-gray-400">Predictions</span>
            </div>
            <p className="text-4xl font-black text-blue-400">{user.predictions_count}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-green-400" />
              <span className="text-xs text-gray-400">Correct</span>
            </div>
            <p className="text-4xl font-black text-green-400">{user.correct_predictions}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-gray-400">Accuracy</span>
            </div>
            <p className="text-4xl font-black text-purple-400">{accuracy}%</p>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-gray-800 rounded-xl p-6 card-glow mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Your Rank
          </h2>
          <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500/30 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-black">#2</span>
                </div>
                <div>
                  <p className="font-bold text-lg">{user.name}</p>
                  <p className="text-sm text-gray-400">{user.points} points</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-green-400">{accuracy}%</p>
                <p className="text-xs text-gray-400">Accuracy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Your Predictions */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
               <Target className="w-6 h-6 text-cyan-400" />
               Your Predictions
            </h2>
            <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-bold bg-cyan-900/20 px-4 py-2 rounded-full border border-cyan-500/30 transition shadow-sm">
              Head to Arena 🏟️
            </Link>
          </div>
          
          {votedMatches.length === 0 ? (
             <div className="bg-gray-800/50 rounded-2xl p-8 border border-white/10 text-center">
               <p className="text-white/60 text-lg mb-2">You haven't backed any sides yet.</p>
               <p className="text-sm text-white/40 mb-6">Return to the arena to lock in your votes and track the live results here.</p>
               <Link href="/" className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-bold text-white shadow-lg transition hover:scale-105">
                 Explore Clashes
               </Link>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {votedMatches.map(match => (
                 <VotedMatchCard key={match.id} match={match} />
               ))}
             </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/" className="bg-gradient-to-r from-green-500/20 to-green-600/20 rounded-xl p-6 border-2 border-green-500/50 hover:border-green-400 transition">
            <h3 className="text-xl font-bold mb-2">Make Predictions</h3>
            <p className="text-sm text-gray-400">Vote on upcoming matches</p>
          </Link>
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-xl p-6 border-2 border-purple-500/50">
            <h3 className="text-xl font-bold mb-2">Enable Notifications</h3>
            <p className="text-sm text-gray-400">Get match result alerts</p>
          </div>
        </div>
      </div>
    </div>
  )
}
