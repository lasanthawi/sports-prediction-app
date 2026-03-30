'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Edit3, Image as ImageIcon, LogOut, Plus, RefreshCw, Send, Trash2, Trophy, Users, WandSparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import MatchCard from '@/app/components/MatchCard'

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

interface DashboardSummary {
  total_votes_cast: number
  unique_voters: number
  latest_vote_at: string | null
}

interface DashboardUserDetail {
  id: number
  name: string
  email: string
  role: string
  points: number
  predictions_count: number
  correct_predictions: number
  vote_count: number
  accuracy: number | null
  created_at: string
  last_vote_at: string | null
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
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [dashboardUsers, setDashboardUsers] = useState<DashboardUserDetail[]>([])
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
      await Promise.all([fetchMatches(), fetchDashboardInsights()])
    } finally {
      setLoading(false)
    }
  }

  async function fetchMatches() {
    const res = await fetch('/api/matches?includeAll=1', { cache: 'no-store' })
    const data = await res.json()
    setMatches(data.matches || [])
  }

  async function fetchDashboardInsights() {
    const res = await fetch('/api/admin/dashboard', { cache: 'no-store' })
    if (res.status === 401) {
      router.push('/login')
      return
    }

    const data = await res.json()
    setDashboardSummary(data.summary || null)
    setDashboardUsers(data.users || [])
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const totalVotes = matches.reduce((sum, match) => sum + match.poll_team1_votes + match.poll_team2_votes, 0)
  const sortedVoteMatches = [...matches]
    .sort((a, b) => (b.poll_team1_votes + b.poll_team2_votes) - (a.poll_team1_votes + a.poll_team2_votes))
    .slice(0, 6)

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

      setMessage('Match metadata updated and card variants regenerated')
      setEditingId(null)
      if (payload.match) {
        setMatches((current) =>
          current.map((m) => (m.id === id ? { ...m, ...payload.match } : m))
        )
      } else {
        await fetchMatches()
      }
    })
  }

  async function runMatchAction(
    id: number,
    mode: 'artwork' | 'card' | 'full' | 'publish',
    variant: 'prediction' | 'result' | 'all',
    successMessage: string
  ) {
    await runAction(`${mode}-${variant}-${id}`, async () => {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, variant }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Action failed')
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

    const previousMatches = matches
    setMatches((current) => current.filter((m) => m.id !== id))
    if (editingId === id) {
      setEditingId(null)
    }
    setBusyMap((current) => ({ ...current, [`delete-${id}`]: true }))
    try {
      const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to delete match')
      }
      setMessage('Match deleted.')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Action failed')
      setMatches(previousMatches)
    } finally {
      setBusyMap((current) => ({ ...current, [`delete-${id}`]: false }))
    }
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
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-10 w-10 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-black text-green-400">Admin Dashboard</h1>
              <p className="text-gray-400">Match cards here mirror the home page preview and add card-level controls.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="btn-game inline-flex items-center gap-2">
              <Plus size={18} /> Create Match
            </Link>
            <button onClick={() => void Promise.all([fetchMatches(), fetchDashboardInsights()])} className="rounded-lg border border-green-400/40 px-4 py-2 text-green-300">
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
          <StatCard label="Total Votes" value={String(totalVotes)} icon={<WandSparkles className="h-10 w-10 text-pink-400/30" />} />
        </div>

        <section className="mb-8 rounded-2xl border border-white/10 bg-gray-800/80 p-6 card-glow">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-green-300/70">Audience Analytics</p>
              <h2 className="mt-2 text-2xl font-black text-white">Vote summaries and user details</h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">Track where voting activity is concentrated and which accounts are participating most.</p>
            </div>
            <div className="text-right text-sm text-gray-400">
              <p>{dashboardSummary?.unique_voters ?? 0} unique voters</p>
              <p>{dashboardSummary?.latest_vote_at ? `Last vote ${formatDateTime(dashboardSummary.latest_vote_at)}` : 'No votes recorded yet'}</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <InsightCard label="Votes Cast" value={String(dashboardSummary?.total_votes_cast ?? totalVotes)} detail="All recorded selections across matches" />
            <InsightCard label="Users" value={String(dashboardUsers.length)} detail="Accounts available in the system" />
            <InsightCard label="Active Voters" value={String(dashboardUsers.filter((entry) => entry.vote_count > 0).length)} detail="Users who have submitted at least one vote" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Top Match Vote Summaries</h3>
                  <p className="text-sm text-gray-400">Highest-engagement matches ranked by total votes.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-gray-400">
                  {sortedVoteMatches.length} shown
                </span>
              </div>

              <div className="space-y-3">
                {sortedVoteMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-gray-400">No matches available yet.</div>
                ) : (
                  sortedVoteMatches.map((match) => {
                    const team1Votes = match.poll_team1_votes
                    const team2Votes = match.poll_team2_votes
                    const matchVotes = team1Votes + team2Votes
                    const team1Pct = matchVotes > 0 ? Math.round((team1Votes / matchVotes) * 100) : 50
                    const team2Pct = matchVotes > 0 ? Math.round((team2Votes / matchVotes) * 100) : 50

                    return (
                      <div key={`summary-${match.id}`} className="rounded-xl border border-white/10 bg-gray-900/60 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-white">{match.team1} vs {match.team2}</p>
                            <p className="text-xs uppercase tracking-[0.16em] text-gray-500">{match.sport}{match.league ? ` | ${match.league}` : ''}</p>
                          </div>
                          <div className="text-right text-sm text-gray-400">
                            <p>{matchVotes} votes</p>
                            <p>{formatDateTime(match.match_time)}</p>
                          </div>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-gradient-to-r from-green-400 via-yellow-300 to-cyan-400" style={{ width: `${team1Pct}%` }} />
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-gray-300 md:grid-cols-2">
                          <p>{match.team1}: {team1Votes} votes ({team1Pct}%)</p>
                          <p>{match.team2}: {team2Votes} votes ({team2Pct}%)</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">User Details</h3>
                <p className="text-sm text-gray-400">Roles, activity, and performance for every account.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-gray-500">
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Votes</th>
                      <th className="px-3 py-3">Points</th>
                      <th className="px-3 py-3">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-5 text-gray-400">No users found.</td>
                      </tr>
                    ) : (
                      dashboardUsers.map((entry) => (
                        <tr key={entry.id} className="border-b border-white/5 align-top text-gray-200 last:border-b-0">
                          <td className="px-3 py-4">
                            <p className="font-semibold text-white">{entry.name}</p>
                            <p className="text-xs text-gray-400">{entry.email}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Joined {formatDateTime(entry.created_at)}
                              {entry.last_vote_at ? ` | Last vote ${formatDateTime(entry.last_vote_at)}` : ''}
                            </p>
                          </td>
                          <td className="px-3 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.15em] ${entry.role === 'admin' ? 'bg-yellow-400/15 text-yellow-200' : 'bg-cyan-400/15 text-cyan-200'}`}>
                              {entry.role}
                            </span>
                          </td>
                          <td className="px-3 py-4">{entry.vote_count}</td>
                          <td className="px-3 py-4">{entry.points}</td>
                          <td className="px-3 py-4">
                            <p>{entry.accuracy === null ? 'N/A' : `${entry.accuracy}%`}</p>
                            <p className="text-xs text-gray-500">{entry.correct_predictions}/{entry.predictions_count} correct</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          {loading ? (
            <div className="rounded-xl bg-gray-800 p-6">Loading matches...</div>
          ) : matches.length === 0 ? (
            <div className="rounded-xl bg-gray-800 p-6">No matches found.</div>
          ) : (
            matches.map((match) => (
              <div key={match.id} className="rounded-2xl border border-white/10 bg-gray-800/90 p-6 card-glow">
                <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
                  <div className="flex justify-center">
                    <MatchCard match={match} interactive={false} />
                  </div>

                  <div>
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
                      <div className="space-y-5">
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

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <ActionButton onClick={() => startEdit(match)} tone="border-blue-400/40 text-blue-300">
                            <Edit3 size={16} className="mr-2 inline" /> Edit Metadata
                          </ActionButton>
                          <ActionButton onClick={() => void runMatchAction(match.id, 'artwork', 'prediction', 'Prediction artwork regenerated')} disabled={busyMap[`artwork-prediction-${match.id}`]} tone="border-purple-400/40 text-purple-300">
                            <ImageIcon size={16} className="mr-2 inline" /> Regenerate Art
                          </ActionButton>
                          <ActionButton onClick={() => void runMatchAction(match.id, 'full', 'all', 'Prediction and result cards regenerated')} disabled={busyMap[`full-all-${match.id}`]} tone="border-yellow-400/40 text-yellow-300">
                            <WandSparkles size={16} className="mr-2 inline" /> Regenerate Full Card Set
                          </ActionButton>
                          <ActionButton onClick={() => void runMatchAction(match.id, 'publish', 'all', 'Match assets published')} disabled={busyMap[`publish-all-${match.id}`]} tone="border-emerald-400/40 text-emerald-300">
                            <Send size={16} className="mr-2 inline" /> Publish Match Assets
                          </ActionButton>
                          <ActionButton onClick={() => void removeMatch(match.id)} disabled={busyMap[`delete-${match.id}`]} tone="border-red-400/40 text-red-300">
                            <Trash2 size={16} className="mr-2 inline" /> Delete Match
                          </ActionButton>
                          {match.prediction_card_url ? (
                            <a href={match.prediction_card_url} target="_blank" className="rounded-lg border border-fuchsia-400/40 px-4 py-3 text-fuchsia-300">
                              Open Prediction Card
                            </a>
                          ) : null}
                          {match.result_card_url ? (
                            <a href={match.result_card_url} target="_blank" className="rounded-lg border border-green-400/40 px-4 py-3 text-green-300">
                              Open Result Card
                            </a>
                          ) : null}
                          {match.prediction_artwork_url ? (
                            <a href={match.prediction_artwork_url} target="_blank" className="rounded-lg border border-cyan-400/40 px-4 py-3 text-cyan-300">
                              Open Raw Artwork
                            </a>
                          ) : null}
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

function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-green-300">{value}</p>
      <p className="mt-2 text-sm text-gray-400">{detail}</p>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  tone: string
  disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg border px-4 py-3 text-left disabled:opacity-60 ${tone}`}>
      {children}
    </button>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}
