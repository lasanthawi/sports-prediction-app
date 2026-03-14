'use client'

import { useState, useEffect } from 'react'
import { Trophy, Plus, Image, Users, TrendingUp, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    fetchMatches()
  }, [])

  const checkAuth = async () => {
    const res = await fetch('/api/auth/me')
    const data = await res.json()
    
    if (!data.user || data.user.role !== 'admin') {
      router.push('/login')
      return
    }
    
    setUser(data.user)
  }

  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/matches')
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (error) {
      console.error('Error fetching matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const generateFlyer = async (matchId: number) => {
    alert('Flyer generation ready! Connect Gemini to generate AI flyers.')
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-black text-green-400">Admin Dashboard</h1>
              <p className="text-gray-400">Welcome, {user.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition">
            <LogOut size={20} /> Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Matches</p>
                <p className="text-3xl font-bold text-green-400">{matches.length}</p>
              </div>
              <Users className="w-12 h-12 text-green-400/30" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Polls</p>
                <p className="text-3xl font-bold text-yellow-400">{matches.filter(m => m.status === 'upcoming').length}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-yellow-400/30" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 card-glow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Votes</p>
                <p className="text-3xl font-bold text-pink-400">
                  {matches.reduce((acc, m) => acc + (m.poll_team1_votes || 0) + (m.poll_team2_votes || 0), 0)}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-pink-400/30" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Link href="/admin" className="bg-gradient-to-r from-green-500/20 to-green-600/20 rounded-xl p-6 border-2 border-green-500/50 hover:border-green-400 transition card-glow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/30 rounded-lg flex items-center justify-center">
                <Plus size={24} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Create Match</h3>
                <p className="text-sm text-gray-400">Add new match poll</p>
              </div>
            </div>
          </Link>
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-xl p-6 border-2 border-purple-500/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/30 rounded-lg flex items-center justify-center">
                <Image size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold">AI Flyers</h3>
                <p className="text-sm text-gray-400">Generate match flyers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Matches Table */}
        <div className="bg-gray-800 rounded-xl p-6 card-glow">
          <h2 className="text-2xl font-bold mb-4">All Matches</h2>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left p-3 text-gray-400">Match</th>
                    <th className="text-left p-3 text-gray-400">Sport</th>
                    <th className="text-left p-3 text-gray-400">Time</th>
                    <th className="text-left p-3 text-gray-400">Status</th>
                    <th className="text-left p-3 text-gray-400">Votes</th>
                    <th className="text-left p-3 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(match => (
                    <tr key={match.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="p-3">
                        <div className="font-bold">{match.team1} vs {match.team2}</div>
                      </td>
                      <td className="p-3 text-gray-400">{match.sport}</td>
                      <td className="p-3 text-gray-400 text-sm">
                        {new Date(match.match_time).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          match.status === 'upcoming' ? 'bg-green-500/20 text-green-400' :
                          match.status === 'live' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {match.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">
                        {match.poll_team1_votes + match.poll_team2_votes}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => generateFlyer(match.id)}
                          className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-sm transition"
                        >
                          Generate Flyer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}