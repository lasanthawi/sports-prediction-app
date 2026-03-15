import { sql } from '@vercel/postgres'
import { ensureSchema } from './db'
import { upsertFeedMatches } from './matches'
import { FeedMatch, FeedQueueRecord, MatchStatus } from './types'

const DEFAULT_SPORTSDB_API_KEY = '123'
const DEFAULT_SPORTSDB_LEAGUE_IDS = ['4328', '4335', '4387']

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null
}

function normalizeSport(value: string | null | undefined) {
  if (!value) {
    return 'Football'
  }

  if (value.toLowerCase() === 'soccer') {
    return 'Football'
  }

  return value
}

function normalizeStatus(value: string | null | undefined): MatchStatus {
  const normalized = value?.toLowerCase() || ''

  if (normalized.includes('live') || normalized.includes('in play') || normalized.includes('in progress')) {
    return 'live'
  }

  if (normalized.includes('finished') || normalized.includes('ft') || normalized.includes('complete')) {
    return 'finished'
  }

  if (normalized.includes('postponed') || normalized.includes('cancel')) {
    return 'cancelled'
  }

  return 'upcoming'
}

function toIsoTimestamp(dateValue: string | null | undefined, timeValue?: string | null, timestampValue?: string | null) {
  if (timestampValue) {
    return timestampValue.endsWith('Z') ? timestampValue : `${timestampValue}Z`
  }

  if (dateValue) {
    const time = timeValue || '00:00:00'
    return `${dateValue}T${time}Z`
  }

  return new Date().toISOString()
}

function defaultCreativeDirection(team1: string, team2: string, league?: string | null) {
  return `Realistic stadium rivalry poster for ${team1} vs ${team2}${league ? ` in ${league}` : ''}, dramatic split lighting, intense competitive energy, safe top and lower CTA space`
}

function defaultTagline(team1: string, team2: string) {
  return `${team1} vs ${team2}. One crown.`
}

async function fetchTheSportsDbLeague(leagueId: string, apiKey: string) {
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnextleague.php?id=${leagueId}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`TheSportsDB request failed for league ${leagueId} with ${res.status}`)
  }

  const payload = await res.json() as { events?: Array<Record<string, unknown>> }
  return payload.events || []
}

export async function fetchConfiguredFeedMatches() {
  const provider = (process.env.SPORTS_SYNC_PROVIDER || '').trim().toLowerCase()
  const customFeedUrl = process.env.SPORTS_SYNC_FEED_URL?.trim()

  if (provider === 'thesportsdb' || (!customFeedUrl && provider !== 'custom')) {
    return fetchTheSportsDbFeed()
  }

  if (customFeedUrl) {
    const res = await fetch(customFeedUrl, {
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
      team1Captain: item.team1Captain ? String(item.team1Captain) : null,
      team2Captain: item.team2Captain ? String(item.team2Captain) : null,
      team1Palette: item.team1Palette ? String(item.team1Palette) : null,
      team2Palette: item.team2Palette ? String(item.team2Palette) : null,
      team1FlagColors: item.team1FlagColors ? String(item.team1FlagColors) : null,
      team2FlagColors: item.team2FlagColors ? String(item.team2FlagColors) : null,
      creativeDirection: item.creativeDirection ? String(item.creativeDirection) : null,
      rivalryTagline: item.rivalryTagline ? String(item.rivalryTagline) : null,
      artStyle: item.artStyle ? String(item.artStyle) : null,
      status: (item.status as FeedMatch['status']) || 'upcoming',
      winner: typeof item.winner === 'number' ? item.winner : null,
      resultSummary: item.resultSummary ? String(item.resultSummary) : null,
    }))
  }

  return fetchTheSportsDbFeed()
}

export async function fetchTheSportsDbFeed() {
  const apiKey = process.env.SPORTSDB_API_KEY?.trim() || DEFAULT_SPORTSDB_API_KEY
  const configuredLeagueIds = process.env.SPORTSDB_LEAGUE_IDS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const leagueIds = configuredLeagueIds?.length ? configuredLeagueIds : DEFAULT_SPORTSDB_LEAGUE_IDS
  const leagueResponses = await Promise.all(leagueIds.map((leagueId) => fetchTheSportsDbLeague(leagueId, apiKey)))

  return leagueResponses.flatMap((events) =>
    events.map((event): FeedMatch => {
      const team1 = String(event.strHomeTeam || '').trim()
      const team2 = String(event.strAwayTeam || '').trim()
      const league = normalizeText(String(event.strLeague || ''))
      const sport = normalizeSport(String(event.strSport || 'Football'))

      return {
        externalId: String(event.idEvent || `${team1}-${team2}-${event.dateEvent}`),
        source: 'thesportsdb',
        sport,
        league,
        team1,
        team2,
        matchTime: toIsoTimestamp(
          normalizeText(String(event.dateEvent || '')),
          normalizeText(String(event.strTime || '')),
          normalizeText(String(event.strTimestamp || ''))
        ),
        venue: normalizeText(String(event.strVenue || '')),
        team1Logo: normalizeText(String(event.strHomeTeamBadge || '')),
        team2Logo: normalizeText(String(event.strAwayTeamBadge || '')),
        creativeDirection: defaultCreativeDirection(team1, team2, league),
        rivalryTagline: defaultTagline(team1, team2),
        artStyle: 'cinematic realistic sports battle poster',
        status: normalizeStatus(normalizeText(String(event.strStatus || ''))),
        winner: null,
        resultSummary: null,
      }
    })
  )
}

export async function stageFeedMatches(feedMatches: FeedMatch[], provider = 'feed') {
  await ensureSchema()
  const rows: FeedQueueRecord[] = []

  for (const item of feedMatches) {
    const result = await sql<FeedQueueRecord>`
      INSERT INTO feed_sync_items (
        external_id,
        provider,
        source,
        sport,
        league,
        team1,
        team2,
        team1_logo,
        team2_logo,
        team1_captain,
        team2_captain,
        team1_palette,
        team2_palette,
        team1_flag_colors,
        team2_flag_colors,
        creative_direction,
        rivalry_tagline,
        art_style,
        match_time,
        venue,
        status,
        result_summary,
        winner,
        payload,
        last_seen_at,
        sync_status
      )
      VALUES (
        ${item.externalId},
        ${provider},
        ${item.source},
        ${item.sport},
        ${normalizeText(item.league)},
        ${item.team1},
        ${item.team2},
        ${normalizeText(item.team1Logo)},
        ${normalizeText(item.team2Logo)},
        ${normalizeText(item.team1Captain)},
        ${normalizeText(item.team2Captain)},
        ${normalizeText(item.team1Palette)},
        ${normalizeText(item.team2Palette)},
        ${normalizeText(item.team1FlagColors)},
        ${normalizeText(item.team2FlagColors)},
        ${normalizeText(item.creativeDirection)},
        ${normalizeText(item.rivalryTagline)},
        ${normalizeText(item.artStyle)},
        ${item.matchTime},
        ${normalizeText(item.venue)},
        ${item.status || 'upcoming'},
        ${normalizeText(item.resultSummary)},
        ${item.winner ?? null},
        ${JSON.stringify(item)}::jsonb,
        NOW(),
        'queued'
      )
      ON CONFLICT (external_id)
      DO UPDATE SET
        provider = EXCLUDED.provider,
        source = EXCLUDED.source,
        sport = EXCLUDED.sport,
        league = EXCLUDED.league,
        team1 = EXCLUDED.team1,
        team2 = EXCLUDED.team2,
        team1_logo = EXCLUDED.team1_logo,
        team2_logo = EXCLUDED.team2_logo,
        team1_captain = EXCLUDED.team1_captain,
        team2_captain = EXCLUDED.team2_captain,
        team1_palette = EXCLUDED.team1_palette,
        team2_palette = EXCLUDED.team2_palette,
        team1_flag_colors = EXCLUDED.team1_flag_colors,
        team2_flag_colors = EXCLUDED.team2_flag_colors,
        creative_direction = EXCLUDED.creative_direction,
        rivalry_tagline = EXCLUDED.rivalry_tagline,
        art_style = EXCLUDED.art_style,
        match_time = EXCLUDED.match_time,
        venue = EXCLUDED.venue,
        status = EXCLUDED.status,
        result_summary = EXCLUDED.result_summary,
        winner = EXCLUDED.winner,
        payload = EXCLUDED.payload,
        last_seen_at = NOW(),
        sync_status = CASE
          WHEN feed_sync_items.sync_status = 'dismissed' THEN 'dismissed'
          ELSE 'queued'
        END
      RETURNING *
    `

    rows.push(result.rows[0])
  }

  return rows
}

export async function listFeedQueue() {
  await ensureSchema()
  const { rows } = await sql<FeedQueueRecord>`
    SELECT *
    FROM feed_sync_items
    ORDER BY
      CASE sync_status
        WHEN 'queued' THEN 0
        WHEN 'imported' THEN 1
        ELSE 2
      END,
      match_time ASC,
      id DESC
    LIMIT 50
  `

  return rows
}

export async function importFeedQueueItem(id: number) {
  await ensureSchema()
  const { rows } = await sql<FeedQueueRecord>`
    SELECT *
    FROM feed_sync_items
    WHERE id = ${id}
  `

  const item = rows[0]
  if (!item) {
    return null
  }

  const [match] = await upsertFeedMatches([
    {
      externalId: item.external_id,
      source: item.source,
      sport: item.sport,
      league: item.league,
      team1: item.team1,
      team2: item.team2,
      matchTime: item.match_time,
      venue: item.venue,
      team1Logo: item.team1_logo,
      team2Logo: item.team2_logo,
      team1Captain: item.team1_captain,
      team2Captain: item.team2_captain,
      team1Palette: item.team1_palette,
      team2Palette: item.team2_palette,
      team1FlagColors: item.team1_flag_colors,
      team2FlagColors: item.team2_flag_colors,
      creativeDirection: item.creative_direction,
      rivalryTagline: item.rivalry_tagline,
      artStyle: item.art_style,
      status: item.status,
      winner: item.winner,
      resultSummary: item.result_summary,
    },
  ])

  await sql`
    UPDATE feed_sync_items
    SET sync_status = 'imported', imported_match_id = ${match.id}
    WHERE id = ${id}
  `

  return match
}

export async function dismissFeedQueueItem(id: number) {
  await ensureSchema()
  const { rows } = await sql<FeedQueueRecord>`
    UPDATE feed_sync_items
    SET sync_status = 'dismissed'
    WHERE id = ${id}
    RETURNING *
  `

  return rows[0] || null
}
