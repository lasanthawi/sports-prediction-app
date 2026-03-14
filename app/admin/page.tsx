'use client'

import { useState, useEffect } from 'react'
import { Trophy, Plus, ArrowLeft, Image as ImageIcon, Play, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function Admin() {
  const [formData, setFormData] = useState({
    team1: '',
    team2: '',
    sport: 'Football',
    match_time: ''
  })
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [matches, setMatches] = useState<any[]>([])
  const [generating, setGenerating] = useState<number | null>(null)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    const res = await fetch('/api/matches')
    const data = await res.json()
    setMatches(data.matches || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setMessage('')
    
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (res.ok) {
        setMessage('✅ Match created successfully!')
        setFormData({ team1: '', team2: '', sport: 'Football', match_time: '' })
        fetchMatches()
      } else {
        setMessage('❌ Error creating match')
      }
    } catch (error) {
      setMessage('❌ Error creating match')
    } finally {
      setCreating(false)
    }
  }

  const generateFlyer = async (match: any, type: 'pre' | 'post') => {
    setGenerating(match.id)
    try {
      const res = await fetch('/api/generate-flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matchId: match.id,
          type
        })
      })
      
      const data = await res.json()
      alert(`🎨 Flyer Prompt Ready!\n\nPrompt: ${data.prompt}\n\nNext: Use Gemini to generate the image with this prompt.`)
    } catch (error) {
      alert('Error generating flyer')
    } finally {
      setGenerating(null)
    }
  }

  const updateStatus = async (matchId: number, status: string) => {
    // This would call an update API - placeholder for now
    alert(`Status update: ${status}\nUse database query to update: UPDATE matches SET status='${status}' WHERE id=${matchId}`)
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 mb-6">
          <ArrowLeft size={20} /> Back to Arena
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-10 h-10 text-yellow-400" />
          <h1 className="text-4xl font-black text-green-400">Match Management</h1>
        </div>

        {/* Create Match Form */}
        <div className="bg-gray-800 rounded-xl p-8 card-glow mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6" />
            Create New Match
          </h2>

          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              value={formData.team1}
              onChange={(e) => setFormData({...formData, team1: e.target.value})}
              className="p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
              placeholder="Team 1"
              required
            />
            <input
              type="text"
              value={formData.team2}
              onChange={(e) => setFormData({...formData, team2: e.target.value})}
              className="p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
              placeholder="Team 2"
              required
            />
            <select
              value={formData.sport}
              onChange={(e) => setFormData({...formData, sport: e.target.value})}
              className="p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
            >
              <option>Football</option>
              <option>Basketball</option>
              <option>Tennis</option>
              <option>Cricket</option>
              <option>Rugby</option>
            </select>
            <input
              type="datetime-local"
              value={formData.match_time}
              onChange={(e) => setFormData({...formData, match_time: e.target.value})}
              className="p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
              required
            />
            <button 
              type="submit" 
              disabled={creating}
              className="md:col-span-2 btn-game disabled:opacity-50"
            >
              {creating ? 'Creating...' : '➕ Create Match'}
            </button>
          </form>
        </div>

        {/* Existing Matches */}
        <div className="bg-gray-800 rounded-xl p-6 card-glow">
          <h2 className="text-2xl font-bold mb-4">Existing Matches</h2>
          <div className="space-y-4">
            {matches.map(match => (
              <div key={match.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">
                      {match.team1} vs {match.team2}
                    </h3>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>🏆 {match.sport}</span>
                      <span>📅 {new Date(match.match_time).toLocaleString()}</span>
                      <span className={`font-bold ${
                        match.status === 'upcoming' ? 'text-green-400' :
                        match.status === 'live' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {match.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-green-400">{match.team1}: {match.poll_team1_votes} votes</span>
                      <span className="text-gray-500 mx-2">|</span>
                      <span className="text-pink-400">{match.team2}: {match.poll_team2_votes} votes</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateFlyer(match, 'pre')}
                      disabled={generating === match.id}
                      className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-sm transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <ImageIcon size={16} />
                      {generating === match.id ? 'Generating...' : 'Pre Flyer'}
                    </button>
                    {match.status === 'upcoming' && (
                      <button
                        onClick={() => updateStatus(match.id, 'live')}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition flex items-center gap-2"
                      >
                        <Play size={16} />
                        Start Match
                      </button>
                    )}
                    {match.status === 'live' && (
                      <button
                        onClick={() => updateStatus(match.id, 'finished')}
                        className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-sm transition flex items-center gap-2"
                      >
                        <CheckCircle size={16} />
                        Finish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}