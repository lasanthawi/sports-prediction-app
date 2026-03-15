import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { refreshDerivedMatchStatuses, upsertFeedMatches } from './matches'
import { AssetRecord, FeedMatch, MatchRecord } from './types'

const DEFAULT_WEBHOOK_TIMEOUT_MS = 10000

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, 'https://') ||
    process.env.VERCEL_URL?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  )
}

function getCaption(match: MatchRecord, assetType: string) {
  if (assetType === 'result') {
    return `${match.team1} vs ${match.team2} is final. ${match.result_summary || 'Result is in.'}`
  }

  return `${match.team1} vs ${match.team2} starts at ${new Date(match.match_time).toLocaleString()}. Cast your prediction now.`
}

function escapeXml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildMatchSvg(match: MatchRecord, assetType: 'upcoming' | 'result') {
  const subtitle =
    assetType === 'result'
      ? match.result_summary || 'Full-time result'
      : `${match.sport}${match.league ? ` · ${match.league}` : ''}`
  const footer =
    assetType === 'result'
      ? `Community vote ${match.poll_team1_votes} - ${match.poll_team2_votes}`
      : new Date(match.match_time).toLocaleString()
  const accent = assetType === 'result' ? '#f472b6' : '#4ade80'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#09090f"/>
  <rect x="30" y="30" width="1140" height="570" rx="32" fill="url(#bg)" stroke="${accent}" stroke-width="2"/>
  <text x="90" y="120" fill="${accent}" font-size="34" font-family="Arial, sans-serif" font-weight="700">Prediction Arena</text>
  <text x="90" y="190" fill="#ffffff" font-size="58" font-family="Arial, sans-serif" font-weight="700">${escapeXml(match.team1)}</text>
  <text x="90" y="280" fill="#fbbf24" font-size="38" font-family="Arial, sans-serif" font-weight="700">VS</text>
  <text x="90" y="370" fill="#ffffff" font-size="58" font-family="Arial, sans-serif" font-weight="700">${escapeXml(match.team2)}</text>
  <text x="90" y="460" fill="#d1d5db" font-size="28" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>
  <text x="90" y="520" fill="#9ca3af" font-size="24" font-family="Arial, sans-serif">${escapeXml(footer)}</text>
  <text x="90" y="565" fill="#9ca3af" font-size="20" font-family="Arial, sans-serif">Automated asset: ${assetType}</text>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1f1147"/>
    </linearGradient>
  </defs>
</svg>`
}

export async function logAutomationRun(jobName: string, status: string, summary: string, payload: unknown) {
  await ensureSchema()
  const { rows } = await sql`
    INSERT INTO automation_runs (job_name, status, summary, payload, finished_at)
    VALUES (${jobName}, ${status}, ${summary}, ${JSON.stringify(payload)}::jsonb, NOW())
    RETURNING *
  `

  return rows[0]
}

export async function fetchFeedMatches() {
  const feedUrl = process.env.SPORTS_SYNC_FEED_URL
  if (!feedUrl) {
    return []
  }

  const res = await fetch(feedUrl, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Feed request failed with ${res.status}`)
  }

  const payload = await res.json()
  const rawItems = Array.isArray(payload) ? payload : payload.matches

  if (!Array.isArray(rawItems)) {
    throw new Error('Feed response must be an array or an object with a matches array')
  }

  return rawItems.map((item: Record<string, unknown>, index: number): FeedMatch => ({
    externalId: String(item.externalId || item.id || `feed-${index}`),
    source: String(item.source || 'feed'),
    sport: String(item.sport || 'Football'),
    league: item.league ? String(item.league) : null,
    team1: String(item.team1 || item.homeTeam || ''),
    team2: String(item.team2 || item.awayTeam || ''),
    matchTime: String(item.matchTime || item.match_time || item.startsAt || ''),
    venue: item.venue ? String(item.venue) : null,
    team1Logo: item.team1Logo ? String(item.team1Logo) : null,
    team2Logo: item.team2Logo ? String(item.team2Logo) : null,
    status: (item.status as FeedMatch['status']) || 'upcoming',
    winner: typeof item.winner === 'number' ? item.winner : null,
    resultSummary: item.resultSummary ? String(item.resultSummary) : null,
  }))
}

export async function syncMatchesFromFeed() {
  await ensureSchema()
  const feedMatches = await fetchFeedMatches()

  if (!feedMatches.length) {
    await logAutomationRun('sync_matches', 'skipped', 'No feed configured or feed returned no matches', {
      count: 0,
    })

    return {
      count: 0,
      matches: [] as MatchRecord[],
      skipped: true,
    }
  }

  const matches = await upsertFeedMatches(feedMatches)
  await refreshDerivedMatchStatuses()
  await generateAssetsForMatches(matches)
  await logAutomationRun('sync_matches', 'success', `Synced ${matches.length} matches from feed`, {
    count: matches.length,
  })

  return {
    count: matches.length,
    matches,
    skipped: false,
  }
}

export async function generateAssetsForMatches(matches: MatchRecord[]) {
  await ensureSchema()
  const generated: AssetRecord[] = []

  for (const match of matches) {
    const assetType = match.status === 'finished' ? 'result' : 'upcoming'
    const title = `${match.team1} vs ${match.team2} ${assetType === 'result' ? 'Result' : 'Preview'}`
    const content = buildMatchSvg(match, assetType)
    const caption = getCaption(match, assetType)

    const { rows } = await sql<AssetRecord>`
      INSERT INTO generated_assets (
        match_id,
        asset_type,
        format,
        title,
        content,
        publication_caption,
        published_status
      )
      VALUES (
        ${match.id},
        ${assetType},
        'svg',
        ${title},
        ${content},
        ${caption},
        'ready'
      )
      ON CONFLICT (match_id, asset_type, format)
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        publication_caption = EXCLUDED.publication_caption,
        published_status = CASE
          WHEN generated_assets.published_status = 'published' THEN generated_assets.published_status
          ELSE 'ready'
        END
      RETURNING *
    `

    generated.push(rows[0])
  }

  await logAutomationRun('generate_assets', 'success', `Generated ${generated.length} assets`, {
    count: generated.length,
  })

  return generated
}

export async function publishReadyAssets() {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE published_status = 'ready'
    ORDER BY created_at ASC
    LIMIT 20
  `

  const webhookUrl = process.env.PUBLISH_WEBHOOK_URL
  if (!webhookUrl) {
    await logAutomationRun('publish_assets', 'skipped', 'PUBLISH_WEBHOOK_URL is not configured', {
      count: rows.length,
    })

    return {
      published: 0,
      queued: rows.length,
      mode: 'queue-only',
      assets: rows,
    }
  }

  let published = 0

  for (const asset of rows) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: asset.title,
        caption: asset.publication_caption,
        format: asset.format,
        content: asset.content,
        assetUrl: `${getBaseUrl()}/api/assets/${asset.id}`,
      }),
      signal: AbortSignal.timeout(DEFAULT_WEBHOOK_TIMEOUT_MS),
    })

    const nextStatus = response.ok ? 'published' : 'failed'
    const destination = response.headers.get('x-published-to') || webhookUrl

    await sql`
      UPDATE generated_assets
      SET
        published_status = ${nextStatus},
        published_to = ${destination},
        published_at = CASE WHEN ${response.ok} THEN NOW() ELSE published_at END
      WHERE id = ${asset.id}
    `

    if (response.ok) {
      published += 1
    }
  }

  await logAutomationRun('publish_assets', 'success', `Processed ${rows.length} assets`, {
    published,
    queued: rows.length,
  })

  return {
    published,
    queued: rows.length,
    mode: 'webhook',
    assets: rows,
  }
}

export async function runAutomationPipeline() {
  await ensureSchema()
  const sync = await syncMatchesFromFeed()
  const assets = sync.matches.length ? await generateAssetsForMatches(sync.matches) : []
  const publish = await publishReadyAssets()

  await logAutomationRun('run_pipeline', 'success', 'Ran sync, asset generation, and publish pipeline', {
    synced: sync.count,
    generated: assets.length,
    published: publish.published,
  })

  return {
    sync,
    assets: { count: assets.length },
    publish,
  }
}

export async function listAutomationRuns(limit = 10) {
  await ensureSchema()
  const { rows } = await sql`
    SELECT *
    FROM automation_runs
    ORDER BY started_at DESC, id DESC
    LIMIT ${limit}
  `

  return rows
}

export async function getAsset(id: number) {
  await ensureSchema()
  const { rows } = await sql<AssetRecord>`
    SELECT *
    FROM generated_assets
    WHERE id = ${id}
  `

  return rows[0] || null
}
