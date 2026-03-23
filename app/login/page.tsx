'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SiteFooter from '@/app/components/SiteFooter'
import { BRAND } from '@/lib/brand'

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

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex flex-col items-center justify-center gap-4">
            <img src={BRAND.logoUrl} alt={`${BRAND.name} logo`} className="h-28 w-28 object-contain drop-shadow-[0_0_28px_rgba(255,216,77,0.18)]" />
            <h1 className="text-glow bg-gradient-to-r from-green-400 to-pink-500 bg-clip-text text-4xl font-black text-transparent">
              {BRAND.name.toUpperCase()}
            </h1>
          </div>
          <p className="text-gray-400">Log in to your {BRAND.shortName} account</p>
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

          <div className="mt-6 border-t border-gray-700 pt-6 text-center">
            <p className="text-xs text-gray-400">Use your registered {BRAND.shortName} email and password to sign in.</p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-green-400 hover:text-green-300">
            Back to Vote League
          </a>
        </div>
      </div>
      </div>
      <SiteFooter />
    </div>
  )
}
