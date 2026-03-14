'use client'

import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (res.ok) {
        // Redirect based on role
        if (data.user.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/player/dashboard')
        }
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (testEmail: string, testPassword: string) => {
    setEmail(testEmail)
    setPassword(testPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <h1 className="text-4xl font-black text-glow bg-gradient-to-r from-green-400 to-pink-500 bg-clip-text text-transparent">
              PREDICTION ARENA
            </h1>
          </div>
          <p className="text-gray-400">Login to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-xl p-8 card-glow">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-gray-900 rounded-lg border border-green-400/30 focus:border-green-400 outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-game disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Test Accounts */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-3 text-center">Quick Login (Test Accounts)</p>
            <div className="space-y-2">
              <button
                onClick={() => quickLogin('admin@sports.com', 'admin123')}
                className="w-full p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded text-sm text-purple-300 transition"
              >
                🔐 Admin Account
              </button>
              <button
                onClick={() => quickLogin('player1@sports.com', 'player123')}
                className="w-full p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm text-blue-300 transition"
              >
                👤 Player 1 (John Doe - 250pts)
              </button>
              <button
                onClick={() => quickLogin('player2@sports.com', 'player123')}
                className="w-full p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded text-sm text-blue-300 transition"
              >
                👤 Player 2 (Jane Smith - 420pts)
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-green-400 hover:text-green-300 text-sm">
            ← Back to Arena
          </a>
        </div>
      </div>
    </div>
  )
}