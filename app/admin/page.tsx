'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, Database, PlayCircle, Plus, RefreshCw, Rocket, Trophy } from 'lucide-react'

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
}

export default function AdminPage() {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [formData, setFormData] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [jobState, setJobState] = useState<Record<string, boolean>>({})

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
        body: JSON.stringify(formData),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create match')
      }

      setFormData(initialForm)
      setMessage('Match created successfully')
      await refreshDashboard()
    } catch (error: any) {
      setMessage(error.message || 'Failed to create match')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateMatch(id: number, body: Record<string, unknown>, successMessage: string) {
    setJobState((current) => ({ ...current, [`match-${id}`]: true }))
    setMessage('')

    try {
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
    } catch (error: any) {
      setMessage(error.message || 'Failed to update match')
    } finally {
      setJobState((current) => ({ ...current, [`match-${id}`]: false }))
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-green-400 hover:text-green-300">
              <ArrowLeft size={18} /> Back to Arena
            </Link>
            <div className="flex items-center gap-3">
              <Trophy className="h-10 w-10 text-yellow-400" />
              <div>
                <h1 className="text-4xl font-black text-green-400">Admin Dashboard</h1>
                <p className="text-sm text-gray-400">Create matches, manage results, and run the automation pipeline.</p>
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

        <section className="grid gap-4 md:grid-cols-4">
          <ActionCard
            title="Initialize DB"
            description="Creates the required tables the first time."
            icon={<Database className="h-5 w-5" />}
            onClick={() => void runJob('setup', '/api/admin/setup', 'Database tables are ready')}
            busy={jobState.setup}
          />
          <ActionCard
            title="Sync Feed"
            description="Pulls fixtures and results from SPORTS_SYNC_FEED_URL."
            icon={<RefreshCw className="h-5 w-5" />}
            onClick={() => void runJob('sync', '/api/automation/sync', 'Feed sync completed')}
            busy={jobState.sync}
          />
          <ActionCard
            title="Generate Assets"
            description="Creates SVG promo and result images for each match."
            icon={<PlayCircle className="h-5 w-5" />}
            onClick={() => void runJob('assets', '/api/automation/assets', 'Assets generated')}
            busy={jobState.assets}
          />
          <ActionCard
            title="Publish"
            description="Pushes ready assets to PUBLISH_WEBHOOK_URL when configured."
            icon={<Rocket className="h-5 w-5" />}
            onClick={() => void runJob('publish', '/api/automation/publish', 'Publish job completed')}
            busy={jobState.publish}
          />
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
          <section className="card-glow rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
            <div className="mb-6 flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              <h2 className="text-2xl font-bold">Add Match</h2>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Input
                label="Team 1"
                value={formData.team1}
                onChange={(value) => setFormData((current) => ({ ...current, team1: value }))}
                placeholder="Real Madrid"
                required
              />
              <Input
                label="Team 2"
                value={formData.team2}
                onChange={(value) => setFormData((current) => ({ ...current, team2: value }))}
                placeholder="Barcelona"
                required
              />
              <Input
                label="Sport"
                value={formData.sport}
                onChange={(value) => setFormData((current) => ({ ...current, sport: value }))}
                placeholder="Football"
                required
              />
              <Input
                label="League"
                value={formData.league}
                onChange={(value) => setFormData((current) => ({ ...current, league: value }))}
                placeholder="La Liga"
              />
              <Input
                label="Venue"
                value={formData.venue}
                onChange={(value) => setFormData((current) => ({ ...current, venue: value }))}
                placeholder="Santiago Bernabeu"
              />
              <Input
                label="Match Time"
                value={formData.match_time}
                onChange={(value) => setFormData((current) => ({ ...current, match_time: value }))}
                type="datetime-local"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-game md:col-span-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating...' : 'Create Match'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-6">
            <div className="mb-5 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <h2 className="text-2xl font-bold">Automation Design</h2>
            </div>
            <div className="space-y-4 text-sm text-gray-300">
              <p>The automation loop now has four stages: ingest fixtures and results, upsert matches, generate SVG assets, and publish those assets through a webhook.</p>
              <p>
                Configure <code>SPORTS_SYNC_FEED_URL</code> with a JSON feed that returns an array of matches or an
                object containing a <code>matches</code> array. Each item can include <code>externalId</code>,{' '}
                <code>team1</code>, <code>team2</code>, <code>sport</code>, <code>league</code>, <code>matchTime</code>,{' '}
                <code>status</code>, <code>winner</code>, and <code>resultSummary</code>.
              </p>
              <p>
                Configure <code>PUBLISH_WEBHOOK_URL</code> to send generated assets to your scheduler, CMS, Zapier
                flow, or custom poster. If the webhook is missing, assets stay in a ready-to-publish queue.
              </p>
              <p>
                For hands-off operation on Vercel, schedule three cron calls: <code>/api/automation/sync</code>,{' '}
                <code>/api/automation/assets</code>, and <code>/api/automation/publish</code>.
              </p>
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
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="rounded-xl border border-white/10 bg-gray-900/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {match.team1} vs {match.team2}
                      </h3>
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
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void updateMatch(match.id, { status: 'live' }, 'Match marked live')}
                        disabled={jobState[`match-${match.id}`]}
                        className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300"
                      >
                        Mark Live
                      </button>
                      <button
                        onClick={() =>
                          void updateMatch(
                            match.id,
                            {
                              status: 'finished',
                              winner: match.poll_team1_votes >= match.poll_team2_votes ? 1 : 2,
                              result_summary: `${match.team1} ${match.poll_team1_votes} - ${match.poll_team2_votes} ${match.team2}`,
                            },
                            'Match marked finished'
                          )
                        }
                        disabled={jobState[`match-${match.id}`]}
                        className="rounded-lg border border-green-400/40 px-3 py-2 text-sm text-green-300"
                      >
                        Finish
                      </button>
                      <button
                        onClick={() => void updateMatch(match.id, { status: 'cancelled' }, 'Match cancelled')}
                        disabled={jobState[`match-${match.id}`]}
                        className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-300"
                      >
                        Cancel
                      </button>
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

function ActionCard({
  title,
  description,
  icon,
  onClick,
  busy,
}: {
  title: string
  description: string
  icon: ReactNode
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-2xl border border-green-400/20 bg-gray-800/80 p-5 text-left transition hover:border-green-400/40 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="mb-3 flex items-center gap-2 text-green-400">
        {icon}
        <span className="font-bold">{title}</span>
      </div>
      <p className="text-sm text-gray-400">{busy ? 'Running...' : description}</p>
    </button>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
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
