'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Edit3, Image as ImageIcon, LogOut, Plus, RefreshCw, Trash2, Trophy, Users, WandSparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface MatchRecord {
  id: number
  team1: string
  team2: string
  sport: string
  league: string | null
  match_time: string
  venue: string | null
  status: 'upcoming' | 'live' | 'finished' | 'cancelled'
  result_summary: string | null
  winner: number | null
  poll_team1_votes: number
  poll_team2_votes: number
  card_asset_url?: string | null
  prediction_artwork_url?: string | null
  prediction_card_url?: string | null
  result_card_url?: string | null
  asset_generation_status?: string | null
  team1_captain?: string | null
  team2_captain?: string | null
  team1_palette?: string | null
  team2_palette?: string | null
  team1_flag_colors?: string | null
  team2_flag_colors?: string | null
  creative_direction?: string | null
  rivalry_tagline?: string | null
  art_style?: string | null
}

interface UserRecord {
  id: number
  name: string
  role: string
}

const emptyEditForm = {
  team1: '',
  team2: '',
  sport: '',
  league: '',
  venue: '',
  match_time: '',
  status: 'upcoming' as MatchRecord['status'],
  result_summary: '',
  winner: '',
  team1_captain: '',
  team2_captain: '',
  team1_palette: '',
  team2_palette: '',
  team1_flag_colors: '',
  team2_flag_colors: '',
  creative_direction: '',
  rivalry_tagline: '',
  art_style: '',
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<UserRecord | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    setLoading(true)
    try {
      const authRes = await fetch('/api/auth/me', { cache: 'no-store' })
      const authData = await authRes.json()

      if (!authData.user || authData.user.role !== 'admin') {
        router.push('/login')
        return
      }

      setUser(authData.user)
      await fetchMatches()
    } finally {
      setLoading(false)
    }
  }

  async function fetchMatches() {
    const res = await fetch('/api/matches?includeAll=1', { cache: 'no-store' })
    const data = await res.json()
    setMatches(data.matches || [])
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function startEdit(match: MatchRecord) {
    setEditingId(match.id)
    setEditForm({
      team1: match.team1,
      team2: match.team2,
      sport: match.sport,
      league: match.league || '',
      venue: match.venue || '',
      match_time: new Date(match.match_time).toISOString().slice(0, 16),
      status: match.status,
      result_summary: match.result_summary || '',
      winner: match.winner ? String(match.winner) : '',
      team1_captain: match.team1_captain || '',
      team2_captain: match.team2_captain || '',
      team1_palette: match.team1_palette || '',
      team2_palette: match.team2_palette || '',
      team1_flag_colors: match.team1_flag_colors || '',
      team2_flag_colors: match.team2_flag_colors || '',
      creative_direction: match.creative_direction || '',
      rivalry_tagline: match.rivalry_tagline || '',
      art_style: match.art_style || '',
    })
    setMessage('')
  }

  function stopEdit() {
    setEditingId(null)
    setEditForm(emptyEditForm)
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault()
    await runAction(`save-${id}`, async () => {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          league: editForm.league || null,
          venue: editForm.venue || null,
          result_summary: editForm.result_summary || null,
          winner: editForm.winner ? Number(editForm.winner) : null,
          match_time: new Date(editForm.match_time).toISOString(),
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update match')
      }

      setMessage('Match metadata updated and assets regenerated')
      setEditingId(null)
      await fetchMatches()
    })
  }

  async function regenerateAsset(id: number, mode: 'artwork' | 'card' | 'full', variant: 'prediction' | 'result' | 'all', successMessage: string) {
    await runAction(`regen-${id}-${mode}-${variant}`, async () => {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, variant }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to regenerate asset')
      }

      setMessage(successMessage)
      await fetchMatches()
    })
  }

  async function removeMatch(id: number) {
    const confirmed = window.confirm('Delete this match and all generated assets?')
    if (!confirmed) {
      return
    }

    await runAction(`delete-${id}`, async () => {
      const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete match')
      }

      setMessage('Match deleted')
      if (editingId === id) {
        setEditingId(null)
      }
      await fetchMatches()
    })
  }

  async function runAction(key: string, task: () => Promise<void>) {
    setBusyMap((current) => ({ ...current, [key]: true }))
    setMessage('')
    try {
      await task()
    } catch (error: any) {
      setMessage(error.message || 'Action failed')
    } finally {
      setBusyMap((current) => ({ ...current, [key]: false }))
    }
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-black text-green-400">Admin Dashboard</h1>
              <p className="text-gray-400">Manage premium artwork metadata, rendered card variants, and match state.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="btn-game inline-flex items-center gap-2">
              <Plus size={18} /> Create Match
            </Link>
            <button onClick={() => void fetchMatches()} className="rounded-lg border border-green-400/40 px-4 py-2 text-green-300">
              <RefreshCw size={18} className="inline" /> Refresh
            </button>
            <button onClick={handleLogout} className="rounded-lg bg-red-500/20 px-4 py-2 text-red-300">
              <LogOut size={18} className="inline" /> Logout
            </button>
          </div>
        </div>

        {message ? <div className="mb-6 rounded-xl border border-green-400/20 bg-gray-900/70 px-4 py-3 text-sm">{message}</div> : null}

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard label="Total Matches" value={String(matches.length)} icon={<Users className="h-10 w-10 text-green-400/30" />} />
          <StatCard label="Active Polls" value={String(matches.filter((match) => match.status === 'upcoming').length)} icon={<ImageIcon className="h-10 w-10 text-yellow-400/30" />} />
          <StatCard label="Total Votes" value={String(matches.reduce((sum, match) => sum + match.poll_team1_votes + match.poll_team2_votes, 0))} icon={<WandSparkles className="h-10 w-10 text-pink-400/30" />} />
        </div>

        <div className="grid gap-6">
          {loading ? (
            <div className="rounded-xl bg-gray-800 p-6">Loading matches...</div>
          ) : matches.length === 0 ? (
            <div className="rounded-xl bg-gray-800 p-6">No matches found.</div>
          ) : (
            matches.map((match) => (
              <div key={match.id} className="overflow-hidden rounded-2xl border border-white/10 bg-gray-800/90 card-glow">
                <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
                  <div className="bg-black/30">
                    {match.card_asset_url ? (
                      <img src={match.card_asset_url} alt={`${match.team1} vs ${match.team2}`} className="h-full min-h-[340px] w-full object-cover object-top" />
                    ) : (
                      <div className="flex min-h-[340px] items-center justify-center text-sm text-gray-400">No generated image yet</div>
                    )}
                  </div>

                  <div className="p-6">
                    {editingId === match.id ? (
                      <form onSubmit={(event) => void saveEdit(event, match.id)} className="grid gap-4 md:grid-cols-2">
                        <Field label="Team 1" value={editForm.team1} onChange={(value) => setEditForm((current) => ({ ...current, team1: value }))} />
                        <Field label="Team 2" value={editForm.team2} onChange={(value) => setEditForm((current) => ({ ...current, team2: value }))} />
                        <Field label="Sport" value={editForm.sport} onChange={(value) => setEditForm((current) => ({ ...current, sport: value }))} />
                        <Field label="League" value={editForm.league} onChange={(value) => setEditForm((current) => ({ ...current, league: value }))} required={false} />
                        <Field label="Venue" value={editForm.venue} onChange={(value) => setEditForm((current) => ({ ...current, venue: value }))} required={false} />
                        <Field label="Match Time" value={editForm.match_time} onChange={(value) => setEditForm((current) => ({ ...current, match_time: value }))} type="datetime-local" />
                        <Field label="Team 1 Captain" value={editForm.team1_captain} onChange={(value) => setEditForm((current) => ({ ...current, team1_captain: value }))} required={false} />
                        <Field label="Team 2 Captain" value={editForm.team2_captain} onChange={(value) => setEditForm((current) => ({ ...current, team2_captain: value }))} required={false} />
                        <Field label="Team 1 Palette" value={editForm.team1_palette} onChange={(value) => setEditForm((current) => ({ ...current, team1_palette: value }))} required={false} />
                        <Field label="Team 2 Palette" value={editForm.team2_palette} onChange={(value) => setEditForm((current) => ({ ...current, team2_palette: value }))} required={false} />
                        <Field label="Team 1 Flag Colors" value={editForm.team1_flag_colors} onChange={(value) => setEditForm((current) => ({ ...current, team1_flag_colors: value }))} required={false} />
                        <Field label="Team 2 Flag Colors" value={editForm.team2_flag_colors} onChange={(value) => setEditForm((current) => ({ ...current, team2_flag_colors: value }))} required={false} />
                        <Field label="Rivalry Tagline" value={editForm.rivalry_tagline} onChange={(value) => setEditForm((current) => ({ ...current, rivalry_tagline: value }))} required={false} />
                        <Field label="Art Style" value={editForm.art_style} onChange={(value) => setEditForm((current) => ({ ...current, art_style: value }))} required={false} />
                        <label className="block">
                          <span className="mb-2 block text-sm font-bold text-gray-200">Status</span>
                          <select
                            value={editForm.status}
                            onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as MatchRecord['status'] }))}
                            className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none focus:border-green-400"
                          >
                            <option value="upcoming">upcoming</option>
                            <option value="live">live</option>
                            <option value="finished">finished</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </label>
                        <Field label="Winner (1 or 2)" value={editForm.winner} onChange={(value) => setEditForm((current) => ({ ...current, winner: value }))} required={false} />
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm font-bold text-gray-200">Result Summary</span>
                          <input
                            value={editForm.result_summary}
                            onChange={(event) => setEditForm((current) => ({ ...current, result_summary: event.target.value }))}
                            className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none focus:border-green-400"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm font-bold text-gray-200">Creative Direction</span>
                          <textarea
                            value={editForm.creative_direction}
                            onChange={(event) => setEditForm((current) => ({ ...current, creative_direction: event.target.value }))}
                            rows={3}
                            className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none focus:border-green-400"
                          />
                        </label>
                        <div className="flex gap-3 md:col-span-2">
                          <button type="submit" disabled={busyMap[`save-${match.id}`]} className="btn-game disabled:cursor-not-allowed disabled:opacity-60">
                            Save Changes
                          </button>
                          <button type="button" onClick={stopEdit} className="rounded-lg border border-white/20 px-4 py-3 text-gray-300">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="max-w-3xl">
                            <h2 className="text-2xl font-black text-white">{match.team1} vs {match.team2}</h2>
                            <p className="text-sm text-gray-400">
                              {match.sport}
                              {match.league ? ` · ${match.league}` : ''}
                              {' · '}
                              {new Date(match.match_time).toLocaleString()}
                            </p>
                            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                              {match.status}
                              {match.result_summary ? ` · ${match.result_summary}` : ''}
                            </p>
                            <p className="mt-2 text-xs text-yellow-300">Asset status: {match.asset_generation_status || 'pending'}</p>
                            {match.rivalry_tagline ? <p className="mt-1 text-sm text-gray-300">{match.rivalry_tagline}</p> : null}
                          </div>
                          <div className="text-right text-sm text-gray-400">
                            <p>{match.poll_team1_votes + match.poll_team2_votes} votes</p>
                            <p>{match.venue || 'Venue TBD'}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button onClick={() => startEdit(match)} className="rounded-lg border border-blue-400/40 px-4 py-2 text-blue-300">
                            <Edit3 size={16} className="mr-2 inline" /> Edit
                          </button>
                          <button onClick={() => void regenerateAsset(match.id, 'artwork', 'prediction', 'Prediction artwork regenerated')} disabled={busyMap[`regen-${match.id}-artwork-prediction`]} className="rounded-lg border border-purple-400/40 px-4 py-2 text-purple-300 disabled:opacity-60">
                            <ImageIcon size={16} className="mr-2 inline" /> Regenerate Art
                          </button>
                          <button onClick={() => void regenerateAsset(match.id, 'full', 'all', 'Prediction and result cards regenerated')} disabled={busyMap[`regen-${match.id}-full-all`]} className="rounded-lg border border-yellow-400/40 px-4 py-2 text-yellow-300 disabled:opacity-60">
                            <WandSparkles size={16} className="mr-2 inline" /> Regenerate Full Card Set
                          </button>
                          <button onClick={() => void removeMatch(match.id)} disabled={busyMap[`delete-${match.id}`]} className="rounded-lg border border-red-400/40 px-4 py-2 text-red-300 disabled:opacity-60">
                            <Trash2 size={16} className="mr-2 inline" /> Delete
                          </button>
                          {match.prediction_artwork_url ? <a href={match.prediction_artwork_url} target="_blank" className="rounded-lg border border-cyan-400/40 px-4 py-2 text-cyan-300">Preview Prediction Art</a> : null}
                          {match.prediction_card_url ? <a href={match.prediction_card_url} target="_blank" className="rounded-lg border border-fuchsia-400/40 px-4 py-2 text-fuchsia-300">Preview Prediction Card</a> : null}
                          {match.result_card_url ? <a href={match.result_card_url} target="_blank" className="rounded-lg border border-green-400/40 px-4 py-2 text-green-300">Preview Result Card</a> : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-800 p-6 card-glow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-green-400">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required = true }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-gray-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none focus:border-green-400"
      />
    </label>
  )
}
