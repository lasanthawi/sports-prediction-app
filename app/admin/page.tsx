'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, Database, Edit3, Image as ImageIcon, PlayCircle, Plus, RefreshCw, Rocket, Send, Trash2, Trophy, WandSparkles } from 'lucide-react'
import MatchCard from '@/app/components/MatchCard'

type MatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled'

interface MatchRecord {
  id: number
  team1: string
  team2: string
  sport: string
  league: string | null
  match_time: string
  venue: string | null
  status: MatchStatus
  result_summary: string | null
  winner: number | null
  poll_team1_votes: number
  poll_team2_votes: number
  source: string
  card_asset_url?: string | null
  prediction_artwork_url?: string | null
  prediction_card_url?: string | null
  result_artwork_url?: string | null
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

interface AutomationRun {
  id: number
  job_name: string
  status: string
  summary: string | null
  started_at: string
}

const initialForm = {
  team1: '',
  team2: '',
  sport: 'Football',
  league: '',
  venue: '',
  match_time: '',
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

const emptyEditForm = {
  team1: '',
  team2: '',
  sport: '',
  league: '',
  venue: '',
  match_time: '',
  status: 'upcoming' as MatchStatus,
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

export default function AdminPage() {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [formData, setFormData] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [jobState, setJobState] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyEditForm)

  useEffect(() => {
    void refreshDashboard()
  }, [])

  async function refreshDashboard() {
    setLoading(true)
    try {
      const [matchesRes, runsRes] = await Promise.all([
        fetch('/api/matches?includeAll=1', { cache: 'no-store' }),
        fetch('/api/automation/runs', { cache: 'no-store' }),
      ])

      const matchesPayload = await matchesRes.json()
      const runsPayload = await runsRes.json()
      setMatches(matchesPayload.matches || [])
      setRuns(runsPayload.runs || [])
    } catch (error) {
      console.error(error)
      setMessage('Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function runJob(key: string, url: string, successMessage: string) {
    setJobState((current) => ({ ...current, [key]: true }))
    setMessage('')

    try {
      const res = await fetch(url, { method: 'POST' })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || `Request failed for ${key}`)
      }

      setMessage(successMessage)
      await refreshDashboard()
    } catch (error: any) {
      setMessage(error.message || 'Job failed')
    } finally {
      setJobState((current) => ({ ...current, [key]: false }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          match_time: new Date(formData.match_time).toISOString(),
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create match')
      }

      setFormData(initialForm)
      setMessage('Match created and asset generation started')
      await refreshDashboard()
    } catch (error: any) {
      setMessage(error.message || 'Failed to create match')
    } finally {
      setSubmitting(false)
    }
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

      setMessage('Match updated and assets regenerated')
      setEditingId(null)
      await refreshDashboard()
    })
  }

  async function updateMatch(id: number, body: Record<string, unknown>, successMessage: string) {
    await runAction(`match-${id}`, async () => {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update match')
      }

      setMessage(successMessage)
      await refreshDashboard()
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
      await refreshDashboard()
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

      if (editingId === id) {
        setEditingId(null)
      }
      setMessage('Match deleted')
      await refreshDashboard()
    })
  }

  async function runAction(key: string, task: () => Promise<void>) {
    setJobState((current) => ({ ...current, [key]: true }))
    setMessage('')
    try {
      await task()
    } catch (error: any) {
      setMessage(error.message || 'Action failed')
    } finally {
      setJobState((current) => ({ ...current, [key]: false }))
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto flex max-w-[1450px] flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-green-400 hover:text-green-300">
              <ArrowLeft size={18} /> Back to Arena
            </Link>
            <div className="flex items-center gap-3">
              <Trophy className="h-10 w-10 text-yellow-400" />
              <div>
                <h1 className="text-4xl font-black text-green-400">Admin Studio</h1>
                <p className="text-sm text-gray-400">Create, edit, generate, and publish premium match cards from one place.</p>
              </div>
            </div>
          </div>

          <button onClick={() => void refreshDashboard()} className="btn-game inline-flex items-center gap-2">
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        {message ? (
          <div className="rounded-xl border border-green-400/20 bg-gray-900/70 px-4 py-3 text-sm text-gray-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-5">
          <ActionCard title="Initialize DB" description="Creates and migrates required tables." icon={<Database className="h-5 w-5" />} onClick={() => void runJob('setup', '/api/admin/setup', 'Database tables are ready')} busy={jobState.setup} />
          <ActionCard title="Sync Feed" description="Pull fixtures and visual metadata from SPORTS_SYNC_FEED_URL." icon={<RefreshCw className="h-5 w-5" />} onClick={() => void runJob('sync', '/api/automation/sync', 'Feed sync completed')} busy={jobState.sync} />
          <ActionCard title="Generate Assets" description="Generate artwork plus prediction/result card variants." icon={<PlayCircle className="h-5 w-5" />} onClick={() => void runJob('assets', '/api/automation/assets', 'Assets generated')} busy={jobState.assets} />
          <ActionCard title="Run Pipeline" description="Sync, generate, and publish rendered cards in one flow." icon={<Rocket className="h-5 w-5" />} onClick={() => void runJob('pipeline', '/api/automation/run', 'Automation pipeline completed')} busy={jobState.pipeline} />
          <ActionCard title="Publish" description="Send final rendered cards to your webhook." icon={<Rocket className="h-5 w-5" />} onClick={() => void runJob('publish', '/api/automation/publish', 'Publish job completed')} busy={jobState.publish} />
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
          <section className="card-glow rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
            <div className="mb-6 flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              <h2 className="text-2xl font-bold">Add Match</h2>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Input label="Team 1" value={formData.team1} onChange={(value) => setFormData((current) => ({ ...current, team1: value }))} placeholder="Real Madrid" required />
              <Input label="Team 2" value={formData.team2} onChange={(value) => setFormData((current) => ({ ...current, team2: value }))} placeholder="Barcelona" required />
              <Input label="Sport" value={formData.sport} onChange={(value) => setFormData((current) => ({ ...current, sport: value }))} placeholder="Football" required />
              <Input label="League" value={formData.league} onChange={(value) => setFormData((current) => ({ ...current, league: value }))} placeholder="La Liga" />
              <Input label="Venue" value={formData.venue} onChange={(value) => setFormData((current) => ({ ...current, venue: value }))} placeholder="Santiago Bernabeu" />
              <Input label="Match Time" value={formData.match_time} onChange={(value) => setFormData((current) => ({ ...current, match_time: value }))} type="datetime-local" required />
              <Input label="Team 1 Captain" value={formData.team1_captain} onChange={(value) => setFormData((current) => ({ ...current, team1_captain: value }))} placeholder="Vinicius Jr." />
              <Input label="Team 2 Captain" value={formData.team2_captain} onChange={(value) => setFormData((current) => ({ ...current, team2_captain: value }))} placeholder="Pedri" />
              <Input label="Team 1 Palette" value={formData.team1_palette} onChange={(value) => setFormData((current) => ({ ...current, team1_palette: value }))} placeholder="#FFFFFF,#D4AF37,#1A1A1A" />
              <Input label="Team 2 Palette" value={formData.team2_palette} onChange={(value) => setFormData((current) => ({ ...current, team2_palette: value }))} placeholder="#A50044,#004D98,#FDB913" />
              <Input label="Team 1 Flag Colors" value={formData.team1_flag_colors} onChange={(value) => setFormData((current) => ({ ...current, team1_flag_colors: value }))} placeholder="#AA151B,#F1BF00" />
              <Input label="Team 2 Flag Colors" value={formData.team2_flag_colors} onChange={(value) => setFormData((current) => ({ ...current, team2_flag_colors: value }))} placeholder="#AA151B,#F1BF00" />
              <Input label="Rivalry Tagline" value={formData.rivalry_tagline} onChange={(value) => setFormData((current) => ({ ...current, rivalry_tagline: value }))} placeholder="One stadium. All the glory." />
              <Input label="Art Style" value={formData.art_style} onChange={(value) => setFormData((current) => ({ ...current, art_style: value }))} placeholder="cinematic premium sports key art" />
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-gray-200">Creative Direction</span>
                <textarea
                  value={formData.creative_direction}
                  onChange={(event) => setFormData((current) => ({ ...current, creative_direction: event.target.value }))}
                  placeholder="Captain-focused composition, foil-lit stadium energy, safe negative space for the top banner and CTA zone"
                  rows={3}
                  className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none transition focus:border-green-400"
                />
              </label>
              <button type="submit" disabled={submitting} className="btn-game md:col-span-2 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Creating...' : 'Create Match'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
            <div className="mb-5 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <h2 className="text-2xl font-bold">Feed Setup</h2>
            </div>
            <div className="space-y-4 text-sm text-gray-300">
              <p>Set <code>SPORTS_SYNC_FEED_URL</code> to your deployed sample endpoint first:</p>
              <p className="rounded-lg bg-gray-900 px-3 py-2 font-mono text-xs text-green-300">https://your-app.vercel.app/api/feed/sample</p>
              <p>Premium feed fields should include captain names, palettes, flag colors, creative direction, rivalry tagline, and art style so Gemini can compose a better portrait background.</p>
              <p>The automation chain now supports sync, artwork generation, final card composition for prediction/result variants, and webhook publishing of the rendered cards.</p>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Matches</h2>
            <span className="text-sm text-gray-400">{matches.length} total</span>
          </div>

          {loading ? (
            <p className="text-gray-400">Loading matches...</p>
          ) : matches.length === 0 ? (
            <p className="text-gray-400">No matches yet. Initialize the DB, then add one manually or sync from a feed.</p>
          ) : (
            <div className="space-y-6">
              {matches.map((match) => (
                <div key={match.id} className="rounded-2xl border border-white/10 bg-gray-900/70 p-5">
                  <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
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
                              onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as MatchStatus }))}
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
                            <button type="submit" disabled={jobState[`save-${match.id}`]} className="btn-game disabled:cursor-not-allowed disabled:opacity-60">
                              Save Changes
                            </button>
                            <button type="button" onClick={stopEdit} className="rounded-lg border border-white/20 px-4 py-3 text-gray-300">
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-3xl">
                              <h3 className="text-xl font-black text-white">{match.team1} vs {match.team2}</h3>
                              <p className="text-sm text-gray-400">
                                {match.sport}
                                {match.league ? ` · ${match.league}` : ''}
                                {' · '}
                                {new Date(match.match_time).toLocaleString()}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                                {match.source} · {match.status}
                                {match.result_summary ? ` · ${match.result_summary}` : ''}
                              </p>
                              <p className="mt-2 text-xs text-yellow-300">Asset status: {match.asset_generation_status || 'pending'}</p>
                              {match.rivalry_tagline ? <p className="mt-2 text-sm text-gray-300">{match.rivalry_tagline}</p> : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => void updateMatch(match.id, { status: 'live' }, 'Match marked live')} disabled={jobState[`match-${match.id}`]} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300">Mark Live</button>
                              <button onClick={() => void updateMatch(match.id, { status: 'finished', winner: match.poll_team1_votes >= match.poll_team2_votes ? 1 : 2, result_summary: `${match.team1} ${match.poll_team1_votes} - ${match.poll_team2_votes} ${match.team2}` }, 'Match marked finished')} disabled={jobState[`match-${match.id}`]} className="rounded-lg border border-green-400/40 px-3 py-2 text-sm text-green-300">Finish</button>
                              <button onClick={() => void updateMatch(match.id, { status: 'cancelled' }, 'Match cancelled')} disabled={jobState[`match-${match.id}`]} className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300">Cancel</button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <ActionButton onClick={() => startEdit(match)} tone="border-blue-400/40 text-blue-300">
                              <Edit3 size={16} className="mr-2 inline" /> Edit Match
                            </ActionButton>
                            <ActionButton onClick={() => void runMatchAction(match.id, 'artwork', 'prediction', 'Individual artwork generation started')} disabled={jobState[`artwork-prediction-${match.id}`]} tone="border-purple-400/40 text-purple-300">
                              <ImageIcon size={16} className="mr-2 inline" /> Generate Image
                            </ActionButton>
                            <ActionButton onClick={() => void runMatchAction(match.id, 'full', 'all', 'Prediction and result cards regenerated')} disabled={jobState[`full-all-${match.id}`]} tone="border-yellow-400/40 text-yellow-300">
                              <WandSparkles size={16} className="mr-2 inline" /> Generate Full Card Set
                            </ActionButton>
                            <ActionButton onClick={() => void runMatchAction(match.id, 'publish', 'all', 'Match assets published')} disabled={jobState[`publish-all-${match.id}`]} tone="border-emerald-400/40 text-emerald-300">
                              <Send size={16} className="mr-2 inline" /> Publish
                            </ActionButton>
                            <ActionButton onClick={() => void removeMatch(match.id)} disabled={jobState[`delete-${match.id}`]} tone="border-red-400/40 text-red-300">
                              <Trash2 size={16} className="mr-2 inline" /> Delete
                            </ActionButton>
                            {match.prediction_card_url ? (
                              <a href={match.prediction_card_url} target="_blank" className="rounded-lg border border-fuchsia-400/40 px-4 py-3 text-fuchsia-300">
                                Open Prediction Card
                              </a>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Recent Automation Runs</h2>
            <span className="text-sm text-gray-400">{runs.length} shown</span>
          </div>

          {runs.length === 0 ? (
            <p className="text-gray-400">No automation runs yet.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-white/10 bg-gray-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{run.job_name}</p>
                      <p className="text-sm text-gray-400">{run.summary || 'No summary provided'}</p>
                    </div>
                    <div className="text-right text-sm text-gray-400">
                      <p className="uppercase tracking-wide text-green-300">{run.status}</p>
                      <p>{new Date(run.started_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ActionCard({ title, description, icon, onClick, busy }: { title: string; description: string; icon: ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-5 text-left transition hover:border-green-400/40 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
      <div className="mb-3 flex items-center gap-2 text-green-400">
        {icon}
        <span className="font-bold">{title}</span>
      </div>
      <p className="text-sm text-gray-400">{busy ? 'Running...' : description}</p>
    </button>
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

function Input({ label, value, onChange, placeholder, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-gray-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-green-400/30 bg-gray-900 px-4 py-3 outline-none transition focus:border-green-400"
      />
    </label>
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
