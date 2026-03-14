'use client'

import { useState } from 'react'
import { Trophy, Plus, ArrowLeft } from 'lucide-react'
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
      } else {
        setMessage('❌ Error creating match')
      }
    } catch (error) {
      setMessage('❌ Error creating match')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 mb-6">
          <ArrowLeft size={20} /> Back to Arena
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-10 h-10 text-yellow-400" />
          <h1 className="text-4xl font-black text-green-400">Admin Dashboard</h1>
        </div>

        <div className="bg-gray-800 rounded-xl p-8 card-glow">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Team 1</label>
              <input
                type="text"
                value={formData.team1}
                onChange={(e) => setFormData({...formData, team1: e.target.value})}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
                placeholder="e.g., Real Madrid"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Team 2</label>
              <input
                type="text"
                value={formData.team2}
                onChange={(e) => setFormData({...formData, team2: e.target.value})}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
                placeholder="e.g., Barcelona"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Sport</label>
              <select
                value={formData.sport}
                onChange={(e) => setFormData({...formData, sport: e.target.value})}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
              >
                <option>Football</option>
                <option>Basketball</option>
                <option>Tennis</option>
                <option>Cricket</option>
                <option>Rugby</option>
                <option>Baseball</option>
                <option>Hockey</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Match Time</label>
              <input
                type="datetime-local"
                value={formData.match_time}
                onChange={(e) => setFormData({...formData, match_time: e.target.value})}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={creating}
              className="w-full btn-game disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Match'}
            </button>
          </form>
        </div>

        <div className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-green-400/20">
          <h3 className="font-bold mb-3">📋 How to Manage Polls:</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>✅ <strong>Create Match:</strong> Fill the form above to create a new match poll</li>
            <li>🗳️ <strong>Upcoming:</strong> Users can vote until match time arrives</li>
            <li>⏰ <strong>Auto-Close:</strong> Voting automatically closes when match starts</li>
            <li>📊 <strong>Completed:</strong> To mark as finished, update status in database</li>
          </ul>
        </div>
      </div>
    </div>
  )
}