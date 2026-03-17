'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const BRAND_IMAGE = 'https://i.ibb.co/qLsG4ByG/70325951-97a2-4fb3-ad27-a3c7ba251676.png'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.user.role === 'admin') {
          router.replace('/admin')
        } else {
          router.replace('/player/dashboard')
        }
        router.refresh()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function quickLogin(testEmail: string, testPassword: string) {
    setEmail(testEmail)
    setPassword(testPassword)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex flex-col items-center justify-center gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-3 shadow-[0_0_28px_rgba(255,216,77,0.18)]">
              <img src={BRAND_IMAGE} alt="Prediction Arena logo" className="h-20 w-20 object-contain" />
            </div>
            <h1 className="text-glow bg-gradient-to-r from-green-400 to-pink-500 bg-clip-text text-4xl font-black text-transparent">
              PREDICTION ARENA
            </h1>
          </div>
          <p className="text-gray-400">Login to your account</p>
        </div>

        <div className="card-glow rounded-xl bg-gray-800 p-8">
          {error ? (
            <div className="mb-4 rounded border border-red-500 bg-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-green-400/30 bg-gray-900 p-3 outline-none focus:border-green-400"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-green-400/30 bg-gray-900 p-3 outline-none focus:border-green-400"
                placeholder="Enter your password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-game w-full disabled:opacity-50">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-700 pt-6">
            <p className="mb-3 text-center text-xs text-gray-400">Quick Login (Test Accounts)</p>
            <div className="space-y-2">
              <button
                onClick={() => quickLogin('admin@sports.com', 'admin123')}
                className="w-full rounded bg-purple-500/20 p-2 text-sm text-purple-300 transition hover:bg-purple-500/30"
              >
                Admin Account
              </button>
              <button
                onClick={() => quickLogin('player1@sports.com', 'player123')}
                className="w-full rounded bg-blue-500/20 p-2 text-sm text-blue-300 transition hover:bg-blue-500/30"
              >
                Player 1 (John Doe - 250pts)
              </button>
              <button
                onClick={() => quickLogin('player2@sports.com', 'player123')}
                className="w-full rounded bg-blue-500/20 p-2 text-sm text-blue-300 transition hover:bg-blue-500/30"
              >
                Player 2 (Jane Smith - 420pts)
              </button>
              <button
                onClick={() => quickLogin('player3@sports.com', 'player123')}
                className="w-full rounded bg-blue-500/20 p-2 text-sm text-blue-300 transition hover:bg-blue-500/30"
              >
                Player 3 (Mike Wilson - 180pts)
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-green-400 hover:text-green-300">
            Back to Arena
          </a>
        </div>
      </div>
    </div>
  )
}
